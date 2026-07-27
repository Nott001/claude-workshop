"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatTime, formatEventDate } from "@/lib/date-utils";
import { CountdownTimer } from "@/components/countdown-timer";
import { StatusBadge, type EventStatus } from "@/components/status-badge";
import { DeleteConfirmModal } from "@/modules/event-management/ui/delete-confirm-modal";
import { AttendeesModal } from "@/modules/event-management/ui/attendees-modal";
import { SpeakerSection } from "@/modules/event-management/ui/speaker-section";
import { CurriculumSection } from "@/modules/event-management/ui/curriculum-section";

interface SpeakerProfile {
  id: number;
  bio: string | null;
  designation: string | null;
  USERS?: { full_name: string; email: string } | null;
}

interface EventSpeaker {
  SPEAKER_PROFILES: SpeakerProfile;
}

interface Course {
  id: number;
  course_name: string;
  course_description: string | null;
}

interface Event {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  course_id: number | null;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
  price: number;
  currency: string;
  description: string | null;
  COURSE: Course | null;
  EVENT_SPEAKERS: EventSpeaker[];
  attendee_count?: number;
}

interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

interface FacilitatorEventDetailProps {
  event: Event;
  recentAttendees: AttendeeRow[];
  attendeesTotal: number;
  attendeesLoading: boolean;
  badgeProps: { status: EventStatus; label: string };
  publishing: boolean;
  publishError: string | null;
  deleteError: string | null;
  onPublish: () => Promise<void>;
  onDelete: () => void;
  onEdit: () => void;
  onEnterRoom: () => void;
}

export function FacilitatorEventDetail({
  event,
  recentAttendees,
  attendeesTotal,
  attendeesLoading,
  badgeProps,
  publishing,
  publishError,
  deleteError,
  onPublish,
  onDelete,
  onEdit,
  onEnterRoom,
}: FacilitatorEventDetailProps) {
  const router = useRouter();
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <button
          onClick={() => router.push("/events")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-fg transition-colors hover:text-fg"
        >
          <span className="material-symbols-rounded text-base">arrow_back</span>
          Back to Events
        </button>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-xl border border-[rgba(229,231,235,0.5)] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="relative h-[320px]">
                {event.cover_image_url ? (
                  <img src={event.cover_image_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300">
                    <span className="material-symbols-rounded text-6xl text-white/50">image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] to-[rgba(0,0,0,0)]" />
                <div className="absolute bottom-8 left-8 right-8 flex flex-col gap-3">
                  <StatusBadge
                    status={badgeProps.status}
                    label={badgeProps.label}
                    className={cn(
                      "w-fit border-0",
                      badgeProps.status === "live" ? "bg-error text-white" : "bg-brand text-brand",
                    )}
                  />
                  <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-white">{event.title}</h1>
                  <div className="flex flex-wrap gap-6 text-sm font-medium text-white/90">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-[16px]">calendar_today</span>
                      {formatEventDate(event.event_date)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-[16px]">schedule</span>
                      {formatTime(event.start_time)} – {formatTime(event.end_time)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-rounded text-[16px]">location_on</span>
                      {event.venue_name}
                    </span>
                  </div>
                  {event.status === "active" && (
                    <div className="mt-1">
                      <CountdownTimer eventDate={event.event_date} startTime={event.start_time} light />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {event.COURSE && <CurriculumSection course={event.COURSE} variant="facilitator" />}
            <SpeakerSection speakers={event.EVENT_SPEAKERS} variant="facilitator" />

            <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[20px] font-semibold text-fg">Recent Registrations</h2>
                <button onClick={() => setShowAttendeesModal(true)} className="text-sm font-medium text-brand hover:underline">
                  View all ({attendeesTotal})
                </button>
              </div>
              {attendeesLoading ? (
                <div className="py-8 text-center text-sm text-muted-fg">Loading...</div>
              ) : recentAttendees.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-fg">No registrations yet</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(229,231,235,0.5)] text-muted-fg">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Email</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendees.map((a) => (
                      <tr key={a.user_id} className="border-b border-[rgba(229,231,235,0.2)]">
                        <td className="py-3 pr-4 text-fg">{a.full_name}</td>
                        <td className="py-3 pr-4 text-muted-fg">{a.email}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.ticket_status === "checked_in"
                                ? "bg-success/10 text-success"
                                : a.ticket_status === "issued"
                                  ? "bg-info/10 text-info"
                                  : "bg-muted text-muted-fg"
                            }`}
                          >
                            {a.ticket_status === "checked_in"
                              ? "Checked in"
                              : a.ticket_status === "issued"
                                ? "Registered"
                                : "Cancelled"}
                          </span>
                        </td>
                        <td className="py-3 text-muted-fg">{new Date(a.issued_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="col-span-4 flex flex-col gap-6">
            <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <span className="text-sm font-medium text-muted-fg">Registered</span>
              <p className="mt-2 text-[48px] font-bold leading-[56px] tracking-[-0.02em] text-brand">
                {event.attendee_count?.toLocaleString() ?? "0"}
              </p>
            </div>

            <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <h2 className="mb-4 text-[16px] font-semibold text-fg">Actions</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onEnterRoom}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand/90"
                >
                  <span className="material-symbols-rounded text-sm">play_circle</span>
                  Enter Event Room
                </button>
                <button
                  onClick={onEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-fg transition-colors hover:bg-muted"
                >
                  <span className="material-symbols-rounded text-sm">edit</span>
                  Edit Event
                </button>
                <button
                  onClick={() => setShowAttendeesModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-fg transition-colors hover:bg-muted"
                >
                  <span className="material-symbols-rounded text-sm">qr_code_scanner</span>
                  View All Attendees
                </button>
                {event.status === "draft" && (
                  <button
                    onClick={onPublish}
                    disabled={publishing}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-success py-3 text-sm font-bold text-white transition-colors hover:bg-success/80 disabled:opacity-50"
                  >
                    <span className="material-symbols-rounded text-sm">publish</span>
                    {publishing ? "Publishing..." : "Publish Event"}
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/10 py-3 text-sm font-semibold text-error transition-colors hover:bg-error/20"
                >
                  <span className="material-symbols-rounded text-sm">delete</span>
                  Delete Event
                </button>
              </div>
              {publishError && <p className="mt-2 text-xs text-error">{publishError}</p>}
              {deleteError && <p className="mt-2 text-xs text-error">{deleteError}</p>}
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        show={showDeleteModal}
        deleteConfirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onConfirm={async () => {
          setDeleting(true);
          await onDelete();
          setDeleting(false);
        }}
        onCancel={() => setShowDeleteModal(false)}
        deleting={deleting}
      />

      <AttendeesModal show={showAttendeesModal} eventId={String(event.id)} onClose={() => setShowAttendeesModal(false)} />
    </div>
  );
}
