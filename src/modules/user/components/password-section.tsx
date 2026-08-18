"use client";

import Link from "next/link";
import { TextField } from "@/shared/components/text-field";
import { SettingsCard } from "@/modules/user/components/settings-card";
import { PasswordRequirements } from "@/modules/auth/components/password-requirements";
import { MIN_PASSWORD_LENGTH, type PasswordContext } from "@/shared/lib/password-policy";
import type { useAccountSettings } from "@/modules/user/lib/use-account-settings";

interface PasswordSectionProps {
  password: ReturnType<typeof useAccountSettings>["password"];
  /** The account's own details, which the new password may not be built from. */
  context?: PasswordContext;
}

export function PasswordSection({ password, context }: PasswordSectionProps) {
  return (
    <SettingsCard
      id="password"
      icon="lock"
      title="Password"
      description="Changing this signs you in again everywhere else."
      aside={
        // A forgotten password cannot be typed into the field below, so the
        // reset flow is offered here rather than only on the sign-in screen.
        <Link
          href="/forgot-password"
          prefetch={false}
          className="text-sm font-medium text-brand transition-colors hover:text-brand/80"
        >
          Forgot password?
        </Link>
      }
      footer={{
        onSave: password.save,
        label: "Update password",
        savingLabel: "Updating…",
        dirty: password.dirty,
        saving: password.saving,
        saved: password.saved ? "Password updated" : null,
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="current-password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter current password"
          value={password.current}
          onChange={password.setCurrent}
          error={password.currentError}
        />
        <TextField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter new password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password.next}
          onChange={password.setNext}
          error={password.nextError}
        />
      </div>
      <PasswordRequirements password={password.next} context={context} />
    </SettingsCard>
  );
}
