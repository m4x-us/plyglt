// ============================================================
// dueSelection.ts — which push tokens are worth attempting right now (Task #170)
// ============================================================
// A coarse, non-atomic pre-filter over an already-fetched snapshot of
// push_tokens rows. This is NOT the concurrency-safety boundary — two
// overlapping dispatch runs can both pass a token through this filter using
// slightly stale last_sent_at values. The actual safety-critical, atomic
// "did I really win the right to send to this token" check is
// supabaseAdmin.ts's claimToken, a conditional UPDATE evaluated by Postgres
// at the moment it runs, not by this in-memory filter. selectDueTokens exists
// only to avoid computing a due-card estimate and attempting a claim for
// tokens that are obviously not due (deactivated, outside waking hours, or
// sent too recently even by this stale snapshot).
// ============================================================
// DEPENDS ON: ./types.ts
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

import type { PushTokenRow } from "./types.ts";

/**
 * Whether `now` falls within [startHour, endHour) in the token's own IANA
 * timezone. Uses Intl.DateTimeFormat, which resolves DST transitions
 * correctly for any given UTC instant — there is no ambiguity here because
 * `now` is always a single, well-defined instant, not a wall-clock string
 * being parsed back into a timezone (which IS ambiguous during a DST
 * fall-back repeated hour).
 *
 * `timezone` is user-supplied (via lib/pushTokenClient.ts's registration
 * call) and is not validated anywhere before reaching this function —
 * `Intl.DateTimeFormat`'s constructor throws a RangeError on an
 * unrecognized IANA identifier. Audit finding (2026-08-08): an unguarded
 * throw here, inside selectDueTokens's Array.filter callback, would abort
 * the ENTIRE dispatch batch for every user on that invocation over a single
 * malformed row. Caught here and treated as "not currently due" (fail safe,
 * matching this module's own "coarse pre-filter" framing) rather than
 * fixed only at the write boundary — a write-time check could still miss a
 * row inserted before validation existed, or inserted by a future caller
 * that forgets to validate.
 *
 * Also handles an overnight waking-hours window (startHour > endHour, e.g.
 * 22–6) via wraparound logic — audit finding (2026-08-08): the DB's CHECK
 * constraints on push_tokens bound each of waking_hours_start_local/
 * waking_hours_end_local to [0,23] independently, with no constraint that
 * start < end, so a token configured for an overnight schedule would
 * otherwise never match any hour and be silently, permanently excluded.
 */
export function isWithinWakingHours(timezone: string, now: Date, startHour: number, endHour: number): boolean {
  let hourStr: string;
  try {
    hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now);
  } catch (e) {
    console.error(`[ERR-PUSH-INVALID-TIMEZONE-${Date.now()}] isWithinWakingHours: invalid timezone "${timezone}":`, e);
    return false;
  }
  // Some engines format local midnight as "24" under hour12:false — normalize
  // into the same [0,23] range used everywhere else in this module.
  const hour = parseInt(hourStr, 10) % 24;
  if (startHour <= endHour) return hour >= startHour && hour < endHour;
  // Overnight window: due hours wrap past midnight (e.g. 22 -> 6 means
  // "hour >= 22 OR hour < 6", not the impossible "hour >= 22 AND hour < 6").
  return hour >= startHour || hour < endHour;
}

export function selectDueTokens(tokens: readonly PushTokenRow[], now: Date): PushTokenRow[] {
  return tokens.filter((token) => {
    if (token.deactivated_at !== null) return false;
    if (!isWithinWakingHours(token.timezone, now, token.waking_hours_start_local, token.waking_hours_end_local)) {
      return false;
    }
    if (token.last_sent_at === null) return true;
    const elapsedMs = now.getTime() - new Date(token.last_sent_at).getTime();
    return elapsedMs >= token.interrupt_interval_minutes * 60_000;
  });
}
