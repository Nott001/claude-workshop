"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form } from "@/shared/components/form";

interface EmailSectionProps {
  currentEmail?: string | null;
  newEmail: string;
  onChange: (email: string) => void;
  emailSent: boolean;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function EmailSection({ currentEmail, newEmail, onChange, emailSent, saving, onSubmit }: EmailSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Email</h2>
      <p className="mt-1 text-xs text-muted-fg">{currentEmail ?? ""}</p>
      {emailSent ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3">
          <span className="material-symbols-rounded mt-0.5 text-sm text-success">mark_email_unread</span>
          <p className="text-xs text-muted-fg">
            Verification link sent to <span className="font-medium text-fg">{newEmail}</span>. Check your inbox.
          </p>
        </div>
      ) : (
        <Form onSubmit={onSubmit} className="mt-4 flex gap-3">
          <Input
            type="email"
            placeholder="new@example.com"
            value={newEmail}
            onChange={(e) => onChange(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={saving || !newEmail}>
            {saving ? "Sending\u2026" : "Change email"}
          </Button>
        </Form>
      )}
    </div>
  );
}
