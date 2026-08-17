---
status: done
stream: W8A
wave: 8
---

# Adam — Stream W8A — Wave 8 — 2026-08-16

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W8A | #627 #628 #632 #637

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

Your 4 tasks are the highest-priority work this wave — a real, compounding gap in round 4's severity-9 data-loss fix. Read lib/storage.ts and tests/storage.test.ts in full first, then app/study/page.tsx, before writing anything.

**#627 first (severity 8, the real bug).** lib/storage.ts's late-hydration reconciliation (added last wave to fix a whole-field-replace data-loss bug) computes `subDiff[subKey] = preVal[subKey]` whenever `preVal[subKey]` differs from `snapshotAtExpiry[subKey]` — it NEVER compares against `postMerge[key]` (the real, correctly-hydrated persisted value) before deciding to prefer the live value. This means: if a live write during the failsafe window touches a sub-key that ALSO exists in the real persisted data with DIFFERENT content — e.g. a card that already has real FSRS/introduction history on disk, not a brand-new one — the reconciliation unconditionally overwrites the real history with the live (pre-hydration, likely-wrong) value. Fix: change the comparison so a genuine collision (the sub-key exists in `postVal` too, with a value different from `preVal`) prefers `postVal[subKey]` (the real persisted data) over `preVal[subKey]` — only an ADDITION (sub-key absent from `postVal`, or present but genuinely originating from the live write with no real persisted counterpart to protect) should still take the live value. Think through this carefully: the goal is 'never let a live write during the race window silently destroy real persisted data for an entry that already existed,' while still 'don't lose a live write that has no real persisted counterpart to conflict with.' Write a concrete regression test proving the collision case specifically (a card with real, larger persisted history on disk, colliding with a smaller/wrong live write during the failsafe window) — this exact scenario has zero test coverage today. Live Deletion Test: revert your fix, confirm the new collision test fails with the real data silently overwritten, restore.

**#628 next (severity 7).** app/study/page.tsx:60 still gates the whole interactive page — including `handleRate` → `commitSession` (writes cards/activeSession/streak) and the `onRate` callback → `recordIntroductionResult` (writes introductions) — on the LENIENT `useIsHydrated`, not the STRICT `useIsHydratedStrict` that hooks/useStudySession.ts's mount-fill effect already uses (hooks/useStudySession.ts is read-only reference for you this wave, owned by Barry's stream — do not edit it). This is the concrete reachability path that puts a real card rating inside the exact failsafe window #627's collision bug requires. Switch page.tsx's hydration gate to `useIsHydratedStrict` — but think through the UX trade-off first: this gate ALSO controls when the 'Loading…' screen unblocks. If real hydration never finishes (a genuine storage failure), the strict signal never resolves true, meaning the loading screen would show forever instead of eventually giving up after the failsafe. Decide whether that's acceptable (arguably yes — an app that can't load its own SRS data shouldn't let the user interact with it at all) or whether page.tsx needs a SEPARATE, generous timeout of its own for the loading-screen-only concern (distinct from write-gating). Document your reasoning either way. Write a regression test proving a user cannot reach the interactive study UI (and thus cannot trigger a write) before real hydration completes, even after HYDRATION_FAILSAFE_MS elapses.

**#632 next (severity 4).** `useIsHydratedStrict` — the load-bearing fix for the original severity-9 bug — has zero test coverage proving its ONE differentiating behavior (never resolving true via the failsafe, unlike the lenient `useIsHydrated`). Add a test using fake timers: advance past `HYDRATION_FAILSAFE_MS` without `persist.hasHydrated()` ever becoming true, and assert `useIsHydratedStrict` still returns `false` (while, for contrast, confirm `useIsHydrated` in the same scenario DOES return `true`). Deletion Test: temporarily make `useIsHydratedStrict` alias `useIsHydrated` internally, confirm the new test fails, restore.

**#637 last (severity 4).** Two of tests/storage.test.ts's three existing map-aware-reconciliation regression tests ('still restores a live write on a scalar field exactly as before' and 'does not touch a map-shaped field the user never wrote to') never actually exercise the map-shaped field during the failsafe window — both would still pass with the entire map-aware branch deleted. Strengthen both so they genuinely exercise what their names claim — note your #627 fix likely already added a real collision test as part of that task; make sure these two don't end up duplicating it, and that all tests in this file (existing + your #627/#632 additions) still pass together.

## Your Tasks (run in this exact order)
1. /task #627  — Fix data-loss: The map-aware sub-key reconciliation added to fix the round-4 severity-9 data-loss bug (Task #606) computes subDiff[subK
2. /task #628  — Fix async: hooks/useStudySession.ts's mount-fill effect gates its introduceCard() write on the strict useIsHydratedStrict signal. a
3. /task #632  — Fix tests: useIsHydratedStrict is the load-bearing fix for round 4's severity-9 data-loss bug, but no test file references it - eve
4. /task #637  — Fix tests: Two of the three new map-aware-reconciliation regression tests - 'still restores a live write on a scalar field exactly

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W8A
[→] #627 — Fix data-loss: The map-aware sub-key reconciliation added to fix the round-4 severity-9 data-loss bug (Task #606) computes subDiff[subK   ← starting now
[ ] #628 — Fix async: hooks/useStudySession.ts's mount-fill effect gates its introduceCard() write on the strict useIsHydratedStrict signal. a
[ ] #632 — Fix tests: useIsHydratedStrict is the load-bearing fix for round 4's severity-9 data-loss bug, but no test file references it - eve
[ ] #637 — Fix tests: Two of the three new map-aware-reconciliation regression tests - 'still restores a live write on a scalar field exactly

