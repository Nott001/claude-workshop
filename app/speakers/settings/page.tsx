"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Footer } from "@/components/footer";
import { Toast } from "@/components/toast";

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  designation: string | null;
  photo_url: string | null;
  full_name: string;
  email: string;
}

export default function SpeakerSettingsPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<SpeakerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      const res = await fetch("/api/speakers/me");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setProfile(data);
        setFullName(data.full_name ?? "");
        setDesignation(data.designation ?? "");
        setBio(data.bio ?? "");
        setEmail(data.email ?? "");
        setLoading(false);
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/speakers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designation, bio }),
    });

    if (res.ok) {
      setToast({ title: "Settings Updated", description: "Your profile has been successfully saved." });
      setProfile((prev) => (prev ? { ...prev, designation, bio } : prev));
    }
    setSaving(false);
  }

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
      <div className="flex flex-1 flex-col px-16 pt-16 pb-12">
        <div className="mb-12 max-w-[1280px] w-full">
          <h1 className="text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-foreground">
            Account Settings
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Manage your speaker profile, credentials, and security preferences.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6 max-w-[1280px] w-full">
          <div className="col-span-12 rounded-xl border border-[#e5e7eb] bg-white/80 p-8 shadow-[0_4px_20px_rgba(0,0,0,.05)] backdrop-blur lg:col-span-8">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">Speaker Profile</h2>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#3db9ee] px-6 py-3 text-base font-semibold text-[#00465f] shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-4px_rgba(0,0,0,.1)] transition-colors hover:bg-[#239dce] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center rounded-xl bg-[#efeded] p-6">
                <div className="relative size-32 rounded-full border-4 border-white shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-4px_rgba(0,0,0,.1)]">
                  {profile?.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt={fullName}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center rounded-full bg-[#c2e8ff] text-3xl font-bold text-[#3db9ee]">
                      {initials}
                    </div>
                  )}
                </div>
                <span className="mt-4 text-sm font-medium tracking-wider text-muted-foreground">
                  Change Avatar
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium tracking-wider text-muted-foreground">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-base text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium tracking-wider text-muted-foreground">
                    Professional Title
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-base text-foreground"
                  />
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium tracking-wider text-muted-foreground">
                  Professional Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-base text-foreground whitespace-pre-wrap"
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 rounded-xl border border-[#e5e7eb] bg-white/80 p-8 shadow-[0_4px_20px_rgba(0,0,0,.05)] backdrop-blur lg:col-span-4">
            <div className="mb-6 flex items-center gap-2.5">
              <span className="material-symbols-rounded text-xl text-muted-foreground">mail</span>
              <h2 className="text-2xl font-semibold text-foreground">Contact</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium tracking-wider text-muted-foreground">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-base text-foreground opacity-70"
              />
            </div>

            <Link
              href="/speakers/update-info"
              className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-[#bdc8d0] bg-white px-4 py-3 text-sm font-semibold text-[#00658d] transition-colors hover:border-[#3db9ee] hover:text-[#1789b8]"
            >
              <span className="material-symbols-rounded text-[18px]">edit</span>
              Update Email & Password
            </Link>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast title={toast.title} description={toast.description} type="success" onClose={() => setToast(null)} />
        </div>
      )}

      <Footer role="speaker" />
    </div>
  );
}
