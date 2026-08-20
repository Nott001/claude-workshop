import { z } from "zod";

/**
 * Which modules of an event's course are held back until the event is over.
 *
 * A course belongs to exactly one event (COURSE.event_id is UNIQUE), so the
 * two kinds of material live inside one curriculum rather than across two
 * courses: the modules that are worked through in the session, and the ones
 * released to attendees once the session has ended. The map is keyed by event
 * id — the event whose ending releases them, and the only event that can.
 *
 * It lives in SYSTEM_SETTING rather than a column because it is a schedule
 * decision about a curriculum, not a fact about a module: it changes as staff
 * plan the day, and it needs no migration to exist. The day a module needs
 * per-attendee release, this stops being the right home.
 */
export const AFTER_EVENT_MODULES_SETTING_KEY = "after_event_modules";

const moduleIds = z.array(z.number().int().positive());

export const afterEventModulesSchema = z.object({
  version: z.literal(1),
  // Keyed by event id as a string: jsonb object keys are always strings.
  releases: z.record(z.string().regex(/^\d+$/), moduleIds),
});

export type AfterEventModules = z.infer<typeof afterEventModulesSchema>;

export const NO_RELEASES: AfterEventModules = { version: 1, releases: {} };

/** The modules event `eventId` releases when it finishes. */
export function releaseFor(map: AfterEventModules, eventId: number): number[] {
  return map.releases[String(eventId)] ?? [];
}

/** Every event holding something back — the ones a listing needs to consider. */
export function releasingEventIds(map: AfterEventModules): number[] {
  return Object.entries(map.releases)
    .filter(([, modules]) => modules.length > 0)
    .map(([eventId]) => Number(eventId));
}

/**
 * The map with event `eventId`'s release set replaced. An empty list drops the
 * key rather than storing an empty array, so a course that holds nothing back
 * serialises as `{}` instead of accumulating dead entries.
 */
export function withRelease(map: AfterEventModules, eventId: number, moduleIds: number[]): AfterEventModules {
  const next = { ...map.releases };
  const unique = [...new Set(moduleIds)].sort((a, b) => a - b);
  if (unique.length === 0) {
    delete next[String(eventId)];
  } else {
    next[String(eventId)] = unique;
  }
  return { version: 1, releases: next };
}

export interface ReleaseWindow {
  /** The event's opening edge has passed. */
  started: boolean;
  /** Its closing edge has too — what releases the held-back modules. */
  finished: boolean;
  /** Staff run the course, so they read all of it at any hour. */
  isStaff: boolean;
}

/**
 * The modules a viewer may read right now.
 *
 * One rule for both surfaces, so the live room and the self-paced page can
 * never disagree about what has been released: a held-back module appears once
 * the event has finished, everything else once it has started, and staff see
 * the whole curriculum throughout because they are the ones assembling it.
 *
 * Pure, and separate from the fetching, because this is the rule the feature
 * turns on — a test that reimplements it proves nothing.
 */
export function visibleModules<T extends { id: number }>(modules: T[], released: number[], window: ReleaseWindow): T[] {
  if (window.isStaff) return modules;
  const heldBack = new Set(released);
  return modules.filter((mod) => (heldBack.has(mod.id) ? window.finished : window.started));
}
