"use client";

import { Input } from "@/shared/components/input";
import { Button } from "@/shared/components/button";
import { FormField, FormLabel, FormMessage } from "@/shared/components/form";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/dialog";
import { useDeleteAccount } from "@/modules/user/lib/use-delete-account";

export function DeleteAccountSection() {
  const { open, openDialog, closeDialog, phrase, setPhrase, canConfirm, submitting, error, confirm } = useDeleteAccount();

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : closeDialog())}>
      <div className="mt-6 rounded-xl border border-border bg-surface">
        <div className="p-6">
          <h2 className="text-sm font-bold text-error">Delete Account</h2>
          <p className="mt-1 text-xs text-muted-fg">
            Deleting your account permanently removes your personal data. This cannot be undone.
          </p>
        </div>
        <div className="border-t border-border p-6">
          <DialogTrigger render={<Button variant="danger">Delete my account</Button>} />
        </div>
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete my account</DialogTitle>
          <DialogDescription>
            We permanently remove all of your personal information, including support chats, tickets, Q&A answers, survey
            responses, email and password-reset logs, and photo uploads, as well as your speaker profile if you have one.
            Payments are kept, but their buyer email is replaced with a deleted placeholder.
          </DialogDescription>
        </DialogHeader>
        <FormField>
          <FormLabel htmlFor="delete-account-phrase">Type &quot;Delete My Account&quot; to confirm</FormLabel>
          <Input
            id="delete-account-phrase"
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "delete-account-error" : undefined}
          />
          {error && (
            <FormMessage id="delete-account-error" role="alert">
              {error}
            </FormMessage>
          )}
        </FormField>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary">Cancel</Button>} />
          <Button variant="danger" disabled={!canConfirm || submitting} onClick={() => void confirm()}>
            {submitting ? "Deleting…" : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
