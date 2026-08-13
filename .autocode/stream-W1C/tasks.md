# Stream W1C Task State

### Task #525 | infrastructure | severity 5
**What:** New Supabase migration creating the `interrupt_gate_events` table — one append-only row per real "fired" or "snoozed" event, per user, reusing the exact conflict-resolution pattern `supabase/migrations/20260806000000_review_events.sql` already established (append-only, not a mutable current-state row) rather than inventing a new one.
**File:** New file under `supabase/migrations/`
**Why:** The shared per-user gate every device (desktop OS events, desktop scheduled poll, mobile cron dispatch) will check before firing and write to after firing. See `docs/INTERRUPT_ARCHITECTURE.md` §5 for the full schema and reasoning (why append-only, not last-write-wins).
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 new SQL file, schema only, no application code
**Blocked by:** Nothing | **Blocks:** #527, #528
**Done when:** Migration matches the schema in `docs/INTERRUPT_ARCHITECTURE.md` §5 (`id`, `user_id`, `event_type` check-constrained to `'fired'`/`'snoozed'`, `occurred_at`, `effective_until`, `device_id`, `created_at`). RLS enabled, scoped to `auth.uid() = user_id` for select/insert (matches `push_tokens`' policy shape — a user only ever sees/writes their own rows; no update/delete policy needed, append-only). Migration applies cleanly against a local/staging Supabase instance.
**Owner:** Architecture Agent
