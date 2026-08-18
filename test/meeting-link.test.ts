import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { canSeeMeetingLink, meetingLinkState, redactMeetingUrl } from "@/modules/events/lib/meeting-link";
import { meetingUrlSchema, eventSchema, eventPartialSchema } from "@/modules/events/lib/schemas";

const LINK = "https://meet.google.com/abc-defg-hij";

// The event window is fixed and the clock is moved around it, so "started" is
// never a question of when the suite happens to run.
const event = { event_type: "online", event_date: "2026-09-01", start_time: "09:00", meeting_url: LINK };

const at = (iso: string) => vi.setSystemTime(new Date(iso));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("canSeeMeetingLink", () => {
  it("gives staff the link whenever they ask, since staff have to set it", () => {
    at("2026-08-01T00:00:00");
    expect(canSeeMeetingLink(event, { isStaff: true, hasTicket: false })).toBe(true);
  });

  it("withholds it from a ticket holder until the event starts", () => {
    at("2026-09-01T08:59:00");
    expect(canSeeMeetingLink(event, { isStaff: false, hasTicket: true })).toBe(false);
  });

  it("hands it to a ticket holder once the event has started", () => {
    at("2026-09-01T09:00:00");
    expect(canSeeMeetingLink(event, { isStaff: false, hasTicket: true })).toBe(true);
  });

  it("never hands it to someone without a ticket, however live the event is", () => {
    // A meeting link is an unauthenticated door: anyone holding it walks in,
    // which would make both the capacity cap and the payment decorative.
    at("2026-09-01T10:00:00");
    expect(canSeeMeetingLink(event, { isStaff: false, hasTicket: false })).toBe(false);
  });
});

describe("redactMeetingUrl", () => {
  it("keeps the link for a viewer who may hold it", () => {
    expect(redactMeetingUrl({ meeting_url: LINK }, true).meeting_url).toBe(LINK);
  });

  it("nulls the link rather than dropping the key", () => {
    // Dropping it would let a caller tell "withheld" from "never set" by the
    // shape of the response alone.
    const redacted = redactMeetingUrl({ id: 1, meeting_url: LINK }, false);

    expect(redacted.meeting_url).toBeNull();
    expect("meeting_url" in redacted).toBe(true);
    expect(redacted.id).toBe(1);
  });

  it("leaves the rest of the event alone", () => {
    expect(redactMeetingUrl({ id: 1, title: "Launch", meeting_url: LINK }, false)).toEqual({
      id: 1,
      title: "Launch",
      meeting_url: null,
    });
  });
});

describe("meetingLinkState", () => {
  it("is ready when a link was served", () => {
    at("2026-09-01T10:00:00");
    expect(meetingLinkState(event)).toBe("ready");
  });

  it("is pending before the event starts", () => {
    at("2026-08-01T00:00:00");
    expect(meetingLinkState({ ...event, meeting_url: null })).toBe("pending");
  });

  it("reads the same to a withheld viewer as to one whose event has no link", () => {
    // Both are "you have no link". Distinguishing them would leak whether a
    // link exists to precisely the people not allowed to know.
    at("2026-08-01T00:00:00");
    expect(meetingLinkState({ ...event, meeting_url: null })).toBe(
      meetingLinkState({ ...event, meeting_url: null, event_type: "online" }),
    );
  });

  it("says none once the event has started with no link posted", () => {
    at("2026-09-01T10:00:00");
    expect(meetingLinkState({ ...event, meeting_url: null })).toBe("none");
  });
});

describe("meetingUrlSchema", () => {
  it("accepts an http(s) URL", () => {
    expect(meetingUrlSchema.safeParse(LINK).success).toBe(true);
    expect(meetingUrlSchema.safeParse("http://zoom.us/j/123").success).toBe(true);
  });

  it("accepts null, which is the normal state before the room is made", () => {
    expect(meetingUrlSchema.safeParse(null).success).toBe(true);
  });

  it("refuses a javascript: URL, which an href would execute on click", () => {
    expect(meetingUrlSchema.safeParse("javascript:alert(document.cookie)").success).toBe(false);
  });

  it("refuses other non-web schemes and plain text", () => {
    expect(meetingUrlSchema.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(false);
    expect(meetingUrlSchema.safeParse("meet.google.com/abc").success).toBe(false);
    expect(meetingUrlSchema.safeParse("").success).toBe(false);
  });
});

describe("the meeting link and the event mode together", () => {
  const online = {
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00",
    end_time: "17:00",
    venue_name: "Zoom",
    event_type: "online" as const,
  };

  it("lets an online event be created with no link at all", () => {
    expect(eventSchema.safeParse(online).success).toBe(true);
  });

  it("lets an online event carry a link", () => {
    expect(eventSchema.safeParse({ ...online, meeting_url: LINK }).success).toBe(true);
  });

  it("refuses a link on an onsite event", () => {
    expect(eventSchema.safeParse({ ...online, event_type: "onsite", venue_name: "Hall A", meeting_url: LINK }).success).toBe(
      false,
    );
  });

  it("applies the same rule to a patch carrying both halves", () => {
    expect(eventPartialSchema.safeParse({ event_type: "onsite", meeting_url: LINK }).success).toBe(false);
    expect(eventPartialSchema.safeParse({ event_type: "online", meeting_url: LINK }).success).toBe(true);
  });
});

describe("meeting link migration (00012)", () => {
  const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/00012_event_meeting_url.sql"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("adds the column nullable, since the room rarely exists at creation", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "meeting_url" character varying(2048)');
    expect(sql).not.toMatch(/"meeting_url"[^;]*NOT NULL/);
  });

  it("refuses a link on anything but an online event", () => {
    expect(sql).toContain('CHECK ((("event_type" = \'online\'::"public"."event_mode") OR ("meeting_url" IS NULL)))');
  });
});
