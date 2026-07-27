"use client";

interface SpeakerProfile {
  id: number;
  bio: string | null;
  designation: string | null;
  USERS?: { full_name: string; email: string } | null;
}

interface EventSpeaker {
  SPEAKER_PROFILES: SpeakerProfile;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export function SpeakerSection({
  speakers,
  variant = "attendee",
}: {
  speakers: EventSpeaker[];
  variant?: "facilitator" | "attendee";
}) {
  if (speakers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-[rgba(255,255,255,0.9)] px-8 py-6 text-center text-sm text-muted-fg shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        No speaker assigned yet
      </div>
    );
  }

  const sp = speakers[0].SPEAKER_PROFILES;
  const name = sp.USERS?.full_name || "Speaker";
  const initials = getInitials(name);

  if (variant === "facilitator") {
    return (
      <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
        <div className="flex items-center gap-5">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-brand/20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <span className="text-xl font-bold text-brand">{initials || "SP"}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-fg">{name}</p>
            {sp.designation && (
              <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-fg">{sp.designation}</p>
            )}
            {sp.USERS?.email && <p className="mt-1 text-sm text-muted-fg">{sp.USERS.email}</p>}
            {sp.bio && <p className="mt-2 text-sm leading-[22px] text-muted-fg">{sp.bio}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-8 text-[24px] font-semibold text-fg">Speaker</h2>
      <div className="flex items-center gap-8 rounded-xl border border-[rgba(189,200,208,0.2)] bg-muted p-8">
        <div className="grid size-[100px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-brand/20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <span className="text-2xl font-bold text-brand">{initials}</span>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-[24px] font-semibold text-fg">{name}</h3>
            <p className="text-sm font-medium uppercase tracking-[0.05em] text-muted-fg">{sp.designation || "Speaker"}</p>
          </div>
          {sp.bio && <p className="text-base text-muted-fg">{sp.bio}</p>}
        </div>
      </div>
    </div>
  );
}
