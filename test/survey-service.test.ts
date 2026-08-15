import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, SurveyResponse } from "@/shared/types";

const supabase = {} as unknown as DbClient;

const dao = vi.hoisted(() => ({
  findSurveyByEventId: vi.fn(),
  createSurvey: vi.fn(),
  createResponses: vi.fn(),
  findRecipients: vi.fn(),
  findResponsesNeedingSend: vi.fn(),
  markResponseSent: vi.fn(),
  findByToken: vi.fn(),
  markSubmitted: vi.fn(),
  findSubmittedResponses: vi.fn(),
  countResponses: vi.fn(),
  findResponseBySurveyAndUserId: vi.fn(),
  findResponsesBySurveyAndUserIds: vi.fn(),
}));

const email = vi.hoisted(() => ({ sendEmailNotification: vi.fn() }));

vi.mock("@/modules/surveys/db/survey.dao", () => dao);
vi.mock("@/shared/integrations/email/send-notification", () => email);

import {
  sendEventSurvey,
  sendSurveyToAttendee,
  getAttendeeSurveyFlags,
  getSurveyByToken,
  submitSurvey,
  getSurveyResults,
  getStaffSurveyStatus,
} from "@/modules/surveys/lib/survey-service";

function offsetDate(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function finishedEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 1,
    title: "Launch Day",
    event_date: offsetDate(-1),
    start_time: "09:00",
    end_time: "10:00",
    venue_name: "Main Hall",
    venue_address: null,
    description: null,
    price: 0,
    currency: "PHP",
    cover_image_url: null,
    status: "complete",
    survey_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function response(overrides: Partial<SurveyResponse> & { USER?: unknown; SURVEY?: unknown } = {}): SurveyResponse {
  return {
    id: 1,
    survey_id: 11,
    user_id: 2,
    token: "token-abc",
    sent_at: null,
    submitted_at: null,
    rating: null,
    comment: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  email.sendEmailNotification.mockResolvedValue(true);
});

describe("sendEventSurvey", () => {
  it("refuses to send when the event survey is not enabled", async () => {
    await expect(sendEventSurvey(supabase, finishedEvent({ survey_enabled: false }))).resolves.toEqual({
      ok: false,
      reason: "not_enabled",
    });
    expect(dao.findSurveyByEventId).not.toHaveBeenCalled();
  });

  it("refuses to send while the event has not finished", async () => {
    await expect(sendEventSurvey(supabase, finishedEvent({ event_date: offsetDate(1) }))).resolves.toEqual({
      ok: false,
      reason: "not_finished",
    });
    expect(dao.findSurveyByEventId).not.toHaveBeenCalled();
  });

  it("refuses a retry once the window has passed", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    await expect(sendEventSurvey(supabase, finishedEvent())).resolves.toEqual({ ok: false, reason: "expired" });
    expect(dao.findRecipients).not.toHaveBeenCalled();
  });

  it("refuses when no one is registered", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([]);

    await expect(sendEventSurvey(supabase, finishedEvent())).resolves.toEqual({ ok: false, reason: "no_recipients" });
    expect(dao.createSurvey).not.toHaveBeenCalled();
  });

  it("creates the survey and a response per recipient, then emails and marks each delivered", async () => {
    const now = new Date("2026-08-10T00:00:00Z");
    dao.findSurveyByEventId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([
      { user_id: 2, full_name: "Ada Lovelace", email: "ada@example.com" },
      { user_id: 3, full_name: "Grace Hopper", email: "grace@example.com" },
    ]);
    dao.createSurvey.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: now.toISOString(),
      created_at: "2026-08-10T00:00:00Z",
      updated_at: "2026-08-10T00:00:00Z",
    });
    dao.createResponses.mockResolvedValue([
      response({ id: 101, survey_id: 11, user_id: 2, token: "t-ada" }),
      response({ id: 102, survey_id: 11, user_id: 3, token: "t-grace" }),
    ]);

    const result = await sendEventSurvey(supabase, finishedEvent(), now);

    expect(dao.createSurvey).toHaveBeenCalledWith(supabase, 1, now.toISOString());
    expect(dao.createResponses).toHaveBeenCalledWith(
      supabase,
      11,
      expect.arrayContaining([expect.objectContaining({ user_id: 2 }), expect.objectContaining({ user_id: 3 })]),
    );
    const tokens = dao.createResponses.mock.calls[0][2].map((r: { token: string }) => r.token);
    expect(tokens).toHaveLength(2);
    tokens.forEach((token: string) => expect(typeof token).toBe("string"));

    expect(email.sendEmailNotification).toHaveBeenCalledTimes(2);
    expect(email.sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 2,
        email: "ada@example.com",
        name: "Ada Lovelace",
        email_type: "event_survey",
        surveyUrl: expect.stringContaining("t-ada"),
      }),
    );
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 101);
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 102);
    expect(result).toEqual({ ok: true, survey_created: true, recipients: 2, delivered: 2, failed: 0 });
  });

  it("re-runs after a partial failure and emails only the responses never delivered", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date().toISOString(),
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    dao.findRecipients.mockResolvedValue([
      { user_id: 2, full_name: "Ada Lovelace", email: "ada@example.com" },
      { user_id: 3, full_name: "Grace Hopper", email: "grace@example.com" },
    ]);
    dao.findResponsesNeedingSend.mockResolvedValue([
      response({
        id: 102,
        survey_id: 11,
        user_id: 3,
        token: "t-grace",
        USER: { full_name: "Grace Hopper", email: "grace@example.com" },
      }),
    ]);

    const result = await sendEventSurvey(supabase, finishedEvent());

    expect(dao.createSurvey).not.toHaveBeenCalled();
    expect(dao.createResponses).not.toHaveBeenCalled();
    expect(email.sendEmailNotification).toHaveBeenCalledTimes(1);
    expect(email.sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({ surveyUrl: expect.stringContaining("t-grace") }),
    );
    expect(result).toEqual({ ok: true, survey_created: false, recipients: 1, delivered: 1, failed: 0 });
  });

  it("counts undelivered responses as failed and leaves them for the next retry", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([{ user_id: 2, full_name: "Ada Lovelace", email: "ada@example.com" }]);
    dao.createSurvey.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    });
    dao.createResponses.mockResolvedValue([response({ id: 101, survey_id: 11, user_id: 2, token: "t-ada" })]);
    email.sendEmailNotification.mockResolvedValue(false);

    const result = await sendEventSurvey(supabase, finishedEvent());

    expect(dao.markResponseSent).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, survey_created: true, recipients: 1, delivered: 0, failed: 1 });
  });

  it("keeps sending the remaining recipients when one email throws", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([
      { user_id: 2, full_name: "Ada Lovelace", email: "ada@example.com" },
      { user_id: 3, full_name: "Grace Hopper", email: "grace@example.com" },
    ]);
    dao.createSurvey.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    });
    dao.createResponses.mockResolvedValue([
      response({ id: 101, survey_id: 11, user_id: 2, token: "t-ada" }),
      response({ id: 102, survey_id: 11, user_id: 3, token: "t-grace" }),
    ]);
    email.sendEmailNotification.mockRejectedValueOnce(new Error("smtp down")).mockResolvedValueOnce(true);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendEventSurvey(supabase, finishedEvent());

    expect(consoleError).toHaveBeenCalled();
    expect(email.sendEmailNotification).toHaveBeenCalledTimes(2);
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 102);
    expect(result).toEqual({ ok: true, survey_created: true, recipients: 2, delivered: 1, failed: 1 });
    consoleError.mockRestore();
  });
});

