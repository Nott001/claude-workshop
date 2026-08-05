"use client";

import { describeRejection, type StorageBucket } from "./policy";
import { resizeImage } from "./resize-image";

export type UploadOutcome = { ok: true; url: string } | { ok: false; error: string };

/**
 * The whole browser side of an upload: check the file against the bucket, shrink
 * it, post it, read the answer.
 *
 * Each of those was previously opt-in at each call site, and each site made a
 * different subset of the choices — only the event cover pre-flighted against
 * the bucket, so an oversized profile photo or lesson video spent a full round
 * trip to be told what `policy.ts` already knew. Resizing was in all three only
 * because a test grepped for it.
 *
 * Returns the failure rather than throwing: the three callers surface errors
 * differently — inline text, a toast, a returned string — and that belongs to
 * them, while deciding *what went wrong* does not.
 */
export async function postUpload(
  bucket: StorageBucket,
  endpoint: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<UploadOutcome> {
  const rejection = describeRejection(bucket, file);
  if (rejection) return { ok: false, error: rejection };

  const body = new FormData();
  body.append("file", await resizeImage(file));
  for (const [name, value] of Object.entries(fields)) body.append(name, value);

  try {
    const res = await fetch(endpoint, { method: "POST", body });
    const data = await res.json().catch(() => null);

    if (!res.ok) return { ok: false, error: data?.error ?? "Could not upload the file." };
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Could not upload the file." };
  }
}
