import { describe, it, expect, vi } from "vitest";
import {
  groupReviewEventsByUserId,
  computeDueEstimate,
  buildNotificationPayload,
} from "../supabase/functions/send-interrupt-notifications/dueEstimate.ts";
import type { ReviewEventRow } from "../supabase/functions/send-interrupt-notifications/types.ts";

function makeEvent(overrides: Partial<ReviewEventRow> = {}): ReviewEventRow {
  return {
    card_id: "card-1",
    user_id: "user-1",
    reviewed_at: "2026-06-01T00:00:00.000Z",
    due_date: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupReviewEventsByUserId", () => {
  it("scopes rows strictly to their own user_id with an exact row count per user", () => {
    const rows = [
      makeEvent({ user_id: "u1", card_id: "c1" }),
      makeEvent({ user_id: "u2", card_id: "c1" }),
      makeEvent({ user_id: "u1", card_id: "c2" }),
    ];
    const map = groupReviewEventsByUserId(rows);
    expect(map.get("u1")).toEqual([rows[0], rows[2]]);
    expect(map.get("u2")).toEqual([rows[1]]);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for an empty input", () => {
    expect(groupReviewEventsByUserId([])).toEqual(new Map());
  });
});

describe("computeDueEstimate", () => {
  it("returns cardCount 0 when every row's due_date is in the future", () => {
    const now = new Date("2026-06-05T00:00:00Z");
    const events = [makeEvent({ due_date: "2026-06-10T00:00:00.000Z" })];
    expect(computeDueEstimate(events, "user-1", now)).toEqual({ cardCount: 0, sessionType: "review" });
  });

  it("counts each card_id once, using only its most recent reviewed_at row", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const events = [
      // Same card reviewed twice — the earlier row's due_date is in the
      // past (would count), but the later, more recent review pushed the
      // due date into the future. Only the latest row must be considered.
      makeEvent({
        card_id: "card-1",
        reviewed_at: "2026-06-01T00:00:00.000Z",
        due_date: "2026-06-02T00:00:00.000Z",
      }),
      makeEvent({
        card_id: "card-1",
        reviewed_at: "2026-06-10T00:00:00.000Z",
        due_date: "2026-06-20T00:00:00.000Z",
      }),
    ];
    expect(computeDueEstimate(events, "user-1", now)).toEqual({ cardCount: 0, sessionType: "review" });
  });

  it("counts multiple distinct ready cards correctly", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const events = [
      makeEvent({ card_id: "card-1", due_date: "2026-06-10T00:00:00.000Z" }), // ready
      makeEvent({ card_id: "card-2", due_date: "2026-06-14T00:00:00.000Z" }), // ready
      makeEvent({ card_id: "card-3", due_date: "2026-06-20T00:00:00.000Z" }), // not yet
    ];
    expect(computeDueEstimate(events, "user-1", now)).toEqual({ cardCount: 2, sessionType: "review" });
  });

  it("ignores rows belonging to a different user_id", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const events = [
      makeEvent({ user_id: "user-1", card_id: "card-1", due_date: "2026-06-10T00:00:00.000Z" }),
      makeEvent({ user_id: "user-2", card_id: "card-2", due_date: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(computeDueEstimate(events, "user-1", now)).toEqual({ cardCount: 1, sessionType: "review" });
  });

  it("always returns sessionType 'review' (documented v1 scope limitation)", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const result = computeDueEstimate([makeEvent({ due_date: "2026-06-10T00:00:00.000Z" })], "user-1", now);
    expect(result.sessionType).toBe("review");
  });
});

describe("buildNotificationPayload — Batch 23 session floor, Tasks #544/#545 clamp+zero-case fix", () => {
  // A genuinely zero estimate is honestly worded, not floored to a number the server
  // cannot back — Deletion Test: the pre-fix code claimed "6 cards ready" here.
  it("uses an honest, count-free body for a zero estimate — never suppresses the send, never fabricates a number", () => {
    expect(buildNotificationPayload({ cardCount: 0, sessionType: "review" })).toEqual({
      title: "plyglt",
      body: "Cards ready",
      data: { cardCount: 0, sessionType: "review" },
    });
  });

  it("floors a small positive estimate (1) at 6 — the session the tap opens targets at least 6", () => {
    expect(buildNotificationPayload({ cardCount: 1, sessionType: "review" }).body).toBe("6 cards ready");
  });

  it("keeps an estimate within the floor..cap range exact", () => {
    const payload = buildNotificationPayload({ cardCount: 7, sessionType: "review" });
    expect(payload).toEqual({
      title: "plyglt",
      body: "7 cards ready",
      data: { cardCount: 7, sessionType: "review" },
    });
  });

  // Deletion Test: the pre-clamp code returned "9 cards ready" here, overstating what
  // app/study/page.tsx's INTERRUPT_SESSION_CAP(8)-capped queue can ever deliver.
  it("clamps a backlog estimate above the cap (9) down to 8 — never announces more than the session can hold", () => {
    const payload = buildNotificationPayload({ cardCount: 9, sessionType: "review" });
    expect(payload).toEqual({
      title: "plyglt",
      body: "8 cards ready",
      data: { cardCount: 8, sessionType: "review" },
    });
  });

  it("clamps a large vacation-return backlog (40) down to the cap (8)", () => {
    expect(buildNotificationPayload({ cardCount: 40, sessionType: "review" }).body).toBe("8 cards ready");
  });

  it("never uses forbidden terminology ('due' or 'overdue') in the body", () => {
    const payload = buildNotificationPayload({ cardCount: 3, sessionType: "review" });
    expect(payload.body).not.toMatch(/due|overdue/i);
  });

  it("never uses forbidden terminology in the zero-estimate body either", () => {
    expect(buildNotificationPayload({ cardCount: 0, sessionType: "review" }).body).not.toMatch(/due|overdue/i);
  });

  // Task #638 (supersedes Task #578's clamp-and-log behavior): a negative cardCount
  // (malformed upstream data, not reachable via computeDueEstimate today) now throws
  // rather than silently clamping to a fake floored value — dispatchNotifications'
  // per-token try/catch (summary.erroredUnexpectedly) is the intended backstop, so
  // corrupted data never reaches an actual sent notification with a made-up count.
  it("throws for a negative cardCount instead of silently clamping to a fake floor value", () => {
    expect(() => buildNotificationPayload({ cardCount: -3, sessionType: "review" })).toThrow(
      "buildNotificationPayload received a negative cardCount: -3"
    );
  });

  it("does not log anything for a non-negative cardCount", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    buildNotificationPayload({ cardCount: 7, sessionType: "review" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
