# Interrupt Trigger & Cross-Device Scheduling Architecture — plyglt

Status: **DRAFT — captures the redesign discussed live with Max, 2026-08-13,
during Task #166's Windows VM testing.** Not yet implemented, not yet
assigned a task number. Pending Max's review before either happens — see
"Open questions for Max" at the end.

This document exists because live testing surfaced a real behavioral bug
(desktop fires on every unlock, no spacing) that turned into a broader
question this codebase had never actually settled: what should count as a
reason to interrupt the user, and how does that hold together once mobile
(Batch 17, not yet built) and cross-device sync (Batch 16, live) are both in
the picture. It's a direct sequel to `docs/SYNC_ARCHITECTURE.md` — reuses
that doc's platform choice and its append-only conflict-resolution pattern
rather than inventing new ones.

---

## 1. The core principle: due-ness governs content, never timing

**The schedule is a hard ceiling on interrupt frequency. Whether something is
due can only make a scheduled check come up empty — it can never create an
extra check.**

This directly targets BRAND.md's own "6–10 times a day" promise. If having a
due card can independently trigger a fire, actual frequency scales with
however often the trigger condition becomes true (which, for a real learner
with a real deck, is most of the day) rather than with the stated cadence.
"Due" answers *what to show once a scheduled slot arrives*, never *whether a
slot exists*.

### Where the current code violates this

`src-tauri/src/os_events.rs`'s Windows/macOS/Linux unlock, wake, and
idle-return handlers all bypass `interval_secs` entirely — see the module's
own comment: "OS events intentionally bypass interval_secs — a wake or
unlock should always interrupt regardless of the configured schedule." Only
`interrupt.rs`'s scheduled poll thread respects the interval. In practice
this means: lock your screen 15 times in a day, and if anything's due each
time, that's 15 interrupts, not 6–10.

### Where the current code already gets it right

Mobile's push dispatch (`supabase/functions/send-interrupt-notifications`,
built in Task #170, not yet wired to a real client) already follows this
principle correctly. `dueSelection.ts`'s `selectDueTokens` checks the
interval *first*, as a hard gate, completely independent of due-count — only
tokens that already pass "enough time has elapsed" get a due-count check at
all, and due-count is used purely to decide whether to send, never to
justify sending early.

---

## 2. Bug: "due" undercounts what should trigger an interrupt