describe("sendSurveyToAttendee", () => {
  function liveSurvey() {
    return { id: 11, event_id: 1, sent_at: new Date().toISOString(), created_at: "", updated_at: "" };
  }

  it("refuses when the event survey is not enabled", async () => {
    await expect(sendSurveyToAttendee(supabase, finishedEvent({ survey_enabled: false }), 5)).resolves.toEqual({
      ok: false,
      reason: "not_enabled",
    });
  });

  it("refuses while the event has not finished", async () => {
    await expect(sendSurveyToAttendee(supabase, finishedEvent({ event_date: offsetDate(1) }), 5)).resolves.toEqual({
      ok: false,
      reason: "not_finished",
    });
  });

  it("lazily creates the survey on a standalone first send", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);
    dao.findResponseBySurveyAndUserId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([{ user_id: 5, full_name: "Ada Lovelace", email: "ada@example.com" }]);
    dao.createSurvey.mockResolvedValue(liveSurvey());
    dao.createResponses.mockResolvedValue([response({ id: 101, survey_id: 11, user_id: 5, token: "t-ada" })]);

    const result = await sendSurveyToAttendee(supabase, finishedEvent(), 5);

    expect(dao.createSurvey).toHaveBeenCalledWith(supabase, 1, expect.any(String));
    expect(dao.createResponses).toHaveBeenCalledWith(
      supabase,
      11,
      expect.arrayContaining([expect.objectContaining({ user_id: 5 })]),
    );
    expect(email.sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 5,
        email: "ada@example.com",
        name: "Ada Lovelace",
        email_type: "event_survey",
        surveyUrl: expect.stringContaining("t-ada"),
      }),
    );
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 101);
    expect(result).toEqual({ ok: true, delivered: true });
  });

  it("refuses once the survey window has passed", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: "",
      updated_at: "",
    });
    await expect(sendSurveyToAttendee(supabase, finishedEvent(), 5)).resolves.toEqual({ ok: false, reason: "expired" });
    expect(dao.createSurvey).not.toHaveBeenCalled();
  });

  it("refuses an attendee who already responded", async () => {
    dao.findSurveyByEventId.mockResolvedValue(liveSurvey());
    dao.findResponseBySurveyAndUserId.mockResolvedValue(
      response({ id: 101, user_id: 5, submitted_at: "2026-08-01T00:00:00Z" }),
    );

    await expect(sendSurveyToAttendee(supabase, finishedEvent(), 5)).resolves.toEqual({
      ok: false,
      reason: "already_responded",
    });
  });

  it("refuses a user who holds no ticket", async () => {
    dao.findSurveyByEventId.mockResolvedValue(liveSurvey());
    dao.findResponseBySurveyAndUserId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([{ user_id: 2, full_name: "Ada Lovelace", email: "ada@example.com" }]);

    await expect(sendSurveyToAttendee(supabase, finishedEvent(), 5)).resolves.toEqual({
      ok: false,
      reason: "no_ticket",
    });
    expect(dao.createResponses).not.toHaveBeenCalled();
  });

  it("creates the response for a late registrant and delivers it", async () => {
    dao.findSurveyByEventId.mockResolvedValue(liveSurvey());
    dao.findResponseBySurveyAndUserId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([{ user_id: 5, full_name: "Ada Lovelace", email: "ada@example.com" }]);
    dao.createResponses.mockResolvedValue([response({ id: 101, survey_id: 11, user_id: 5, token: "t-ada" })]);

    const result = await sendSurveyToAttendee(supabase, finishedEvent(), 5);

    expect(dao.createResponses).toHaveBeenCalledWith(
      supabase,
      11,
      expect.arrayContaining([expect.objectContaining({ user_id: 5 })]),
    );
    expect(email.sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 5,
        email: "ada@example.com",
        name: "Ada Lovelace",
        email_type: "event_survey",
        surveyUrl: expect.stringContaining("t-ada"),
      }),
    );
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 101);
    expect(result).toEqual({ ok: true, delivered: true });
  });

  it("re-delivers an existing response that never went out", async () => {
    dao.findSurveyByEventId.mockResolvedValue(liveSurvey());
    dao.findResponseBySurveyAndUserId.mockResolvedValue(
      response({ id: 101, survey_id: 11, user_id: 5, token: "t-ada", USER: { full_name: "Ada", email: "ada@example.com" } }),
    );

    const result = await sendSurveyToAttendee(supabase, finishedEvent(), 5);

    expect(dao.createResponses).not.toHaveBeenCalled();
    expect(dao.markResponseSent).toHaveBeenCalledWith(supabase, 101);
    expect(result).toEqual({ ok: true, delivered: true });
  });

  it("reports an undelivered send so the admin can retry", async () => {
    dao.findSurveyByEventId.mockResolvedValue(liveSurvey());
    dao.findResponseBySurveyAndUserId.mockResolvedValue(null);
    dao.findRecipients.mockResolvedValue([{ user_id: 5, full_name: "Ada", email: "ada@example.com" }]);
    dao.createResponses.mockResolvedValue([response({ id: 101, survey_id: 11, user_id: 5, token: "t-ada" })]);
    email.sendEmailNotification.mockResolvedValue(false);

    await expect(sendSurveyToAttendee(supabase, finishedEvent(), 5)).resolves.toEqual({ ok: true, delivered: false });
    expect(dao.markResponseSent).not.toHaveBeenCalled();
  });
});

