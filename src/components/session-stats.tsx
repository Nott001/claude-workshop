"use client";

interface SessionStatsProps {
  progressPercent: number;
  activeParticipants: number;
}

export function SessionStats({ progressPercent, activeParticipants }: SessionStatsProps) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-1 flex-col gap-2 rounded-xl bg-white p-6 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium tracking-[0.7px] text-[#5f5e5e]">Session Progress</span>
          <span className="material-symbols-rounded text-[18px] text-[#5f5e5e]">trending_up</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[32px] font-semibold leading-10 tracking-[-0.32px] text-[#1b1c1c]">{progressPercent}%</span>
          <div className="flex h-5 flex-1 items-end pb-2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-[#e4e2e1]">
              <div
                className="h-full rounded-full bg-[#3db9ee] shadow-[0_0_8px_rgba(61,185,238,0.5)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 rounded-xl bg-white p-6 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium tracking-[0.7px] text-[#5f5e5e]">Active Participants</span>
          <span className="material-symbols-rounded text-[12px] text-[#5f5e5e]">group</span>
        </div>
        <div className="flex items-center">
          <span className="text-[32px] font-semibold leading-10 tracking-[-0.32px] text-[#1b1c1c]">
            {activeParticipants.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
