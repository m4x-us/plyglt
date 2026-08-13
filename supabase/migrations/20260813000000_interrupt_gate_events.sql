-- ===========================================
-- INTERRUPT GATE EVENTS — append-only cross-device interrupt gate (Task #525)
-- ===========================================
-- One shared per-user gate that every device (desktop OS-event handlers,
-- desktop's scheduled poll, mobile's cron dispatch) checks before firing an
-- interrupt and writes to after firing. Reuses review_events' append-only
-- pattern rather than a mutable "current gate" row: two devices independently
-- deciding to fire close together are two real events, not a conflict to
-- merge, and per-field last-write-wins on a mutable row invites exactly the
-- kind of subtle race Rule 23 exists to name. Snooze folds into the same
-- table rather than being a separate mutable field — a snooze is just a
-- stronger, user-initiated push of the same "don't fire before X" value that
-- an automatic fire also produces. See docs/INTERRUPT_ARCHITECTURE.md §5 for
-- the full design rationale.
--
-- Read side is a single query, identical regardless of event type:
--   select max(effective_until) from interrupt_gate_events where user_id = ?
-- A device may fire iff now() >= that value (or the table has no rows yet).
-- effective_until is computed at write time, not read time, so a later
-- change to the user's interval setting only affects future events — it
-- never retroactively rewrites history.
-- ===========================================
-- DEPENDS ON: auth.users (Supabase Auth — Apple/Google Sign In)
-- USED BY: desktop's interrupt trigger path (before firing: reads the gate;
--          after firing or snoozing: writes an event) and mobile dispatch
--          (supabase/functions/send-interrupt-notifications, replacing its
--          current per-device push_tokens.last_sent_at check) — both landing
--          in later Wave streams (#527, #528) against this exact schema.
-- ===========================================

create table if not exists public.interrupt_gate_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  event_type        text not null check (event_type in ('fired', 'snoozed')),
  occurred_at       timestamptz not null,   -- wall-clock time of the real event
  effective_until   timestamptz not null,   -- next-eligible-time, computed at write time:
                                             --   'fired'   -> occurred_at + interval-at-time-of-firing
                                             --   'snoozed' -> occurred_at + snooze_minutes
  device_id         text not null,          -- diagnostic only, matches review_events' own field — never used for gate logic
  created_at        timestamptz not null default now()
);

-- The gate read is `select max(effective_until) from ... where user_id = ?`
-- on every fire decision, from every device — this is the hot path.
create index if not exists interrupt_gate_events_user_idx
  on public.interrupt_gate_events (user_id, effective_until desc);

-- Row Level Security: a user can only ever read or write their own gate
-- events. The client is never trusted to filter by user_id itself.
alter table public.interrupt_gate_events enable row level security;

create policy "interrupt_gate_events_select_own"
  on public.interrupt_gate_events for select
  using (auth.uid() = user_id);

create policy "interrupt_gate_events_insert_own"
  on public.interrupt_gate_events for insert
  with check (auth.uid() = user_id);

-- No update or delete policy is intentional — the table is append-only by
-- design (see header). A user can never modify or remove a past gate event,
-- from any client, matching review_events' own guarantee.
