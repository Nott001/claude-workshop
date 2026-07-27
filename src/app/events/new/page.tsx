"use client";

import { useRouter } from "next/navigation";
import { Toast } from "@/components/toast";
import { Footer } from "@/components/footer";
import { EventCreateForm } from "@/modules/event-management/ui/event-create-form";
import { useEventCreate } from "@/modules/event-management/lib/use-event-create";

export default function NewEventPage() {
  const router = useRouter();
  const hook = useEventCreate();

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <EventCreateForm
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
            courses={hook.courses}
            coursesError={hook.coursesError}
            speakers={hook.speakers}
            speakerId={hook.speakerId}
            setSpeakerId={hook.setSpeakerId}
            coverImagePreview={hook.coverImagePreview}
            handleCoverFileSelect={hook.handleCoverFileSelect}
            handleCoverRemove={hook.handleCoverRemove}
            handleSubmit={hook.handleSubmit}
            handleSaveDraft={hook.handleSaveDraft}
            submitting={hook.submitting}
            error={hook.error}
            onNoCourses={() => router.push("/courses/new")}
            onBack={() => router.push("/events")}
          />
        </div>

        {hook.showToast && (
          <div className="fixed bottom-4 right-4 z-50">
            <Toast title="Event published successfully!" />
          </div>
        )}
      </div>
      <Footer role="facilitator" />
    </>
  );
}
