"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types";
import { Footer } from "@/components/footer";
import type { StaffMember } from "@/modules/organization";
import { InviteMemberDialog } from "@/modules/organization/ui/invite-member-dialog";
import { StaffTable } from "@/modules/organization/ui/staff-table";

export default function OrganizationPage() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageSize = 10;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
    let ignore = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/organization?${params}`);
      if (res.ok && !ignore) {
        const data = await res.json();
        setMembers(data.users);
        setTotal(data.total);
      }
      if (!ignore) setLoading(false);
    }
    load();

    return () => {
      ignore = true;
    };
  }, [userRole, page, search, refreshKey]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleChangeRole(member: StaffMember, newRole: UserRole) {
    const res = await fetch(`/api/organization/${member.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  async function handleRemove(member: StaffMember) {
    if (!confirm(`Remove ${member.full_name}?`)) return;
    const res = await fetch(`/api/organization/${member.user_id}`, { method: "DELETE" });
    if (res.ok) {
      if (members.length === 1 && page > 1) setPage((p) => p - 1);
      else setRefreshKey((k) => k + 1);
    }
  }

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

        <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => setRefreshKey((k) => k + 1)} />
      </div>
      <Footer role="facilitator" />
    </div>
  );
}
