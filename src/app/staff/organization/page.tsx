"use client";

import { INVITABLE_ROLES, ROLES, STAFF_ROLES } from "@/shared/lib/roles";
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
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableBodyState,
  TableContainer,
} from "@/shared/components/table";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { Pagination } from "@/shared/components/table-pagination";
import { Drawer } from "@/shared/components/drawer";
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

type RoleFilter = "all" | UserRole;

// The filter shows every staff role, not just the ones this user may hand out.
const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  ...STAFF_ROLES.map((role) => ({ value: role as RoleFilter, label: roleLabel(role) })),
];

export default function StaffOrganizationPage() {
  const { user } = useSession();
  const { role: userRole, allowed: isAdmin, pending } = useRoleGuard(ROLES.ADMIN);
  const isSuperAdmin = hasMinRole(userRole, ROLES.SUPER_ADMIN);

  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selected, setSelected] = useState<Member | null>(null);

  // The route's PAGE_SIZE is 10, so the client's page size must agree or the
  // pagination math comes out wrong.
  const pageSize = 10;

  // Debounced server-side search: keystrokes update the input immediately but
  // only settle into a fetch after the pause, so each term triggers one request.
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/organization?${params}`);
      if (!cancelled) {
        if (res.ok) {
          const data = await res.json();
          setMembers(data.users ?? []);
          setTotal(data.total ?? 0);
          setError(null);
        } else {
          setError("Failed to refresh members — showing last loaded results.");
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, roleFilter, refreshKey]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleRoleFilter(filter: RoleFilter) {
    setRoleFilter(filter);
    setPage(1);
  }

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

        <TableToolbar search={{ value: search, onChange: handleSearch, placeholder: "Search name or email..." }}>
          <Select value={roleFilter} onValueChange={(v) => handleRoleFilter(v as RoleFilter)}>
            <SelectTrigger>
              <SelectValue>{ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label ?? "All roles"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableToolbar>

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

        {error && members.length > 0 && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell className="w-64">Email</TableHeadCell>
                <TableHeadCell className="w-28">Role</TableHeadCell>
                <TableHeadCell className="w-12" aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody busy={loading && members.length > 0}>
              <TableBodyState
                ready={members.length > 0}
                loading={loading}
                colSpan={4}
                empty={{
                  icon: "group",
                  title: "No members found",
                  hint: debouncedSearch ? "Try a different search term." : "No members match the current filter.",
                }}
              >
                {members.map((m) => (
                  <TableRow key={m.id} onClick={() => setSelected(m)} aria-label={`Manage ${m.full_name}`}>
                    <TableCell className="truncate font-medium">{m.full_name}</TableCell>
                    <TableCell className="truncate text-muted-fg">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[m.role] ?? "default"}>{m.role}</Badge>
                    </TableCell>
                    <TableCell className="w-12">
                      <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                        chevron_right
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBodyState>
            </TableBody>
          </Table>
        </TableContainer>

        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      </div>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.full_name ?? ""}
        description={selected?.email}
        footer={
          selected && isAdmin && selected.id !== user?.id ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/10"
                onClick={() => handleRemove(selected.id)}
              >
                Remove
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Role</span>
              <Badge variant={roleBadgeVariant[selected.role] ?? "default"}>{selected.role}</Badge>
            </div>
          </div>
        )}
      </Drawer>

      {inviteToast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast key={inviteToast.id} title="Invitation sent" description={inviteToast.description} onClose={dismissToast} />
        </div>
      )}
    </div>
  );
}
