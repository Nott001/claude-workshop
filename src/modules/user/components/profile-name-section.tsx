"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form } from "@/shared/components/form";

interface ProfileNameSectionProps {
  name: string;
  onChange: (name: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProfileNameSection({ name, onChange, saving, onSubmit }: ProfileNameSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Profile Name</h2>
      <Form onSubmit={onSubmit} className="mt-4 flex gap-3">
        <Input type="text" value={name} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving\u2026" : "Save"}
        </Button>
      </Form>
    </div>
  );
}
