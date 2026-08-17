"use client";

import { useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
import type { ContentType } from "@/shared/types";
import type { MoveDirection } from "../lib/reorder";

export interface LessonRowProps {
  /** "2.3" — module order and lesson order. */
  ordinal: string;
  name: string;
  description: string | null;
  contentType: ContentType;
  contentUrl: string | null;
  /** A file chosen but not yet uploaded, named so the reader can see which. */
  pendingFileName: string | null;
  editing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSource?: boolean;
  isSwapTarget?: boolean;
  isFlash?: boolean;
  onView: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string | null) => void;
  onMove: (direction: MoveDirection) => void;
  onDelete: () => void;
  onRemoveMaterial: () => void;
  onPickFile: (file: File) => void;
  /** A lesson can point at an external link instead of a stored file. */
  linkUrl: string;
  onLinkChange: (value: string) => void;
  /** Other lesson modules this lesson can be sent to, outside edit mode. */
  moveTargets: { id: number; name: string }[];
  onMoveToModule: (moduleId: number) => void;
}

/**
 * Two shapes, one row. Read-only it is a line of text; in edit mode the same
 * fields become inputs outright rather than click-to-edit — an edit affordance
 * you have to discover is the reason the previous editor went unfound, and the
 * module's Edit button has already said what mode this is.
 */
export function LessonRow({
  ordinal,
  name,
  description,
  contentType,
  contentUrl,
  pendingFileName,
  editing,
  canMoveUp,
  canMoveDown,
  isSource,
  isSwapTarget,
  isFlash,
  onView,
  onNameChange,
  onDescriptionChange,
  onMove,
  onDelete,
  onRemoveMaterial,
  onPickFile,
  linkUrl,
  onLinkChange,
  moveTargets,
  onMoveToModule,
}: LessonRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasMaterial = contentUrl !== null || pendingFileName !== null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-4 py-2.5 transition-all",
        isSource && "border-brand/50 bg-brand/5",
        isSwapTarget && "border-brand/60 ring-2 ring-brand/40",
        isFlash && "curriculum-flash",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-xs font-medium text-muted-fg">{ordinal}</span>

          {editing ? (
            <input
              value={name}
              aria-label={`Lesson ${ordinal} name`}
              maxLength={255}
              onChange={(e) => onNameChange(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <span className="truncate text-sm text-fg">{name}</span>
          )}

          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-muted-fg">
            {contentType}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!editing && (
            <>
              {hasMaterial && (
                <Button variant="secondary" size="sm" onClick={onView}>
                  <span aria-hidden className="material-symbols-rounded text-[14px]">
                    visibility
                  </span>
                  View
                </Button>
              )}
              {moveTargets.length > 0 && (
                // Writes through immediately: the destination module is not the
                // one being edited, so no Save here could ever cover it.
                <select
                  value=""
                  aria-label={`Move ${name} to another module`}
                  onChange={(e) => e.target.value !== "" && onMoveToModule(Number(e.target.value))}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Move to…</option>
                  {moveTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {editing && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onMove("up")}
                disabled={!canMoveUp}
                aria-label={`Move ${name} up`}
              >
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  arrow_upward
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onMove("down")}
                disabled={!canMoveDown}
                aria-label={`Move ${name} down`}
              >
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  arrow_downward
                </span>
              </Button>
              <Button variant="danger" size="sm" onClick={onDelete} aria-label={`Remove ${name}`}>
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  delete
                </span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6">
        {editing ? (
          <input
            value={description ?? ""}
            aria-label={`Lesson ${ordinal} description`}
            placeholder="Add description"
            maxLength={140}
            onChange={(e) => onDescriptionChange(e.target.value === "" ? null : e.target.value)}
            className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-muted-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
          />
        ) : (
          <span className="text-xs text-muted-fg">{description || <span className="italic">No description</span>}</span>
        )}
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            aria-label={`Material for ${name}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file);
              // Let the same file be picked again after a remove.
              e.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <span aria-hidden className="material-symbols-rounded text-[14px]">
              upload_file
            </span>
            {hasMaterial ? "Replace file" : "Add file"}
          </Button>

          {hasMaterial && (
            <>
              <Button variant="secondary" size="sm" onClick={onView}>
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  visibility
                </span>
                View
              </Button>
              <Button variant="danger" size="sm" onClick={onRemoveMaterial}>
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  delete_forever
                </span>
                Remove material
              </Button>
            </>
          )}

          {pendingFileName && <span className="text-xs text-brand">{pendingFileName} — uploads on save</span>}

          <input
            value={linkUrl}
            aria-label={`Link for ${name}`}
            placeholder="or paste a link"
            onChange={(e) => onLinkChange(e.target.value)}
            className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
          />
        </div>
      )}
    </div>
  );
}
