-- ===========================================
-- PUSH TOKENS — mobile device push-notification registrations (Task #170)
-- ===========================================
-- One row per (user, device). Unlike review_events, this table is mutable by
-- design: a token rotates (app reinstall, OS-level refresh) and a user can
-- turn off notifications (delete), so it gets the full select/insert/update/
-- delete RLS policy set instead of review_events' append-only pair.
--
-- platform is intentionally constrained to 'ios'/'android' only. Desktop
-- (Tauri) already has a working LOCAL client-side interrupt scheduler
-- (BRAND.md's Proactive Interruption Model) and has no APNs/FCM-shaped
-- credential to register — a 'desktop' row here would claim a push-delivery
-- capability the code does not have. See Task #170's implementation notes
-- in .autocode/tasks.md for the full reasoning.
-- ===========================================
-- DEPENDS ON: auth.users (Supabase Auth)
-- USED BY: lib/pushTokenClient.ts (client-side register/unregister — no
--          production caller yet, written for the not-yet-built iOS/Android
--          clients, Tasks #171/#172), and
--          supabase/functions/send-interrupt-notifications (server-side
--          read via the service-role key, which bypasses RLS entirely).
-- ===========================================

create table if not exists public.push_tokens (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  platform                    text not null check (platform in ('ios', 'android')),
  device_id                   text not null,
  token                       text not null,
  app_env                     text not null default 'production' check (app_env in ('production', 'sandbox')),
  timezone                    text not null,                                          -- IANA name, e.g. "Europe/Rome"
  interrupt_interval_minutes  smallint not null default 90 check (interrupt_interval_minutes > 0),
  waking_hours_start_local    smallint not null default 8  check (waking_hours_start_local between 0 and 23),
  waking_hours_end_local      smallint not null default 21 check (waking_hours_end_local between 0 and 23),
  last_sent_at                timestamptz,
  deactivated_at              timestamptz,                                             -- set by the dispatch function on a permanent delivery failure (e.g. APNs 410 Unregistered) — excluded from all future selection, never deleted (keeps the send history/audit trail intact)
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
create index if not exists push_tokens_dispatch_idx on public.push_tokens (deactivated_at) where deactivated_at is null;

-- Row Level Security: a user can only ever read, register, update, or remove
-- their own device tokens. The dispatch Edge Function never authenticates as
-- an individual user — it uses the Supabase SERVICE ROLE key, which bypasses
-- RLS entirely by design (the only path that reads every user's rows at once).
alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "push_tokens_update_own"
  on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  using (auth.uid() = user_id);
