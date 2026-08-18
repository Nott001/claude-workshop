"use client";

import { Button } from "@/shared/components/button";
import { TextField } from "@/shared/components/text-field";
import { SettingsCard } from "@/modules/user/components/settings-card";
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
      {/* No footer: the action is destructive and confirmed in a dialog, so it
          must not look like the save buttons above it. */}
      <SettingsCard
        id="danger"
        icon="warning"
        title="Delete Account"
        description="Permanently removes your personal data. This cannot be undone."
      >
        <DialogTrigger render={<Button variant="danger">Delete my account</Button>} />
      </SettingsCard>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete my account</DialogTitle>
          <DialogDescription>
            Deleting your account permanently removes your personal data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <TextField
          id="delete-account-phrase"
          label='Type "Delete My Account" to confirm'
          type="text"
          value={phrase}
          onChange={setPhrase}
          error={error}
        />
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
