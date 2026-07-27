"use client";

import { useEffect, useState, useRef } from "react";

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  designation: string | null;
  photo_url: string | null;
  full_name: string;
  email: string;
}

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";

interface SpeakerProfileSectionProps {
  onToast: (toast: { title: string; description: string; type: "success" | "error" }) => void;
}

export function SpeakerProfileSection({ onToast }: SpeakerProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [speakerProfile, setSpeakerProfile] = useState<SpeakerProfile | null>(null);
  const [speakerLoading, setSpeakerLoading] = useState(true);
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/speakers/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSpeakerProfile(data);
        setSpeakerLoading(false);
      })
      .catch(() => setSpeakerLoading(false));
  }, []);

  async function handleSpeakerSave() {
    if (!speakerProfile) return;
    setSavingSpeaker(true);
    const res = await fetch("/api/speakers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designation: speakerProfile.designation, bio: speakerProfile.bio }),
    });
    if (res.ok) {
      onToast({ title: "Profile Updated", description: "Your speaker profile has been saved.", type: "success" });
    } else {
      onToast({ title: "Error", description: "Failed to save speaker profile.", type: "error" });
    }
    setSavingSpeaker(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/profile-image", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setSpeakerProfile((prev) => (prev ? { ...prev, photo_url: data.url } : prev));
      window.dispatchEvent(new CustomEvent("profile-photo-updated", { detail: { photoUrl: data.url } }));
      onToast({ title: "Photo Updated", description: "Your profile photo has been updated.", type: "success" });
    } else {
      URL.revokeObjectURL(previewUrl);
      setPhotoPreview(null);
      const data = await res.json();
      onToast({ title: "Upload Failed", description: data.error ?? "Could not upload photo.", type: "error" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (speakerLoading) return null;
  if (!speakerProfile) return null;

  const speakerInitials = speakerProfile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="material-symbols-rounded text-[28px] text-brand">badge</span>
          <h2 className="text-[24px] font-semibold text-fg leading-8">Speaker Profile</h2>
        </div>
        <button
          onClick={handleSpeakerSave}
          disabled={savingSpeaker}
          className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50"
        >
          {savingSpeaker ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted p-6">
          <button
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.value = "";
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="relative size-32 rounded-full border-4 border-white shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-4px_rgba(0,0,0,.1)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {(photoPreview ?? speakerProfile.photo_url) ? (
              <img
                src={photoPreview ?? speakerProfile.photo_url!}
                alt=""
                className="size-full rounded-full object-cover"
                onError={() => {
                  setPhotoPreview(null);
                  setSpeakerProfile((prev) => (prev ? { ...prev, photo_url: null } : prev));
                }}
              />
            ) : (
              <div className="grid size-full place-items-center rounded-full bg-brand/20 text-3xl font-bold text-brand">
                {speakerInitials}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors hover:bg-black/20">
              <span className="material-symbols-rounded text-2xl text-white opacity-0 transition-opacity hover:opacity-100">
                camera_alt
              </span>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoUpload} />
          <span className="mt-4 text-sm font-medium tracking-wider text-muted-foreground">
            {uploading ? "Uploading..." : "Change Photo"}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Professional Title</label>
            <input
              type="text"
              placeholder="e.g. Keynote Speaker"
              value={speakerProfile.designation ?? ""}
              onChange={(e) => setSpeakerProfile((prev) => (prev ? { ...prev, designation: e.target.value } : prev))}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Professional Bio</label>
        <textarea
          rows={4}
          placeholder="Tell attendees about yourself..."
          value={speakerProfile.bio ?? ""}
          onChange={(e) => setSpeakerProfile((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
          className={`${inputClass} resize-none whitespace-pre-wrap`}
        />
      </div>
    </div>
  );
}
