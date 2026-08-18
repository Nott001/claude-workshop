"use client";

import { TextField } from "@/shared/components/text-field";
import { SettingsCard } from "@/modules/user/components/settings-card";
import { EMAIL_CHANGE_LINK_TTL_LABEL, isSameEmail, suggestEmailCorrection } from "@/shared/lib/email";
import type { useAccountSettings } from "@/modules/user/lib/use-account-settings";

type EmailState = ReturnType<typeof useAccountSettings>["email"];

interface EmailSectionProps {
  currentEmail?: string | null;
  email: EmailState;
}

/** A green note with an icon — the pending, verified and sent states all wear it. */
function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3">
      <span aria-hidden className="material-symbols-rounded mt-0.5 text-sm text-success">
        {icon}
      </span>
      <div className="flex-1 text-xs">{children}</div>
    </div>
  );
}

export function EmailSection({ currentEmail, email }: EmailSectionProps) {
  const unchanged = isSameEmail(email.value, currentEmail);

  // How the address looks is the only signal worth using: a near-miss of a
  // common domain is usually a typo, and the confirming link is what proves a
  // mailbox works — never a DNS lookup.
  const suggestion = unchanged ? null : suggestEmailCorrection(email.value);

  return (
    <SettingsCard
      id="email"
      icon="mail"
      title="Email"
      description="Where sign-in links and event mail are sent."
      footer={
        // A pending change owns the card, so the save is withdrawn rather than
        // left disabled beside a field that is not there.
        email.sent
          ? undefined
          : {
              onSave: email.save,
              label: "Send verification link",
              savingLabel: "Sending…",
              dirty: email.dirty,
              saving: email.saving,
              note: "The address changes only once you open the link we send.",
            }
      }
    >
      {email.sent ? (
        <div className="space-y-3">
          <Notice icon="mark_email_unread">
            <p className="font-bold text-fg">Check your inbox</p>
            {/* The field is not rendered in this branch, so the copy cannot
                send anyone to it: Cancel is what brings it back. */}
            <p className="text-muted-fg">
              The link is valid for {EMAIL_CHANGE_LINK_TTL_LABEL} — to send to a different address, cancel this change first.
            </p>
          </Notice>
          {/* Without these the screen is a dead end: an address that cannot
              receive mail says so by staying silent, and the only way back to
              the field was a page reload. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-muted-fg">Didn&apos;t get it?</span>
            <button
              type="button"
              onClick={email.resend}
              disabled={email.saving || email.resendIn > 0}
              className="font-medium text-brand underline underline-offset-2 disabled:text-muted-fg disabled:no-underline"
            >
              {email.resendIn > 0 ? `Resend available in ${email.resendIn}s` : "Send it again"}
            </button>
            <button type="button" onClick={email.cancel} className="font-medium text-brand underline underline-offset-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {email.verified && (
            <Notice icon="verified">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-muted-fg">Email verified — {email.verified}</p>
                <button
                  type="button"
                  onClick={email.dismissVerified}
                  aria-label="Dismiss"
                  className="material-symbols-rounded text-sm text-muted-fg hover:text-fg"
                >
                  close
                </button>
              </div>
            </Notice>
          )}
          <div className="sm:max-w-md">
            <TextField
              id="new-email"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email.value}
              onChange={email.setValue}
              error={email.error}
            />
          </div>
          {suggestion && !email.error && (
            <p className="text-xs text-muted-fg">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => email.setValue(suggestion)}
                className="font-medium text-brand underline underline-offset-2"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
