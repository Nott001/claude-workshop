"use client";

import { Input } from "@/shared/components/input";
import { FormField, FormMessage } from "@/shared/components/form";
import { isSameEmail, suggestEmailCorrection } from "@/shared/lib/email";

interface EmailSectionProps {
  currentEmail?: string | null;
  newEmail: string;
  onChange: (email: string) => void;
  emailError?: string | null;
  emailSent: boolean;
  saving: boolean;
  /** Seconds until another link may be sent; 0 when one may be sent now. */
  resendIn: number;
  onResend: () => void;
  onCancel: () => void;
}

export function EmailSection({
  currentEmail,
  newEmail,
  onChange,
  emailError,
  emailSent,
  saving,
  resendIn,
  onResend,
  onCancel,
}: EmailSectionProps) {
  const unchanged = isSameEmail(newEmail, currentEmail);

  // How the address looks is the only signal worth using: a near-miss of a
  // common domain is usually a typo, and the confirming link is what proves a
  // mailbox works — never a DNS lookup.
  const suggestion = unchanged ? null : suggestEmailCorrection(newEmail);

  return (
    <>
      <h2 className="text-sm font-bold text-fg">Email</h2>
      {emailSent ? (
        <>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3">
            <span className="material-symbols-rounded mt-0.5 text-sm text-success">mark_email_unread</span>
            <div>
              <p className="text-xs font-bold text-fg">Email change pending</p>
              <p className="text-xs text-muted-fg">The link expires on its own — to send to a new address, type it below.</p>
            </div>
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
            <button type="button" onClick={onCancel} className="font-medium text-brand underline underline-offset-2">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <FormField className="mt-4">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError && (
            <FormMessage id="email-error" role="alert">
              {emailError}
            </FormMessage>
          )}
          {suggestion && !emailError && (
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
        </FormField>
      )}
    </>
  );
}