describe("getAttendeeSurveyFlags", () => {
  it("reports unusable when no survey was ever sent", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);

    const flags = await getAttendeeSurveyFlags(supabase, finishedEvent(), [5, 6]);

    expect(flags.usable).toBe(false);
    expect(flags.hasSurvey).toBe(false);
    expect(flags.byUser.size).toBe(0);
    expect(dao.findResponsesBySurveyAndUserIds).not.toHaveBeenCalled();
  });

  it("reports unusable once the window has passed", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: "",
      updated_at: "",
    });

    const flags = await getAttendeeSurveyFlags(supabase, finishedEvent(), [5, 6]);

    expect(flags.usable).toBe(false);
    expect(flags.hasSurvey).toBe(true);
  });

  it("flags sent and responded per attendee, leaving absent users out", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    });
    dao.findResponsesBySurveyAndUserIds.mockResolvedValue([
      response({ id: 1, survey_id: 11, user_id: 5, token: "t", sent_at: "2026-08-01T00:00:00Z", submitted_at: null }),
      response({
        id: 2,
        survey_id: 11,
        user_id: 6,
        token: "t",
        sent_at: "2026-08-01T00:00:00Z",
        submitted_at: "2026-08-02T00:00:00Z",
      }),
    ]);

    const flags = await getAttendeeSurveyFlags(supabase, finishedEvent(), [5, 6]);

    expect(flags.usable).toBe(true);
    expect(flags.hasSurvey).toBe(true);
    expect(flags.byUser.get(5)).toEqual({ sent: true, responded: false });
    expect(flags.byUser.get(6)).toEqual({ sent: true, responded: true });
    expect(flags.byUser.has(7)).toBe(false);
    expect(dao.findResponsesBySurveyAndUserIds).toHaveBeenCalledWith(supabase, 11, [5, 6]);
  });
});

