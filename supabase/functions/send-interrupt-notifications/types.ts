// ============================================================
// types.ts — shared types for the push dispatch pipeline (Task #170)
// ============================================================
// Pure types only. No Deno.* APIs, no runtime imports — safe to import from
// both the Deno Edge Function (index.ts) and Vitest test files.
// ============================================================

export interface PushTokenRow {
  id: string;
  user_id: string;
  platform: "ios" | "android";
  device_id: string;
  token: string;
  app_env: "production" | "sandbox";
  timezone: string; // IANA name, e.g. "Europe/Rome"
  interrupt_interval_minutes: number;
  waking_hours_start_local: number;
  waking_hours_end_local: number;
  last_sent_at: string | null; // ISO timestamp or null (never sent)
  deactivated_at: string | null; // ISO timestamp or null (still active)
}

export interface ReviewEventRow {
  card_id: string;
  user_id: string;
  reviewed_at: string; // ISO timestamp
  due_date: string; // ISO timestamp
}

// Task #527 — the shared, cross-device fire gate (supabase/migrations/20260813000000_interrupt_gate_events.sql).
// Only the columns this pipeline actually reads/writes are modeled here — see the migration
// itself (or docs/INTERRUPT_ARCHITECTURE.md §5) for the full schema (id, created_at, etc.).
export interface InterruptGateEventRow {
  user_id: string;
  event_type: "fired" | "snoozed";
  effective_until: string; // ISO timestamp
}

export interface NotificationPayload {
  title: string;
  body: string;
  data: { cardCount: number; sessionType: "review" };
}

export interface DispatchSummary {
  sent: number;
  failed: number;
  skippedNoCards: number;
  skippedAlreadyClaimed: number;
  // Audit finding (2026-08-08): a send result of {ok:false, skipped:true}
  // (APNs/FCM credentials not configured for this deployment — a normal,
  // expected ops state, e.g. iOS shipped before Android credentials exist)
  // was previously folded into `failed`, making a config gap indistinguishable
  // from a genuine per-token delivery failure in this summary.
  skippedNotConfigured: number;
  deactivated: number;
  // Audit finding (2026-08-08): an unexpected exception during one token's
  // processing (a defensive backstop — every known throwing call in the
  // pipeline is now caught closer to its source) previously had no counter
  // of its own and no way to be distinguished from a normal outcome.
  erroredUnexpectedly: number;
  total: number;
}

/** Result contract shared by sendApnsNotification and sendFcmNotification. */
export interface PushSendResult {
  ok: boolean;
  error?: string;
  /** True when credentials are absent — the graceful-degradation path; no network call was made. */
  skipped?: boolean;
  /** True when the provider's response means this token will never be valid again (e.g. APNs 410 Unregistered, FCM UNREGISTERED) — signals the caller to deactivate the token rather than retry it. */
  permanentFailure?: boolean;
}
