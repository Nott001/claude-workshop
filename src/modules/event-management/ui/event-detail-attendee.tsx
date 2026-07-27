"use client";

import { useState } from "react";
import { formatTime } from "@/lib/date-utils";
import { CountdownTimer } from "@/components/countdown-timer";
import { StatusBadge, type EventStatus } from "@/components/status-badge";
import { SpeakerSection } from "@/modules/event-management/ui/speaker-section";
import { CurriculumSection } from "@/modules/event-management/ui/curriculum-section";
import { DeleteConfirmModal } from "@/modules/event-management/ui/delete-confirm-modal";

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

interface AttendeeEventDetailProps {
  event: Event;
  badgeProps: { status: EventStatus; label: string };
  hasTicket: boolean;
  userRole: string | null;
  isSpeakerAssigned: boolean;
  eventStarted: boolean;
  showCountdown: boolean;
  isSignedIn: boolean;
  canManage: boolean;
  publishing: boolean;
  publishError: string | null;
  deleteError: string | null;
  onRegister: () => void;
  onPublish: () => Promise<void>;
  onDelete: () => void;
  onEnterRoom: () => void;
  onEdit: () => void;
  onManageSpeakers: () => void;
}

function formatHeroDateTime(dateStr: string, startTime: string, endTime: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${formatTime(startTime)} - ${formatTime(endTime)}, ${month} ${day} ${year}`;
}

function getMapUrl(venueName: string, venueAddress: string | null, format: "embed" | "search") {
  const q = encodeURIComponent(venueName + (venueAddress ? `, ${venueAddress}` : ""));
  if (format === "embed") {
    return `https://www.google.com/maps?q=${q}&output=embed`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function AttendeeEventDetail({
  event,
  badgeProps,
  hasTicket,
  userRole,
  isSpeakerAssigned,
  eventStarted,
  showCountdown,
  isSignedIn,
  canManage,
  publishing,
  publishError,
  deleteError,
  onRegister,
  onPublish,
  onDelete,
  onEnterRoom,
  onEdit,
  onManageSpeakers,
}: AttendeeEventDetailProps) {
  const router = useRouter();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const isFacilitator = userRole === "facilitator";

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <div className="mx-auto w-full max-w-[1238px] px-0 py-[70px]">
        <div className="flex flex-col gap-[10px] px-0">
          <div className="flex flex-col gap-12 px-[48px]">
            <div className="overflow-hidden rounded-2xl border border-[rgba(189,200,208,0.3)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex">
                <div className="relative w-[567px] shrink-0">
                  {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt={event.title} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300">
                      <span className="material-symbols-rounded text-6xl text-white/50">image</span>
                    </div>
                  )}
                  {event.COURSE && (
                    <div className="absolute inset-x-0 bottom-0 bg-surface px-[20px] pb-4 pt-0 rounded-tr-[50px]">
                      <div className="pt-4">
                        <h2 className="text-[32px] font-bold leading-[60px] tracking-[-0.03em] text-fg">
                          {event.COURSE.course_name}
                        </h2>
                        <p className="text-base text-fg">{event.COURSE.course_description || "Course Description"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-center gap-8 p-12">
                  <div>
                    {badgeProps && <StatusBadge status={badgeProps.status} label={badgeProps.label} className="mb-3" />}
                    <p className="text-lg font-bold text-brand">
                      {formatHeroDateTime(event.event_date, event.start_time, event.end_time)}
                    </p>
                  </div>

                  <div>
                    <h1 className="text-[48px] font-bold leading-[56px] tracking-[-0.02em] text-fg">{event.title}</h1>
                  </div>

                  <div className="flex flex-col gap-8">
                    {showCountdown && <CountdownTimer eventDate={event.event_date} startTime={event.start_time} />}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-12">
              <div className="col-span-2 flex flex-col gap-6">
                {event.description && (
                  <div>
                    <p className="text-lg leading-[29.25px] text-muted-fg">{event.description}</p>
                  </div>
                )}

                <SpeakerSection speakers={event.EVENT_SPEAKERS} />

                {event.COURSE && <CurriculumSection course={event.COURSE} />}
              </div>

              <div className="col-span-1">
                <div className="sticky top-[70px] flex flex-col gap-6">
                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    {event.price > 0 && !hasTicket && (
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                          <span className="material-symbols-rounded text-lg text-brand">payments</span>
                        </div>
                        <div>
                          <p className="text-base text-fg">Event Price</p>
                          <p className="text-[24px] font-semibold text-brand">
                            {event.currency} {event.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      {event.status === "active" && !isFacilitator && userRole !== "speaker" && (
                        <>
                          {hasTicket ? (
                            <div className="flex flex-col gap-2">
                              {!eventStarted && (
                                <p className="text-xs text-muted-fg leading-relaxed">
                                  The event hasn&apos;t started yet. Feel free to explore the available resources ahead of time.
                                </p>
                              )}
                              <button
                                onClick={onEnterRoom}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand/80"
                              >
                                Access event room
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={onRegister}
                              className="flex w-full items-center justify-center rounded-lg bg-brand px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand/80"
                            >
                              Register
                            </button>
                          )}
                        </>
                      )}

                      {userRole === "speaker" && isSpeakerAssigned && (
                        <button
                          onClick={onEnterRoom}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand/80"
                        >
                          Access event room
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                        <span className="material-symbols-rounded text-lg text-brand">location_on</span>
                      </div>
                      <div>
                        <p className="text-base text-fg">Venue Location</p>
                        <p className="text-base text-muted-fg">
                          {event.venue_name}
                          {event.venue_address && <>, {event.venue_address}</>}
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setMapExpanded(true)}
                      className="relative h-[250px] cursor-pointer overflow-hidden rounded-xl border border-border"
                    >
                      <iframe
                        title="Venue map"
                        src={getMapUrl(event.venue_name, event.venue_address, "embed")}
                        className="pointer-events-none h-full w-full border-0 opacity-60"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                        <span className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-muted-fg shadow-sm">
                          Click to view map
                        </span>
                      </div>
                    </div>

                    {mapExpanded && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-8"
                        onClick={() => setMapExpanded(false)}
                      >
                        <div
                          className="relative h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setMapExpanded(false)}
                            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-surface shadow-md transition-colors hover:bg-muted"
                          >
                            <span className="material-symbols-rounded text-[20px]">close</span>
                          </button>
                          <iframe
                            title="Venue map"
                            src={getMapUrl(event.venue_name, event.venue_address, "embed")}
                            className="h-full w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                          <a
                            href={getMapUrl(event.venue_name, event.venue_address, "search")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 bg-white/90 px-4 py-3 text-sm font-medium text-brand shadow-[0_-2px_10px_rgba(0,0,0,.08)] transition-colors hover:bg-surface"
                          >
                            <span className="material-symbols-rounded text-[16px]">open_in_new</span>
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isSignedIn && canManage && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-6">
                <h3 className="mb-2 text-sm font-semibold text-fg">Event Management</h3>
                <div className="flex flex-wrap gap-3">
                  {event.status === "draft" && (
                    <button
                      onClick={onPublish}
                      disabled={publishing}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
                    >
                      <span className="material-symbols-rounded text-sm">publish</span>
                      {publishing ? "Publishing..." : "Publish Event"}
                    </button>
                  )}
                  <button
                    onClick={onEnterRoom}
                    className="inline-flex items-center gap-2 rounded-lg border border-success bg-success/10 px-4 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success/20"
                  >
                    <span className="material-symbols-rounded text-sm">play_circle</span>
                    Access event room
                  </button>
                  <button
                    onClick={onEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-muted"
                  >
                    <span className="material-symbols-rounded text-sm">edit</span>
                    Edit event
                  </button>
                  <button
                    onClick={onManageSpeakers}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-muted"
                  >
                    <span className="material-symbols-rounded text-sm">groups</span>
                    Manage speakers
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/20"
                  >
                    <span className="material-symbols-rounded text-sm">delete</span>
                    Delete event
                  </button>
                </div>
                {publishError && <p className="text-xs text-error">{publishError}</p>}
                {deleteError && <p className="text-xs text-error">{deleteError}</p>}
              </div>
            )}
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
    </div>
  );
}
