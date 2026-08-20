import { z } from "zod";
import { isEventLive } from "@/shared/lib/date-utils";

/**
 * Parsed as a URL and pinned to http(s): this string is rendered as an href, and
 * `javascript:` in an href is script execution on click. Null is the normal
 * state — the room rarely exists when the event is scheduled.
 *
 * Exported because the meeting-link route validates the same value on its own,
 * and a second spelling of this rule is a second place for it to be wrong.
 */
export const meetingUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((url) => /^https?:\/\//i.test(url), { message: "A meeting link must start with http:// or https://" })
  .nullable();

const eventBaseSchema = z.object({
  title: z.string().min(1).max(255),
  event_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  venue_name: z.string().min(1).max(255),
  venue_address: z.string().nullable().optional(),
  event_type: z.enum(["onsite", "online"]).optional(),
  // Parsed as a URL and pinned to http(s): this string is rendered as an href,
  // and `javascript:` in an href is script execution on click. Null is the
  // normal state — the room rarely exists when the event is scheduled.
  meeting_url: meetingUrlSchema.optional(),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  // Null is uncapped, which is also what an omitted capacity means. Bounded
  // above so a typo cannot store a number the seat count can never reach; the
  // DB's chk_event_capacity_positive holds the lower edge.
  capacity: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "complete"]).optional(),
  survey_enabled: z.boolean().optional(),
  facilitator_ids: z.array(z.coerce.number().int().positive()).optional(),
  speaker_profile_ids: z.array(z.coerce.number().int().positive()).optional(),
});

/** An online event is held on a platform, not at an address, and the database's
 *  chk_event_online_has_no_address says so too. Checked here as well so the
 *  pair comes back as a 400 the caller can read rather than a constraint 500. */
const noAddressWhenOnline = (data: { event_type?: string; venue_address?: string | null }) =>
  data.event_type !== "online" || !data.venue_address;

const ADDRESS_WHEN_ONLINE = { message: "An online event cannot have a venue address" };

/** The mirror of the rule above, and of chk_event_meeting_url_online_only. */
const noLinkWhenOnsite = (data: { event_type?: string; meeting_url?: string | null }) =>
  data.event_type !== "onsite" || !data.meeting_url;

const LINK_WHEN_ONSITE = { message: "Only an online event can have a meeting link" };

export const eventSchema = eventBaseSchema
  .refine((data) => data.start_time < data.end_time, {
    message: "start_time must be before end_time",
  })
  .refine(noAddressWhenOnline, ADDRESS_WHEN_ONLINE)
  .refine(noLinkWhenOnsite, LINK_WHEN_ONSITE);

// `.partial()` drops the refinement, so a PATCH used to accept an inverted
// range and let the DB's chk_event_time turn a 400 into a 500. Re-applied for
// the case where the patch carries both ends; a patch that moves only one end
// is checked against the stored event in the route, which has the other half.
export const eventPartialSchema = eventBaseSchema
  .partial()
  .refine((data) => data.start_time === undefined || data.end_time === undefined || data.start_time < data.end_time, {
    message: "start_time must be before end_time",
  })
  // Only catches a patch carrying both halves. A patch that names one of them
  // is checked against the stored event in `updateEvent`, which has the other.
  .refine(noAddressWhenOnline, ADDRESS_WHEN_ONLINE)
  .refine(noLinkWhenOnsite, LINK_WHEN_ONSITE);

export const speakerProfileSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  bio: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
});

export const speakerProfileUpdateSchema = z.object({
  bio: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
});

export const speakerAssignmentSchema = z.object({
  speaker_profile_id: z.coerce.number().int().positive(),
});

/** A caption is a line under a photo, not a paragraph. Mirrors the column. */
export const MAX_CAPTION_LENGTH = 200;

/**
 * The caption on a photo. Optional on upload and nullable on edit, because
 * clearing a caption is a thing a curator does and `undefined` would read as
 * "leave it alone" — the two are different requests.
 */
export const eventPhotoCaptionSchema = z.object({
  caption: z.string().max(MAX_CAPTION_LENGTH).nullable(),
});

export type BadgeStatus = "live" | "upcoming" | "completed" | "draft";

export function getBadgeProps(event: { event_date: string; start_time: string; end_time: string; status: string }): {
  status: BadgeStatus;
  label: string;
} {
  if (isEventLive(event.event_date, event.start_time, event.end_time)) {
    return { status: "live", label: "Live" };
  }
  switch (event.status) {
    case "active":
      return { status: "upcoming", label: "Upcoming" };
    case "complete":
      return { status: "completed", label: "Completed" };
    case "draft":
      return { status: "draft", label: "Draft" };
    default:
      return { status: "draft", label: "Draft" };
  }
}
