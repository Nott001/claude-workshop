"use client";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { InviteMemberDialog } from "@/modules/organization/ui/invite-member-dialog";
import { StaffTable } from "@/modules/organization/ui/staff-table";
import { useStaff } from "@/modules/organization/lib/use-staff";

export default function OrganizationPage() {
  const {
    userRole,
    members,
    total,
    page,
    search,
    loading,
    inviteOpen,
    pageSize,
    setPage,
    setInviteOpen,
    handleSearch,
    handleChangeRole,
    handleRemove,
    onInvited,
  } = useStaff();

  if (userRole !== "facilitator") return null;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto max-w-4xl flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Manage staff</h1>
          <Button onClick={() => setInviteOpen(true)}>
            <span className="material-symbols-rounded text-[18px]">person_add</span>
            Invite member
          </Button>
        </div>

        <StaffTable
          members={members}
          total={total}
          page={page}
          search={search}
          loading={loading}
          pageSize={pageSize}
          onSearch={handleSearch}
          onPageChange={setPage}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
        />

        <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={onInvited} />
      </div>
      <Footer role="facilitator" />
    </div>
  );
}
