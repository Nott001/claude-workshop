import { z } from "zod";

export const communityLinkSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url(),
  description: z.string().nullable().optional(),
  // The form submits an empty string when the optional field is blank; the
  // column is nullable, so normalize the empty string to null before insert.
  icon_url: z
    .union([z.string().url(), z.literal(""), z.null()])
    .transform((value) => (value === "" ? null : value))
    .optional(),
  sequence_order: z.coerce.number().int().min(0).optional(),
});

export const communityLinkPartialSchema = communityLinkSchema.partial().extend({
  is_hidden: z.boolean().optional(),
});

export type CommunityLinkInput = z.infer<typeof communityLinkSchema>;
export type CommunityLinkPatch = z.infer<typeof communityLinkPartialSchema>;