describe("getSurveyByToken", () => {
  it("returns null for an unknown token", async () => {
    dao.findByToken.mockResolvedValue(null);
    await expect(getSurveyByToken(supabase, "nope")).resolves.toBeNull();
  });

  it("reports a response already submitted", async () => {
    dao.findByToken.mockResolvedValue(
      response({
        submitted_at: "2026-08-01T00:00:00Z",
        SURVEY: { id: 11, event_id: 1, sent_at: new Date().toISOString(), EVENT: { title: "Launch Day" } },
      }),
    );
    await expect(getSurveyByToken(supabase, "t")).resolves.toEqual({ state: "submitted" });
  });

  it("reports an expired window", async () => {
    dao.findByToken.mockResolvedValue(
      response({
        SURVEY: {
          id: 11,
          event_id: 1,
          sent_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          EVENT: { title: "Launch Day" },
        },
      }),
    );
    await expect(getSurveyByToken(supabase, "t")).resolves.toEqual({ state: "expired" });
  });

  it("opens the form with the event title", async () => {
    dao.findByToken.mockResolvedValue(
      response({
        SURVEY: { id: 11, event_id: 1, sent_at: new Date().toISOString(), EVENT: { title: "Launch Day" } },
      }),
    );
    await expect(getSurveyByToken(supabase, "t")).resolves.toEqual({ state: "open", event_title: "Launch Day" });
  });
});

