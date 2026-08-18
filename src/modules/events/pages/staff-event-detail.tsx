"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ROLES } from "@/shared/lib/roles";
import { cn } from "@/shared/lib/utils";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { useSession } from "@/modules/auth/components/session-context";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import type { EventWithCourse } from "@/modules/events/lib/types";
import { BackLink } from "@/shared/components/back-link";
import { Button, buttonStyles } from "@/shared/components/button";
import { SectionCard } from "@/shared/components/section-card";
import { StaffPage, StaffPageState } from "@/shared/components/staff-page";
import { CoverImageUpload } from "@/modules/events/components/cover-image-upload";
import { EditEventForm } from "@/modules/events/components/edit-event-form";
import { AdminAttendeeManagement } from "@/modules/events/components/admin-attendee-management";
import { EventDetailHero } from "@/modules/events/components/event-detail-hero";
import { EventOverviewPanel } from "@/modules/events/components/event-overview-panel";
import { MeetingLinkPanel } from "@/modules/events/components/meeting-link-panel";
import { EventTeamPanel } from "@/modules/events/components/event-team-panel";
import { EventCoursePanel } from "@/modules/events/components/event-course-panel";
import { EventSurveyPanel } from "@/modules/events/components/event-survey-panel";

type TabKey = "overview" | "details" | "team" | "course" | "attendees" | "surveys";

const TABS: { key: TabKey; label: string; adminOnly?: boolean }[] = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details", adminOnly: true },
  { key: "team", label: "Team", adminOnly: true },
  { key: "course", label: "Course" },
  { key: "attendees", label: "Attendees", adminOnly: true },
  { key: "surveys", label: "Surveys", adminOnly: true },
];

const isTabKey = (value: string | undefined): value is TabKey => TABS.some((tab) => tab.key === value);

/**
 * The staff view of one event: a hero, the actions that apply to the whole
 * event, and one panel per concern behind a tab.
 *
 * The page composes and nothing else. Every panel owns its own data, so opening
 * the page costs the event and its attendee count — the speaker roster, course
 * and survey status are only fetched by whoever asks for that tab.
 */
export function StaffEventDetailPage({ initialTab }: { initialTab?: string }) {
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const { role: userRole, allowed: isStaff, pending } = useRoleGuard(ROLES.FACILITATOR);

  const {
    event,
    loading,
    error,
    publishing,
    publishError,
    deleteError,
    attendeesTotal,
    handlePublish,
    handleDelete,
    applyEventPatch,
  } = useEventDetail(eventId);

  const [activeTab, setActiveTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "overview");

  if (pending || loading) {
    return <StaffPageState>Loading event...</StaffPageState>;
  }

  if (error || !event) {
    return <StaffPageState tone="error">{error ?? "Event not found"}</StaffPageState>;
  }

  if (!isStaff) return null;

  const isAdmin = hasMinRole(userRole, ROLES.ADMIN);
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : "overview";
  // The list pages are split by role since C-02; go back to the one this role sees.
  const backHref = isAdmin ? "/staff/events" : "/staff/events/assigned";
  // The page is facilitator-floor, so the assignment term is the facilitator row.
  const isAssignedFacilitator = event.EVENT_FACILITATOR?.some((f) => f.user_id === user?.id) ?? false;
  const canManageCourse = isAdmin || isAssignedFacilitator;
  const staffEvent = event as EventWithCourse & { facilitator_ids?: number[] };

  return (
    <StaffPage>
      <BackLink href={backHref} className="mb-6">
        Back to Events
      </BackLink>

      <EventDetailHero event={event} />

      {/* The whole-event actions, above the tabs, because none of them belongs
          to one panel and each was previously buried inside a different one. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {isAdmin && event.status === "draft" && (
          <Button size="lg" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish"}
          </Button>
        )}
        <Link href={`/staff/events/${eventId}/kiosk`} className={buttonStyles({ variant: "secondary", size: "lg" })}>
          <span aria-hidden className="material-symbols-rounded text-[18px]">
            qr_code_scanner
          </span>
          Open Kiosk
        </Link>
        {event.COURSE?.id && (
          <Link href={`/courses/${event.COURSE.id}/room`} className={buttonStyles({ variant: "secondary", size: "lg" })}>
            Enter Course Room
          </Link>
        )}
      </div>

      {publishError && <p className="mt-3 text-sm text-error">{publishError}</p>}

      <div role="tablist" aria-label="Event sections" className="mt-8 mb-6 flex flex-wrap gap-1.5 border-b border-border pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={currentTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              currentTab === tab.key ? "bg-muted font-medium text-fg" : "text-muted-fg hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentTab === "overview" && (
        <div className="space-y-6">
          {/* Above the summary, and only for an online event: on the day, this
              is the one thing on the page anybody needs. Every staff role that
              can open this page can set it — the endpoint scopes a facilitator
              to their own events. */}
          {event.event_type === "online" && (
            <MeetingLinkPanel
              eventId={eventId}
              initialUrl={event.meeting_url}
              onSaved={(meetingUrl) => applyEventPatch({ meeting_url: meetingUrl })}
            />
          )}

          <EventOverviewPanel
            event={event}
            attendeeCount={attendeesTotal}
            canDelete={isAdmin}
            deleteError={deleteError}
            onDelete={handleDelete}
          />
        </div>
      )}

      {currentTab === "details" && isAdmin && (
        <div className="space-y-6">
          <CoverImageUpload
            eventId={eventId}
            initialUrl={event.cover_image_url}
            onUploaded={(url) => applyEventPatch({ cover_image_url: url })}
          />

          <EditEventForm eventId={eventId} initialData={staffEvent} onSaved={applyEventPatch} />
        </div>
      )}

      {currentTab === "team" && isAdmin && (
        <EventTeamPanel eventId={eventId} facilitatorIds={staffEvent.facilitator_ids ?? []} />
      )}

      {currentTab === "course" && <EventCoursePanel eventId={eventId} userRole={userRole} canManageCourse={canManageCourse} />}

      {currentTab === "attendees" && isAdmin && (
        <SectionCard title="Attendees" icon="group">
          <AdminAttendeeManagement eventId={eventId} />
        </SectionCard>
      )}

      {currentTab === "surveys" && isAdmin && (
        <EventSurveyPanel event={event} onSaved={(surveyEnabled) => applyEventPatch({ survey_enabled: surveyEnabled })} />
      )}
    </StaffPage>
  );
}
