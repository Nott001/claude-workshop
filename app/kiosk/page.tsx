"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import type { Event } from "@/types";
import { AttendeesPanel } from "@/components/attendees-panel";
import { Footer } from "@/components/footer";

const QrScanner = dynamic(() => import("@/components/qr-scanner").then((m) => m.QrScanner), { ssr: false });

interface CheckinResponse {
  status: "success" | "duplicate" | "rejected";
  attendee?: { full_name: string; email: string };
  ticket?: { status: string };
  reason?: string;
}

type ResultKind = "success" | "duplicate" | "rejected" | null;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function KioskPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [qrInput, setQrInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ResultKind>(null);
  const [resultData, setResultData] = useState<CheckinResponse | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
    fetch("/api/events?filter=upcoming")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, [userRole]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  async function handleCheckin(token: string) {
    if (processing || !token.trim()) return;
    setProcessing(true);
    setQrInput(token);

    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_token: token.trim() }),
    });

    const data: CheckinResponse = await res.json();
    setResultData(data);

    if (data.status === "success") {
      setResult("success");
    } else if (data.status === "duplicate") {
      setResult("duplicate");
    } else {
      setResult("rejected");
    }

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setResult(null);
      setResultData(null);
      setQrInput("");
      setProcessing(false);
    }, 3000);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleCheckin(qrInput);
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-4xl text-[#3db9ee]">progress_activity</span>
      </div>
    );
  }

  if (userRole !== "facilitator") return null;

  if (!selectedEvent) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center gap-2 border-b border-[#bdc8d0] bg-white px-6 py-4">
          <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">bolt</span>
          <span className="text-sm font-bold tracking-tight text-[#1b1c1c]">StartupLab — Kiosk mode</span>
        </div>

        <div className="flex flex-1 flex-col items-center px-6 py-10">
          <div className="w-full max-w-lg">
            <div className="mb-8 text-center">
              <span className="material-symbols-rounded mb-3 text-[48px] text-[#3db9ee]">qr_code_scanner</span>
              <h1 className="text-xl font-bold tracking-tight text-[#1b1c1c]">Select Event</h1>
              <p className="mt-1 text-sm text-[#647078]">Choose an event to start scanning attendee QR codes.</p>
            </div>

            {eventsLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="material-symbols-rounded animate-spin text-3xl text-[#3db9ee]">progress_activity</span>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-[#bdc8d0] bg-[#f4f7f8] px-6 py-12 text-center">
                <span className="material-symbols-rounded mb-2 text-3xl text-[#8a959e]">event_busy</span>
                <p className="text-sm font-medium text-[#1b1c1c]">No upcoming events</p>
                <p className="mt-1 text-xs text-[#8a959e]">Create an event first, then return to the kiosk.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    key={event.event_id}
                    onClick={() => setSelectedEvent(event)}
                    className="flex w-full items-center gap-4 rounded-xl border border-[#bdc8d0] bg-white px-5 py-4 text-left transition hover:border-[#3db9ee] hover:shadow-sm"
                  >
                    <span className="material-symbols-rounded text-[28px] text-[#3db9ee]">event</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#1b1c1c]">{event.title}</p>
                      <p className="mt-0.5 text-xs text-[#647078]">
                        {formatDate(event.event_date)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8a959e]">{event.venue_name}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        event.status === "active" ? "bg-[#2ea86e]/10 text-[#2ea86e]" : "bg-[#8a959e]/10 text-[#8a959e]"
                      }`}
                    >
                      {event.status}
                    </span>
                    <span className="material-symbols-rounded text-[18px] text-[#8a959e]">chevron_right</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-[#bdc8d0] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">bolt</span>
          <span className="text-sm font-bold tracking-tight text-[#1b1c1c]">StartupLab — Kiosk mode</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="truncate max-w-[200px] text-sm font-medium text-[#1b1c1c]">{selectedEvent.title}</span>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setCameraActive(false);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[#bdc8d0] bg-white px-3 text-xs font-semibold text-[#647078] transition hover:border-[#3db9ee] hover:text-[#3db9ee]"
          >
            <span className="material-symbols-rounded text-[14px]">swap_horiz</span>
            Change
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: QR Scanner */}
        <div className="flex flex-1 flex-col items-center px-6 py-8 lg:border-r lg:border-[#bdc8d0]">
          <div className="flex w-full max-w-lg flex-col items-center">
            <span className="material-symbols-rounded mb-3 text-[40px] text-[#3db9ee]">qr_code_scanner</span>
            <p className="mb-1 text-sm font-semibold text-[#1b1c1c]">Align the participant&apos;s QR code within the frame</p>
            <p className="mb-6 text-center text-xs text-[#8a959e]">
              To automatically verify attendance and record check-in time.
            </p>

            {!cameraActive && !cameraError && (
              <button
                onClick={() => {
                  setCameraActive(true);
                  setCameraError(null);
                }}
                className="mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bdc8d0] bg-[#f4f7f8] text-sm font-semibold text-[#647078] transition hover:border-[#3db9ee] hover:text-[#3db9ee]"
              >
                <span className="material-symbols-rounded text-[22px]">photo_camera</span>
                Start Camera Scanner
              </button>
            )}

            {cameraError && (
              <div className="mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#e5484d]/30 bg-[#e5484d]/5 text-sm text-[#e5484d]">
                <span className="material-symbols-rounded text-[18px]">videocam_off</span>
                {cameraError}
              </div>
            )}

            {cameraActive && (
              <QrScanner
                onScan={handleCheckin}
                active={cameraActive}
                onError={(msg) => {
                  setCameraError(msg);
                  setCameraActive(false);
                }}
              />
            )}

            <form onSubmit={handleManualSubmit} className="w-full">
              <label htmlFor="qr-input" className="mb-1.5 block text-sm font-medium text-[#1b1c1c]">
                Manual check-in
              </label>
              <div className="flex gap-3">
                <input
                  id="qr-input"
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="Scan or type QR token..."
                  disabled={processing}
                  className="h-12 flex-1 rounded-xl border border-[#bdc8d0] bg-white px-4 text-sm text-[#1b1c1c] placeholder-[#8a959e] outline-none transition focus:border-[#3db9ee] focus:ring-2 focus:ring-[#3db9ee]/20 disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={processing || !qrInput.trim()}
                  className="flex h-12 items-center gap-2 rounded-xl bg-[#3db9ee] px-6 text-sm font-semibold text-white transition hover:bg-[#239dce] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing ? (
                    <span className="material-symbols-rounded animate-spin text-[18px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-rounded text-[18px]">check_circle</span>
                  )}
                  {processing ? "Checking..." : "Check In"}
                </button>
              </div>
            </form>

            {result && resultData && (
              <div
                className={`mt-6 flex w-full items-start gap-3 rounded-xl border px-4 py-3 ${
                  result === "success"
                    ? "border-[#2ea86e]/20 bg-[#2ea86e]/5"
                    : result === "duplicate"
                      ? "border-[#e0a930]/20 bg-[#e0a930]/5"
                      : "border-[#e5484d]/20 bg-[#e5484d]/5"
                }`}
              >
                <span
                  className={`material-symbols-rounded mt-0.5 text-[20px] ${
                    result === "success" ? "text-[#2ea86e]" : result === "duplicate" ? "text-[#e0a930]" : "text-[#e5484d]"
                  }`}
                >
                  {result === "success" ? "check_circle" : result === "duplicate" ? "warning" : "cancel"}
                </span>
                <div>
                  {result === "success" && (
                    <>
                      <p className="text-sm font-semibold text-[#1b1c1c]">Checked in</p>
                      <p className="text-sm text-[#647078]">{resultData.attendee?.full_name}</p>
                      <p className="text-xs text-[#8a959e]">{resultData.attendee?.email}</p>
                    </>
                  )}
                  {result === "duplicate" && <p className="text-sm font-semibold text-[#1b1c1c]">Already checked in</p>}
                  {result === "rejected" && (
                    <>
                      <p className="text-sm font-semibold text-[#1b1c1c]">
                        {resultData.reason === "cancelled" ? "Ticket cancelled" : "Invalid ticket"}
                      </p>
                      <p className="text-xs text-[#8a959e]">This QR code could not be validated for this event.</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 w-full">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setCameraActive(false);
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#bdc8d0] bg-white text-sm font-semibold text-[#647078] transition hover:border-[#3db9ee] hover:text-[#3db9ee]"
              >
                <span className="material-symbols-rounded text-[18px]">swap_horiz</span>
                Change Event
              </button>
            </div>
          </div>
        </div>

        {/* Right: Attendees List */}
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <AttendeesPanel eventId={selectedEvent.event_id} />
        </div>
      </div>
    </div>
    <Footer role="facilitator" />
    </>
  );
}
