import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordAttempt, countByUser, countByIp, nthOldestSince } = vi.hoisted(() => ({
  recordAttempt: vi.fn(),
  countByUser: vi.fn(),
  countByIp: vi.fn(),
  nthOldestSince: vi.fn(),
}));

vi.mock("@/shared/db/dao/email-change-attempt.dao", () => ({
  recordAttempt,
  countByUser,
  countByIp,
  nthOldestSince,
}));

import {
  checkEmailChangeSendLimit,
  EMAIL_CHANGE_MAX_PER_IP,
  EMAIL_CHANGE_MAX_PER_USER,
  EMAIL_CHANGE_WINDOW_MS,
} from "@/modules/auth/lib/email-change-limit";

const db = {} as never;
const USER_ID = 1;
const IP = "203.0.113.7";
const NOW = new Date("2026-08-17T12:00:00.000Z");

/** `ago` minutes before NOW, as the DAO would return it. */
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  recordAttempt.mockResolvedValue(undefined);
  countByUser.mockResolvedValue(1);
  countByIp.mockResolvedValue(1);
  nthOldestSince.mockResolvedValue(null);
});

describe("checkEmailChangeSendLimit", () => {
  it("allows a caller inside both limits", async () => {
    await expect(checkEmailChangeSendLimit(db, USER_ID, IP, NOW)).resolves.toEqual({ allowed: true });
  });

  // Written before the counts are read, so two requests racing cannot both read
  // a total taken before either insert and both conclude they are under.
  it("records the attempt before counting it", async () => {
    const order: string[] = [];
    recordAttempt.mockImplementation(async () => void order.push("record"));
    countByUser.mockImplementation(async () => {
      order.push("count");
      return 1;
    });

    await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(order).toEqual(["record", "count"]);
  });

  it("refuses once the caller is past their own limit", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    nthOldestSince.mockResolvedValue(minutesAgo(5));

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    // The oldest attempt was 5 minutes into a 15-minute window, so 10 remain.
    expect(verdict).toEqual({ allowed: false, retryAfter: 600 });
  });

  it("refuses once the origin is past its limit, whoever is asking", async () => {
    countByIp.mockResolvedValue(EMAIL_CHANGE_MAX_PER_IP + 1);
    nthOldestSince.mockResolvedValue(minutesAgo(14));

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(verdict).toEqual({ allowed: false, retryAfter: 60 });
    expect(nthOldestSince).toHaveBeenCalledWith(db, "ip", IP, expect.any(String), 1);
  });

  // A caller n over the limit is under it again once n attempts have aged out,
  // so it is the nth oldest that frees the next send. Reading the oldest would
  // state a wait shorter than the truth and buy them a second refusal.
  it("waits on the nth oldest attempt, not the oldest, when several over", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 3);
    nthOldestSince.mockResolvedValue(minutesAgo(2));

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(nthOldestSince).toHaveBeenCalledWith(db, "user_id", USER_ID, expect.any(String), 3);
    expect(verdict).toEqual({ allowed: false, retryAfter: 780 });
  });

  it("waits on whichever limit frees last when both are exceeded", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    countByIp.mockResolvedValue(EMAIL_CHANGE_MAX_PER_IP + 6);

    await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(nthOldestSince).toHaveBeenCalledWith(db, "ip", IP, expect.any(String), 6);
  });

  // Absent under `next dev` and behind any host that is not Cloudflare.
  it("applies the per-user limit alone when there is no origin to count", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    nthOldestSince.mockResolvedValue(minutesAgo(5));

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, null, NOW);

    expect(countByIp).not.toHaveBeenCalled();
    expect(verdict).toEqual({ allowed: false, retryAfter: 600 });
  });

  // The DAO answers MAX_SAFE_INTEGER when it cannot read the counter, so an
  // unreadable ledger refuses rather than leaving an open mail relay.
  it("refuses when the counter cannot be read at all", async () => {
    countByUser.mockResolvedValue(Number.MAX_SAFE_INTEGER);

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(verdict.allowed).toBe(false);
  });

  it("names the full window when the ledger cannot say when a slot frees", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    nthOldestSince.mockResolvedValue(null);

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(verdict).toEqual({ allowed: false, retryAfter: EMAIL_CHANGE_WINDOW_MS / 1000 });
  });

  it("never reports a wait of zero at the very edge of the window", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    nthOldestSince.mockResolvedValue(new Date(NOW.getTime() - EMAIL_CHANGE_WINDOW_MS + 1).toISOString());

    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(verdict).toEqual({ allowed: false, retryAfter: 1 });
  });
});

// The two ways the old cooldown could be walked around, as behaviour rather
// than as a claim about the code: neither the address asked for nor the pending
// record reaches this limiter, so neither trick can move its verdict.
describe("the bypasses the cooldown allowed", () => {
  it("counts a run of different addresses as the same caller's attempts", async () => {
    let sends = 0;
    countByUser.mockImplementation(async () => ++sends);
    nthOldestSince.mockResolvedValue(minutesAgo(1));

    const verdicts = [];
    for (const address of ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com"]) {
      // The address is never passed in — that is the point. Named here only to
      // show what the caller was varying between attempts.
      void address;
      verdicts.push(await checkEmailChangeSendLimit(db, USER_ID, IP, NOW));
    }

    expect(verdicts.filter((v) => v.allowed)).toHaveLength(EMAIL_CHANGE_MAX_PER_USER);
    expect(verdicts.at(-1)).toEqual({ allowed: false, retryAfter: 840 });
  });

  it("keeps counting across a cancel, which clears GoTrue's record but not ours", async () => {
    countByUser.mockResolvedValue(EMAIL_CHANGE_MAX_PER_USER + 1);
    nthOldestSince.mockResolvedValue(minutesAgo(3));

    // Nothing here is keyed on the pending change, so `cancel_pending_email_change`
    // nulling `email_change_sent_at` cannot reset this the way it reset the cooldown.
    const verdict = await checkEmailChangeSendLimit(db, USER_ID, IP, NOW);

    expect(verdict).toEqual({ allowed: false, retryAfter: 720 });
  });
});
