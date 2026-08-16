"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { AuthUser } from "@/modules/auth/lib/types";
import { ROLES } from "@/shared/lib/roles";
import { getBrowserClient } from "@/shared/db/browser-client";
import { emailDomain, isSameEmail, RESEND_COOLDOWN_SECONDS } from "@/shared/lib/email";
import { authErrorMessage } from "@/shared/lib/auth-error-message";
import { evaluatePassword } from "@/shared/lib/password-policy";
import { verifyPassword } from "@/modules/auth/lib/verify-password";
import { postUpload } from "@/shared/integrations/storage/upload-client";

export type ToastData = { title: string; description: string; type: "success" | "error" };

// `id` is assigned here rather than by callers, who have no reason to care: it
// exists so the rendered Toast can be re-keyed per message. Without it a second
// message reuses the mounted instance, whose dismissal timer is still counting
// down for the first, and disappears early.
export type ActiveToast = ToastData & { id: number };

export function useAccountSettings() {
  const { user: currentUser, updateUser } = useSession();
  const supabase = getBrowserClient();

  const [toast, setToast] = useState<ActiveToast | null>(null);
  // Shared with the speaker profile hook so every section toasts in one place.
  const notify = useCallback((data: ToastData) => setToast((prev) => ({ ...data, id: (prev?.id ?? 0) + 1 })), []);
  // Stable, so an unrelated re-render does not restart Toast's dismissal effect
  // — it is keyed on `onClose` — and leave the message on screen indefinitely.
  const dismissToast = useCallback(() => setToast(null), []);

  // A save that the user may miss if it only reached the auto-dismissing toast.
  // Declared before the field editors (which clear it on a keystroke) so a
  // stale confirmation never outlives the input it matched.
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const dismissSavedNotice = useCallback(() => setSavedNotice(null), []);

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

  // The email field is prefilled the same way, and for the same reason: the
  // page renders before the session resolves, and adopting the session address
  // keeps the box in step with a confirmed change. An edit in progress is left
  // alone on unrelated renders.
  const sessionEmail = currentUser?.email ?? "";
  const [newEmail, setNewEmail] = useState(sessionEmail);
  const [lastSessionEmail, setLastSessionEmail] = useState(sessionEmail);
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  // The address the open pending change belongs to: the adoption effect clears
  // the pending banner exactly when the session reaches it, and only then. Any
  // other session repaint must leave the pending state alone.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // The address the session just reached by opening the mailed link, kept long
  // enough for the section to say the change went through instead of silently
  // accepting the new value. Transient: cleared again on the next email action
  // and gone with the page on reload.
  const [emailVerified, setEmailVerified] = useState<string | null>(null);
  const dismissEmailVerified = useCallback(() => setEmailVerified(null), []);

  if (sessionEmail !== lastSessionEmail) {
    setLastSessionEmail(sessionEmail);
    setNewEmail(sessionEmail);
    if (pendingEmail && isSameEmail(sessionEmail, pendingEmail)) {
      setPendingEmail(null);
      setEmailSent(false);
      setResendIn(0);
      setEmailError(null);
      setEmailVerified(sessionEmail);
    }
  }

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes. The fresh keystroke
  // also clears the save confirmation, so it never outlives the input it matched.
  const editName = useCallback((value: string) => {
    setName(value);
    setNameError(null);
    setSavedNotice(null);
  }, []);

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editEmail = useCallback((value: string) => {
    setNewEmail(value);
    setEmailError(null);
    setSavedNotice(null);
    setEmailVerified(null);
  }, []);

  // One timeout per remaining second rather than a repeating interval: it
  // cancels itself on unmount and cannot outlive the countdown it belongs to.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // A reload wipes emailSent and resendIn, leaving an in-flight change to look
  // like a fresh form that re-sends straight into the same rate-limit window.
  // GoTrue records the pending address on the auth user, so read it back and
  // resume. Waiting for a resolved session keeps this from stamping the pending
  // value in before the session adoption (above) has a chance to agree on what
  // the account currently owns.
  const restoredPendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser?.email) return;
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const pending = data.user?.new_email?.trim() ?? "";
        if (!pending || isSameEmail(pending, currentUser?.email)) return;
        if (restoredPendingRef.current === pending) return;
        restoredPendingRef.current = pending;
        setPendingEmail(pending);
        setNewEmail(pending);
        setEmailSent(true);
        const sentAt = data.user?.email_change_sent_at ?? null;
        const elapsed = sentAt ? (Date.now() - new Date(sentAt).getTime()) / 1000 : 0;
        setResendIn(elapsed < RESEND_COOLDOWN_SECONDS ? Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supabase, currentUser?.email]);

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
    setSavedNotice(null);
  }, []);

  const editNewPassword = useCallback((value: string) => {
    setNewPassword(value);
    setNewPasswordError(null);
    setSavedNotice(null);
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

  const editSpeakerDesignation = useCallback((value: string) => {
    setDesignation(value);
    setSavedNotice(null);
  }, []);
  const editSpeakerBio = useCallback((value: string) => {
    setBio(value);
    setSavedNotice(null);
  }, []);
  // Editing a field is the retry for its own rejection, so the message clears
  // with the keystroke rather than lingering under input it no longer describes.
  const editSpeakerLinkedin = useCallback((value: string) => {
    setLinkedinUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, linkedin: undefined }));
    setSavedNotice(null);
  }, []);
  const editSpeakerTwitter = useCallback((value: string) => {
    setTwitterUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, twitter: undefined }));
    setSavedNotice(null);
  }, []);
  const editSpeakerGithub = useCallback((value: string) => {
    setGithubUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, github: undefined }));
    setSavedNotice(null);
  }, []);
  const editSpeakerWebsite = useCallback((value: string) => {
    setWebsiteUrl(value);
    setSpeakerFieldErrors((prev) => ({ ...prev, website: undefined }));
    setSavedNotice(null);
  }, []);

  function validateFullName(fullName: string): string | null {
    if (fullName.trim() === "") return "Name is required.";
    return null;
  }

  async function persistProfileChange(): Promise<boolean> {
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

      return true;
    } catch {
      notify({ title: "Error", description: "Failed to update profile.", type: "error" });
      return false;
    }
  }

  // The route failure shape is `{ ok: false, error: { status, message } }`, with
  // the auth-route 401 convention (`{ error: "Unauthenticated" }`) as the one
  // bare variant. Fold either into the object the mapping helper expects.
  function routeError(data: { error?: unknown }): { status?: number; message: string } {
    const error = data.error;
    if (typeof error === "string") return { message: error };
    if (error && typeof error === "object") {
      const { status, message } = error as { status?: number; message?: string };
      return { status, message: typeof message === "string" ? message : "" };
    }
    return { message: "" };
  }

  /** Asks the route to send the confirmation link, and starts the resend clock. */
  async function sendVerification(email: string): Promise<boolean> {
    const res = await fetch("/api/auth/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: unknown };

    if (!data.ok) {
      notify({
        title: "Error",
        description: authErrorMessage(routeError(data), "We could not send the verification link. Please try again."),
        type: "error",
      });
      return false;
    }
    setPendingEmail(email.trim());
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setEmailVerified(null);
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

  /**
   * Voids the pending change server-side: GoTrue's email_change_token_new row
   * is deleted and the pending fields cleared, so the mailed link expires and a
   * reload finds nothing to resurrect. The typed address stays in the field —
   * a dismissal, not a correction.
   */
  async function cancelEmailChange() {
    const res = await fetch("/api/auth/email/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: unknown };

    if (!data.ok) {
      notify({
        title: "Error",
        description: authErrorMessage(routeError(data), "We could not cancel the pending change. Please try again."),
        type: "error",
      });
      return;
    }
    setEmailSent(false);
    setResendIn(0);
    setPendingEmail(null);
    setEmailVerified(null);
    // The field is bound to the stored address, not the attempted one: cancel
    // snaps it back to the account's email so what remains on screen is plainly
    // the original, not an address that never landed.
    setNewEmail(currentUser?.email ?? "");
  }

  type EmailVerdict = { ok: true } | { ok: false; message: string };

  function validateEmailAddress(email: string): EmailVerdict {
    // The dirty gate keeps the session's own address and a blank field out of
    // here, so the only thing left to refuse is a domain that does not look
    // like one. No DNS lookup: tagged aliases (you+tag@…), sub-domains and
    // small domains are all legitimate mailboxes, and the verification link is
    // the real proof one works.
    if (!emailDomain(email)) {
      return { ok: false, message: "Enter a valid email address, like name@example.com." };
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

  async function persistPasswordChange(next: string): Promise<boolean> {
    // The provider only ever rejects this call over the new password itself —
    // too weak for its own rules, or identical to the one being replaced — so
    // its message belongs on that field rather than in a toast.
    const { error: authError } = await supabase.auth.updateUser({ password: next });
    if (authError) {
      setNewPasswordError(authErrorMessage(authError, "We could not change your password. Please try again."));
      return false;
    }

    setCurrentPassword("");
    setNewPassword("");
    return true;
  }

  const nameDirty = name.trim() !== savedName.trim();
  // Prefilled against the session address, the field is only a change when it
  // differs from it — the address already on file, or a blank, is never
  // resubmitted as if it were one.
  const emailDirty = !emailSent && newEmail.trim() !== "" && !isSameEmail(newEmail, currentUser?.email);
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
    // A new attempt must not leave a stale confirmation on screen; it is set
    // again, only for what actually landed, after the persists below.
    setSavedNotice(null);

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

    let savedProfile = false;
    let savedPassword = false;

    setSaving(true);
    try {
      if (nameDirty || speakerDirty) {
        // persistProfileChange writes the dirty profile groups and resets their
        // saved originals to what was stored, which is what flips them clean
        // once the write lands. It answers whether the write actually landed.
        savedProfile = await persistProfileChange();
      }

      if (emailDirty) {
        await persistEmailChange(newEmail.trim());
      }

      if (passwordDirty) {
        savedPassword = await persistPasswordChange(newPassword);
      }
    } finally {
      setSaving(false);
    }

    // The email section confirms in place with its own green sent-box, so only
    // profile and password saves announce themselves here — one surface per save.
    setSavedNotice(
      savedProfile && savedPassword
        ? "Your settings have been updated."
        : savedProfile
          ? "Your profile has been updated."
          : savedPassword
            ? "Your password has been updated."
            : null,
    );
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
    savedNotice,
    dismissSavedNotice,
    name,
    setName: editName,
    nameError,
    newEmail,
    setNewEmail: editEmail,
    emailError,
    emailSent,
    emailVerified,
    dismissEmailVerified,
    savingEmail,
    resendIn,
    resendVerification,
    cancelEmailChange,
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
