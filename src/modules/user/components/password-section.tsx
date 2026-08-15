"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import { PasswordRequirements } from "@/modules/auth/components/password-requirements";
import { MIN_PASSWORD_LENGTH, type PasswordContext } from "@/shared/lib/password-policy";

interface PasswordSectionProps {
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  /** Why the current password was rejected, shown against that field. */
  currentPasswordError?: string | null;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  /** Why the new password was rejected, shown against that field. */
  newPasswordError?: string | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** The account's own details, which the new password may not be built from. */
  context?: PasswordContext;
}

export function PasswordSection({
  currentPassword,
  onCurrentPasswordChange,
  currentPasswordError,
  newPassword,
  onNewPasswordChange,
  newPasswordError,
  saving,
  onSubmit,
  context,
}: PasswordSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Password</h2>
      <Form onSubmit={onSubmit} className="mt-4 space-y-3">
        <FormField>
          <FormLabel htmlFor="current-password">Current password</FormLabel>
          <Input
            id="current-password"
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            required
            aria-invalid={!!currentPasswordError}
            aria-describedby={currentPasswordError ? "current-password-error" : undefined}
          />
          {currentPasswordError && (
            <FormMessage id="current-password-error" role="alert">
              {currentPasswordError}
            </FormMessage>
          )}
        </FormField>
        <FormField>
          <FormLabel htmlFor="new-password">New password</FormLabel>
          <Input
            id="new-password"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={!!newPasswordError}
            aria-describedby={newPasswordError ? "new-password-error" : undefined}
          />
          {newPasswordError && (
            <FormMessage id="new-password-error" role="alert">
              {newPasswordError}
            </FormMessage>
          )}
          <PasswordRequirements password={newPassword} context={context} />
        </FormField>
        <Button type="submit" disabled={saving || !currentPassword || !newPassword}>
          {saving ? "Updating\u2026" : "Update password"}
        </Button>
      </Form>
    </div>
  );
}
