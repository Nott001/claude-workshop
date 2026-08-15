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
  onUseDifferent: () => void;
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
  onUseDifferent,
}: EmailSectionProps) {
  const unchanged = isSameEmail(newEmail, currentEmail);

  // Offered on how the address looks, never on whether it resolves. A lookalike
  // of a common domain is usually registered by someone banking on the typo, so
  // it answers DNS perfectly well and mail sent to it arrives — at them. The
  // resolving case is the one worth warning about, not the one to stay quiet on.
  const suggestion = unchanged ? null : suggestEmailCorrection(newEmail);

  return (
    <>
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
        <FormField className="mt-4">
          <Input
            id="email"
            type="email"
            placeholder="new@example.com"
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
