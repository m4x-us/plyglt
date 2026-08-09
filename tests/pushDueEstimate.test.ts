import { describe, it, expect } from "vitest";
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

describe("buildNotificationPayload", () => {
  it("returns null when cardCount is 0 (no zero-card nag push)", () => {
    expect(buildNotificationPayload({ cardCount: 0, sessionType: "review" })).toBeNull();
  });

  it("formats body as '<n> cards ready' for plural counts, using canonical terminology", () => {
    const payload = buildNotificationPayload({ cardCount: 5, sessionType: "review" });
    expect(payload).toEqual({
      title: "plyglt",
      body: "5 cards ready",
      data: { cardCount: 5, sessionType: "review" },
    });
  });

  it("formats body as '1 card ready' (singular) for a single ready card", () => {
    const payload = buildNotificationPayload({ cardCount: 1, sessionType: "review" });
    expect(payload?.body).toBe("1 card ready");
  });

  it("never uses forbidden terminology ('due' or 'overdue') in the body", () => {
    const payload = buildNotificationPayload({ cardCount: 3, sessionType: "review" });
    expect(payload?.body).not.toMatch(/due|overdue/i);
  });
});
