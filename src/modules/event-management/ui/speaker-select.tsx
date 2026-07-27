"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface SpeakerProfile {
  speaker_profile_id: number;
  USERS: { full_name: string; email: string } | null;
  bio: string | null;
  designation: string | null;
}

interface SpeakerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  speakers: SpeakerProfile[];
  includeNone?: boolean;
}

export function SpeakerSelect({ value, onValueChange, speakers, includeNone }: SpeakerSelectProps) {
  if (speakers.length > 0) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full rounded-lg border-border bg-muted px-4 py-3 text-base text-fg">
          <SelectValue placeholder="Select a speaker">
            {(val: string) => {
              if (!val) return "None \u2014 no speaker";
              const s = speakers.find((sp) => String(sp.speaker_profile_id) === val);
              return s
                ? `${s.USERS?.full_name ?? `Speaker #${s.speaker_profile_id}`}${s.designation ? ` (${s.designation})` : ""}`
                : "Select a speaker";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {includeNone && <SelectItem value="">None — no speaker</SelectItem>}
          {speakers.map((s) => (
            <SelectItem key={s.speaker_profile_id} value={String(s.speaker_profile_id)}>
              {s.USERS?.full_name ?? `Speaker #${s.speaker_profile_id}`}
              {s.designation ? ` (${s.designation})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder="Speaker profile ID (optional)"
      className="rounded-lg border-border bg-muted px-4 py-3 text-base text-fg"
    />
  );
}