describe("submitSurvey", () => {
  it("rejects a rating outside 1..5", async () => {
    await expect(submitSurvey(supabase, "t", { rating: 6, comment: "" })).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(dao.markSubmitted).not.toHaveBeenCalled();
  });

  it("rejects a comment over 2000 characters", async () => {
    await expect(submitSurvey(supabase, "t", { rating: 5, comment: "x".repeat(2001) })).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an unknown token", async () => {
    dao.findByToken.mockResolvedValue(null);
    await expect(submitSurvey(supabase, "nope", { rating: 4, comment: "" })).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects a second submission", async () => {
    dao.findByToken.mockResolvedValue(
      response({
        submitted_at: "2026-08-01T00:00:00Z",
        SURVEY: { id: 11, event_id: 1, sent_at: new Date().toISOString(), EVENT: null },
      }),
    );
    await expect(submitSurvey(supabase, "t", { rating: 4, comment: "" })).resolves.toEqual({
      ok: false,
      reason: "already_submitted",
    });
  });

  it("rejects a submission after the window", async () => {
    dao.findByToken.mockResolvedValue(
      response({
        SURVEY: { id: 11, event_id: 1, sent_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), EVENT: null },
      }),
    );
    await expect(submitSurvey(supabase, "t", { rating: 4, comment: "" })).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("stores the rating and the trimmed comment", async () => {
    dao.findByToken.mockResolvedValue(
      response({ id: 101, SURVEY: { id: 11, event_id: 1, sent_at: new Date().toISOString(), EVENT: null } }),
    );
    await expect(submitSurvey(supabase, "t", { rating: 4, comment: "  Great session  " })).resolves.toEqual({ ok: true });
    expect(dao.markSubmitted).toHaveBeenCalledWith(supabase, 101, 4, "Great session");
  });

  it("stores null for a blank comment", async () => {
    dao.findByToken.mockResolvedValue(
      response({ id: 101, SURVEY: { id: 11, event_id: 1, sent_at: new Date().toISOString(), EVENT: null } }),
    );
    await expect(submitSurvey(supabase, "t", { rating: 5, comment: "   " })).resolves.toEqual({ ok: true });
    expect(dao.markSubmitted).toHaveBeenCalledWith(supabase, 101, 5, null);
  });
});

describe("getSurveyResults", () => {
  it("computes the average, per-star counts and attributed comments", async () => {
    dao.findSubmittedResponses.mockResolvedValue([
      response({ id: 1, rating: 5, comment: "amazing", USER: { full_name: "Ada" } }),
      response({ id: 2, rating: 3, comment: null, USER: null }),
      response({ id: 3, rating: null, comment: "no stars, still loud", USER: { full_name: "Bob" } }),
    ]);

    const results = await getSurveyResults(supabase, 11);

    expect(results.average).toBe(4);
    expect(results.counts).toEqual([0, 0, 1, 0, 1]);
    expect(results.comments).toEqual([
      { rating: 5, comment: "amazing", attendee_name: "Ada" },
      { rating: null, comment: "no stars, still loud", attendee_name: "Bob" },
    ]);
  });

  it("returns zeros and no comments when nothing is submitted", async () => {
    dao.findSubmittedResponses.mockResolvedValue([]);
    await expect(getSurveyResults(supabase, 11)).resolves.toEqual({ average: null, counts: [0, 0, 0, 0, 0], comments: [] });
  });
});

describe("getStaffSurveyStatus", () => {
  it("reports no survey and empty results when one was never sent", async () => {
    dao.findSurveyByEventId.mockResolvedValue(null);

    const status = await getStaffSurveyStatus(supabase, finishedEvent());

    expect(status).toMatchObject({ survey_enabled: true, survey: null, results: { average: null, counts: [0, 0, 0, 0, 0] } });
  });

  it("reports totals, undelivered count and the expiry flag", async () => {
    dao.findSurveyByEventId.mockResolvedValue({
      id: 11,
      event_id: 1,
      sent_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    });
    dao.countResponses.mockResolvedValue(5);
    dao.findSubmittedResponses.mockResolvedValue([response({ id: 1, rating: 4, comment: "ok", USER: { full_name: "Ada" } })]);
    dao.findResponsesNeedingSend.mockResolvedValue([
      response({ id: 2, survey_id: 11, user_id: 9, token: "t", USER: { full_name: "Bob", email: "bob@example.com" } }),
    ]);

    const status = await getStaffSurveyStatus(supabase, finishedEvent());

    expect(status.survey).toMatchObject({
      total_recipients: 5,
      responded_count: 1,
      undelivered_count: 1,
      expired: false,
    });
    expect(status.results.average).toBe(4);
  });
});
