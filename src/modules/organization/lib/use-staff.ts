"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import type { UserRole } from "@/types";
import type { StaffMember } from "@/modules/organization";

export function useStaff() {
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

  return {
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
    onInvited: () => setRefreshKey((k) => k + 1),
  };
}
