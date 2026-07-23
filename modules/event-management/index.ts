import { z } from "zod";

const eventBaseSchema = z.object({
  title: z.string().min(1).max(255),
  event_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  venue_name: z.string().min(1).max(255),
  venue_address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  course_id: z.coerce.number().int().positive().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  cover_image_url: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "complete"]).optional(),
});

export const eventSchema = eventBaseSchema.refine((data) => data.start_time < data.end_time, {
  message: "start_time must be before end_time",
});

export const eventPartialSchema = eventBaseSchema.partial();

export const speakerProfileSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  bio: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  twitter_url: z.string().url().nullable().optional(),
  github_url: z.string().url().nullable().optional(),
  website_url: z.string().url().nullable().optional(),
});

export const speakerProfileUpdateSchema = z.object({
  bio: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  twitter_url: z.string().url().nullable().optional(),
  github_url: z.string().url().nullable().optional(),
  website_url: z.string().url().nullable().optional(),
});

export const speakerAssignmentSchema = z.object({
  speaker_profile_id: z.coerce.number().int().positive(),
});
