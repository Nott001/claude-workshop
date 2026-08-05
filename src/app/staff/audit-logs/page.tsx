"use client";

import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";

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

function actionColor(action: string): string {
  if (action.includes("deleted") || action.includes("removed") || action.includes("unassigned")) {
    return "text-error bg-error/10";
  }
  if (
    action.includes("created") ||
    action.includes("published") ||
    action.includes("assigned") ||
    action === "checkin.performed"
  ) {
    return "text-success bg-success/10";
  }
  return "text-info bg-info/10";
}

export default function StaffAuditLogsPage() {
  const router = useRouter();
  const { allowed, pending } = useRoleGuard("admin");
  const { logs, loading, page, setPage, totalPages } = useAuditLogs();

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-sm text-muted-fg">Loading audit logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-fg/50">history</span>
            <p className="mt-3 text-sm text-muted-fg">No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-5 py-3 font-semibold text-muted-fg">Action</th>
                    <th className="px-5 py-3 font-semibold text-muted-fg">Actor</th>
                    <th className="px-5 py-3 font-semibold text-muted-fg">Details</th>
                    <th className="px-5 py-3 font-semibold text-muted-fg">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted">
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionColor(log.action)}`}
                        >
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-fg">{log.ACTOR?.full_name ?? "Unknown"}</span>
                          <span className="text-xs text-muted-fg">{log.ACTOR?.email ?? ""}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-fg">
                            {log.entity_type}
                            {log.entity_id ? ` #${log.entity_id}` : ""}
                          </span>
                          {log.metadata && (
                            <span className="text-xs text-muted-fg">
                              {JSON.stringify(log.metadata).length > 80
                                ? JSON.stringify(log.metadata).slice(0, 80) + "..."
                                : JSON.stringify(log.metadata)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-fg">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-fg transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-rounded text-sm">chevron_left</span>
                  Previous
                </button>
                <span className="text-sm text-muted-fg">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-fg transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <span className="material-symbols-rounded text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
