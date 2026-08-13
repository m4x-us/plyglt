CLOSED: #525
NOT_CLOSED: none

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #525 — interrupt_gate_events migration

**File created:** `supabase/migrations/20260813000000_interrupt_gate_events.sql`

Followed `supabase/migrations/20260806000000_review_events.sql`'s append-only
pattern exactly (read directly before writing, per architect memory), not
`push_tokens.sql`'s mutable pattern, per docs/INTERRUPT_ARCHITECTURE.md §5's
explicit instruction to reuse the append-only shape.

### Exact schema (for streams #527/#528 to code against — do not re-derive, use this verbatim)

Table: `public.interrupt_gate_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | not null | `gen_random_uuid()` |
| `user_id` | `uuid` | not null | — (FK → `auth.users(id)`, `on delete cascade`) |
| `event_type` | `text` | not null | — (CHECK constrained to `'fired'` or `'snoozed'`) |
| `occurred_at` | `timestamptz` | not null | — |
| `effective_until` | `timestamptz` | not null | — |
| `device_id` | `text` | not null | — |
| `created_at` | `timestamptz` | not null | `now()` |

- Primary key: `id`.
- Index: `interrupt_gate_events_user_idx` on `(user_id, effective_until desc)` — matches the hot-path read pattern (`select max(effective_until) from interrupt_gate_events where user_id = ?`).
- RLS: enabled. Two policies only — `interrupt_gate_events_select_own` (SELECT, `using (auth.uid() = user_id)`) and `interrupt_gate_events_insert_own` (INSERT, `with check (auth.uid() = user_id)`). No update/delete policy — append-only by design, matching `review_events`.

### Verification performed

Supabase CLI is not installed in this environment and no `supabase/config.toml`
exists (no linked local project), so "applies cleanly against a
local/staging Supabase instance" was verified by hand against a real
Postgres server instead of skipped:

1. Confirmed a local Postgres instance was already running (`psql -lqt`).
2. Created a scratch database (`charles_migration_test`), added a minimal
   `auth.users` table and a stub `auth.uid()` function to reproduce
   Supabase's auth schema surface.
3. Ran the migration file directly with `psql -f` — succeeded (`CREATE
   TABLE`, `CREATE INDEX`, `ALTER TABLE`, 2× `CREATE POLICY`, zero errors).
4. Inspected the resulting table with `\d public.interrupt_gate_events` and
   `pg_policies` — column names, types, nullability, defaults, the CHECK
   constraint, the FK, and both RLS policies all match the spec above and
   `docs/INTERRUPT_ARCHITECTURE.md` §5's SQL block exactly.
5. Re-ran the same file a second time to check idempotency: `create table
   if not exists` and `create index if not exists` no-op correctly on
   rerun (NOTICE + skip); the two `create policy` statements error on
   rerun (`policy ... already exists`) — this is expected and matches
   `review_events.sql`/`push_tokens.sql`'s own convention exactly (neither
   uses a guarded/idempotent policy statement either); Supabase's migration
   runner tracks applied migrations and never re-applies one, so this isn't
   a real-world path.
6. Dropped the scratch database when done.

No existing migration files were touched. No other files were touched
outside `supabase/migrations/`.
