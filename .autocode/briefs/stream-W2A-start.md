# Adam — Stream W2A — Wave 2 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W2A | #536

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #536  — Fix tests: no seam test wires the real Batch 23 fill pipeline end-to-end

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W2A
[→] #536 — Fix tests: no seam test wires the real Batch 23 fill pipeline end-to-end   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
app/study/page.tsx
tests/seam_studyLoop.test.ts (or a new seam test file if that one doesn't fit — your call)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
docs/INTERRUPT_ARCHITECTURE.md
hooks/useInterruptConfig.test.ts
tests/pushDueEstimate.test.ts

## Prior Wave Changes — Read Before Starting
Wave 1 (this same batch) already added a real seam test for part of this exact gap:
`tests/seam_studyLoop.test.ts` gained a test wiring the REAL `useStudySession` hook against
REAL `store/srsStore.ts` actions (no mocked `getNearDueCards`/`canIntroduceNewCard`) via
`renderHook`, proving the interrupt floor-fill reaches `INTERRUPT_SESSION_FLOOR` (6) — added
by Charles's stream (W1C) while closing Task #543. Read that test first (`git log -p -- tests/seam_studyLoop.test.ts`
or just open the file) before writing anything new — your task's specific gap ("no seam test
wires the real app/study/page.tsx through the real useStudySession into the real
store/srsStore.ts... end-to-end") is narrower: Charles's test proves the hook-to-store seam;
yours needs to prove the PAGE-to-hook seam is also real (i.e. `app/study/page.tsx`'s actual
`getNearDueCards: (limit) => getNearDueCards(allCards, limit)` binding at line 73, and its
`buildQueue`/`INTERRUPT_SESSION_CAP` slicing, are wired correctly into a real `useStudySession`
call) — do not duplicate Charles's test, extend the seam coverage one layer further out.

## Task Definitions

### Task #536: Fix tests: no seam test wires the real Batch 23 fill pipeline end-to-end

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing (was semantically blocked on Tasks #538/#551, both COMPLETE as of Wave 1)
**Priority:** P3
**Status:** OPEN

**What:**
No seam test wires the real app/study/page.tsx through the real useStudySession into the real store/srsStore.ts getNearDueCards/canIntroduceNewCard/introduceCard end-to-end; every layer of Batch 23's new fill pipeline is unit-tested in isolation only. Rule 13 seam-test gap.

Given Wave 1 already added a hook-to-store seam test (see "Prior Wave Changes" above), your job
is the outer layer: a test that renders (or at minimum invokes with real, non-mocked collaborators)
`app/study/page.tsx`'s actual queue-construction logic — `buildQueue` + the `INTERRUPT_SESSION_CAP`
slice + the real `getNearDueCards` binding — feeding into a real `useStudySession` call, proving the
full page-to-store chain produces a correctly-floored interrupt session with no intermediate mock.
If a full component render (via `@testing-library/react`) is impractical given existing mocks in
`app/study/page.test.tsx`, a `renderHook`-style test that reconstructs the page's exact wiring
(same function calls, same binding shape) against the real store is an acceptable equivalent — the
point is proving the real functions are called with the real argument shapes, not adding another
layer of mocks.

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.tsx:StudyInner:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx (this script does not exist in
      this repo — substitute the real Verification Gate: `npx tsc --noEmit`, `npm test`, `npm run lint`)

**Source:** Audit finding F003 — severity 4 — tests

---

## Agent Memories

## QA Agent Memory (relevant excerpt)
Rule 13 (Test the Seams): when data flows across module boundaries, at least one test must trace
real data through the full chain without mocking intermediate layers. Rule 20 (Spec-to-Runtime
Traceability): the test must exercise the real production entry point, not an isolated pure function
or state injected via setState. Before signing off: run the Deletion Test — would this test actually
fail if the real wiring were broken?

## When You Finish
Write your completion summary to .autocode/stream-W2A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM]
NOT_CLOSED: #[NUM] — [one-line reason]

(If closed: `NOT_CLOSED: none`. If not: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W2A | #536
