"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { CommunityAdminCard } from "@/modules/community/components/community-admin-card";
import { CommunityForm, type CommunityFormValues } from "@/modules/community/components/community-form";
import { useCommunityLinks } from "@/modules/community/lib/use-community-links";
import { Button } from "@/shared/components/button";
import { StaffPage, StaffPageHeader, StaffPageState, StaffPageSkeleton } from "@/shared/components/staff-page";
import { useState } from "react";

export function StaffCommunityListPage() {
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const { links, loading, error, reload } = useCommunityLinks();
  const [showCreate, setShowCreate] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function patch(id: number, body: unknown) {
    const res = await fetch(`/api/community/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  }

  async function runMutation(action: () => Promise<void>) {
    setMutationError(null);
    try {
      await action();
      await reload();
    } catch {
      setMutationError("Something went wrong. Check the group and try again.");
    }
  }

  async function createLink(values: CommunityFormValues) {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    await runMutation(() => Promise.resolve());
    setShowCreate(false);
  }

  function move(index: number, direction: -1 | 1) {
    const neighbor = index + direction;
    if (neighbor < 0 || neighbor >= links.length) return;
    const a = links[index];
    const b = links[neighbor];
    // Each arrow swaps sequence_order with its neighbor, so two PATCHes trade
    // the values between the adjacent cards.
    runMutation(async () => {
      await Promise.all([patch(a.id, { sequence_order: b.sequence_order }), patch(b.id, { sequence_order: a.sequence_order })]);
    });
  }

  function toggleHidden(linkId: number) {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    runMutation(async () => {
      await patch(linkId, { is_hidden: !link.is_hidden });
    });
  }

  function remove(linkId: number) {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    if (!confirm(`Delete ${link.label}? This cannot be undone.`)) return;
    runMutation(async () => {
      const res = await fetch(`/api/community/${linkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    });
  }

  if (pending || loading) {
    return <StaffPageSkeleton />;
  }

  if (!allowed) return null;

  if (error) {
    return <StaffPageState tone="error">Failed to load community groups.</StaffPageState>;
  }

  return (
    <StaffPage>
      <StaffPageHeader
        title="Community groups"
        description="Manage the cards shown on the community page."
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <span className="material-symbols-rounded text-base">{showCreate ? "close" : "add"}</span>
            {showCreate ? "Close" : "Add group"}
          </Button>
        }
      />

      {showCreate && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <span className="mb-4 block text-sm font-semibold text-fg">New group</span>
          <CommunityForm mode="create" submitLabel="Add group" onCancel={() => setShowCreate(false)} onSubmit={createLink} />
        </div>
      )}

      {mutationError && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{mutationError}</div>
      )}

      {links.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-8 text-center">
          <span aria-hidden className="material-symbols-rounded mb-1 text-2xl text-muted-fg">
            forum
          </span>
          <p className="text-xs font-medium text-fg">No community groups yet</p>
          <p className="mt-0.5 text-[10px] text-muted-fg">Add the first one.</p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link, index) => (
            <CommunityAdminCard
              key={link.id}
              link={link}
              isFirst={index === 0}
              isLast={index === links.length - 1}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onToggleHidden={() => toggleHidden(link.id)}
              onDelete={() => remove(link.id)}
              onEdit={async (values) => {
                await patch(link.id, values);
                await reload();
              }}
            />
          ))}
        </div>
      )}
    </StaffPage>
  );
}
