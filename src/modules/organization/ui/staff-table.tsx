"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/types";
import type { StaffMember } from "@/modules/organization";

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

interface Props {
  members: StaffMember[];
  total: number;
  page: number;
  search: string;
  loading: boolean;
  pageSize: number;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onChangeRole: (member: StaffMember, newRole: UserRole) => void;
  onRemove: (member: StaffMember) => void;
}

export function StaffTable({
  members,
  total,
  page,
  search,
  loading,
  pageSize,
  onSearch,
  onPageChange,
  onChangeRole,
  onRemove,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getManageItems = useCallback(
    (member: StaffMember): DropdownMenuItem[] => {
      const otherRoles = (["attendee", "speaker", "facilitator"] as UserRole[]).filter((r) => r !== member.role);
      return [
        ...otherRoles.map((r) => ({
          label: `Change to ${ROLE_LABELS[r]}`,
          icon: "swap_horiz",
          onClick: () => onChangeRole(member, r),
        })),
        { label: "Remove member", icon: "person_remove", onClick: () => onRemove(member), danger: true },
      ];
    },
    [onChangeRole, onRemove],
  );

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
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
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
