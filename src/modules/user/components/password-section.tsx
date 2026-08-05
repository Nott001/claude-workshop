"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel } from "@/shared/components/form";

interface PasswordSectionProps {
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PasswordSection({
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  saving,
  onSubmit,
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
          />
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
            minLength={6}
          />
        </FormField>
        <Button type="submit" disabled={saving || !currentPassword || !newPassword}>
          {saving ? "Updating\u2026" : "Update password"}
        </Button>
      </Form>
    </div>
  );
}
