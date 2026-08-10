"use client";

import { useState } from "react";

export interface CommunityFormValues {
  label: string;
  url: string;
  description: string;
  icon_url: string;
}

interface CommunityFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<CommunityFormValues>;
  submitLabel: string;
  onSubmit: (values: CommunityFormValues) => Promise<void>;
  onCancel?: () => void;
}

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-fg";

export function CommunityForm({ mode, initialValues, submitLabel, onSubmit, onCancel }: CommunityFormProps) {
  const [values, setValues] = useState<CommunityFormValues>({
    label: initialValues?.label ?? "",
    url: initialValues?.url ?? "",
    description: initialValues?.description ?? "",
    icon_url: initialValues?.icon_url ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CommunityFormValues, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch {
      setError(mode === "create" ? "Failed to create community group." : "Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="community-label" className={LABEL_CLASS}>
          Name
        </label>
        <input
          id="community-label"
          type="text"
          value={values.label}
          onChange={(e) => set("label", e.target.value)}
          required
          maxLength={255}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="community-url" className={LABEL_CLASS}>
          Group URL
        </label>
        <input
          id="community-url"
          type="url"
          value={values.url}
          onChange={(e) => set("url", e.target.value)}
          required
          placeholder="https://..."
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="community-icon-url" className={LABEL_CLASS}>
          Icon image URL <span className="font-normal text-muted-fg">(optional)</span>
        </label>
        <input
          id="community-icon-url"
          type="url"
          value={values.icon_url}
          onChange={(e) => set("icon_url", e.target.value)}
          placeholder="https://..."
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="community-description" className={LABEL_CLASS}>
          Description <span className="font-normal text-muted-fg">(optional)</span>
        </label>
        <textarea
          id="community-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={FIELD_CLASS}
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
        >
          {submitting ? (mode === "create" ? "Creating..." : "Saving...") : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-fg transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
