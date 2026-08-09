import { describe, it, expect, vi } from "vitest";
import { isWithinWakingHours, selectDueTokens } from "../supabase/functions/send-interrupt-notifications/dueSelection.ts";
import type { PushTokenRow } from "../supabase/functions/send-interrupt-notifications/types.ts";

function makeToken(overrides: Partial<PushTokenRow> = {}): PushTokenRow {
  return {
    id: "token-1",
    user_id: "user-1",
    platform: "ios",
    device_id: "device-1",
    token: "raw-token",
    app_env: "production",
    timezone: "Europe/Rome",
    interrupt_interval_minutes: 90,
    waking_hours_start_local: 8,
    waking_hours_end_local: 20,
    last_sent_at: null,
    deactivated_at: null,
    ...overrides,
  };
}

describe("isWithinWakingHours", () => {
  it("returns true for a UTC instant that is 10:00 local in Europe/Rome (waking hours 8-20)", () => {
    // 2026-06-15T08:00:00Z is 10:00 CEST (UTC+2 in summer) in Europe/Rome.
    expect(isWithinWakingHours("Europe/Rome", new Date("2026-06-15T08:00:00Z"), 8, 20)).toBe(true);
  });

  it("returns false for a UTC instant that is 3:00 local in Europe/Rome", () => {
    expect(isWithinWakingHours("Europe/Rome", new Date("2026-06-15T01:00:00Z"), 8, 20)).toBe(false);
  });

  it("handles the America/New_York DST fall-back repeated local hour correctly for both occurrences (2026-11-01)", () => {
    // Both UTC instants below map to local 1:30am in America/New_York — the
    // first while still EDT, the second after the fall-back to EST. Neither
    // is ambiguous because each is a distinct, well-defined UTC instant;
    // Intl.DateTimeFormat resolves both to the correct local hour "1".
    const firstOccurrence = new Date("2026-11-01T05:30:00Z");
    const secondOccurrence = new Date("2026-11-01T06:30:00Z");
    expect(isWithinWakingHours("America/New_York", firstOccurrence, 8, 20)).toBe(false);
    expect(isWithinWakingHours("America/New_York", secondOccurrence, 8, 20)).toBe(false);
  });

  it("returns false (not throw) and logs [ERR-PUSH-INVALID-TIMEZONE-...] for a malformed/non-IANA timezone string", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isWithinWakingHours("Not/A/Real/Timezone", new Date("2026-06-15T08:00:00Z"), 8, 20)).toBe(false);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(
      /^\[ERR-PUSH-INVALID-TIMEZONE-\d+\] isWithinWakingHours: invalid timezone "Not\/A\/Real\/Timezone":$/
    );
    consoleErrorSpy.mockRestore();
  });

  it("handles an overnight window (start=22, end=6): includes a UTC instant that is 23:00 local", () => {
    // 2026-06-15T21:00:00Z is 23:00 CEST in Europe/Rome.
    expect(isWithinWakingHours("Europe/Rome", new Date("2026-06-15T21:00:00Z"), 22, 6)).toBe(true);
  });

  it("handles an overnight window (start=22, end=6): includes a UTC instant that is 3:00 local (past midnight)", () => {
    // 2026-06-15T01:00:00Z is 3:00 CEST in Europe/Rome.
    expect(isWithinWakingHours("Europe/Rome", new Date("2026-06-15T01:00:00Z"), 22, 6)).toBe(true);
  });

  it("handles an overnight window (start=22, end=6): excludes a UTC instant that is 12:00 local (midday)", () => {
    // 2026-06-15T10:00:00Z is 12:00 CEST in Europe/Rome.
    expect(isWithinWakingHours("Europe/Rome", new Date("2026-06-15T10:00:00Z"), 22, 6)).toBe(false);
  });
});

describe("selectDueTokens", () => {
  it("excludes a token whose last_sent_at is within interrupt_interval_minutes of now", () => {
    const now = new Date("2026-06-15T10:00:00Z"); // 12:00 local Europe/Rome
    const token = makeToken({
      interrupt_interval_minutes: 90,
      last_sent_at: new Date("2026-06-15T09:00:00Z").toISOString(), // 60 min ago
    });
    expect(selectDueTokens([token], now)).toEqual([]);
  });

  it("includes a token whose last_sent_at is null", () => {
    const now = new Date("2026-06-15T10:00:00Z");
    const token = makeToken({ last_sent_at: null });
    expect(selectDueTokens([token], now)).toEqual([token]);
  });

  it("includes a token whose last_sent_at is exactly interrupt_interval_minutes ago (inclusive boundary)", () => {
    const now = new Date("2026-06-15T10:00:00Z");
    const token = makeToken({
      interrupt_interval_minutes: 90,
      last_sent_at: new Date("2026-06-15T08:30:00Z").toISOString(), // exactly 90 min ago
    });
    expect(selectDueTokens([token], now)).toEqual([token]);
  });

  it("excludes a token when local time is before waking_hours_start_local", () => {
    const now = new Date("2026-06-15T04:00:00Z"); // 06:00 local Europe/Rome
    const token = makeToken({ waking_hours_start_local: 8, waking_hours_end_local: 20 });
    expect(selectDueTokens([token], now)).toEqual([]);
  });

  it("excludes a token when local time is at/after waking_hours_end_local", () => {
    const now = new Date("2026-06-15T18:00:00Z"); // 20:00 local Europe/Rome
    const token = makeToken({ waking_hours_start_local: 8, waking_hours_end_local: 20 });
    expect(selectDueTokens([token], now)).toEqual([]);
  });

  it("excludes a deactivated token even when otherwise due", () => {
    const now = new Date("2026-06-15T10:00:00Z");
    const token = makeToken({ last_sent_at: null, deactivated_at: "2026-06-01T00:00:00.000Z" });
    expect(selectDueTokens([token], now)).toEqual([]);
  });
});
