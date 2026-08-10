"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import StaffSupportInbox from "@/modules/chat/components/staff-support-inbox";

export default function StaffSupportPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-8">
        <div>
          <h1 className="text-xl font-bold">General Support Inbox</h1>
          <p className="text-sm text-muted-fg">Claim a case to handle it end to end.</p>
        </div>
        <StaffSupportInbox />
      </div>
    </div>
  );
}
