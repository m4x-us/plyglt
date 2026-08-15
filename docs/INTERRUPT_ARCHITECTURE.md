# Interrupt Trigger & Cross-Device Scheduling Architecture — plyglt

Status: **IMPLEMENTED — Batch 21 COMPLETE, 2026-08-13.** All 4 open questions
were answered (see "Open questions for Max" at the end), all 10 tasks
(#523–#532) shipped via `/advance` across 3 waves the same day, zero debt
logged. See `.autocode/tasks.md` Batch 21 for the per-task implementation
notes and `CLAUDE.md`'s Architecture §1 for the resulting module list
(`lib/interruptGate.ts`, `hooks/useSnoozeAndExit.ts`, etc.).

Sections 1–9 below describe Batch 21: **when** an interrupt is allowed to
fire (the schedule/gate). §10 (added 2026-08-15) describes Batch 22/23, a
separate but related question: once a fire is allowed, **what content** it's
guaranteed to hold — the "6–10 interrupts a day, never fewer, never a
1-card burst" content-supply floor.

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

Two mismatches surfaced while writing this up. **Both decided by Max,
2026-08-13:**

- **Interval default: 90 minutes, unified across both platforms.** Mobile's
  `push_tokens.interrupt_interval_minutes` already defaulted to 90 — over a
  13-hour waking window (8am–9pm default) that's ≈8.7 interrupts/day,
  landing right in BRAND.md's 6–10 target. Desktop's `interrupt.rs`
  `interval_secs` defaulted to 3 hours (180 min) — over the same window
  that's ≈4.3/day, undershooting the target. Decision: desktop's default
  changes to 90 minutes to match mobile exactly — one number, one cadence,
  on every platform (Task #531).
- **Waking hours vs. DND: merge into one shared, synced setting.** Mobile
  has an explicit waking-hours window as a first-class concept
  (`waking_hours_start_local`/`_end_local`). Desktop only has DND start/end
  (`store/settingsStore.ts`) — related but not identical framing (DND is
  "don't interrupt during this window," waking hours is "only ever
  interrupt during this window" — same practical effect for a single
  contiguous window). Decision: unify into one literally-shared, synced
  setting rather than leaving them as platform-local concepts that merely
  happen to behave similarly (Task #532).

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

## 10. Interrupt content-supply floor (Batch 22–23, remediated Wave 1 2026-08-15)

Status: **IMPLEMENTED.** Batch 22 (`.autocode/tasks.md`, Task #533) closed a
real gap live Windows testing surfaced: §2 above fixed `computeDue`
undercounting what content exists, but a day where NO content of any kind
existed yet (a caught-up user, or a brand-new signup with zero history) still
made the interrupt engine go completely silent — contradicting BRAND.md's
"6–10 interrupts every day, never fewer" as a hard floor, not an average.
Batch 23 then found that "non-empty" alone wasn't enough either: a caught-up
user's session could still land as a single card, a real, live-tested UX
complaint ("way too small"). This section documents the current, live
behavior after both batches plus Wave 1's audit remediation
(`/audit 23`, Tasks #538/#539/#541/#544/#545/#550/#551) — not the original
Batch 23 spec text, which has since been corrected in two places (noted
below).

### 10.1 The client-side content floor (`lib/queue.ts`)

Every proactive interrupt session targets **45–90 seconds** of retrieval,
which at 8–15s/card means a real, reasoned range of constants:

| Constant | Value | Why |
|---|---|---|
| `INTERRUPT_SESSION_FLOOR` | 6 | The largest floor that fits the 45–90s target at 8–15s/card. Target, never fewer, when the catalog and pause state allow. |
| `INTERRUPT_SESSION_MAX_NEW` | 3 | Hard per-session cap on never-seen items. Working memory holds ~4 chunks (Cowan 2001) — reviews aren't WM-bound, but brand-new items are. |
| `INTERRUPT_SESSION_CAP` | 8 | 8 cards at 8–15s/card is 64–120s — up to 30s past the 90s target. Deliberate tradeoff: a slightly longer worst-case session beats truncating a heavy backlog day's content mid-session (BRAND.md: cards are ready, never overdue — no wall of debt). |
| `INTERRUPT_FLEX_DAILY_MAX` | 9 (`INTERRUPT_SESSION_MAX_NEW * 3`) | **New in Wave 1 (Task #551).** A real cross-*session* daily ceiling on flex-introduced new cards — see 10.3. |

`app/study/page.tsx` caps the built queue at `INTERRUPT_SESSION_CAP`.

### 10.2 Fill order (`hooks/useStudySession.ts`'s mount effect, `isInterrupt` only)

When the day's normal supply (FSRS-due + introduction-cadence-due + the
one-per-day new card) falls short of the floor:

1. **Flex-introduce more new cards** — up to `INTERRUPT_SESSION_MAX_NEW` (3)
   per session. Deliberate fill-order choice: starvation is cold-start-shaped
   (a brand-new account or a return from vacation), exactly when extra
   introductions are pure ramp-up with no review load to compete against.
2. **Pull near-due FSRS reviews slightly early** (soonest-due first,
   `store/srsStore.ts`'s `getNearDueCards`).

**The floor is a target, not an unconditional guarantee (Task #561).** A
stranded introduction pause, or a genuinely exhausted catalog, can leave a
session below 6 — even, in one rare combination, completely empty (10.4).

### 10.3 The flex fill is gated, not unlimited (Task #538/#551 — corrects the original Batch 23 shipment)

Step 1 above disables the *numeric* daily new-card cap
(`store/srsStore.ts`'s `canIntroduceNewCard`'s `maxPerDay` default of 1) but
must not disable two other things:

- **The `strandedAcrossDays` pause.** BRAND.md: "Wrong across multiple days →
  new card introductions pause until this one stabilizes." The original
  Batch 23 shipment passed `Number.MAX_SAFE_INTEGER` as `maxPerDay`, which
  correctly left the pause check intact (`canIntroduceNewCard` checks the
  pause independently of the numeric cap) — this part was already right.
- **A real cross-session daily ceiling.** This part was the actual bug: an
  unbounded `maxPerDay` also disabled the numeric cap for the *rest of the
  day*, not just the current session. Because `canIntroduceNewCard`'s
  `introducedTodayCount` already counts every card introduced today across
  ALL sessions (the `introductions` map is persisted store state, not
  per-session), a persistently-starved catalog — the default state for any
  brand-new user — could flex 3 new cards into *every* interrupt that day
  with no ceiling, contradicting BRAND.md's "one new card introduced per day
  at steady state" framing for exactly the population this flex path targets
  first. **Fix:** pass `INTERRUPT_FLEX_DAILY_MAX` (9) instead of
  `Number.MAX_SAFE_INTEGER`. No `store/srsStore.ts` change was needed — the
  existing per-day counting logic already supports an arbitrary finite
  ceiling.

`hooks/useInterruptConfig.ts`'s `computeDue` mirrors this exact gate in its
own zero-supply flex-fallback branch (Task #539) — before this fix,
`computeDue` could count (and therefore fire an interrupt promising) an
untouched card that the session's own flex fill would then refuse to
introduce, a real fire-gate/session-content divergence of the same shape §2
already closed once for the normal-cap case.

### 10.4 The never-empty backstop now respects the pause (Task #538 — corrects the original Batch 23 shipment)

A final backstop in the mount effect exists so an interrupt is never
completely empty when the pipeline can actually supply something. The
original Batch 23 shipment called it unconditionally — bypassing the
stranded pause entirely, a direct contradiction of the invariant in 10.3.
**Fixed:** the backstop now only fires when the same flex-gate from 10.3
allows it. Net effect: when the stranded pause is active AND no near-due
card exists either, the session is now genuinely allowed to be empty — a
deliberate product decision that BRAND.md's named pause invariant takes
priority over the "never completely empty" guarantee in this one rare
combination, rather than the guarantee silently overriding a named rule.

### 10.5 Near-due over-fetch is a proven bound, not a heuristic (Task #541)

The near-due fill step originally requested
`INTERRUPT_SESSION_FLOOR + sessionIds.size` cards from `getNearDueCards` — a
heuristic that only over-fetches enough if cards already in the session
cluster at the front of the sorted near-due pool. If they're interleaved
instead, the slice could run out before the floor is reached even with
enough near-due cards available. **Fixed:** request
`Number.MAX_SAFE_INTEGER` instead. `store/srsStore.ts`'s `getNearDueCards`
already filters and sorts the entire catalog before slicing to `limit`, so
asking for everything adds no real cost — it's a mathematically sufficient
bound instead of an unproven one.

### 10.6 Server-side mirror (`supabase/functions/send-interrupt-notifications/dueEstimate.ts`)

The server's due estimate is a documented **lower bound** over synced
`review_events` only (§2 already established real due-ness needs client-side
introduction-engine state the server never sees) and is never a
send/no-send gate (Batch 23's original fix — `dispatch.ts` no longer
`skippedNoCards`, closing the mobile-side version of §1/10.2's "silent day"
bug). `buildNotificationPayload` announces a count derived from that
estimate:

- **Non-zero estimate:** clamped to `[INTERRUPT_SESSION_FLOOR,
  INTERRUPT_SESSION_CAP]` (Task #544 — corrects the original Batch 23
  shipment, which only floored the count with no ceiling; a real backlog day
  could announce more cards than the session the tap opens can ever
  deliver).
- **Genuinely zero estimate** (Task #545 — corrects the original Batch 23
  shipment, which always claimed the floor of 6 even here): the server
  cannot distinguish "the client will fill this via flex-introduction" (the
  common case for a brand-new Pro signup's first interrupt) from "catalog
  and daily flex ceiling both exhausted, truly nothing to show." Claiming a
  specific number in either case would be a promise the server can't back.
  The body instead reads **"Cards ready"** with no number, and
  `data.cardCount` reports the honest `0`.

Keep `INTERRUPT_SESSION_FLOOR`/`INTERRUPT_SESSION_CAP` here in sync with
`lib/queue.ts`'s copies — Deno Edge Functions can't import from `lib/`, so
this is a comment-documented convention, mechanically enforced by
`tests/interruptFloorSync.test.ts` (Task #535), not a shared import.

`DispatchSummary` (`types.ts`) replaces the removed `skippedNoCards` counter
with **`sentWithZeroEstimate`** (Task #550) — a subset of `sent`, not
additional to it, counting sends whose announced count came entirely from
the zero-case fabrication above rather than real synced review history, so
observability into "how often are we sending on faith" isn't lost along with
the old skip-gate.

### 10.7 Summary of files touched

| Area | File(s) | Current behavior |
|---|---|---|
| Client floor/cap/ceiling constants | `lib/queue.ts` | `INTERRUPT_SESSION_FLOOR`(6), `INTERRUPT_SESSION_MAX_NEW`(3), `INTERRUPT_SESSION_CAP`(8), `INTERRUPT_FLEX_DAILY_MAX`(9) — see 10.1 |
| Session fill + pause/ceiling gating + never-empty backstop | `hooks/useStudySession.ts` | Mount-effect fill order, flex gate, backstop — see 10.2–10.5 |
| Fire-gate mirror | `hooks/useInterruptConfig.ts` | `computeDue`'s flex-fallback, gated identically to the session fill — see 10.3 |
| Server estimate + payload | `supabase/functions/send-interrupt-notifications/dueEstimate.ts` | Lower-bound estimate, clamp-to-[FLOOR,CAP], honest zero case — see 10.6 |
| Dispatch observability | `supabase/functions/send-interrupt-notifications/types.ts`, `dispatch.ts` | `sentWithZeroEstimate` replaces `skippedNoCards` — see 10.6 |
| Client/server constant sync guard | `tests/interruptFloorSync.test.ts` | Mechanical equality assertion, not a shared import — see 10.6 |

---

## Open questions for Max — RESOLVED 2026-08-13

All 4 answered, none guessed:

1. **Interval default:** ✅ 90 minutes on both platforms (unify desktop to
   match mobile exactly) — Task #531.
2. **REST check timeout:** ✅ 500ms–1s, as originally proposed — Task #528.
3. **Timeout behavior:** ✅ Fire anyway, fall back to local state — Task
   #529.
4. **DND vs. waking hours:** ✅ Merge into one shared, synced setting —
   Task #532.

**Sign-off status:** Approved by Max 2026-08-13, all open questions
answered. Registered as `.autocode/tasks.md` Batch 21 (Tasks #523–#532,
same day) — see that batch's header for sequencing and `/advance`
parallelism notes.
