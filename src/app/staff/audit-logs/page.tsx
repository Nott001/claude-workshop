"use client";

import { ROLES } from "@/shared/lib/roles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";
import type { AuditLogWithActor } from "@/modules/audit/db/audit.dao";
import { Badge } from "@/shared/components/badge";
import { Button } from "@/shared/components/button";
import { Drawer } from "@/shared/components/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/select";
import { TableToolbar } from "@/shared/components/table-toolbar";
import { Pagination } from "@/shared/components/table-pagination";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import {
  Table,
  TableBody,
  TableBodyState,
  TableCell,
  TableContainer,
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
  const { logs, total, loading, error, page, setPage, search, setSearch } = useAuditLogs();
  const [category, setCategory] = useState<Category>("all");
  const [selected, setSelected] = useState<AuditLogWithActor | null>(null);

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!allowed) return null;

  const filteredLogs = category === "all" ? logs : logs.filter((log) => categoryOf(log.action) === category);

  return (
    <>
      <StaffPage>
        <StaffPageHeader
          title="Audit Logs"
          description="Track all facilitator actions across the platform"
          actions={
            <Button variant="secondary" size="lg" onClick={() => router.push("/staff/events")}>
              Back to Dashboard
            </Button>
          }
        />

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

        {error && filteredLogs.length > 0 && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell className="w-44">Action</TableHeadCell>
                <TableHeadCell>Actor</TableHeadCell>
                <TableHeadCell className="w-44">Details</TableHeadCell>
                <TableHeadCell className="w-52">Date</TableHeadCell>
                <TableHeadCell className="w-12" aria-label="Details" />
              </TableRow>
            </TableHead>
            <TableBody busy={loading && filteredLogs.length > 0}>
              <TableBodyState
                ready={filteredLogs.length > 0}
                loading={loading}
                colSpan={5}
                empty={{
                  icon: "history",
                  title: "No audit logs found",
                  hint: search ? "Try a different search term." : "No logs match the current filter.",
                }}
              >
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} onClick={() => setSelected(log)} aria-label={`View ${actionLabel(log.action)}`}>
                    <TableCell>
                      <Badge variant={actionVariant(log.action)}>{actionLabel(log.action)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-fg">{log.ACTOR?.full_name ?? "Unknown"}</span>
                        <span className="truncate text-xs text-muted-fg">{log.ACTOR?.email ?? ""}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="block truncate text-fg">
                        {log.entity_type}
                        {log.entity_id ? ` #${log.entity_id}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="truncate text-muted-fg">{new Date(log.created_at).toLocaleString()}</TableCell>
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

        <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
      </StaffPage>

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
    </>
  );
}
