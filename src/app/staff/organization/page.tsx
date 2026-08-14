"use client";

import { INVITABLE_ROLES, ROLES } from "@/shared/lib/roles";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { Button } from "@/shared/components/button";
import { Badge } from "@/shared/components/badge";
import { Input } from "@/shared/components/input";
import { Toast } from "@/shared/components/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";

interface Member {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
}

// Every invitable role is a single word, so this is the whole of it. Shared by
// the role picker and the confirmation so the two never drift apart.
const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

// `id` exists to re-key the Toast. Without it a second invitation reuses the
// mounted instance, whose dismissal timer is still counting down for the first
// message, and the new one disappears early.
interface InviteToast {
  id: number;
  description: string;
}

const roleBadgeVariant: Record<UserRole, "default" | "success" | "warning" | "error" | "info"> = {
  attendee: "default",
  speaker: "info",
  facilitator: "success",
  admin: "warning",
  super_admin: "error",
};

export default function StaffOrganizationPage() {
  const { user } = useSession();
  const { role: userRole, allowed: isAdmin, pending } = useRoleGuard(ROLES.ADMIN);
  const isSuperAdmin = hasMinRole(userRole, ROLES.SUPER_ADMIN);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>(ROLES.SPEAKER);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteToast, setInviteToast] = useState<InviteToast | null>(null);
  const [inviting, setInviting] = useState(false);

  // Stable, so an unrelated re-render of this page does not restart the Toast's
  // dismissal effect and leave the message on screen indefinitely.
  const dismissToast = useCallback(() => setInviteToast(null), []);

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

    // Read before the fields are cleared below — these still hold what was sent.
    setInviteToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      description: `${inviteEmail} was invited as ${inviteRole}.`,
    }));

    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole(ROLES.SPEAKER);
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

  const allowedInviteRoles = isSuperAdmin ? INVITABLE_ROLES : INVITABLE_ROLES.filter((r) => r !== ROLES.ADMIN);

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex flex-1 flex-col">
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
                        {roleLabel(r)}
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

      {inviteToast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast key={inviteToast.id} title="Invitation sent" description={inviteToast.description} onClose={dismissToast} />
        </div>
      )}
    </div>
  );
}
