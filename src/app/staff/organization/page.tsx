"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth";
import { Footer } from "@/shared/components/footer";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import type { UserRole } from "@/shared/types";

interface Member {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
}

const roleBadgeVariant: Record<UserRole, "default" | "success" | "warning" | "error" | "info"> = {
  attendee: "default",
  speaker: "info",
  facilitator: "success",
  admin: "warning",
  super_admin: "error",
};

const INVITE_ROLES: UserRole[] = ["speaker", "facilitator", "admin"];

export default function StaffOrganizationPage() {
  const { user } = useSession();
  const userRole = user?.role ?? null;
  const isAdmin = hasMinRole(userRole, "admin");
  const isSuperAdmin = hasMinRole(userRole, "super_admin");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("speaker");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/organization?pageSize=50");
      if (res.ok) {
        const data = await res.json();
        if (!cancelled) setMembers(data.users ?? []);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);

    const res = await fetch("/api/organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: inviteName, email: inviteEmail, role: inviteRole }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setInviteError(data?.error?.message ?? "Failed to invite member");
      setInviting(false);
      return;
    }

    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("speaker");
    setInviting(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleRemove(userId: number) {
    if (!confirm("Remove this member from the organization?")) return;

    const res = await fetch(`/api/organization/${userId}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error?.message ?? "Failed to remove member");
      return;
    }

    setRefreshKey((k) => k + 1);
  }

  const allowedInviteRoles = isSuperAdmin ? INVITE_ROLES : INVITE_ROLES.filter((r) => r !== "admin");

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

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-fg">Full name</label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg">Email</label>
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  type="email"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg">Role</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedInviteRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {inviteError && <p className="text-xs text-error">{inviteError}</p>}

              <DialogFooter>
                <Button type="submit" disabled={!inviteName.trim() || !inviteEmail.trim() || inviting}>
                  {inviting ? "Inviting..." : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-fg">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-fg">No members found.</p>
        ) : (
          <div className="rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  {isAdmin && <th className="px-4 py-3 text-left font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{m.full_name}</td>
                    <td className="px-4 py-3 text-muted-fg">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadgeVariant[m.role] ?? "default"}>{m.role}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-xs text-error hover:underline disabled:opacity-50"
                          disabled={m.id === user?.id}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer role={userRole} />
    </div>
  );
}
