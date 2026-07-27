"use client";

import { useParams, useRouter } from "next/navigation";
import { Footer } from "@/components/footer";
import { FacilitatorEventDetail } from "@/modules/event-management/ui/event-detail-facilitator";
import { AttendeeEventDetail } from "@/modules/event-management/ui/event-detail-attendee";
import { useEventDetail } from "@/modules/event-management/lib/use-event-detail";

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const {
    event,
    loading,
    error,
    userRole,
    hasTicket,
    isSpeakerAssigned,
    eventStarted,
    badgeProps,
    isFacilitator,
    showCountdown,
    isSignedIn,
    recentAttendees,
    attendeesTotal,
    attendeesLoading,
    publishing,
    publishError,
    deleteError,
    handleRegister,
    handlePublish,
    handleDelete,
  } = useEventDetail(eventId);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">{error ?? "Event not found"}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      {isFacilitator ? (
        <FacilitatorEventDetail
          event={event}
          recentAttendees={recentAttendees}
          attendeesTotal={attendeesTotal}
          attendeesLoading={attendeesLoading}
          badgeProps={badgeProps!}
          publishing={publishing}
          publishError={publishError}
          deleteError={deleteError}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onEdit={() => router.push(`/events/${eventId}/edit`)}
          onEnterRoom={() => router.push(`/events/${eventId}/room`)}
        />
      ) : (
        <AttendeeEventDetail
          event={event}
          badgeProps={badgeProps!}
          hasTicket={hasTicket}
          userRole={userRole}
          isSpeakerAssigned={isSpeakerAssigned}
          eventStarted={eventStarted}
          showCountdown={showCountdown}
          isSignedIn={!!isSignedIn}
          canManage={isFacilitator}
          publishing={publishing}
          publishError={publishError}
          deleteError={deleteError}
          onRegister={handleRegister}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onEnterRoom={() => router.push(`/events/${eventId}/room`)}
          onEdit={() => router.push(`/events/${eventId}/edit`)}
          onManageSpeakers={() => router.push(`/events/${eventId}/speakers`)}
        />
      )}
      <Footer role={isFacilitator ? "facilitator" : "attendee"} />
    </div>
  );
}
