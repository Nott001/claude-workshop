"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form } from "@/shared/components/form";
import { isSameEmail, suggestEmailCorrection } from "@/shared/lib/email";

interface EmailSectionProps {
  currentEmail?: string | null;
  newEmail: string;
  onChange: (email: string) => void;
  emailSent: boolean;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** Seconds until another link may be sent; 0 when one may be sent now. */
  resendIn: number;
  onResend: () => void;
  onUseDifferent: () => void;
}

export function EmailSection({
  currentEmail,
  newEmail,
  onChange,
  emailSent,
  saving,
  onSubmit,
  resendIn,
  onResend,
  onUseDifferent,
}: EmailSectionProps) {
  const unchanged = isSameEmail(newEmail, currentEmail);

  // Offered on how the address looks, never on whether it resolves. A lookalike
  // of a common domain is usually registered by someone banking on the typo, so
  // it answers DNS perfectly well and mail sent to it arrives — at them. The
  // resolving case is the one worth warning about, not the one to stay quiet on.
  const suggestion = unchanged ? null : suggestEmailCorrection(newEmail);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Email</h2>
      <p className="mt-1 text-xs text-muted-fg">{currentEmail ?? ""}</p>
      {emailSent ? (
        <>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3">
            <span className="material-symbols-rounded mt-0.5 text-sm text-success">mark_email_unread</span>
            <p className="text-xs text-muted-fg">
              Verification link sent to <span className="font-medium text-fg">{newEmail}</span>. Check your inbox, and your spam
              folder. The change takes effect once you open the link.
            </p>
          </div>
          {/* Without these the screen is a dead end: an address that cannot
              receive mail says so by staying silent, and the only way back to
              the field was a page reload. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-muted-fg">Didn&apos;t get it?</span>
            <button
              type="button"
              onClick={onResend}
              disabled={saving || resendIn > 0}
              className="font-medium text-brand underline underline-offset-2 disabled:text-muted-fg disabled:no-underline"
            >
              {resendIn > 0 ? `Send again in ${resendIn}s` : "Send it again"}
            </button>
            <button type="button" onClick={onUseDifferent} className="font-medium text-brand underline underline-offset-2">
              Use a different address
            </button>
          </div>
        </>
      ) : (
        <>
          <Form onSubmit={onSubmit} className="mt-4 flex gap-3">
            <Input
              type="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => onChange(e.target.value)}
              required
              aria-invalid={unchanged}
              aria-describedby={unchanged ? "email-unchanged" : undefined}
              className="flex-1"
            />
            <Button type="submit" disabled={saving || !newEmail || unchanged}>
              {saving ? "Sending\u2026" : "Change email"}
            </Button>
          </Form>
          {unchanged && (
            <p id="email-unchanged" className="mt-2 text-xs text-error">
              This is already your email address.
            </p>
          )}
          {suggestion && (
            <p className="mt-2 text-xs text-muted-fg">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => onChange(suggestion)}
                className="font-medium text-brand underline underline-offset-2"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </>
      )}
    </div>
  );
}
