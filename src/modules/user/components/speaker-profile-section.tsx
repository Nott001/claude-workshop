"use client";

import { TextField } from "@/shared/components/text-field";
import { SettingsCard } from "@/modules/user/components/settings-card";
import type { useAccountSettings } from "@/modules/user/lib/use-account-settings";

interface SpeakerProfileSectionProps {
  speaker: ReturnType<typeof useAccountSettings>["speaker"];
}

export function SpeakerProfileSection({ speaker }: SpeakerProfileSectionProps) {
  return (
    <SettingsCard
      id="speaker"
      icon="record_voice_over"
      title="Professional Info"
      description="Shown to attendees on the sessions you speak at."
      footer={{
        onSave: speaker.save,
        label: "Save professional info",
        dirty: speaker.dirty,
        saving: speaker.saving,
        saved: speaker.saved ? "Professional info saved" : null,
      }}
    >
      {speaker.loading ? (
        <p className="text-xs text-muted-fg">Loading…</p>
      ) : (
        <div className="space-y-4">
          {/* Designation is a short single line; the bio is a paragraph. Side
              by side they had to share a baseline neither wanted, so the bio
              gets its own row and the full width of the card. */}
          <div className="sm:max-w-md">
            <TextField
              id="designation"
              label="Designation"
              placeholder="e.g. Senior Developer"
              value={speaker.designation}
              onChange={speaker.setDesignation}
            />
          </div>
          <TextField
            id="bio"
            label="Bio"
            value={speaker.bio}
            onChange={speaker.setBio}
            render={(control) => (
              <textarea
                {...control}
                rows={4}
                placeholder="Tell attendees about yourself..."
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            )}
          />
          {/* Four across where there is room: the links are short, same-shaped
              values, and a single column of them pushed the save out of sight
              on a laptop. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {speaker.links.map((link) => (
              <TextField
                key={link.key}
                id={link.id}
                label={link.label}
                type="url"
                placeholder={link.placeholder}
                value={link.value}
                onChange={link.onChange}
                error={speaker.errors[link.key]}
              />
            ))}
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
