"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import StaffSupportInbox from "@/modules/chat/components/staff-support-inbox";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";

export default function StaffSupportPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!allowed) return null;

  return (
    <StaffPage>
      <StaffPageHeader title="General Support Inbox" description="Claim a case to handle it end to end." />
      <StaffSupportInbox />
    </StaffPage>
  );
}
