import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getCurrentUser, findByIdWithCourse, getAttendeeCount, facilitatorIsAssigned, ticketDao, speakerDao } = vi.hoisted(
  () => ({
    getCurrentUser: vi.fn(),
    findByIdWithCourse: vi.fn(),
    getAttendeeCount: vi.fn(),
    facilitatorIsAssigned: vi.fn(),
    ticketDao: { findActiveTicketByUserAndEvent: vi.fn() },
    speakerDao: { findByUserId: vi.fn(), checkSpeakerAssignment: vi.fn() },
  }),
);

vi.mock("@/modules/auth/lib/session", () => ({ getCurrentUser }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole: vi.fn() }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/ticket.dao", () => ticketDao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/modules/events/db/event.dao", () => ({
  findByIdWithCourse,
  getAttendeeCount,
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({
  isAssigned: facilitatorIsAssigned,
  replaceEventAssignments: vi.fn(),
}));
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);

import { GET } from "@/app/api/events/[id]/route";
import { parseEventDateTime } from "@/shared/lib/date-utils";

const get = (id = "1") => GET(new Request(`https://app.test/api/events/${id}`), { params: Promise.resolve({ id }) });

const staffUser = (role: string) => ({
  id: 9,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  findByIdWithCourse.mockResolvedValue({
    id: 1,
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00",
    end_time: "17:00",
    status: "active",
    EVENT_FACILITATOR: [{ user_id: 9 }],
  });
  getAttendeeCount.mockResolvedValue(3);
  facilitatorIsAssigned.mockResolvedValue(true);
  ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue(null);
  speakerDao.findByUserId.mockResolvedValue(null);
  speakerDao.checkSpeakerAssignment.mockResolvedValue(false);
});

describe("GET /api/events/[id] facilitator assignment scoping", () => {
  it("admits a facilitator assigned to the event", async () => {
    getCurrentUser.mockResolvedValue(staffUser(ROLES.FACILITATOR));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).toHaveBeenCalledWith({}, 1, 9);
  });

  it("hides an event the facilitator is not assigned to", async () => {
    getCurrentUser.mockResolvedValue(staffUser(ROLES.FACILITATOR));
    facilitatorIsAssigned.mockResolvedValue(false);

    const res = await get();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("does not consult the assignment roster for an admin", async () => {
    getCurrentUser.mockResolvedValue(staffUser(ROLES.ADMIN));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).not.toHaveBeenCalled();
  });

  it("still lets an attendee read a published event without an assignment check", async () => {
    getCurrentUser.mockResolvedValue(staffUser(ROLES.ATTENDEE));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).not.toHaveBeenCalled();
  });

  it("answers the caller's ticket and speaker facts alongside the event", async () => {
    getCurrentUser.mockResolvedValue(staffUser(ROLES.ATTENDEE));
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ id: 11, event_id: 1, status: "issued" });
    speakerDao.findByUserId.mockResolvedValue({ id: 22, user_id: 9 });
    speakerDao.checkSpeakerAssignment.mockResolvedValue(true);

    const res = await get();

    expect(ticketDao.findActiveTicketByUserAndEvent).toHaveBeenCalledWith(expect.anything(), 9, 1);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ hasTicket: true, isSpeakerAssigned: true, speakerProfileId: 22 }),
    );
  });
});

/**
 * The link is withheld by the API, not merely hidden by the UI. A reader who
 * fetches this endpoint directly is the whole reason the rule lives here.
 */
describe("GET /api/events/[id] meeting link", () => {
  const LINK = "https://meet.google.com/abc-defg-hij";

  const attendee = { id: 5, role: ROLES.ATTENDEE, full_name: "Ann", email: "ann@example.com", profile_image_url: null };

  beforeEach(() => {
    vi.useFakeTimers();
    findByIdWithCourse.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      event_date: "2026-09-01",
      start_time: "09:00",
      end_time: "17:00",
      status: "active",
      event_type: "online",
      meeting_url: LINK,
      EVENT_FACILITATOR: [],
    });
  });

  afterEach(() => vi.useRealTimers());

  it("serves it to staff before the event starts, since staff set it", async () => {
    vi.setSystemTime(parseEventDateTime("2026-08-01", "00:00:00")!);
    getCurrentUser.mockResolvedValue(staffUser(ROLES.ADMIN));

    const body = await (await get()).json();

    expect(body.meeting_url).toBe(LINK);
  });

  it("withholds it from a ticket holder until the event starts", async () => {
    vi.setSystemTime(parseEventDateTime("2026-09-01", "08:59:00")!);
    getCurrentUser.mockResolvedValue(attendee);
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ id: 3, status: "issued" });

    const body = await (await get()).json();

    expect(body.meeting_url).toBeNull();
    expect(body.hasTicket).toBe(true);
  });

  it("serves it to a ticket holder once the event has started", async () => {
    vi.setSystemTime(parseEventDateTime("2026-09-01", "09:30:00")!);
    getCurrentUser.mockResolvedValue(attendee);
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ id: 3, status: "issued" });

    const body = await (await get()).json();

    expect(body.meeting_url).toBe(LINK);
  });

  it("withholds it from a signed-in reader with no ticket, mid-event", async () => {
    vi.setSystemTime(parseEventDateTime("2026-09-01", "09:30:00")!);
    getCurrentUser.mockResolvedValue(attendee);
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue(null);

    const body = await (await get()).json();

    expect(body.meeting_url).toBeNull();
  });

  it("withholds it from a signed-out reader, mid-event", async () => {
    vi.setSystemTime(parseEventDateTime("2026-09-01", "09:30:00")!);
    getCurrentUser.mockResolvedValue(null);

    const body = await (await get()).json();

    expect(body.meeting_url).toBeNull();
  });

  it("keeps the key present when withholding, so the shape says nothing", async () => {
    vi.setSystemTime(parseEventDateTime("2026-09-01", "09:30:00")!);
    getCurrentUser.mockResolvedValue(null);

    const body = await (await get()).json();

    expect("meeting_url" in body).toBe(true);
  });
});
