"use client";

import { ALL_ROLES, ASSIGNABLE_ROLES, INVITABLE_ROLES, ROLES } from "@/shared/lib/roles";
import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/shared/lib/api-error-message";
import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { Button } from "@/shared/components/button";
import { Badge } from "@/shared/components/badge";
import { Input } from "@/shared/components/input";
import { Toast } from "@/shared/components/toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";
import { canGrantRole } from "@/shared/lib/role-hierarchy";
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
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import { Drawer } from "@/shared/components/drawer";
import type { UserRole } from "@/shared/types";

interface Member {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
}

// Shared by the filter, the role pickers and the confirmations so they never
// drift apart. `super_admin` is the only role whose name is not one word, and
// showing it as typed in the database reads as a bug to the person looking.
const roleLabel = (role: string) => {
  const spaced = role.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// `id` exists to re-key the Toast. Without it a second message reuses the
// mounted instance, whose dismissal timer is still counting down for the first
// one, and the new message disappears early.
interface PageToast {
  id: number;
  title: string;
  description: string;
}

const roleBadgeVariant: Record<UserRole, "default" | "success" | "warning" | "error" | "info"> = {
  attendee: "default",
  speaker: "info",
  facilitator: "success",
  admin: "warning",
  super_admin: "error",
};

/**
 * Why this member cannot be acted on, or null when they can be.
 *
 * The reasons the route refuses, phrased for the person reading them, so the
 * answer arrives before the request rather than as a failed one.
 */
function memberLockReason(member: Member, viewerId: number | undefined): string | null {
  if (member.role === ROLES.SUPER_ADMIN) return "A super admin's role is set in the database and cannot be changed here.";
  if (member.id === viewerId) return "You cannot change your own role.";
  return null;
}

// Role pickers and the delete button are gated separately: a peer admin may
// still be demoted, but an irreversible delete is strictly-lower only.
const canDeleteUser = (member: Member, viewerId: number | undefined, actorRole: UserRole | null) => {
  if (member.role === ROLES.SUPER_ADMIN) return false;
  if (member.id === viewerId) return false;
  return canGrantRole(actorRole, member.role);
};

type RoleFilter = "all" | "all_users" | UserRole;

// Every role, not just the ones this user may hand out — and attendee among
// them, since picking it is how an admin finds somebody to promote.
const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Staff only" },
  { value: "all_users", label: "All users" },
  ...ALL_ROLES.map((role) => ({ value: role as RoleFilter, label: roleLabel(role) })),
];