Separate from §1, but related and real. The desktop fire-gate
(`hooks/useInterruptConfig.ts`'s `computeDue`) only counts
`store/srsStore.ts`'s `getStats(unitCards).due` — cards with `reps > 0 &&
isDue(now)`. This excludes:

- Cards in the intensive introduction cadence (`introductions` map,
  `getIntroductionDueCardIds`) — these live in a separate part of the store
  and don't necessarily have `reps > 0`.
- Brand-new, never-reviewed cards (`getNewCards`).

But `lib/queue.ts`'s `buildQueue` — the function that actually builds session
*content* — correctly folds in both via `getIntroductionDueCardIds` and
`getNewCards`. So on a day where a user has, say, a Day-3 introduction card
needing its next appearance and zero traditional FSRS reviews due,
`computeDue()` returns 0, the interrupt never fires, and the interrupt engine
silently never delivers the introduction-cadence promise ("appears every
interrupt on Day 1" etc., BRAND.md's own table) for that day. **Fix:**
`computeDue` needs to also count introduction-due and qualifying-new cards,
matching what `buildQueue` already considers biddable content.

---

## 3. The interval clock only advances on a real fire with real content

A scheduled check that comes up empty (nothing due) must not cost a full
interval — otherwise a legitimately quiet stretch pushes the *next possible*
interrupt further out than intended, working against the frequency target in
the opposite direction from §1's bug.

Mobile already gets this right by construction: `push_tokens.last_sent_at`
is only written by `claimToken`, called only when a notification is actually
sent (`buildNotificationPayload` returns `null` — no send, no claim — when
`cardCount === 0`). Desktop currently gets this wrong: `interrupt.rs`'s poll
loop sets `last_triggered_secs = now` the moment it decides to *check*, in
Rust, before the JS layer even evaluates due-count. An empty check today
silently spends the next 3 hours (the current default interval) for
nothing. **Fix:** desktop's "last fired" clock should only advance when a
session with real content is actually shown, mirroring mobile's
already-correct behavior.

---

## 4. OS events become check-in moments, not independent triggers

Given §1–§3, unlock/wake/idle-return stop being their own trigger authority.
They become opportunistic prompts to evaluate the *same* gate the scheduled
poll uses: "has the interval elapsed, and is there real content to show."
This is still a meaningful use of OS events — attention-return is a
scientifically good moment for retrieval practice (this is BRAND.md's own
argument for the feature existing at all) — it just can't be allowed to
*add* interrupts beyond what the schedule permits.

---

## 5. Cross-device coordination: one shared gate per user, not per device

Sync (Batch 16, live) means a Pro user can have plyglt open on a desktop and
registered for push on a phone simultaneously — sync-across-devices is a
named, marquee Pro feature (BRAND.md's pricing table). Today, nothing
coordinates between them: desktop's clock is local Rust memory, never
synced anywhere; mobile's `last_sent_at` is scoped per device-token row, so
even two phones don't know about each other. Two independent devices each
correctly respecting their own local interval can still interrupt the same
user twice within minutes of each other — directly undermining the exact
feature multi-device sync is supposed to deliver, and worse the more devices
someone uses (the thing they're paying more to have).

**The fix has to be a single shared per-user gate**, not a per-device one.
Every device — desktop's OS-event handlers, desktop's scheduled poll,
mobile's cron dispatch — checks and updates the *same* state before
deciding whether to fire.

### Schema (first-cut, reusing SYNC_ARCHITECTURE.md §4's append-only pattern)

Same reasoning as that doc's `review_events` table: two devices independently
deciding to fire close together are two real events, not a conflict to
merge, and per-field last-write-wins on a mutable "current gate" row invites
exactly the kind of subtle race Rule 23 exists to name. Snooze folds into
the same table rather than being a separate mutable field or a separate
sync concept — a snooze is just a stronger, user-initiated push of the same
"don't fire before X" value that an automatic fire also produces.

```sql
create table if not exists public.interrupt_gate_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  event_type        text not null check (event_type in ('fired', 'snoozed')),
  occurred_at       timestamptz not null,   -- wall-clock time of the real event
  effective_until   timestamptz not null,   -- next-eligible-time, computed at write time:
                                             --   'fired'   -> occurred_at + interval-at-time-of-firing
                                             --   'snoozed' -> occurred_at + snooze_minutes
  device_id         text not null,          -- diagnostic only, matches review_events' own field
  created_at        timestamptz not null default now()
);
```

Read side is a single query, identical regardless of event type:
`select max(effective_until) from interrupt_gate_events where user_id = ?`.
A device may fire iff `now() >= that value` (or the table has no rows yet).
Baking the interval into `effective_until` at write time (rather than
recomputing it at read time from a settings value) means a later change to
the user's interval setting only affects future events — it doesn't
retroactively rewrite history, which also isn't something we'd want.

### Who reads/writes this

- **Desktop**, before firing (OS event or scheduled poll): reads the gate;
  after firing with real content: writes a `fired` event. Snooze button
  writes a `snoozed` event instead of (as today) only touching local Rust
  state.
- **Mobile dispatch** (`supabase/functions/send-interrupt-notifications`):
  `dueSelection.ts`'s `selectDueTokens` currently checks `push_tokens.
  last_sent_at` per-device — needs to check `interrupt_gate_events` per-user
  instead. On a real send, writes a `fired` event to the same table (not
  `push_tokens.last_sent_at`, which becomes a device-registration detail
  only, not a scheduling input).
- Both read/write paths are ordinary authenticated PostgREST calls (desktop
  already has an authenticated Supabase session per Task #169) — no new
  Edge Function needed beyond what mobile dispatch already has.

---

## 6. Delivery mechanism: on-demand REST check, not a persistent connection

Considered and rejected: a persistent, reconnecting Supabase Realtime
subscription, so desktop always has a locally-cached, near-real-time copy of
the gate state and never blocks on network at decision time.

**Rejected on cost grounds, not correctness grounds.** Everything else in
this architecture (and all of `docs/SYNC_ARCHITECTURE.md`'s own $0–300/mo
estimate) is priced on Postgres storage/bandwidth — a request-based cost
axis. Realtime bills on concurrent open connections and message volume — a
cost that scales with *how many users have the app sitting open*, not with
actual usage. For a lean, high-margin desktop app that's often idling in
the background all day, that's the wrong cost shape, and it's an entirely
new, un-budgeted cost axis this doc's numbers never accounted for. (Current
Supabase Realtime pricing wasn't verified as part of this discussion — flag
for whoever implements this to check before committing either way, but the
*shape* of the cost curve is the deciding factor regardless of the exact
number.)

**Recommendation: a plain REST call, made only at actual firing-decision
moments** (a handful of times a day per user — matching the interrupt
cadence itself, not continuous). This keeps the cost on the same
per-request axis already budgeted for in `docs/SYNC_ARCHITECTURE.md` §7,
effectively free at any realistic scale.

### Offline / timeout behavior

Short timeout (proposed starting point: 500ms–1s, tunable), non-blocking —
never stall the unlock-to-interrupt UX waiting on network. On timeout or no
connection, **fall back to local last-known state and fire anyway** (rather
than suppressing). This means an offline or flaky-network device can
occasionally double-fire or ignore a snooze made on another device — a
rare, low-severity gap, not a data-loss or correctness issue, and consistent
with how this project already treats rare edge cases (`.autocode/debt.md`'s
own convention) rather than something worth paying for infrastructure to
eliminate. The alternative (suppress-on-timeout) trades an occasional
extra/missed interrupt for an occasional real interrupt getting silently
dropped by a network hiccup — worse, not better, given BRAND.md's own
"never make the user feel like the app went dark" framing.

---

## 7. Interval and waking-hours reconciliation

Two mismatches surfaced while writing this up, not yet decided:

- **Interval default:** mobile's `push_tokens.interrupt_interval_minutes`
  defaults to 90 — over a 13-hour waking window (8am–9pm default) that's
  ≈8.7 interrupts/day, landing right in BRAND.md's 6–10 target. Desktop's
  `interrupt.rs` `interval_secs` defaults to 3 hours (180 min) — over the
  same window that's ≈4.3/day, undershooting the target. These read like
  two independently-picked numbers. Recommend unifying desktop's default to
  match mobile's already-correctly-calibrated 90 minutes, but this changes
  existing users' default experience, so it's called out as a decision, not
  folded silently into "the fix."
- **Waking hours vs. DND:** mobile has an explicit waking-hours window as a
  first-class concept (`waking_hours_start_local`/`_end_local`). Desktop
  only has DND start/end (`store/settingsStore.ts`) — related but not
  identical framing (DND is "don't interrupt during this window," waking
  hours is "only ever interrupt during this window" — same practical effect
  for a single contiguous window, but worth deciding whether these should
  become one literally-shared, synced setting or stay platform-local
  concepts that happen to behave similarly).

---

## 8. Snooze becomes shared and cross-device

Today: `snooze_interrupt` (`interrupt.rs`) only ever touches local,
in-memory Rust state on the single device it's clicked on — snoozing on
desktop has zero effect on any other device, and mobile has no snooze
concept at all. Under §5's shared-gate model, snooze becomes a `snoozed`
event in `interrupt_gate_events`, visible to every device via the same
read path already used for firing decisions. This is a genuinely new
capability for mobile, not just "connect the existing thing."

---

## 9. Summary of concrete changes (once approved)

| Area | File(s) | Change |
|---|---|---|
| Due-count gate | `hooks/useInterruptConfig.ts` | `computeDue` must also count introduction-due and qualifying-new cards (§2) |
| Clock semantics | `src-tauri/src/interrupt.rs`, `os_events.rs` | Advance "last fired" only on a real fire with content, not on every check (§3) |
| OS-event gating | `src-tauri/src/os_events.rs` | Unlock/wake/idle stop bypassing the interval — same gate as the scheduled poll (§4) |
| Shared gate schema | New Supabase migration | `interrupt_gate_events` table (§5) |
| Desktop gate check | New — desktop sync layer (Task #169 area) | Read/write the shared gate around firing decisions and snooze (§5, §6) |
| Mobile dispatch | `supabase/functions/send-interrupt-notifications/dueSelection.ts`, `dispatch.ts` | Read/write `interrupt_gate_events` instead of per-token `last_sent_at` (§5) |
| Settings reconciliation | `store/settingsStore.ts`, `push_tokens` schema | Unify interval default; decide DND vs. waking-hours (§7) |

---

## Open questions for Max

Not decided by this doc — flagged explicitly rather than silently assumed:

1. **Interval default:** adopt mobile's 90 minutes as the new desktop
   default (changes existing users' experience), or pick a different
   unified number?
2. **REST check timeout:** is 500ms–1s the right starting point, or would
   you rather it be even shorter (accept more staleness) or allow a bit
   longer (fresher data, slightly more UX risk)?
3. **Timeout behavior:** confirmed preference is "fire anyway, fall back to
   local" over "suppress on timeout" (§6) — sanity-check this against your
   own read of which failure mode is worse for the brand.
4. **DND vs. waking hours:** merge into one shared, synced setting, or keep
   as related-but-separate platform-local concepts?

**Sign-off status:** Not yet reviewed. No task number assigned — following
this doc's own precedent (`docs/SYNC_ARCHITECTURE.md` was Task #168, its
implementation was the separate Task #169), the plan would be to register
this as a new task (or small batch) once you've reviewed it, not before.
