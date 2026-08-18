"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { AuthUser } from "@/modules/auth/lib/types";
import { ROLES } from "@/shared/lib/roles";
import { getBrowserClient } from "@/shared/db/browser-client";
import { emailDomain, isSameEmail, resendCooldownRemaining, RESEND_COOLDOWN_SECONDS } from "@/shared/lib/email";
import { authErrorMessage, rateLimitSecondsFrom } from "@/shared/lib/auth-error-message";
import { evaluatePassword } from "@/shared/lib/password-policy";
import { verifyPassword } from "@/modules/auth/lib/verify-password";
import { postUpload } from "@/shared/integrations/storage/upload-client";

export type ToastData = { title: string; description: string; type: "success" | "error" };

/** The cards that save. One key per `<form>` on the page. */
export type SettingsSection = "profile" | "email" | "password" | "speaker";

export type SpeakerFieldKey = "linkedin" | "twitter" | "github" | "website";
export type SpeakerFieldErrors = Partial<Record<SpeakerFieldKey, string>>;

/** One speaker link, carrying everything the card needs to render and save it. */
export interface SpeakerLinkField {
  key: SpeakerFieldKey;
  id: string;
  label: string;
  placeholder: string;
  value: string;
  /** The last value written, so the card knows whether it is dirty. */
  saved: string;
  onChange: (value: string) => void;
}

/**
 * What an auth route reports when it refuses. `retryAfter` and `code` are only
 * present on a rate limit, and between them decide whether the wait can be
 * named — see `authErrorMessage`.
 */
