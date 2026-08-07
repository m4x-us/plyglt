// ============================================================
// syncClient.ts — upload/download orchestration against Supabase (Task #517)
// ============================================================
// Talks to the review_events table (supabase/migrations/20260806000000_review_events.sql)
// via lib/supabaseClient.ts's single gateway — this file never imports
// @supabase/supabase-js directly. Row<->ReviewEvent shape conversion lives here
// because it's the only place that needs to know the wire format; every other
// caller works in ReviewEvent's unix-ms-number shape.
// ============================================================
// DEPENDS ON: lib/supabaseClient.ts (getSupabaseClient), lib/reviewEvent.ts (ReviewEvent)
// USED BY: hooks/useSync.ts
// ============================================================

import { getSupabaseClient } from "@/lib/supabaseClient";
import type { ReviewEvent } from "@/lib/reviewEvent";

export type SyncClientResult = { ok: true } | { ok: false; error: string };
export type DownloadResult = { ok: true; events: ReviewEvent[] } | { ok: false; error: string };

interface ReviewEventRow {
  id: string;
  card_id: string;
  reviewed_at: string;
  rating: number;
  stability: number;
  difficulty: number;
  due_date: string;
  device_id: string;
}

function toRow(event: ReviewEvent, userId: string) {
  return {
    id: event.id,
    user_id: userId,
    card_id: event.cardId,
    reviewed_at: new Date(event.reviewedAt).toISOString(),
    rating: event.rating,
    stability: event.stability,
    difficulty: event.difficulty,
    due_date: new Date(event.dueDate).toISOString(),
    device_id: event.deviceId,
  };
}

function fromRow(row: ReviewEventRow): ReviewEvent {
  return {
    id: row.id,
    cardId: row.card_id,
    reviewedAt: new Date(row.reviewed_at).getTime(),
    rating: row.rating,
    stability: row.stability,
    difficulty: row.difficulty,
    dueDate: new Date(row.due_date).getTime(),
    deviceId: row.device_id,
  };
}

/**
 * Uploads local review events to the user's review_events rows. Idempotent: retrying
 * the same events (e.g. after a failed upload, or a crash between insert and clearing
 * the local queue) is always safe, because `id` is client-generated and stable —
 * `ignoreDuplicates: true` makes this a plain `INSERT ... ON CONFLICT (id) DO NOTHING`,
 * which never touches an UPDATE path. That matters because
 * supabase/migrations/20260806000000_review_events.sql deliberately has no UPDATE RLS
 * policy (the table is append-only) — a plain `.upsert()` without `ignoreDuplicates`
 * would attempt an ON CONFLICT DO UPDATE and get rejected by RLS on any retry.
 */
export async function uploadReviewEvents(
  userId: string,
  events: readonly ReviewEvent[]
): Promise<SyncClientResult> {
  if (events.length === 0) return { ok: true };

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  const rows = events.map((e) => toRow(e, userId));
  const { error } = await client.from("review_events").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error(`[ERR-SYNC-UPLOAD-${Date.now()}] uploadReviewEvents failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Downloads every review event belonging to the signed-in user. RLS already restricts
 *  rows to `auth.uid() = user_id`; the explicit `.eq()` states that intent in the query
 *  itself rather than relying solely on the server-side policy. */
export async function downloadReviewEvents(userId: string): Promise<DownloadResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Sync is not configured." };

  const { data, error } = await client.from("review_events").select("*").eq("user_id", userId);
  if (error) {
    console.error(`[ERR-SYNC-DOWNLOAD-${Date.now()}] downloadReviewEvents failed:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true, events: (data as ReviewEventRow[]).map(fromRow) };
}