export default function StaffUsersPage() {
  const { user } = useSession();
  const { role: userRole, allowed: isAdmin, pending } = useRoleGuard(ROLES.ADMIN);

  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>(ROLES.SPEAKER);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [toast, setToast] = useState<PageToast | null>(null);
  const [inviting, setInviting] = useState(false);

  const [roleError, setRoleError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // Stable, so an unrelated re-render of this page does not restart the Toast's
  // dismissal effect and leave the message on screen indefinitely.
  const dismissToast = useCallback(() => setToast(null), []);

  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selected, setSelected] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      if (roleFilter === "all_users") params.set("scope", "all");
      else if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/users?${params}`);
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

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: inviteName, email: inviteEmail, role: inviteRole }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setInviteError(apiErrorMessage(data, "Failed to invite member"));
      setInviting(false);
      return;
    }

    // Read before the fields are cleared below — these still hold what was sent.
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      title: "Invitation sent",
      description: `${inviteEmail} was invited as ${inviteRole}.`,
    }));

    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole(ROLES.SPEAKER);
    setInviting(false);
    setRefreshKey((k) => k + 1);
  }

  // A failure belongs to the person it was about, so it is cleared on the way
  // into the drawer rather than left over the next member opened.
  function openMember(member: Member) {
    setRoleError(null);
    setSelected(member);
  }

  async function handleRoleChange(member: Member, role: UserRole) {
    setRoleError(null);
    setSavingRole(true);

    const res = await fetch(`/api/users/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRoleError(apiErrorMessage(data, "Failed to change the role"));
      setSavingRole(false);
      return;
    }

    // The drawer stays open on the same person, so it has to show the new role
    // rather than the one the list was fetched with.
    setSelected({ ...member, role });
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      title: "Role updated",
      description: `${member.full_name} is now ${roleLabel(role).toLowerCase()}.`,
    }));
    setSavingRole(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(apiErrorMessage(data, "Failed to delete user"));
      setDeleting(false);
      // The teardown may already have tombstoned the row server-side even when a
      // later step (the auth identity) failed, so the roster is refetched here
      // too rather than holding a row the server has already removed.
      setRefreshKey((k) => k + 1);
      return;
    }
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      title: "User deleted",
      description: `${deleteTarget.full_name} was deleted.`,
    }));
    setDeleteTarget(null);
    setSelected(null);
    setDeleting(false);
    setRefreshKey((k) => k + 1);
  }

  // The predicate the write paths apply, asked here too so neither picker can
  // offer what the server would refuse. Both ends are needed — this one is only
  // the UI — but they are now the same question rather than two copies of it.
  const allowedInviteRoles = INVITABLE_ROLES.filter((r) => canGrantRole(userRole, r));
  const allowedAssignableRoles = ASSIGNABLE_ROLES.filter((r) => canGrantRole(userRole, r));

  // One answer drives both the picker and the delete button, which the route
  // refuses under the same conditions — computing it twice is how the two would
  // come to disagree.
  const lockReason = selected ? memberLockReason(selected, user?.id) : null;

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!isAdmin) return null;

  return (
    <>
      <StaffPage>
        <StaffPageHeader
          title="Manage users"
          description="Invite members, set the role each one holds, and delete accounts."
          actions={
            <Button onClick={() => setInviteOpen(true)}>
              <span className="material-symbols-rounded text-[18px]">person_add</span>
              Invite member
            </Button>
          }
        />

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

        <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteTarget?.full_name}?</DialogTitle>
              <DialogDescription>
                Their account and all personal data — tickets, chat, survey responses and any speaker profile — will be
                permanently deleted. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && <p className="text-xs text-error">{deleteError}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="secondary">Cancel</Button>} />
              <Button variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {error && members.length > 0 && <p className="mb-3 text-sm text-error">{error}</p>}

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
                  <TableRow key={m.id} onClick={() => openMember(m)} aria-label={`Manage ${m.full_name}`}>
                    <TableCell className="truncate font-medium">{m.full_name}</TableCell>
                    <TableCell className="truncate text-muted-fg">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[m.role] ?? "default"}>{roleLabel(m.role)}</Badge>
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
      </StaffPage>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.full_name ?? ""}
        description={selected?.email}
        footer={
          selected && isAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/10"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(selected);
                }}
                disabled={!canDeleteUser(selected, user?.id, userRole)}
              >
                Delete user
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Role</span>
              <Badge variant={roleBadgeVariant[selected.role] ?? "default"}>{roleLabel(selected.role)}</Badge>
            </div>

            {lockReason ? (
              <p className="text-xs text-muted-fg">{lockReason}</p>
            ) : (
              <div>
                <label htmlFor="member-role" className="mb-1 block text-xs font-medium text-fg">
                  Change role
                </label>
                <Select
                  value={selected.role}
                  onValueChange={(v) => handleRoleChange(selected, v as UserRole)}
                  disabled={savingRole}
                >
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue>{roleLabel(selected.role)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allowedAssignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roleError && <p className="mt-2 text-xs text-error">{roleError}</p>}
              </div>
            )}

            {selected && !lockReason && !canDeleteUser(selected, user?.id, userRole) && (
              <p className="text-xs text-muted-fg">You can only delete users in a role you outrank.</p>
            )}
          </div>
        )}
      </Drawer>

      {toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast key={toast.id} title={toast.title} description={toast.description} onClose={dismissToast} />
        </div>
      )}
    </>
  );
}
