# Sync Backend Architecture — plyglt (Task #168)

Status: **APPROVED by Max, 2026-08-03** — Supabase (Postgres) + FCM-for-push-only,
signed off as recommended with no changes. Task #169 (real implementation) is
unblocked on the decision side; see the batch note in `.autocode/tasks.md`
Batch 16 for when to actually start provisioning infrastructure.

This document exists because the platform choice constrains everything else in
Batches 16–17, and a wrong choice is expensive to reverse once real user data
is in it.

---

## 1. Platform choice: Supabase (Postgres) for data + auth, Firebase Cloud Messaging for push only

**Recommendation: Supabase**, with one deliberate exception — use **Firebase
Cloud Messaging (FCM)** purely as the push-notification transport, not as the
data store. This hybrid isn't hedging; it's picking the right tool for two
genuinely different jobs.

### Why not a custom server

Ruled out. plyglt's own history already favors buy-over-build for anything
that isn't the product's core differentiator — Lemon Squeezy handles
payments, the entitlement model is deliberately honor-system to avoid running
license-verification infrastructure (see CLAUDE.md §5). A custom auth+sync
server means owning uptime, security patching, and scaling for a team that
today is effectively one person plus AI assistance. Not the right trade for
this project's stage.

### Why Supabase over Firebase for the data layer

| | Supabase (Postgres) | Firebase (Firestore) |
|---|---|---|
| Data model fit | SRS card state (cardId, stability, difficulty, dueDate, lastReview, reviewCount, lapses) is naturally relational — a `review_events` table with per-card foreign keys and a simple `UPSERT ... ON CONFLICT` is the obvious schema | Document model works but is an awkward fit for what's fundamentally tabular, timestamped event data |
| Billing predictability | Flat monthly fee ($25/mo Pro tier) + predictable storage/bandwidth overage ($0.09/GB egress past 250GB) | Per-operation billing ($0.06/100K reads, $0.18/100K writes) with **no hard spending cap** — a bug in a sync loop or an unbounded query can turn a $12/mo bill into a four-figure one overnight (a documented, recurring complaint in 2026 pricing writeups) |
| Auth | Native Apple Sign In + Google Sign In support, standard OAuth flows | Also native, equally solid |
| Vendor lock-in | Postgres is an open standard — exportable, self-hostable if ever needed | Firestore's query model and data format are Google-proprietary |
| Migrations | Maps directly onto plyglt's existing discipline (`store/migrations.ts`'s versioned, chained migration pattern for every Zustand store) — SQL migrations are the same mental model, just server-side | Firestore has no native schema/migration concept; would need to be hand-rolled |

Given plyglt already treats "no silent data corruption, versioned migrations,
explicit schemas" as non-negotiable (AGENTS.md's Stop-the-Line rules apply
this to every local store today), Postgres's explicit schema and predictable
billing outweigh Firestore's marginally simpler mobile SDK ergonomics.

### Why FCM anyway, just for push

FCM has one advantage worth keeping regardless of data-layer choice: it's a
**single API for both iOS and Android push**. The FCM SDK silently exchanges
an app's real APNs device token for an FCM token behind the scenes — the
sync backend only ever stores and sends to one token type
(`push_token: string`), never touching raw APNs certs/keys directly. FCM
itself is free with no per-message charge on any tier. Using it purely as
"the thing that delivers a notification to a device," decoupled from where
review data lives, gets iOS+Android push for free without taking on
Firestore's billing model for the actual sync traffic. The desktop app
registers its FCM token the same way a mobile client would (Task #170).

---

## 2. What syncs

Three independent data domains, each with different sync semantics:

1. **SRS review state** (the interesting one — see §4 for the event-log design):
   `cardId`, `stability`, `difficulty`, `dueDate`, `lastReview`, `reviewCount`, `lapses`.
2. **Settings** (`store/settingsStore.ts`'s `InterruptConfig` shape — interval,
   DnD hours, OS-trigger toggles, idle threshold). Low-frequency, low-conflict-risk —
   last-write-wins by `updated_at` is fine here; these aren't append-only events,
   they're genuinely "current value" settings a user changes rarely on one device
   at a time.
3. **Entitlement** (`licenseKey`, `licenseType`, `purchasedAddOns`). Server is
   authoritative once sync exists — this is the one place where "client-only,
   honor-system" (CLAUDE.md §5) can start to erode *if* Max wants it to; out of
   scope for this doc to decide, flagging for a future explicit decision. Until
   then: sync mirrors whatever the client already computed locally (Lemon
   Squeezy remains the source of truth), it doesn't gate anything server-side.

## 3. Offline-first model

Non-negotiable given BRAND.md's whole premise ("no overdue cards," works
anywhere). Concretely:

- Every write happens locally first (unchanged from today — Zustand + platform
  storage). Sync is an *additional* background layer, never a blocking one.
- A local `synced_at` / `pending_sync: boolean` marker per review event queues
  writes made while offline.
- Sync triggers: on app open (if `pending_sync` events exist and network is
  available), plus a periodic background sync (interval TBD, likely matching
  or slower than the existing 30s-poll/OS-hook interrupt cadence — no need to
  sync more often than the user could plausibly review on two devices).
- A failed sync is silent-retry, never user-blocking — matches the existing
  "plyglt never makes you feel behind" brand principle applied to
  infrastructure, not just scheduling.

## 4. Conflict resolution: append-only event log, not mutable current-state rows

