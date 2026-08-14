"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";
import type { AuditLogWithActor } from "@/modules/audit/db/audit.dao";
import { Badge } from "@/shared/components/badge";
import { Drawer } from "@/shared/components/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { Pagination } from "@/shared/components/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/shared/components/table";

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "event.created": "Event Created",
    "event.updated": "Event Updated",
    "event.deleted": "Event Deleted",
    "event.published": "Event Published",
    "speaker.assigned": "Speaker Assigned",
    "speaker.unassigned": "Speaker Removed",
    "organization.invited": "Member Invited",
    "organization.role_changed": "Role Changed",
    "organization.removed": "Member Removed",
    "checkin.performed": "Check-in",
    "course.created": "Course Created",
    "course.updated": "Course Updated",
    "course.deleted": "Course Deleted",
    "module.created": "Module Created",
    "module.updated": "Module Updated",
    "module.deleted": "Module Deleted",
    "lesson.created": "Lesson Created",
    "lesson.updated": "Lesson Updated",
    "lesson.deleted": "Lesson Deleted",
  };
  return labels[action] ?? action;
}

function actionVariant(action: string): "error" | "success" | "info" {
  if (action.includes("deleted") || action.includes("removed") || action.includes("unassigned")) {
    return "error";
  }
  if (
    action.includes("created") ||
    action.includes("published") ||
    action.includes("assigned") ||
    action === "checkin.performed"
  ) {
    return "success";
  }
  return "info";
}

type Category = "all" | "created" | "deleted/removed" | "updated" | "assigned" | "check-in" | "invited";

// Substring mapping mirrors actionVariant. `event.published` and
// `organization.role_changed` are state changes of an existing entity, so they
// filter as updates even though neither name contains "updated".
function categoryOf(action: string): Category {
  if (action.includes("deleted") || action.includes("removed") || action.includes("unassigned")) {
    return "deleted/removed";
  }
  if (action.includes("created")) return "created";
  if (action.includes("updated") || action === "event.published" || action === "organization.role_changed") {
    return "updated";
  }
  if (action.includes("assigned")) return "assigned";
  if (action === "checkin.performed") return "check-in";
  if (action === "organization.invited") return "invited";
  return "all";
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "created", label: "Created" },
  { value: "deleted/removed", label: "Deleted/Removed" },
  { value: "updated", label: "Updated" },
  { value: "assigned", label: "Assigned" },
  { value: "check-in", label: "Check-in" },
  { value: "invited", label: "Invited" },
];

// The hook debounces search itself and resets page on a new term (sheet 05), so
// the page feeds keystrokes straight through and never fights the pagination.
export default function StaffAuditLogsPage() {
  const router = useRouter();
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const { logs, total, loading, page, setPage, search, setSearch } = useAuditLogs();
  const [category, setCategory] = useState<Category>("all");
  const [selected, setSelected] = useState<AuditLogWithActor | null>(null);

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  const filteredLogs = category === "all" ? logs : logs.filter((log) => categoryOf(log.action) === category);

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[1024px] px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Audit Logs</h1>
            <p className="mt-1 text-sm text-muted-fg">Track all facilitator actions across the platform</p>
          </div>
          <button
            onClick={() => router.push("/staff/events")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-fg transition-colors hover:bg-muted"
          >
            Back to Dashboard
          </button>
        </div>

        <TableToolbar search={{ value: search, onChange: setSearch, placeholder: "Search action, entity, or actor..." }}>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger>
              <SelectValue>{CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? "All"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableToolbar>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-sm text-muted-fg">Loading audit logs...</p>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <TableEmpty
            icon="history"
            title="No audit logs found"
            hint={search ? "Try a different search term." : "No logs match the current filter."}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Action</TableHeadCell>
                    <TableHeadCell>Actor</TableHeadCell>
                    <TableHeadCell>Details</TableHeadCell>
                    <TableHeadCell>Date</TableHeadCell>
                    <TableHeadCell className="w-12" aria-label="Details" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} onClick={() => setSelected(log)} aria-label={`View ${actionLabel(log.action)}`}>
                      <TableCell>
                        <Badge variant={actionVariant(log.action)}>{actionLabel(log.action)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-fg">{log.ACTOR?.full_name ?? "Unknown"}</span>
                          <span className="text-xs text-muted-fg">{log.ACTOR?.email ?? ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-fg">
                            {log.entity_type}
                            {log.entity_id ? ` #${log.entity_id}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-fg">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell className="w-12">
                        <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                          chevron_right
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? actionLabel(selected.action) : ""}
        description={selected?.ACTOR?.full_name ?? "Unknown"}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Action</span>
              <Badge variant={actionVariant(selected.action)}>{actionLabel(selected.action)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Actor</span>
              <span className="text-right text-fg">
                {selected.ACTOR?.full_name ?? "Unknown"}
                {selected.ACTOR?.email ? (
                  <>
                    <br />
                    <span className="text-xs text-muted-fg">{selected.ACTOR.email}</span>
                  </>
                ) : null}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Entity</span>
              <span className="text-fg">
                {selected.entity_type}
                {selected.entity_id ? ` #${selected.entity_id}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Created</span>
              <span className="text-fg">{new Date(selected.created_at).toLocaleString()}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
