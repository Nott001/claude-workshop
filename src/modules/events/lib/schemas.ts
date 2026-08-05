import { z } from "zod";
import { isEventLive } from "@/shared/lib/date-utils";

const eventBaseSchema = z.object({
  title: z.string().min(1).max(255),
  event_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  venue_name: z.string().min(1).max(255),
  venue_address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  cover_image_url: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "complete"]).optional(),
  facilitator_ids: z.array(z.coerce.number().int().positive()).optional(),
  speaker_profile_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export const eventSchema = eventBaseSchema.refine((data) => data.start_time < data.end_time, {
  message: "start_time must be before end_time",
});

// `.partial()` drops the refinement, so a PATCH used to accept an inverted
// range and let the DB's chk_event_time turn a 400 into a 500. Re-applied for
// the case where the patch carries both ends; a patch that moves only one end
// is checked against the stored event in the route, which has the other half.
export const eventPartialSchema = eventBaseSchema
  .partial()
  .refine((data) => data.start_time === undefined || data.end_time === undefined || data.start_time < data.end_time, {
    message: "start_time must be before end_time",
  });

export const speakerProfileSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  bio: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
});

export const speakerProfileUpdateSchema = z.object({
  bio: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
});

export const speakerAssignmentSchema = z.object({
  speaker_profile_id: z.coerce.number().int().positive(),
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
