"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/types";
import { Footer } from "@/components/footer";

interface StaffMember {
  user_id: number;
  full_name: string;
  email: string;
  role: UserRole;
}

const ROLE_LABELS: Record<UserRole, string> = {
  attendee: "Attendee",
  speaker: "Speaker",
  facilitator: "Facilitator",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function OrganizationPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("speaker");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  async function handleInvite() {
    setInviteError(null);
    setInviteLoading(true);
    const res = await fetch("/api/organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: inviteName, email: inviteEmail, role: inviteRole }),
    });
    setInviteLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setInviteError(data.error?.message ?? "Failed to invite member");
      return;
    }
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("speaker");
    setRefreshKey((k) => k + 1);
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

  function getManageItems(member: StaffMember): DropdownMenuItem[] {
    const otherRoles = (["attendee", "speaker", "facilitator"] as UserRole[]).filter((r) => r !== member.role);
    return [
      ...otherRoles.map((r) => ({
        label: `Change to ${ROLE_LABELS[r]}`,
        icon: "swap_horiz",
        onClick: () => handleChangeRole(member, r),
      })),
      { label: "Remove member", icon: "person_remove", onClick: () => handleRemove(member), danger: true },
    ];
  }

  if (userRole !== "facilitator") return null;

  return (
    <>
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Manage staff</h1>
        <Button onClick={() => setInviteOpen(true)}>
          <span className="material-symbols-rounded text-[18px]">person_add</span>
          Invite member
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading staff...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff members found.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.user_id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(member.full_name)}
                        </div>
                        <span className="font-medium">{member.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {ROLE_LABELS[member.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu
                        trigger={
                          <Button variant="ghost" size="sm">
                            Manage
                          </Button>
                        }
                        items={getManageItems(member)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} members
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                placeholder="Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@startuplab.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facilitator">Facilitator</SelectItem>
                  <SelectItem value="speaker">Speaker</SelectItem>
                  <SelectItem value="attendee">Attendee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteName || !inviteEmail}>
              {inviteLoading ? "Inviting..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <Footer role="facilitator" />
    </>
  );
}
