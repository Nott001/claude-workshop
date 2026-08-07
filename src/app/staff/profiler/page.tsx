"use client";

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { ProfilerPanel } from "@/modules/profiler/components/profiler-panel";

export default function StaffProfilerPage() {
  const { allowed, pending } = useRoleGuard("facilitator");

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[1024px] px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Runtime Profiler</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Memory and live-object counts for this browser tab. Dev-only: the build strips it from production.
          </p>
        </div>
        <ProfilerPanel />
      </div>
    </div>
  );
}
