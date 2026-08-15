---
status: done
agent: charles
stream: W1C
wave: 1
---

# Charles — Stream W1C — Wave 1 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W1C | #534 #537 #542 #543 #552 #553 #555 #556 #557 #559

You are Charles, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #534  — Fix requirements: desktop passive notification never applies the session-floor treatment its mobile sibling now gets
2. /task #552  — Fix edge-case: initialQueue useMemo missing allCards dependency (pre-existing, flagged for cold-start interaction)
3. /task #542  — Fix performance: full-catalog scan on every interrupt mount has no documented budget
4. /task #553  — Fix tests: useLangPack mock cannot catch a pack-loading-race regression
5. /task #557  — Fix tests: no test exercises the real INTERRUPT_SESSION_CAP=8 slicing behavior
6. /task #543  — Fix tests: four compounding seam-test gaps around the interrupt fill pipeline
7. /task #537  — Fix tests: stale test title now describes a false general rule
8. /task #555  — Fix tests: weak greater-than-or-equal assertion where an exact value is provable
9. /task #556  — Fix tests: 4-card-to-6 top-up test only asserts queue length, not exact contents
10. /task #559 — Fix tests: "never duplicates a near-due card" test doesn't prove the loop-level dedup check is load-bearing

Order rationale: #534 first since it's the highest-priority (P2) task and touches
components/InterruptHandler.tsx/.test.tsx exclusively; #552/#542/#553/#557 next since they're all
app/study/page.tsx + app/study/page.test.tsx; then #543 (the multi-file seam-gap task, do it once
you've already got context on all three test files from the tasks above); then the remaining
hooks/useStudySession.test.ts quality fixes (#537/#555/#556/#559) last as a batch.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W1C
[✓] #534 — Fix requirements: desktop passive notification never applies the session-floor treatment   ← done
[→] #552 — Fix edge-case: initialQueue useMemo missing allCards dependency   ← starting now
[ ] #542 — Fix performance: full-catalog scan on every interrupt mount has no documented budget
[ ] #553 — Fix tests: useLangPack mock cannot catch a pack-loading-race regression
[ ] #557 — Fix tests: no test exercises the real INTERRUPT_SESSION_CAP=8 slicing behavior
[ ] #543 — Fix tests: four compounding seam-test gaps around the interrupt fill pipeline
[ ] #537 — Fix tests: stale test title now describes a false general rule
[ ] #555 — Fix tests: weak greater-than-or-equal assertion where an exact value is provable
[ ] #556 — Fix tests: 4-card-to-6 top-up test only asserts queue length, not exact contents
[ ] #559 — Fix tests: "never duplicates a near-due card" test doesn't prove the loop-level dedup check is load-bearing

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
hooks/useStudySession.test.ts
app/study/page.tsx
app/study/page.test.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
supabase/functions/send-interrupt-notifications/dueEstimate.ts
supabase/functions/send-interrupt-notifications/dispatch.ts
supabase/functions/send-interrupt-notifications/types.ts
hooks/useStudySession.ts
hooks/useInterruptConfig.ts
hooks/useInterruptConfig.test.ts
lib/queue.ts
hooks/useSync.ts

IMPORTANT: hooks/useStudySession.ts (the production file) is Barry's, not yours — you own its TEST
file only. Barry's stream is fixing real bugs in hooks/useStudySession.ts's mount effect this same
wave (#538 stranded-pause bypass, #541 near-due over-fetch, #551 daily cap, #561 floor doc comment).
Barry's completion.md will list specific new/updated test cases hooks/useStudySession.test.ts needs
for those fixes — if Barry finishes before you reach your test tasks, read Barry's completion.md
(`.autocode/stream-W1B/completion.md`) and add those test cases as part of your own work here (this
is expected — do not skip it just because it wasn't in your original task list). If Barry hasn't
finished yet when you get there, add what you can from this brief and leave a note in your own
completion.md for the next wave to pick up Barry's outstanding test requests.

## Task Definitions

### Task #534: Fix requirements: desktop passive notification never applies the session-floor treatment its mobile sibling now gets

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Desktop passive notification body uses raw `computeDue()` (`totalDue`) verbatim, never floored to `INTERRUPT_SESSION_FLOOR` (6), unlike the server push this batch just fixed (`dueEstimate.ts:89`, being fixed in parallel by Adam's stream). `hooks/useInterruptConfig.ts`'s `computeDue` (owned by Barry's stream, not yours) was not updated to mirror Batch 23's new floor-fill magnitude, so desktop undercounts true session size in the ordinary non-empty case. `components/InterruptHandler.test.tsx:550,564,694` assert the stale "1 card ready — 2 min study break?" text and actively pin the regression — this is the audit's highest-convergence finding (4 of 8 independent auditors flagged it).

Fix at line 179 in `components/InterruptHandler.tsx`: floor `totalDue` the same way `dueEstimate.ts` does — `Math.max(totalDue, INTERRUPT_SESSION_FLOOR)` — importing `INTERRUPT_SESSION_FLOOR` from `lib/queue.ts` (you may import from `lib/queue.ts` even though you don't own it for edits — read-only imports across owned/off-limits boundaries are fine, only writes are restricted). Then update the 3 stale assertions in `components/InterruptHandler.test.tsx` (lines 550, 564, 694) to expect the floored text ("6 cards ready — 2 min study break?" or whatever the real floored value is for each specific test's mocked `computeDue` return). Do NOT weaken the assertions to make them pass — fix the production code first, then update the test to assert the CORRECT new behavior.

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:notification body / computeDue:179
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F001 — severity 6 — requirements

---

### Task #552: Fix edge-case: initialQueue useMemo missing allCards dependency (pre-existing, flagged for cold-start interaction with this batch's guarantee)

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
`initialQueue`'s useMemo references `allCards` in its body but omits it from the dependency array (`react-hooks/exhaustive-deps` disabled). Verified via `git show f5f1305 -- app/study/page.tsx` that this dependency array and eslint-disable predate Batch 23 (only the `INTERRUPT_CARD_LIMIT` → `INTERRUPT_SESSION_CAP` constant swap touched this block) — pre-existing and technically out of Batch 23's original scope, but flagged because a cold-start pack-loading race on this exact line could freeze `initialQueue` at `[]` before `ALL_UNITS` populates, permanently defeating the never-empty guarantee this whole batch exists to deliver — most plausibly via the push-tap cold-start path (`hooks/usePushInterruptTap.ts`/`hooks/useInterruptDeepLink.ts`).

Fix: add `allCards` to the dependency array and remove the `eslint-disable-next-line`. Before doing so, verify this doesn't cause an infinite re-render loop or excessive recomputation — `allCards` itself is a `useMemo` at line 45-48 with its own deps (`isGlobal, isInterrupt, unitId, ALL_UNITS, UNIT_MAP`), so it should be referentially stable across renders where those don't change; confirm this holds. Add a regression test proving `initialQueue` recomputes once `ALL_UNITS` transitions from empty (pack still loading) to populated.

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/study/page.tsx:initialQueue useMemo:60
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F019 — severity 3 — edge-case

---

### Task #542: Fix performance: full-catalog scan on every interrupt mount has no documented budget

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The `getNearDueCards` binding passed into `useStudySession` (line 73) scans the full ~30,609-card catalog (`allCards`) via a synchronous filter+sort on every interrupt mount, up to 4 times across the fill pipeline (per the audit's security-agent count). Unbounded-growth perf debt with no documented budget, not yet a measured real problem.

This is a low-urgency task — a full rewrite (e.g. a sorted index maintained incrementally) is overkill for the current ~30K-card scale. The minimal honest fix: add a code comment at the binding documenting the current cost (full catalog scan, O(n log n), up to 4x per mount) and a note on when to revisit (e.g. "revisit if curriculum exceeds ~100K cards or if this measurably shows up in profiling — see Task #542"). If you have time/interest, a cheap real improvement: memoize the `allCards` array reference stability (it already is, via useMemo) is not enough — the actual win would be pre-sorting `allCards` by dueDate once instead of re-filtering+re-sorting on every call, but only do this if it's a clean, well-tested change; otherwise the documentation fix alone satisfies this task.

**Acceptance Criteria:**
- [ ] Fix performance issue at app/study/page.tsx:getNearDueCards binding:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F009 — severity 3 — performance

---

### Task #553: Fix tests: useLangPack mock cannot catch a pack-loading-race regression

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
`useLangPack` mock hardcodes `loading:false` in every test case; structurally cannot catch Task #552's issue even if that pre-existing issue is real, a genuine test-coverage gap regardless of Task #552's in-scope status. Add a test that transitions `useLangPack`'s mock `loading` from `true` to `false` mid-test (simulating the pack finishing its load after first render) and asserts `initialQueue`/the rendered queue correctly reflects the now-populated `ALL_UNITS` rather than staying frozen empty. This test should directly prove or disprove #552's fix.

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:useLangPack mock:78
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F020 — severity 2 — tests

---

### Task #557: Fix tests: no test exercises the real INTERRUPT_SESSION_CAP=8 slicing behavior

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No test exercises the actual `INTERRUPT_SESSION_CAP=8` slicing behavior in `app/study/page.tsx`'s `initialQueue` memo; only a mock constant was added to the test file, with nothing asserting the real 8-card cap fires against a real oversized queue. Add a test: mock `buildQueue` to return >8 cards for an interrupt-mode session, assert `initialQueue`/the rendered queue is capped at exactly 8. Also fix the mock itself — it currently hardcodes `INTERRUPT_SESSION_CAP: 8` as a literal inside the `@/lib/queue` mock rather than importing the real constant from `lib/queue.ts` (via `vi.importActual` or similar), so a future change to the real constant wouldn't be caught by this test file at all.

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:INTERRUPT_SESSION_CAP mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F024 — severity 3 — tests

---

### Task #543: Fix tests: four compounding seam-test gaps around the interrupt fill pipeline

**File:** components/InterruptHandler.test.tsx, app/study/page.test.tsx, hooks/useStudySession.test.ts
**Complexity:** 🔧 Full — 3 files (seam gaps span InterruptHandler.test.tsx's srsStore mock, page.test.tsx's useStudySession mock, and useStudySession.test.ts's getNearDueCards mock)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Four compounding seam-test gaps: `app/study/page.test.tsx` mocks `useStudySession` entirely, `useStudySession.test.ts` mocks `getNearDueCards` entirely, the `page.tsx:73` binding itself is asserted by zero tests, and `InterruptHandler.test.tsx`'s `srsStore` mock does not implement `getNearDueCards` at all — currently silently safe only because the `getStats` stub always returns non-zero due, an incidental (not designed) protection that could break on an unrelated future change. Rule 13.

This is the biggest task in your stream. Minimum viable fix, in priority order:
1. Add `getNearDueCards` to `InterruptHandler.test.tsx`'s `srsStore` mock (even a simple `() => []` stub closes the silent-break risk — the real behavioral coverage of `getNearDueCards` itself lives in `tests/srsStore.test.ts`, owned by no one this wave since it's not in scope).
2. Add ONE real seam test (new file or appended to an existing seam test file — check if `tests/seam_studyLoop.test.ts` exists and is the right home) that wires the REAL `useStudySession` hook (not mocked) against a REAL (not mocked) `store/srsStore.ts`, through a minimal harness, proving the interrupt floor-fill actually reaches 6 cards end-to-end with no intermediate layer faked. This does not need to go through the full `app/study/page.tsx` component — a `renderHook`-based test calling the real `useStudySession` with the real store's actions (not mocked functions) is sufficient to satisfy Rule 13.
Do not try to fix all four gaps to the same depth — the seam test in step 2 is the one that matters most; steps for InterruptHandler.test.tsx's mock gap should be quick.

**Acceptance Criteria:**
- [ ] Fix tests issue at components/InterruptHandler.test.tsx:srsStore mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.test.tsx

**Source:** Audit finding F010 — severity 4 — tests

---

### Task #537: Fix tests: stale test title now describes a false general rule

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Test titled "does not flex when isInterrupt is true but queue is non-empty" (around line 249) now describes a false general rule since Batch 23 deliberately does fill non-empty queues in the very next describe block (the "tops up a 4-card interrupt queue to 6" test); it only still passes because of specific default mocks (`getNearDueCards` defaults to `[]`, `canIntroduceNewCard` always `false`), misleading for future maintainers reading the test name as documentation. Rename the test to accurately describe what it actually proves (e.g. "does not flex when isInterrupt is true, the queue is non-empty, AND both fill sources are empty/stranded" or similar — read the test body precisely and name it for what it actually tests, not the broader claim it no longer supports).

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:describe block:249
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F004 — severity 2 — tests

---

### Task #555: Fix tests: weak greater-than-or-equal assertion where an exact value is provable

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Test uses `toBeGreaterThanOrEqual(1)` (around line 144) where an exact `toBe(1)` is provable given the test's own setup (a single-card queue, `handleRate` called exactly once). Change to the exact assertion.

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:n/a:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F022 — severity 2 — tests

---

### Task #556: Fix tests: 4-card-to-6 top-up test only asserts queue length, not exact contents

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The "tops up a 4-card interrupt queue to 6 with 2 flexed new cards and no near-due" test only asserts `toHaveLength(6)` on the final queue rather than the exact array of ids; a wrong or duplicate id landing at length 6 would slip through this specific assertion undetected. Change the assertion to an exact `.toEqual([...])` on the full expected id array (mirroring the sibling test "fills an empty interrupt session to exactly 6", which already does this correctly).

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"tops up a 4-card interrupt queue to 6":0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F023 — severity 3 — tests

---

### Task #559: Fix tests: "never duplicates a near-due card" test doesn't prove the loop-level dedup check is load-bearing

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This test passes even with the loop-level dedup check (`if (sessionIds.has(card.id)) continue;`) deleted, because an outer `setQueue` filter independently re-deduplicates; the test proves the composite pipeline is duplicate-free but does not prove the loop-level check itself is load-bearing (Deletion Test failure, Rule 18). Add or strengthen the test to specifically prove the loop-level check matters — e.g. construct a scenario where the outer filter's dedup would NOT be sufficient on its own (if such a scenario exists — trace the code carefully; if the outer filter genuinely always covers every case the loop-level check would, then the loop-level check may be redundant and worth removing instead, with a comment explaining why it's safe to delete — decide based on what you find, don't just add a test that still can't distinguish the two).

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"never duplicates a near-due card" test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F026 — severity 3 — tests

---

## Agent Memories

## QA Agent Memory (first 150 lines)
# QA Agent Memory — plyglt

## Test Framework
Vitest 4 with vi.mock, vi.fn, vi.spyOn. @testing-library/react for hook tests.
Test command: `npm test`. Coverage: `npm test -- --coverage`. Thresholds: lines=84, funcs=79, branches=81, stmts=82 — only ever increase, never lower.

## Systemic Patterns (from /patterns health report) — directly relevant to your whole stream
- **Test Quality** (43 occurrences, 22 audit cycles, avg severity 4.2) — the single most recurring
  finding category in this codebase's history: existence-only assertions, tests that inject state
  directly instead of exercising the real write path (Rule 20), and Rule 18 (Deletion Test) violations
  where the assertion would pass even if the described production code were deleted or broken. Before
  signing off any test you touch this wave: run the Deletion Test on every `it()` block you write or
  modify — "what specific wrong implementation would this test catch?"
- Rule 20 (Spec-to-Runtime Traceability): verify every spec requirement's test exercises the real
  production entry point (the actual hook a real user interaction calls), not the isolated pure
  function or state injected via setState. This is exactly what your #543 seam-test task needs.
- Rule 14: every user-facing React component needs a co-located `.test.tsx` — already true for both
  components/InterruptHandler.tsx and app/study/page.tsx in this codebase; you're deepening existing
  coverage, not creating new files.

Full qa.md is at .autocode/agents/qa.md if you need more context.

## When You Finish
Write your completion summary to .autocode/stream-W1C/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content —
the orchestrator's consolidation step and its reconciliation check both parse these two
lines mechanically, not the prose below them:

CLOSED: #[NUM] #[NUM] #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason] | #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`. Every
task number assigned to this stream must appear in exactly one of the two lines — never
omit a task number from both.)

After those two lines, write whatever prose detail is useful — this part is free-form and
is not mechanically parsed, so include as much as helps the next wave or Max's review:
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]
  Whether Barry's requested hooks/useStudySession.test.ts test cases (from his completion.md) got added
  [architecture decisions, root causes, anything the next stream touching these files needs]

Then tell Max in this window: "Charles is done." (or describe what's incomplete).

— Charles | W1C | #534 #537 #542 #543 #552 #553 #555 #556 #557 #559
