"use client";

export type ModuleStatus = "completed" | "in_progress" | "upcoming";

interface Module {
  id: number;
  title: string;
  description: string;
  status: ModuleStatus;
  duration?: string;
}

interface CourseSyllabusProps {
  modules: Module[];
  onMarkComplete?: (moduleId: number) => void;
  onPrepareDraft?: (moduleId: number) => void;
}

function TimelineIcon({ status, index }: { status: ModuleStatus; index: number }) {
  if (status === "completed") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-full border-2 border-[#22c55e] bg-[#dcfce7] p-[2px]">
          <span className="material-symbols-rounded text-[16px] text-[#22c55e]">check</span>
        </div>
        <div className="h-10 w-0.5 bg-[#bdc8d0]" />
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#3db9ee]">
          <span className="material-symbols-rounded text-[18px] text-white">play_arrow</span>
        </div>
        <div className="h-10 w-0.5 bg-[#bdc8d0]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex size-10 items-center justify-center rounded-full border-2 border-[#bdc8d0] p-[2px]">
        <span className="text-sm font-medium text-[#5f5e5e]">{index + 1}</span>
      </div>
    </div>
  );
}

export function CourseSyllabus({ modules, onMarkComplete, onPrepareDraft }: CourseSyllabusProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-[#bdc8d0] bg-[#fbf9f8] px-6 py-6">
        <h2 className="text-[24px] font-semibold text-[#1b1c1c]">Course Syllabus</h2>
        <span className="rounded-full bg-[#c2e8ff] px-3 py-1 text-sm font-medium tracking-[0.7px] text-[#3db9ee]">
          Interactive Session
        </span>
      </div>

      <div>
        {modules.map((mod, i) => {
          const isCompleted = mod.status === "completed";
          const isActive = mod.status === "in_progress";

          const rowBg = isCompleted ? "bg-[rgba(219,218,217,0.2)] opacity-60" : isActive ? "bg-[rgba(194,232,255,0.05)]" : "";

          const rowBorder = isActive
            ? "border-inset shadow-[inset_0px_0px_0px_2px_#068]"
            : i < modules.length - 1
              ? "border-b border-[#bdc8d0]"
              : "";

          return (
            <div
              key={mod.id}
              className={`flex gap-6 px-6 py-6 ${rowBg} ${rowBorder}`}
              style={isActive ? { boxShadow: "inset 0 0 0 2px #006888" } : undefined}
            >
              <TimelineIcon status={mod.status} index={i} />

              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className={`text-[20px] leading-[30px] ${isActive ? "text-[#3db9ee]" : "text-[#1b1c1c]"}`}>
                    {mod.title}
                  </h3>
                  {isActive && (
                    <span className="rounded-full bg-[#3db9ee] px-3 py-1 text-xs font-bold text-[#00465f]">
                      SPEAKER IS HERE
                    </span>
                  )}
                </div>

                <p className="text-base leading-6 text-[#3e484f]">{mod.description}</p>

                {isCompleted && mod.duration && (
                  <span className="pt-1 text-xs font-bold uppercase tracking-wide text-[#16a34a]">
                    COMPLETED - {mod.duration} DURATION
                  </span>
                )}

                {isActive && (
                  <div className="flex gap-4 pt-5">
                    <button className="flex items-center gap-2 rounded-lg bg-[#3db9ee] px-6 py-3 font-bold text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]">
                      <span className="material-symbols-rounded text-[14px]">play_arrow</span>
                      In Progress
                    </button>
                    <button
                      onClick={() => onMarkComplete?.(mod.id)}
                      className="rounded-lg border border-[#3db9ee] px-6 py-3 font-bold text-[#3db9ee]"
                    >
                      Mark Complete
                    </button>
                  </div>
                )}

                {mod.status === "upcoming" && (
                  <button onClick={() => onPrepareDraft?.(mod.id)} className="self-end pt-2 text-base font-bold text-[#3db9ee]">
                    Prepare Draft
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