type RouteErrorBody = { status?: number; message?: string; retryAfter?: number; code?: string };

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

  // Which card is mid-save, and which one last landed. Declared before the
  // field editors, which clear the confirmation on a keystroke so it never
  // outlives the input it matched.
  const [savingSection, setSavingSection] = useState<SettingsSection | null>(null);
  const [savedSection, setSavedSection] = useState<SettingsSection | null>(null);
  const savingRef = useRef<SettingsSection | null>(null);

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
    setSavedSection(null);
  }, []);

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editEmail = useCallback((value: string) => {
    setNewEmail(value);
    setEmailError(null);
    setSavedSection(null);
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
        // Read through the same helper the route gates on, so the countdown on
        // screen cannot outlast — or undercut — the window actually enforced.
        setResendIn(resendCooldownRemaining(data.user?.email_change_sent_at));
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

  // Editing the field is the retry, so the message clears with the keystroke
  // rather than lingering over input it no longer describes.
  const editCurrentPassword = useCallback((value: string) => {
    setCurrentPassword(value);
    setCurrentPasswordError(null);
    setSavedSection(null);
  }, []);

  const editNewPassword = useCallback((value: string) => {
    setNewPassword(value);
    setNewPasswordError(null);
    setSavedSection(null);
  }, []);

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The speaker block is a card of this page rather than a page of its own, so
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
  const [speakerFieldErrors, setSpeakerFieldErrors] = useState<SpeakerFieldErrors>({});

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
    setSavedSection(null);
  }, []);
  const editSpeakerBio = useCallback((value: string) => {
    setBio(value);
    setSavedSection(null);
  }, []);

  /**
   * The four link fields, described once.
   *
   * Each had its own state pair, its own editor and its own entry in the
   * validation loop and the rendered list — four near-identical copies of the
   * same field, and the only thing that actually differed between them was a
   * label and a placeholder. Editing one is the retry for its own rejection,
   * so the message clears with the keystroke.
   */
  const speakerLinkSources: Array<Omit<SpeakerLinkField, "onChange"> & { set: (value: string) => void }> = [
    {
      key: "linkedin",
      id: "linkedin-url",
      label: "LinkedIn",
      placeholder: "https://linkedin.com/in/username",
      value: linkedinUrl,
      set: setLinkedinUrl,
      saved: savedLinkedinUrl,
    },
    {
      key: "twitter",
      id: "twitter-url",
      label: "X (Twitter)",
      placeholder: "https://x.com/username",
      value: twitterUrl,
      set: setTwitterUrl,
      saved: savedTwitterUrl,
    },
    {
      key: "github",
      id: "github-url",
      label: "GitHub",
      placeholder: "https://github.com/username",
      value: githubUrl,
      set: setGithubUrl,
      saved: savedGithubUrl,
    },
    {
      key: "website",
      id: "website-url",
      label: "Website",
      placeholder: "https://yoursite.com",
      value: websiteUrl,
      set: setWebsiteUrl,
      saved: savedWebsiteUrl,
    },
  ];

  const speakerLinks: SpeakerLinkField[] = speakerLinkSources.map(({ set, ...field }) => ({
    ...field,
    onChange: (value: string) => {
      set(value);
      setSpeakerFieldErrors((prev) => ({ ...prev, [field.key]: undefined }));
      setSavedSection(null);
    },
  }));

  function validateFullName(fullName: string): string | null {
    if (fullName.trim() === "") return "Name is required.";
    return null;
  }

  /**
   * Writes one card's worth of profile fields and hands back the stored row.
   *
   * The body is the caller's, so a card sends only what it owns — the two that
   * use this route write different columns and must not blank each other's by
   * sending them empty.
   */
  async function patchProfile(body: Record<string, unknown>): Promise<Partial<AuthUser> | null> {
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("PATCH /api/auth/me failed");
      return (await res.json()) as Partial<AuthUser>;
    } catch {
      notify({ title: "Error", description: "Failed to update profile.", type: "error" });
      return null;
    }
  }

  // The route failure shape is `{ ok: false, error: { status, message } }`, with
  // the auth-route 401 convention (`{ error: "Unauthenticated" }`) as the one
  // bare variant. Fold either into the object the mapping helper expects.
  function routeError(data: { error?: unknown }): { status?: number; message: string; retryAfter?: number; code?: string } {
    const error = data.error;
    if (typeof error === "string") return { message: error };
    if (error && typeof error === "object") {
      const { status, message, retryAfter, code } = error as RouteErrorBody;
      return { status, message: typeof message === "string" ? message : "", retryAfter, code };
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
      const error = routeError(data);
      notify({
        title: "Error",
        description: authErrorMessage(error, "We could not send the verification link. Please try again."),
        type: "error",
      });
      // Whenever the refusal named a wait — ours outright, GoTrue's in prose —
      // the resend button counts that same number down rather than offering a
      // press already known to fail. An hourly refusal names none, and the
      // button stays live because there is nothing honest to count.
      const seconds = error.retryAfter ?? rateLimitSecondsFrom(error.message);
      if (error.status === 429 && seconds) setResendIn(seconds);
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
  function resendVerification() {
    if (resendIn > 0) return;
    // Through the same gate as the first send, so a resend cannot run beside a
    // password change or a second press of its own.
    void runSave("email", async () => {
      if (await sendVerification(newEmail.trim())) {
        notify({ title: "Link sent again", description: `Sent to ${newEmail.trim()}.`, type: "success" });
      }
      return false;
    });
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

  const profileDirty = name.trim() !== savedName.trim();
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

  /**
   * Runs one section's save, alone.
   *
   * The ref rather than `savingSection` gates re-entry, because the state flag
   * is set too late to help: validating a password change awaits a full
   * sign-in round trip before any render happens, and a second submit inside
   * that window used to pass straight through — re-running the password change
   * against the password the first pass had just set, and spending another of
   * the hourly auth-mail sends. It also holds every other card's button down
   * while one is in flight, so two sections cannot race the same session.
   */
  async function runSave(section: SettingsSection, work: () => Promise<boolean>, when = true) {
    // A card with nothing to save writes nothing, whatever asked it to. Its
    // button is disabled too, but `disabled` is a DOM attribute an extension
    // can strip — the same reason the re-entry guard below is a ref.
    if (!when || savingRef.current) return;
    savingRef.current = section;
    setSavingSection(section);
    // A new attempt must not leave a stale confirmation on screen.
    setSavedSection(null);

    try {
      if (await work()) setSavedSection(section);
    } finally {
      savingRef.current = null;
      setSavingSection(null);
    }
  }

  const saveProfile = () =>
    runSave(
      "profile",
      async () => {
        setNameError(null);
        const problem = validateFullName(name);
        if (problem) {
          setNameError(problem);
          return false;
        }

        const saved = await patchProfile({ full_name: name.trim() });
        if (!saved) return false;

        // The route echoes the stored row, so the session is refreshed from what
        // was actually written rather than from what we hoped to write. This is
        // what repaints the navbar, which renders the name off the session.
        const persisted = saved.full_name ?? name.trim();
        updateUser({ full_name: persisted });
        setName(persisted);
        setSavedName(persisted);
        return true;
      },
      profileDirty,
    );

  const saveEmail = () =>
    runSave(
      "email",
      async () => {
        setEmailError(null);
        const verdict = validateEmailAddress(newEmail.trim());
        if (!verdict.ok) {
          setEmailError(verdict.message);
          return false;
        }

        // Nothing is written to the app row here on purpose. The address is a
        // claim until the link in the message is opened; the callback route
        // catches the row up at that point. Writing it now would put an
        // unverified address on every surface that reads the session, and leave
        // it there for good if the link were never opened.
        if (!(await sendVerification(newEmail.trim()))) return false;
        setEmailSent(true);
        // The card says "check your inbox" in place of the field, which is a
        // clearer confirmation than a tick in the footer would be.
        return false;
      },
      emailDirty,
    );

  const savePassword = () =>
    runSave(
      "password",
      async () => {
        setCurrentPasswordError(null);
        setNewPasswordError(null);

        const verdict = await validatePassword(currentPassword, newPassword);
        if (!verdict.ok) {
          if (verdict.field === "current") setCurrentPasswordError(verdict.message);
          else setNewPasswordError(verdict.message);
          return false;
        }

        return persistPasswordChange(newPassword);
      },
      passwordDirty,
    );

  const saveSpeaker = () =>
    runSave(
      "speaker",
      async () => {
        setSpeakerFieldErrors({});

        // Designation and bio are free text; only the four links can be
        // malformed. Every bad one is named at once rather than one per attempt,
        // and any of them aborts the write — a half-saved profile would leave
        // the rest pointing nowhere and vanish on the next render.
        const problems: SpeakerFieldErrors = {};
        for (const { key, value } of speakerLinks) {
          const trimmed = value.trim();
          if (trimmed === "") continue;
          try {
            new URL(trimmed);
          } catch {
            problems[key] = "Enter a valid full URL (https://…).";
          }
        }
        if (Object.keys(problems).length > 0) {
          setSpeakerFieldErrors(problems);
          return false;
        }

        const saved = await patchProfile({
          designation: designation.trim() || null,
          bio: bio.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          github_url: githubUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        });
        if (!saved) return false;

        // The values actually sent become the new clean baseline, so the card
        // stops counting itself dirty once the write lands.
        setSavedDesignation(designation.trim());
        setSavedBio(bio.trim());
        setSavedLinkedinUrl(linkedinUrl.trim());
        setSavedTwitterUrl(twitterUrl.trim());
        setSavedGithubUrl(githubUrl.trim());
        setSavedWebsiteUrl(websiteUrl.trim());
        return true;
      },
      speakerDirty,
    );

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
    // One flag apiece, derived rather than stored, so a card asks about itself
    // instead of every card reading the same pair of section keys.
    savingSection,
    savedSection,

    profile: {
      name,
      setName: editName,
      nameError,
      dirty: profileDirty,
      saving: savingSection === "profile",
      saved: savedSection === "profile",
      save: saveProfile,
    },
    email: {
      value: newEmail,
      setValue: editEmail,
      error: emailError,
      sent: emailSent,
      verified: emailVerified,
      dismissVerified: dismissEmailVerified,
      resendIn,
      resend: resendVerification,
      cancel: cancelEmailChange,
      dirty: emailDirty,
      saving: savingSection === "email",
      save: saveEmail,
    },
    password: {
      current: currentPassword,
      setCurrent: editCurrentPassword,
      currentError: currentPasswordError,
      next: newPassword,
      setNext: editNewPassword,
      nextError: newPasswordError,
      dirty: passwordDirty,
      saving: savingSection === "password",
      saved: savedSection === "password",
      save: savePassword,
    },
    speaker: {
      isSpeaker,
      loading: speakerProfileId === undefined,
      designation,
      setDesignation: editSpeakerDesignation,
      bio,
      setBio: editSpeakerBio,
      links: speakerLinks,
      errors: speakerFieldErrors,
      dirty: speakerDirty,
      saving: savingSection === "speaker",
      saved: savedSection === "speaker",
      save: saveSpeaker,
    },
    photo: {
      url: currentUser?.profile_image_url,
      uploading,
      deleting,
      change: changeProfilePhoto,
      remove: deleteProfilePhoto,
    },
  };
}
