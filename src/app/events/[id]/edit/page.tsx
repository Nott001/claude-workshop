"use client";

import { useRouter, useParams } from "next/navigation";
import { Footer } from "@/components/footer";
import { EventEditForm } from "@/modules/event-management/ui/event-edit-form";
import { useEventEdit } from "@/modules/event-management/lib/use-event-edit";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const hook = useEventEdit(eventId);

  if (hook.loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <p className="text-sm text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Event
          </button>

          <div className="mb-12">
            <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Edit Event</h1>
          </div>

          <EventEditForm
            title={hook.title}
            setTitle={hook.setTitle}
            eventDate={hook.eventDate}
            setEventDate={hook.setEventDate}
            startTime={hook.startTime}
            setStartTime={hook.setStartTime}
            endTime={hook.endTime}
            setEndTime={hook.setEndTime}
            venueName={hook.venueName}
            setVenueName={hook.setVenueName}
            venueAddress={hook.venueAddress}
            setVenueAddress={hook.setVenueAddress}
            courseId={hook.courseId}
            setCourseId={hook.setCourseId}
            price={hook.price}
            setPrice={hook.setPrice}
            currency={hook.currency}
            setCurrency={hook.setCurrency}
            description={hook.description}
            setDescription={hook.setDescription}
            status={hook.status}
            setStatus={hook.setStatus}
            courses={hook.courses}
            coursesError={hook.coursesError}
            speakers={hook.speakers}
            speakerId={hook.speakerId}
            setSpeakerId={hook.setSpeakerId}
            previewSrc={hook.previewSrc}
            handleCoverFileSelect={hook.handleCoverFileSelect}
            handleCoverRemove={hook.handleCoverRemove}
            handleSubmit={hook.handleSubmit}
            submitting={hook.submitting}
            uploading={hook.uploading}
            error={hook.error}
            onCancel={() => router.push(`/events/${eventId}`)}
          />
        </div>
      </div>
      <Footer role="facilitator" />
    </>
  );
}
