"use client";

import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel } from "@/shared/components/form";

interface SpeakerProfileSectionProps {
  loading: boolean;
  designation: string;
  onDesignationChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  linkedinUrl: string;
  onLinkedinUrlChange: (value: string) => void;
  twitterUrl: string;
  onTwitterUrlChange: (value: string) => void;
  githubUrl: string;
  onGithubUrlChange: (value: string) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (value: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function SpeakerProfileSection({
  loading,
  designation,
  onDesignationChange,
  bio,
  onBioChange,
  linkedinUrl,
  onLinkedinUrlChange,
  twitterUrl,
  onTwitterUrlChange,
  githubUrl,
  onGithubUrlChange,
  websiteUrl,
  onWebsiteUrlChange,
  saving,
  onSubmit,
}: SpeakerProfileSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Professional Info</h2>
      <p className="mt-1 text-xs text-muted-fg">Speaker designation, bio, and links.</p>
      {loading ? (
        <p className="mt-4 text-xs text-muted-fg">Loading...</p>
      ) : (
        <Form onSubmit={onSubmit} className="mt-4 space-y-3">
          <FormField>
            <FormLabel htmlFor="designation">Designation</FormLabel>
            <Input
              id="designation"
              value={designation}
              onChange={(e) => onDesignationChange(e.target.value)}
              placeholder="e.g. Senior Developer"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="bio">Bio</FormLabel>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="Tell attendees about yourself..."
              rows={3}
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="linkedin-url">LinkedIn</FormLabel>
            <Input
              id="linkedin-url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => onLinkedinUrlChange(e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="twitter-url">X (Twitter)</FormLabel>
            <Input
              id="twitter-url"
              type="url"
              value={twitterUrl}
              onChange={(e) => onTwitterUrlChange(e.target.value)}
              placeholder="https://x.com/username"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="github-url">GitHub</FormLabel>
            <Input
              id="github-url"
              type="url"
              value={githubUrl}
              onChange={(e) => onGithubUrlChange(e.target.value)}
              placeholder="https://github.com/username"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="website-url">Website</FormLabel>
            <Input
              id="website-url"
              type="url"
              value={websiteUrl}
              onChange={(e) => onWebsiteUrlChange(e.target.value)}
              placeholder="https://yoursite.com"
            />
          </FormField>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Form>
      )}
    </div>
  );
}
