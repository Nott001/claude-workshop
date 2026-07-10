"use client";

import { useEffect, useState } from "react";

interface EmailLog {
  log_id: number;
  user_id: number;
  email_type: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  USER: { full_name: string; email: string } | null;
}

const emailTypes = ["", "registration_confirmation", "ticket_issued", "check_in_confirmed"];
const statuses = ["", "sent", "failed"];

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterType) params.set("email_type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    fetch(`/api/logs?${params.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterType, filterStatus, dateFrom, dateTo]);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="text-foreground mb-6 text-3xl font-bold">Email Logs</h1>

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="text-muted-foreground mb-1 block text-sm">Email Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded border px-3 py-2">
            <option value="">All</option>
            {emailTypes.slice(1).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-muted-foreground mb-1 block text-sm">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded border px-3 py-2">
            <option value="">All</option>
            {statuses.slice(1).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-muted-foreground mb-1 block text-sm">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="text-muted-foreground mb-1 block text-sm">Date To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border px-3 py-2" />
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 ? (
        <p>No email logs found.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-3">User</th>
              <th className="p-3">Email</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Sent At</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.log_id} className="border-b">
                <td className="p-3">{log.USER?.full_name ?? `User #${log.user_id}`}</td>
                <td className="p-3">{log.USER?.email ?? "—"}</td>
                <td className="p-3">{log.email_type.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      log.status === "sent" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="p-3">{log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
