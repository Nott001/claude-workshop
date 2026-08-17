"use client";

import { Input } from "@/shared/components/input";
import { FormField, FormLabel, FormMessage } from "@/shared/components/form";

export type SpeakerFieldKey = "linkedin" | "twitter" | "github" | "website";
export type SpeakerFieldErrors = Partial<Record<SpeakerFieldKey, string>>;

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
  errors?: SpeakerFieldErrors;
}

interface LinkField {
  key: SpeakerFieldKey;
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
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
  errors,
}: SpeakerProfileSectionProps) {
  const links: LinkField[] = [
    {
      key: "linkedin",
      id: "linkedin-url",
      label: "LinkedIn",
      placeholder: "https://linkedin.com/in/username",
      value: linkedinUrl,
      onChange: onLinkedinUrlChange,
    },
    {
      key: "twitter",
      id: "twitter-url",
      label: "X (Twitter)",
      placeholder: "https://x.com/username",
      value: twitterUrl,
      onChange: onTwitterUrlChange,
    },
    {
      key: "github",
      id: "github-url",
      label: "GitHub",
      placeholder: "https://github.com/username",
      value: githubUrl,
      onChange: onGithubUrlChange,
    },
    {
      key: "website",
      id: "website-url",
      label: "Website",
      placeholder: "https://yoursite.com",
      value: websiteUrl,
      onChange: onWebsiteUrlChange,
    },
  ];

  return (
    <>
      <h2 className="text-sm font-bold text-fg">Professional Info</h2>
      <p className="mt-1 text-xs text-muted-fg">Speaker designation, bio, and links.</p>
      {loading ? (
        <p className="mt-4 text-xs text-muted-fg">Loading...</p>
      ) : (
        <div className="mt-4 space-y-3">
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
          {links.map(({ key, id, label, placeholder, value, onChange }) => {
            const error = errors?.[key];
            return (
              <FormField key={key}>
                <FormLabel htmlFor={id}>{label}</FormLabel>
                <Input
                  id={id}
                  type="url"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                {error && (
                  <FormMessage id={`${id}-error`} role="alert">
                    {error}
                  </FormMessage>
                )}
              </FormField>
            );
          })}
        </div>
      )}
    </>
  );
}
