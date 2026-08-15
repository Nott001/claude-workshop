"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { AuthUser } from "@/modules/auth/lib/types";
import { ROLES } from "@/shared/lib/roles";
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
  const [savedName, setSavedName] = useState(sessionName);
  const [nameError, setNameError] = useState<string | null>(null);

  if (sessionName !== lastSessionName) {
    setLastSessionName(sessionName);
    setName(sessionName);
    setSavedName(sessionName);
  }

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editName = useCallback((value: string) => {
    setName(value);
    setNameError(null);
  }, []);

  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editEmail = useCallback((value: string) => {
    setNewEmail(value);
    setEmailError(null);
  }, []);

  // One timeout per remaining second rather than a repeating interval: it
  // cancels itself on unmount and cannot outlive the countdown it belongs to.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // A rejected password belongs to the field that was rejected, not to a corner
  // of the screen that times out after three seconds. Held per field so each
  // one can be labelled invalid and described by its own message.
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);

  // Full-form submission state: the unified form (sheet 04) paints one button
  // off this, while the per-section flags above keep the current cards working.
  const [saving, setSaving] = useState(false);

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
  const [deleting, setDeleting] = useState(false);

  // The speaker block lives in the same form and saves with the same button, so
  // its state stays in this hook rather than a sibling one (the old
  // useSpeakerProfile is gone). `speakerProfileId` doubles as the loading seam:
  // it stays undefined until the profile fetch has answered.
  const isSpeaker = currentUser?.role === ROLES.SPEAKER;
  const [speakerProfileId, setSpeakerProfileId] = useState<number | null | undefined>(undefined);
  const [designation, setDesignation] = useState("");
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [savedDesignation, setSavedDesignation] = useState("");
  const [savedBio, setSavedBio] = useState("");
  const [savedLinkedinUrl, setSavedLinkedinUrl] = useState("");
  const [savedTwitterUrl, setSavedTwitterUrl] = useState("");
  const [savedGithubUrl, setSavedGithubUrl] = useState("");
  const [savedWebsiteUrl, setSavedWebsiteUrl] = useState("");
  const [speakerFieldErrors, setSpeakerFieldErrors] = useState<
    Partial<Record<"linkedin" | "twitter" | "github" | "website", string>>
  >({});

  useEffect(() => {
    if (!isSpeaker) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSpeakerProfileId(data.speaker_profile_id ?? null);
        // Seed the live fields and the saved originals together, so the first
        // render of the merged form shows what is stored _and_ treats it as
        // clean — the "save" button must not light up for nothing.
        const designation = data.designation ?? "";
        const bio = data.bio ?? "";
        const linkedin = data.linkedin_url ?? "";
        const twitter = data.twitter_url ?? "";
        const github = data.github_url ?? "";
        const website = data.website_url ?? "";
        setDesignation(designation);
        setBio(bio);
        setLinkedinUrl(linkedin);
        setTwitterUrl(twitter);
        setGithubUrl(github);
        setWebsiteUrl(website);
        setSavedDesignation(designation);
        setSavedBio(bio);
        setSavedLinkedinUrl(linkedin);
        setSavedTwitterUrl(twitter);
        setSavedGithubUrl(github);
        setSavedWebsiteUrl(website);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSpeaker]);

  const editSpeakerDesignation = useCallback((value: string) => setDesignation(value), []);
  const editSpeakerBio = useCallback((value: string) => setBio(value), []);
  // Editing a field is the retry for its own rejection, so the message clears
  // with the keystroke rather than lingering under input it no longer describes.
  const editSpeakerLinkedin = useCallback((value: string) => {
    setLinkedinUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, linkedin: undefined }));
  }, []);
  const editSpeakerTwitter = useCallback((value: string) => {
    setTwitterUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, twitter: undefined }));
  }, []);
  const editSpeakerGithub = useCallback((value: string) => {
    setGithubUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, github: undefined }));
  }, []);
  const editSpeakerWebsite = useCallback((value: string) => {
    setWebsiteUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, website: undefined }));
  }, []);

  function validateFullName(fullName: string): string | null {
    if (fullName.trim() === "") return "Name is required.";
    return null;
  }

  async function persistProfileChange() {
    try {
      // One PATCH for the whole profile — name and speaker fields together, so
      // the merged form's Save Changes writes everything it owns in a single
      // round trip instead of one call per section.
      const body: Record<string, unknown> = {};
      if (nameDirty) body.full_name = name.trim();
      if (speakerDirty) {
        body.designation = designation.trim() || null;
        body.bio = bio.trim() || null;
        body.linkedin_url = linkedinUrl.trim() || null;
        body.twitter_url = twitterUrl.trim() || null;
        body.github_url = githubUrl.trim() || null;
        body.website_url = websiteUrl.trim() || null;
      }

      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("PATCH /api/auth/me failed");

      // The route echoes the stored row, so the session is refreshed from what
      // was actually written rather than from what we hoped to write. This is
      // what repaints the navbar, which renders the name off the session.
      const saved: Partial<AuthUser> = await res.json();
      if (nameDirty) {
        const persisted = saved.full_name ?? name.trim();
        updateUser({ full_name: persisted });
        setName(persisted);
        setSavedName(persisted);
      }
      if (speakerDirty) {
        // The values actually sent become the new clean baseline, so the
        // form stops counting the speaker group as dirty once it lands.
        setSavedDesignation(designation.trim());
        setSavedBio(bio.trim());
        setSavedLinkedinUrl(linkedinUrl.trim());
        setSavedTwitterUrl(twitterUrl.trim());
        setSavedGithubUrl(githubUrl.trim());
        setSavedWebsiteUrl(websiteUrl.trim());
      }

      notify({ title: "Profile updated", description: "Your profile has been saved.", type: "success" });
    } catch {
      notify({ title: "Error", description: "Failed to update profile.", type: "error" });
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

  type EmailVerdict = { ok: true } | { ok: false; title: "Error" | "Check the address"; message: string };

  async function validateEmailAddress(email: string): Promise<EmailVerdict> {
    // Caught before the request rather than after: asking Supabase to move the
    // address to the one it already holds spends a slot of the per-address
    // rate limit that a real change would need, and answers by mailing a
    // confirmation link to the inbox the user is already reading.
    if (isSameEmail(email, currentUser?.email)) {
      return { ok: false, title: "Error", message: "This is already your email address." };
    }

    // A mistyped domain is the one failure worth catching before sending,
    // because its confirmation link goes nowhere and the account is left
    // waiting on a message that cannot arrive. An inconclusive lookup lets the
    // address through: the confirmation is what actually proves it works.
    const domain = emailDomain(email);
    if (domain && (await checkMailDomain(domain)) === "no-mail-server") {
      const suggestion = suggestEmailCorrection(email);
      return {
        ok: false,
        title: "Check the address",
        message: suggestion
          ? `We could not find a mail server for ${domain}. Did you mean ${suggestion}?`
          : `We could not find a mail server for ${domain}. Check the spelling.`,
      };
    }

    return { ok: true };
  }

  async function persistEmailChange(email: string) {
    setSavingEmail(true);
    try {
      if (await sendVerification(email)) {
        // Nothing is written here on purpose. The address is a claim until the
        // link in the message is opened; the app row is caught up at that
        // point, by the callback route. Writing it now would put an unverified
        // address on every surface that reads the session, and leave it there
        // for good if the link were never opened.
        setEmailSent(true);
      }
    } finally {
      setSavingEmail(false);
    }
  }

  async function validatePassword(
    current: string,
    next: string,
  ): Promise<{ ok: true } | { ok: false; field: "current" | "new"; message: string }> {
    // Named before the request, because the provider answers a rejected
    // password with one generic message for every rule it could have broken.
    const verdict = evaluatePassword(next, {
      email: currentUser?.email,
      fullName: currentUser?.full_name,
    });
    if (!verdict.ok) {
      return { ok: false, field: "new", message: verdict.problem! };
    }

    // The field asking for it was decorative until now: the provider changes a
    // password on the strength of the session alone, so an open laptop or a
    // stolen token was enough to take an account over, and the owner would find
    // themselves locked out of it. Proving the current password is what makes
    // that a real gate. Checked after the free local rules and before anything
    // is written, so a weak new password costs no round trip and a wrong
    // current one changes nothing.
    if (!currentUser?.email || !(await verifyPassword(currentUser.email, current))) {
      return { ok: false, field: "current", message: "That is not your current password." };
    }

    return { ok: true };
  }

  async function persistPasswordChange(next: string) {
    // The provider only ever rejects this call over the new password itself —
    // too weak for its own rules, or identical to the one being replaced — so
    // its message belongs on that field rather than in a toast.
    const { error: authError } = await supabase.auth.updateUser({ password: next });
    if (authError) {
      setNewPasswordError(authError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    notify({ title: "Password updated", description: "Your password has been changed.", type: "success" });
  }

  const nameDirty = name.trim() !== savedName.trim();
  const emailDirty = !emailSent && newEmail.trim() !== "";
  const passwordDirty = currentPassword.trim() !== "" || newPassword.trim() !== "";
  const speakerDirty =
    isSpeaker &&
    (designation.trim() !== savedDesignation.trim() ||
      bio.trim() !== savedBio.trim() ||
      linkedinUrl.trim() !== savedLinkedinUrl.trim() ||
      twitterUrl.trim() !== savedTwitterUrl.trim() ||
      githubUrl.trim() !== savedGithubUrl.trim() ||
      websiteUrl.trim() !== savedWebsiteUrl.trim());
  const dirty = nameDirty || emailDirty || passwordDirty || speakerDirty;

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setEmailError(null);
    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setSpeakerFieldErrors({});

    // Validate only the groups that changed; an untouched field's stale value
    // must not block saving something else, and any failure aborts the whole
    // batch before anything is written.
    let failed = false;

    if (nameDirty) {
      const problem = validateFullName(name);
      if (problem) {
        setNameError(problem);
        failed = true;
      }
    }

    if (emailDirty) {
      const verdict = await validateEmailAddress(newEmail.trim());
      if (!verdict.ok) {
        setEmailError(verdict.message);
        failed = true;
      }
    }

    if (passwordDirty) {
      const verdict = await validatePassword(currentPassword, newPassword);
      if (!verdict.ok) {
        if (verdict.field === "current") setCurrentPasswordError(verdict.message);
        else setNewPasswordError(verdict.message);
        failed = true;
      }
    }

    if (speakerDirty) {
      // Name and bio are free text; only the four links can be malformed. One
      // field's bad value must not block the rest of the save, but anything
      // malformed still aborts the whole batch — a half-written profile would
      // leave the links pointing nowhere and vanish on the next render.
      const linkFields: Array<{ field: "linkedin" | "twitter" | "github" | "website"; value: string; saved: string }> = [
        { field: "linkedin", value: linkedinUrl, saved: savedLinkedinUrl },
        { field: "twitter", value: twitterUrl, saved: savedTwitterUrl },
        { field: "github", value: githubUrl, saved: savedGithubUrl },
        { field: "website", value: websiteUrl, saved: savedWebsiteUrl },
      ];
      for (const { field, value, saved } of linkFields) {
        const trimmed = value.trim();
        if (trimmed === saved.trim()) continue;
        if (trimmed === "") continue;
        try {
          new URL(trimmed);
        } catch {
          setSpeakerFieldErrors((prev) => ({ ...prev, [field]: "Enter a valid full URL (https://…)." }));
          failed = true;
        }
      }
    }

    if (failed) return;

    setSaving(true);
    try {
      if (nameDirty || speakerDirty) {
        // persistProfileChange writes the dirty profile groups and resets their
        // saved originals to what was stored, which is what flips them clean
        // once the write lands.
        await persistProfileChange();
      }

      if (emailDirty) {
        await persistEmailChange(newEmail.trim());
      }

      if (passwordDirty) {
        await persistPasswordChange(newPassword);
      }
    } finally {
      setSaving(false);
    }
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

  async function deleteProfilePhoto() {
    setDeleting(true);
    try {
      const res = await fetch("/api/upload/profile-image", { method: "DELETE" });

      if (!res.ok) {
        notify({ title: "Delete failed", description: "Could not remove your profile photo.", type: "error" });
        return;
      }

      // The route has already nulled the row, so the session is only being
      // caught up to it — this is what hides the photo in the preview and the
      // navbar avatar without a reload.
      updateUser({ profile_image_url: null });
      notify({ title: "Photo removed", description: "Your profile photo has been deleted.", type: "success" });
    } catch {
      notify({ title: "Delete failed", description: "Could not remove your profile photo.", type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return {
    toast,
    dismissToast,
    notify,
    currentUser,
    name,
    setName: editName,
    nameError,
    newEmail,
    setNewEmail: editEmail,
    emailError,
    emailSent,
    savingEmail,
    resendIn,
    resendVerification,
    useDifferentEmail,
    currentPassword,
    setCurrentPassword: editCurrentPassword,
    currentPasswordError,
    newPassword,
    setNewPassword: editNewPassword,
    newPasswordError,
    dirty,
    saving,
    saveChanges,
    uploading,
    changeProfilePhoto,
    deleting,
    deleteProfilePhoto,
    isSpeaker,
    speakerProfileId,
    designation,
    setDesignation: editSpeakerDesignation,
    bio,
    setBio: editSpeakerBio,
    linkedinUrl,
    setLinkedinUrl: editSpeakerLinkedin,
    twitterUrl,
    setTwitterUrl: editSpeakerTwitter,
    githubUrl,
    setGithubUrl: editSpeakerGithub,
    websiteUrl,
    setWebsiteUrl: editSpeakerWebsite,
    speakerFieldErrors,
    speakerDirty,
  };
}