## Files You Own (edit ONLY these)
lib/storage.ts
tests/storage.test.ts
app/study/page.tsx
app/study/page.test.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel, or read-only reference)
.autocode/debt.md
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
hooks/useStudySession.test.ts
hooks/useStudySession.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/dueEstimate.ts
tests/pushDispatch.test.ts
tests/pushDueEstimate.test.ts
hooks/useStudySession.ts (read-only reference — Barry's stream owns it)

## Task Definitions

### Task #627

### Task #627: Fix data-loss: The map-aware sub-key reconciliation added to fix the round-4 severity-9 data-loss bug (Task #606) computes subDiff[subK

**File:** lib/storage.ts
**Complexity:** 🔧 Full — a real redesign of the subDiff/collision-detection logic in a primitive shared by 3 persisted stores, not a single-scope tweak
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The map-aware sub-key reconciliation added to fix the round-4 severity-9 data-loss bug (Task #606) computes subDiff[subKey] = preVal[subKey] whenever preVal[subKey] differs from snapshotAtExpiry[subKey], then spreads it over postVal unconditionally: clobbered[key] = { ...postVal, ...subDiff }. It never compares against postMerge[key] (the real, fully-hydrated persisted value) before taking the live value. When a live write during the HYDRATION_FAILSAFE_MS window touches a sub-key that ALSO exists in the real persisted data with different content - e.g. rating a card that already has real FSRS history on disk, not just introducing a brand-new one - the reconciliation unconditionally prefers the live pre-hydration value and silently discards the real persisted history for that entry. Rule 23a violation: the fix generalized to the ADDITION member of the defect class but not the COLLISION member it exists to protect against. Existing regression tests never exercise a genuine collision scenario. at lib/storage.ts:createPlatformStorage (late-hydration reconciliation, onFinishHydration handler):248.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/storage.ts:createPlatformStorage (late-hydration reconciliation, onFinishHydration handler):248
- [ ] Audit passes: bash scripts/deep-audit.sh lib/storage.ts

**Source:** Audit finding F001 — severity 8 — data-loss

---

### Task #628

### Task #628: Fix async: hooks/useStudySession.ts's mount-fill effect gates its introduceCard() write on the strict useIsHydratedStrict signal. a

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
hooks/useStudySession.ts's mount-fill effect gates its introduceCard() write on the strict useIsHydratedStrict signal. app/study/page.tsx:60 still gates the entire interactive page on the lenient useIsHydrated, which resolves true via the HYDRATION_FAILSAFE_MS timeout even when real hydration has not finished. Once that gate passes, handleRate drives commitSession (writes cards/activeSession/streak) and calls recordIntroductionResult directly (writes introductions) with no additional strict-hydration check. lib/storage.ts's own doc comment states the governing principle: a consumer that writes new persisted state should gate on useIsHydratedStrict, not the lenient useIsHydrated - page.tsx violates its own batch's stated principle on the two main interactive write paths, and is the concrete reachability path that puts a rating write inside the exact failsafe window F001's collision bug requires. at app/study/page.tsx:StudyPage (component body, hydration gate):60.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at app/study/page.tsx:StudyPage (component body, hydration gate):60
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F002 — severity 7 — async

---

### Task #632

### Task #632: Fix tests: useIsHydratedStrict is the load-bearing fix for round 4's severity-9 data-loss bug, but no test file references it - eve

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
useIsHydratedStrict is the load-bearing fix for round 4's severity-9 data-loss bug, but no test file references it - every test that exercises the mount-fill effect's hydration gate manipulates persist.hasHydrated() directly, never HYDRATION_FAILSAFE_MS, so none of them can distinguish useIsHydratedStrict from a broken reimplementation as `return useIsHydrated(store)`. Per Rule 18, a fix this severe requires a test whose corruption of the strict behavior would fail; none exists. at lib/storage.ts:useIsHydratedStrict:175.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at lib/storage.ts:useIsHydratedStrict:175
- [ ] Audit passes: bash scripts/deep-audit.sh lib/storage.ts

**Source:** Audit finding F006 — severity 4 — tests

---

### Task #637

### Task #637: Fix tests: Two of the three new map-aware-reconciliation regression tests - 'still restores a live write on a scalar field exactly

**File:** tests/storage.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two of the three new map-aware-reconciliation regression tests - 'still restores a live write on a scalar field exactly as before' and 'does not touch a map-shaped field the user never wrote to during the window' - never actually exercise the map-shaped field during the failsafe window, and both would still pass with the entire new isPlainObject/map-aware branch deleted. Only the third test is genuinely load-bearing. Notably, none of the three tests exercises the sub-key collision scenario F001 identifies, so this suite would not have caught F001 either. at tests/storage.test.ts:map-aware reconciliation regression tests:474.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/storage.test.ts:map-aware reconciliation regression tests:474
- [ ] Audit passes: bash scripts/deep-audit.sh tests/storage.test.ts

**Source:** Audit finding F011 — severity 4 — tests

---

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (other streams are editing other files concurrently; a failure
  in a file you did not touch is not yours to fix, but confirm via `git status` before assuming)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) — the real
  Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production
  fix and confirm your new test fails, then restore it and confirm it passes. State explicitly
  in your completion.md which tasks got a live Deletion Test vs. traced-by-hand verification.

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or
shows changes you don't recognize, report it in your completion.md rather than resolving it
yourself with a repo-wide command.

This wave includes several tasks that ask for a genuine design decision (not a mechanical
fix). Explain your reasoning clearly in completion.md — do not silently pick an option
without stating why.

## When You Finish
Write your completion summary to .autocode/stream-W8A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W8A | #627 #628 #632 #637
