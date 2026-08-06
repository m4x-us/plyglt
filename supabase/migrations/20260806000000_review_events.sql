-- ===========================================
-- REVIEW EVENTS — append-only SRS review log (Task #169)
-- ===========================================
-- The sync layer's source of truth for SRS state. Never updated in place —
-- only ever inserted into. Current card state is a derived value: the row
-- with the latest reviewed_at for a given (user_id, card_id) pair.
--
-- Why append-only, not a mutable card_state table: two devices reviewing the
-- same card before either syncs is not a conflict to resolve, it's two real
-- events that both happened. A UNION with dedup-by-id is the entire sync
-- algorithm — no per-field merge logic exists to get subtly wrong. See
-- docs/SYNC_ARCHITECTURE.md §4 for the full design rationale.
-- ===========================================
-- DEPENDS ON: auth.users (Supabase Auth — Apple/Google Sign In)
-- USED BY: the sync layer (lib/sync/*) once real Supabase credentials exist.
--          Not yet wired to a live client — see Task #169 in .autocode/tasks.md
--          for what's blocked pending Max's Supabase/OAuth provisioning.
-- ===========================================

create table if not exists public.review_events (
  id            uuid primary key,                        -- client-generated (crypto.randomUUID()) — dedup key across devices
  user_id       uuid not null references auth.users(id) on delete cascade,
  card_id       text not null,
  reviewed_at   timestamptz not null,                     -- real review wall-clock time, not sync time
  rating        smallint not null check (rating between 1 and 4),  -- FSRS grade: 1=again 2=hard 3=good 4=easy
  stability     double precision not null,                -- resulting FSRS state AFTER this review
  difficulty    double precision not null,
  due_date      timestamptz not null,
  device_id     text not null,                            -- diagnostic only, never used for conflict logic
  synced_at     timestamptz not null default now()
);

-- One (user, card, reviewed_at) pair should never legitimately repeat from the
-- same device — this is a defensive de-dup guard for retried sync uploads,
-- not the primary dedup key (that's the client-generated `id` primary key,
-- which makes re-uploading the exact same event a no-op via ON CONFLICT).
create index if not exists review_events_user_card_idx
  on public.review_events (user_id, card_id, reviewed_at desc);

-- Row Level Security: a user can only ever read or write their own events.
-- This is the actual enforcement boundary — the client is never trusted to
-- filter by user_id itself.
alter table public.review_events enable row level security;

create policy "review_events_select_own"
  on public.review_events for select
  using (auth.uid() = user_id);

create policy "review_events_insert_own"
  on public.review_events for insert
  with check (auth.uid() = user_id);

-- No update or delete policy is intentional — the table is append-only by
-- design (see header). A user can never modify or remove a past review
-- event, from any client, matching the "no per-field merge logic to get
-- wrong" guarantee this schema exists to provide.
