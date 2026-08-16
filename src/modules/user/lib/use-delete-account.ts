"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";

const DELETE_PHRASE = "Delete My Account";

export function useDeleteAccount() {
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [phrase, setPhraseValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = phrase.trim() === DELETE_PHRASE;

  // A reopened dialog starts blank, so a typed phrase from a previous attempt
  // cannot leave the destructive button armed without a fresh keystroke.
  const openDialog = useCallback(() => {
    setPhraseValue("");
    setError(null);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => setOpen(false), []);

  // The keystroke is the retry, so the failure message clears as the phrase is
  // edited rather than lingering over input it no longer describes.
  const setPhrase = useCallback((value: string) => {
    setPhraseValue(value);
    setError(null);
  }, []);

  async function confirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      closeDialog();
      // The auth identity is already gone server-side by now; signOut may
      // reject because the token no longer belongs to anyone, so navigation
      // must not depend on it resolving.
      await signOut().catch(() => {});
    } catch {
      setError("We could not delete your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    open,
    openDialog,
    closeDialog,
    phrase,
    setPhrase,
    canConfirm,
    submitting,
    error,
    confirm,
  };
}
