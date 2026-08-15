"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { AuthUser } from "@/modules/auth/lib/types";
import { getBrowserClient } from "@/shared/db/browser-client";
import { emailDomain, isSameEmail, suggestEmailCorrection } from "@/shared/lib/email";
import { checkMailDomain } from "@/shared/integrations/dns/mail-domain";
import { evaluatePassword } from "@/shared/lib/password-policy";
import { verifyPassword } from "@/modules/auth/lib/verify-password";
import { postUpload } from "@/shared/integrations/storage/upload-client";

export type ToastData = { title: string; description: string; type: "success" | "error" };

// `id` is assigned here rather than by callers, who have no reason to care: it
// exists so the rendered Toast can be re-keyed per message. Without it a second
// message reuses the mounted instance, whose dismissal timer is still counting
// down for the first, and disappears early.
export type ActiveToast = ToastData & { id: number };

// Matches the provider's own minimum gap between messages, so the countdown
// runs out at about the moment a second send would be accepted.
const RESEND_COOLDOWN_SECONDS = 60;

export function useAccountSettings() {
  const { user: currentUser, updateUser } = useSession();
  const supabase = getBrowserClient();

  const [toast, setToast] = useState<ActiveToast | null>(null);
  // Shared with the speaker profile hook so every section toasts in one place.
  const notify = useCallback((data: ToastData) => setToast((prev) => ({ ...data, id: (prev?.id ?? 0) + 1 })), []);
  // Stable, so an unrelated re-render does not restart Toast's dismissal effect
  // — it is keyed on `onClose` — and leave the message on screen indefinitely.
  const dismissToast = useCallback(() => setToast(null), []);

  // The page renders before the session resolves, so the field cannot simply be
  // seeded once at mount — it would stay empty and Save would then write that
  // blank over a real name. Adopt the session's name whenever it actually
  // changes, which leaves an edit in progress untouched on unrelated renders.
  const sessionName = currentUser?.full_name ?? "";
  const [name, setName] = useState(sessionName);
  const [lastSessionName, setLastSessionName] = useState(sessionName);
  const [savingName, setSavingName] = useState(false);

  if (sessionName !== lastSessionName) {
    setLastSessionName(sessionName);
    setName(sessionName);
  }

  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // One timeout per remaining second rather than a repeating interval: it
  // cancels itself on unmount and cannot outlive the countdown it belongs to.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // A rejected password belongs to the field that was rejected, not to a corner
  // of the screen that times out after three seconds. Held per field so each
  // one can be labelled invalid and described by its own message.
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editCurrentPassword = useCallback((value: string) => {
    setCurrentPassword(value);
    setCurrentPasswordError(null);
  }, []);

  const editNewPassword = useCallback((value: string) => {
    setNewPassword(value);
    setNewPasswordError(null);
  }, []);

  const [uploading, setUploading] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const fullName = name.trim();
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) throw new Error("PATCH /api/auth/me failed");

      // The route echoes the stored row, so the session is refreshed from what
      // was actually written rather than from what we hoped to write. This is
      // what repaints the navbar, which renders the name off the session.
      const saved: Partial<AuthUser> = await res.json();
      const persisted = saved.full_name ?? fullName;
      updateUser({ full_name: persisted });
      setName(persisted);

      notify({ title: "Profile updated", description: "Your name has been saved.", type: "success" });
    } catch {
      notify({ title: "Error", description: "Failed to update profile.", type: "error" });
    } finally {
      setSavingName(false);
    }
  }

  /** Asks Supabase to mail the confirmation link, and starts the resend clock. */
  async function sendVerification(email: string): Promise<boolean> {
    const { error: authError } = await supabase.auth.updateUser({ email });
    if (authError) {
      notify({ title: "Error", description: authError.message, type: "error" });
      return false;
    }
    setResendIn(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  /**
   * A link that never arrived is the only signal a wrong address gives, so the
   * sent state has to offer a way forward. Sending again is rate limited at the
   * provider, and the countdown says so rather than letting the press fail.
   */
  async function resendVerification() {
    if (resendIn > 0 || savingEmail) return;

    setSavingEmail(true);
    if (await sendVerification(newEmail.trim())) {
      notify({ title: "Link sent again", description: `Sent to ${newEmail.trim()}.`, type: "success" });
    }
    setSavingEmail(false);
  }

  /** Returns to the form with the address still in it, so a typo is one edit away. */
  function useDifferentEmail() {
    setEmailSent(false);
    setResendIn(0);
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();

    // Caught before the request rather than after: asking Supabase to move the
    // address to the one it already holds spends a slot of the per-address
    // rate limit that a real change would need, and answers by mailing a
    // confirmation link to the inbox the user is already reading.
    if (isSameEmail(email, currentUser?.email)) {
      notify({ title: "Error", description: "That is already your email address.", type: "error" });
      return;
    }

    setSavingEmail(true);

    // A mistyped domain is the one failure worth catching before sending,
    // because its confirmation link goes nowhere and the account is left
    // waiting on a message that cannot arrive. An inconclusive lookup lets the
    // address through: the confirmation is what actually proves it works.
    const domain = emailDomain(email);
    if (domain && (await checkMailDomain(domain)) === "no-mail-server") {
      const suggestion = suggestEmailCorrection(email);
      notify({
        title: "Check the address",
        description: suggestion
          ? `We could not find a mail server for ${domain}. Did you mean ${suggestion}?`
          : `We could not find a mail server for ${domain}. Check the spelling.`,
        type: "error",
      });
      setSavingEmail(false);
      return;
    }

    if (!(await sendVerification(email))) {
      setSavingEmail(false);
      return;
    }

    // Nothing is written here on purpose. The address is a claim until the link
    // in the message is opened; the app row is caught up at that point, by the
    // callback route. Writing it now would put an unverified address on every
    // surface that reads the session, and leave it there for good if the link
    // were never opened.
    setEmailSent(true);
    setSavingEmail(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPasswordError(null);
    setNewPasswordError(null);

    // Named before the request, because the provider answers a rejected
    // password with one generic message for every rule it could have broken.
    const verdict = evaluatePassword(newPassword, {
      email: currentUser?.email,
      fullName: currentUser?.full_name,
    });
    if (!verdict.ok) {
      setNewPasswordError(verdict.problem!);
      return;
    }

    setSavingPassword(true);

    // The field asking for it was decorative until now: the provider changes a
    // password on the strength of the session alone, so an open laptop or a
    // stolen token was enough to take an account over, and the owner would find
    // themselves locked out of it. Proving the current password is what makes
    // that a real gate. Checked after the free local rules and before anything
    // is written, so a weak new password costs no round trip and a wrong
    // current one changes nothing.
    if (!currentUser?.email || !(await verifyPassword(currentUser.email, currentPassword))) {
      setCurrentPasswordError("That is not your current password.");
      setSavingPassword(false);
      return;
    }

    // The provider only ever rejects this call over the new password itself —
    // too weak for its own rules, or identical to the one being replaced — so
    // its message belongs on that field rather than in a toast.
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      setNewPasswordError(authError.message);
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    notify({ title: "Password updated", description: "Your password has been changed.", type: "success" });
    setSavingPassword(false);
  }

  async function changeProfilePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await postUpload("profile_images", "/api/upload/profile-image", file);

      if (!result.ok) {
        notify({ title: "Upload failed", description: result.error, type: "error" });
        return;
      }

      // The upload route has already written this URL to the user row, so the
      // session is only being caught up to it — that is what repaints both the
      // preview beside this button and the navbar avatar.
      updateUser({ profile_image_url: result.url });
      notify({ title: "Photo updated", description: "Your profile photo has been changed.", type: "success" });
    } finally {
      setUploading(false);
    }
  }

  return {
    toast,
    dismissToast,
    notify,
    currentUser,
    name,
    setName,
    savingName,
    saveName,
    newEmail,
    setNewEmail,
    emailSent,
    savingEmail,
    changeEmail,
    resendIn,
    resendVerification,
    useDifferentEmail,
    currentPassword,
    setCurrentPassword: editCurrentPassword,
    currentPasswordError,
    newPassword,
    setNewPassword: editNewPassword,
    newPasswordError,
    savingPassword,
    changePassword,
    uploading,
    changeProfilePhoto,
  };
}