The task brief is explicit that last-write-wins is wrong for concurrent
reviews on multiple devices, and it is — a whole-row overwrite would let a
stale device's sync silently erase a newer review recorded elsewhere. But
per-field "latest timestamp wins per field" is *also* fragile: it invites the
exact bug class this codebase's Rule 23 exists to name (a fix that handles
one field correctly while a structurally identical sibling field is missed).

**Recommendation: sync an append-only `review_events` table, not a mutable
`card_state` table.**

```sql
review_events (
  id            uuid primary key,       -- client-generated, dedup key
  user_id       uuid references auth.users,
  card_id       text not null,
  reviewed_at   timestamptz not null,   -- real review wall-clock time, not sync time
  rating        smallint not null,      -- FSRS grade
  stability     float8 not null,        -- resulting FSRS state AFTER this review
  difficulty    float8 not null,
  due_date      date not null,
  device_id     text not null,          -- diagnostic only, not used for conflict logic
  synced_at     timestamptz default now()
);
```

Why this sidesteps the conflict problem entirely rather than solving it:

- **Two devices reviewing the same card before either syncs is not a
  conflict** — it's two real events that both happened. Both get recorded.
  There is nothing to "merge"; a UNION with dedup-by-`id` is the entire sync
  algorithm.
- **Current card state is a derived value, not stored authoritatively**: it's
  the row with the latest `reviewed_at` for that `card_id`. No per-field
  merge logic exists to get subtly wrong, because no field is ever updated in
  place — only appended.
- **`reviewCount`/`lapses` stop being fields that need incrementing under
  concurrency** — they're `count(*)` / `count(*) where rating = again` over
  the event log, always correct regardless of how many devices wrote
  concurrently.
- This is the standard event-sourcing answer to "multiple writers, need
  correct merge" — not a novel design, a well-trodden one, chosen because it
  is *structurally* conflict-free rather than requiring bespoke merge code
  that has to be independently proven correct (and re-proven correct every
  time a field is added, per Rule 23's own concern).

Local FSRS scheduling (`lib/srs.ts`) is unaffected — it keeps computing from
current state as it does today. The event log is purely the sync
representation; a device replays "latest event per card" into its local
Zustand `cards` map after every sync.

## 5. Auth providers: Apple Sign In + Google Sign In (minimum)

Both required, not optional:
- **Apple Sign In** — mandatory per App Store Review Guidelines for any app
  offering third-party social login (Google counts), so this isn't a
  "nice to have," it's a hard iOS App Store requirement once Batch 17 ships.
- **Google Sign In** — the natural second option; broad reach, low friction.
- Both are natively supported by Supabase Auth (OAuth providers, no custom
  implementation needed).
- Email/password as a fallback is deliberately **out of scope** for v1 —
  every additional auth method is additional attack surface and support
  burden; two OAuth providers cover the overwhelming majority of desktop +
  mobile users without it.

## 6. Push notification infrastructure

- **Transport:** FCM (see §1). Desktop (Tauri) and mobile (Batch 17) clients
  register an FCM token on Pro activation, same as any FCM-based mobile app.
- **Sender:** a Supabase Edge Function (Deno-based serverless function,
  co-located with the data layer) reads each user's interrupt schedule +
  push token, calls FCM's HTTP v1 API on a cron trigger. No separate service
  to operate.
- **Payload:** card count + session type (matches the existing desktop
  notification shape in `components/InterruptHandler.tsx` — `"${totalDue}
  cards ready — 2 min study break?"`), kept consistent across desktop
  notifications and mobile push so the brand voice (BRAND.md: no exclamation
  marks, no guilt-tripping "overdue" language) doesn't fork between
  platforms.
- **Tap handling:** notification tap opens directly into a study session
  (Task #171/#172's own requirement) — client-side routing, no server
  involvement beyond delivering the notification.

## 7. Estimated monthly cost

Assumptions: average user reviews ~30 cards/day (BRAND.md's "6-10 minutes/day"
target), syncing roughly once per app session (a handful of times daily, not
per-review). Costs below are the **data + auth layer only** — FCM push is
free at any of these scales.

| Users | Supabase tier | Estimated monthly cost | Notes |
|---|---|---|---|
| 1,000 | Free tier likely sufficient (500MB DB, 50K MAU auth) until review-event volume pushes past free storage | **$0** | ~1,000 users × ~30 events/day is well within free-tier row-count/storage limits for months |
| 10,000 | Pro tier | **~$25–35/mo** | 8GB DB storage / 250GB bandwidth on Pro covers this comfortably; event-log rows are small (a few dozen bytes each) |
| 100,000 | Pro tier + usage overage, or Team tier if compliance features become relevant | **~$100–300/mo** | Bandwidth/storage overage becomes the dominant cost driver, not compute; still an order of magnitude below Firestore's per-operation model at this volume given ~3M events/day |

These are directional estimates for decision-making, not a committed budget —
real numbers should be re-checked against Supabase's current pricing page
before Task #169 locks in a specific tier.

---

## Open question for Max

This doc makes a recommendation across all 7 required dimensions above. The
one place it deliberately does NOT decide anything is the entitlement-model
question flagged in §2 — whether sync should eventually make the server
authoritative for license state (a real shift from today's "client-only,
honor-system" design, CLAUDE.md §5). Not needed for Batch 16 to start; worth
an explicit decision before Batch 17 ships if it comes up.

**Sign-off status:** Approved by Max 2026-08-03 — Supabase (Postgres) +
FCM-for-push-only, as recommended, no changes requested. The entitlement
server-authority question above remains open and deferred, not decided by
this sign-off.
