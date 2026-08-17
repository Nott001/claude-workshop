"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { ProfilerPanel } from "@/modules/profiler/components/profiler-panel";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";

export default function StaffProfilerPage() {
  const { allowed, pending } = useRoleGuard(ROLES.FACILITATOR);

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!allowed) return null;

  return (
    <StaffPage>
      <StaffPageHeader
        title="Runtime Profiler"
        description="Memory and live-object counts for this browser tab. Dev-only: the build strips it from production."
      />
      <ProfilerPanel />
    </StaffPage>
  );
}
