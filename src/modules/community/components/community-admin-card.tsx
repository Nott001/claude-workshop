"use client";

import { useState } from "react";
import type { CommunityLink } from "@/shared/types";
import { CommunityForm, type CommunityFormValues } from "@/modules/community/components/community-form";

interface CommunityAdminCardProps {
  link: CommunityLink;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onEdit: (values: CommunityFormValues) => Promise<void>;
}

export function CommunityAdminCard({
  link,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  onDelete,
  onEdit,
}: CommunityAdminCardProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">Edit group</span>
          <span className="text-xs text-muted-fg">#{link.sequence_order}</span>
        </div>
        <CommunityForm
          mode="edit"
          initialValues={{
            label: link.label,
            url: link.url,
            description: link.description ?? "",
            icon_url: link.icon_url ?? "",
          }}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await onEdit(values);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-surface p-6 ${link.is_hidden ? "border-dashed border-border opacity-70" : "border-border"}`}
    >
      <div className="flex items-center gap-4">
        {link.icon_url ? (
          <img src={link.icon_url} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <span className="material-symbols-rounded text-2xl">groups</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{link.label}</h3>
            {link.is_hidden && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-fg">Hidden</span>
            )}
          </div>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-xs text-brand hover:underline"
          >
            {link.url}
          </a>
        </div>
      </div>

      {link.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{link.description}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`Move ${link.label} up`}
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="material-symbols-rounded text-base">arrow_upward</span>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`Move ${link.label} down`}
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="material-symbols-rounded text-base">arrow_downward</span>
        </button>

        <span className="mx-1 h-6 w-px bg-border" />

        <button
          type="button"
          onClick={onToggleHidden}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-fg transition-colors hover:bg-muted hover:text-fg"
        >
          <span className="material-symbols-rounded text-base">{link.is_hidden ? "visibility" : "visibility_off"}</span>
          {link.is_hidden ? "Unhide" : "Hide"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-fg transition-colors hover:bg-muted hover:text-fg"
        >
          <span className="material-symbols-rounded text-base">edit</span>
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg border border-error/30 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
        >
          <span className="material-symbols-rounded text-base">delete</span>
          Delete
        </button>
      </div>
    </div>
  );
}
