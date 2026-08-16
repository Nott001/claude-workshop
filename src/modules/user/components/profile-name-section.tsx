"use client";

import { Input } from "@/shared/components/input";
import { FormField, FormLabel, FormMessage } from "@/shared/components/form";

interface ProfileNameSectionProps {
  name: string;
  onChange: (name: string) => void;
  error?: string | null;
}

export function ProfileNameSection({ name, onChange, error }: ProfileNameSectionProps) {
  return (
    <>
      <h2 className="text-sm font-bold text-fg">Profile Name</h2>
      <FormField className="mt-4">
        <FormLabel htmlFor="profile-name">Name</FormLabel>
        <Input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "profile-name-error" : undefined}
        />
        {error && (
          <FormMessage id="profile-name-error" role="alert">
            {error}
          </FormMessage>
        )}
      </FormField>
    </>
  );
}
