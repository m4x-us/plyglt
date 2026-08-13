// ============================================================
// interruptGate.ts — shared per-user interrupt gate client (Task #528)
// ============================================================
// Talks to the interrupt_gate_events table
// (supabase/migrations/20260813000000_interrupt_gate_events.sql) via
// lib/supabaseClient.ts's single gateway — this file never imports
// @supabase/supabase-js directly. See docs/INTERRUPT_ARCHITECTURE.md §5/§6
// for the full design rationale (why append-only, why a plain REST check
// instead of a persistent connection, why the read has a short timeout).
//
// This module only surfaces gate state and records events — it never
// decides fire-vs-suppress itself. The caller (desktop's OS-event/poll path,
// the snooze button, mobile dispatch) owns that decision, including what to
// do when the read times out (docs/INTERRUPT_ARCHITECTURE.md §6: "fall back
// to local last-known state and fire anyway," not suppress).
// ============================================================
// DEPENDS ON: lib/supabaseClient.ts (getSupabaseClient)
// USED BY: (not yet wired — Wave 3's #529 (desktop gate check) and #530
//          (snooze) call this directly; see their task briefs for the exact
//          call sites)
// ============================================================

import { getSupabaseClient } from "@/lib/supabaseClient";

export type InterruptGateEventType = "fired" | "snoozed";

// docs/INTERRUPT_ARCHITECTURE.md §6: "proposed starting point: 500ms–1s,
// tunable" — Max confirmed this exact range 2026-08-13, not a hard blocker
// on the precise value. 750ms is the midpoint; callers may override.
export const DEFAULT_GATE_READ_TIMEOUT_MS = 750;

export type GateReadResult =
  | { status: "known"; effectiveUntil: number | null } // null = no gate history yet for this user (never fired/snoozed)
  | { status: "unknown"; reason: "timeout" | "error" | "not_configured"; error?: string };

export type GateWriteResult = { ok: true } | { ok: false; error: string };

interface InterruptGateEventRow {
  effective_until: string;
}

/**
 * Reads the most recent effective_until for this user — the single value a
 * caller needs to decide "may I fire now?" (`now() >= effectiveUntil`, or
 * `status === "known" && effectiveUntil === null` for a user with no gate
 * history yet). Bounded by `timeoutMs`: never stalls the caller waiting on
 * network (docs/INTERRUPT_ARCHITECTURE.md §6). On timeout or any error, this
 * function does NOT guess — it returns an explicit `"unknown"` result and
 * leaves the fire-vs-suppress fallback decision to the caller.
 *
 * Implemented as `select ... order by effective_until desc limit 1` rather
 * than a `max()` aggregate so the query uses the
 * `(user_id, effective_until desc)` index built for exactly this read
 * (supabase/migrations/20260813000000_interrupt_gate_events.sql).
 */
export async function readInterruptGateState(
  userId: string,
  timeoutMs: number = DEFAULT_GATE_READ_TIMEOUT_MS
): Promise<GateReadResult> {
  const client = getSupabaseClient();
  if (!client) return { status: "unknown", reason: "not_configured" };

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      resolve("timeout");
    }, timeoutMs);
  });

  const queryPromise = client
    .from("interrupt_gate_events")
    .select("effective_until")
    .eq("user_id", userId)
    .order("effective_until", { ascending: false })
    .limit(1)
    .abortSignal(controller.signal) as unknown as Promise<{
    data: InterruptGateEventRow[] | null;
    error: { message: string } | null;
  }>;

  try {
    const outcome = await Promise.race([queryPromise, timeoutPromise]);
    if (outcome === "timeout") {
      return { status: "unknown", reason: "timeout" };
    }

    const { data, error } = outcome;
    if (error) {
      console.error(`[ERR-INTERRUPT-GATE-READ-${Date.now()}] readInterruptGateState failed:`, error);
      return { status: "unknown", reason: "error", error: error.message };
    }

    const row = data?.[0];
    return { status: "known", effectiveUntil: row ? new Date(row.effective_until).getTime() : null };
  } catch (err) {
    // A real aborted fetch rejects (AbortError) rather than resolving {error} —
    // treat that the same as any other unreachable-network outcome.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ERR-INTERRUPT-GATE-READ-${Date.now()}] readInterruptGateState threw:`, err);
    return { status: "unknown", reason: "error", error: message };
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

/**
 * Records a `fired` or `snoozed` gate event. `effective_until` has no
 * database default or trigger (supabase/migrations/20260813000000_interrupt_gate_events.sql)
 * — this function computes it: `occurredAt + minutesUntilEligible` minutes,
 * for both event types alike (docs/INTERRUPT_ARCHITECTURE.md §5: 'fired' ->
 * occurred_at + interval-at-time-of-firing; 'snoozed' -> occurred_at +
 * snooze_minutes — the same additive formula, just a different input). The
 * caller supplies whichever minute value applies to `eventType` — this
 * module has no opinion on interval/snooze-minute constants, which live in
 * store/settingsStore.ts, a layer above lib/ that this file must never
 * import from (CLAUDE.md's Layer Map).
 */
export async function recordInterruptGateEvent(params: {
  userId: string;
  deviceId: string;
  eventType: InterruptGateEventType;
  occurredAt: number; // unix ms — real event wall-clock time, not write time
  minutesUntilEligible: number; // interval minutes for 'fired', snooze minutes for 'snoozed'
}): Promise<GateWriteResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  const { userId, deviceId, eventType, occurredAt, minutesUntilEligible } = params;
  const effectiveUntil = occurredAt + minutesUntilEligible * 60_000;

  const { error } = await client.from("interrupt_gate_events").insert({
    user_id: userId,
    event_type: eventType,
    occurred_at: new Date(occurredAt).toISOString(),
    effective_until: new Date(effectiveUntil).toISOString(),
    device_id: deviceId,
  });

  if (error) {
    console.error(`[ERR-INTERRUPT-GATE-WRITE-${Date.now()}] recordInterruptGateEvent failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
