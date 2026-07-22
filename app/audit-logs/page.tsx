"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface AuditLog {
  log_id: number;
  actor_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ACTOR: { user_id: number; full_name: string; email: string } | null;
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/audit-logs?page=${page}&limit=${limit}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setLoading(false);
    }
    load();
  }, [page]);

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
      return "text-red-600 bg-red-50";
    }
    if (
      action.includes("created") ||
      action.includes("published") ||
      action.includes("assigned") ||
      action === "checkin.performed"
    ) {
      return "text-green-700 bg-green-50";
    }
    return "text-blue-700 bg-blue-50";
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
      <div className="mx-auto w-full max-w-[1024px] px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1B1C1C]">Audit Logs</h1>
            <p className="mt-1 text-sm text-[#6E7980]">Track all facilitator actions across the platform</p>
          </div>
          <button
            onClick={() => router.push("/home")}
            className="rounded-lg border border-[#bdc8d0] px-4 py-2 text-sm font-medium text-[#647078] transition-colors hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-[#3db9ee] border-t-transparent" />
              <p className="text-sm text-[#6E7980]">Loading audit logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-rounded text-4xl text-[#8B989E]/50">history</span>
            <p className="mt-3 text-sm text-[#6E7980]">No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[#E8ECEF] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E8ECEF] bg-[#F8FAFB]">
                    <th className="px-5 py-3 font-semibold text-[#6E7980]">Action</th>
                    <th className="px-5 py-3 font-semibold text-[#6E7980]">Actor</th>
                    <th className="px-5 py-3 font-semibold text-[#6E7980]">Details</th>
                    <th className="px-5 py-3 font-semibold text-[#6E7980]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8ECEF]">
                  {logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-[#F8FAFB]">
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionColor(log.action)}`}
                        >
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#1B1C1C]">{log.ACTOR?.full_name ?? "Unknown"}</span>
                          <span className="text-xs text-[#8B989E]">{log.ACTOR?.email ?? ""}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[#1B1C1C]">
                            {log.entity_type}
                            {log.entity_id ? ` #${log.entity_id}` : ""}
                          </span>
                          {log.metadata && (
                            <span className="text-xs text-[#8B989E]">
                              {JSON.stringify(log.metadata).length > 80
                                ? JSON.stringify(log.metadata).slice(0, 80) + "..."
                                : JSON.stringify(log.metadata)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#6E7980]">{new Date(log.created_at).toLocaleString()}</td>
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
                  className="flex items-center gap-1 rounded-lg border border-[#bdc8d0] px-3 py-2 text-sm font-medium text-[#647078] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-rounded text-sm">chevron_left</span>
                  Previous
                </button>
                <span className="text-sm text-[#6E7980]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-[#bdc8d0] px-3 py-2 text-sm font-medium text-[#647078] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
