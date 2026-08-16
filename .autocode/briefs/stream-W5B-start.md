# Barry — Stream W5B — Wave 5 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W5B | #600 #590 #599 #595

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

All 4 of your tasks touch app/study/page.tsx (and its test file). Read the whole current file first, including both the `initialQueue` useMemo (around line 62, which passes `getIntroductionDueCardIds`) and the Study More handler (around line 129, which currently does not) before starting #600.

**#600 is the highest-severity task in this stream (6) — do it first.** The Study More handler's `buildQueue` call is missing the `getIntroductionDueCardIds` parameter that `initialQueue`'s construction passes. Add the matching parameter to the Study More handler's `buildQueue` call so a card mid-intensive-introduction phase due today is not silently excluded from a rebuilt queue when it would have been included in the session's initial load. Write a real test proving this (mock `getIntroductionDueCardIds` to return a card id, trigger Study More, assert the rebuilt queue includes it) — a Deletion Test: the test must fail if the parameter is reverted to omitted.

**#590** is a related test-integrity fix: a comment in app/study/page.test.tsx claims a cited sibling test already proves global-mode sessions get a null `onStudyMore` handler, but that sibling test never actually checks the `has-study-more`/onStudyMore-related attribute. Add real, direct test coverage for both cases (global mode → null handler, unit mode → non-null handler) and either fix or remove the inaccurate comment.

#599 and #595 are minor, independent code-quality/documentation items in the same file — #599's non-null assertion ordering issue is currently harmless (fix it for correctness, e.g. move the `isDone` check before the assertion, or note why the current order is actually safe if you determine it is); #595 (mode read with no entitlement check) is explicitly NOT a bug per CLAUDE.md section 5's documented client-only honor-system entitlement model — the correct fix is a clarifying code comment acknowledging this is intentional, not a code change that adds an entitlement gate.

## Your Tasks (run in this exact order)
1. /task #600  — Fix requirements: The Study more handler's buildQueue call omits the getIntroductionDueCardIds parameter that initialQ
2. /task #590  — Fix tests: A comment claims a cited sibling test already proves global mode gets a null onStudyMore handler, bu
3. /task #599  — Fix code-quality: const currentCard = queue[pos]! is evaluated before the if (isDone) branch that would make pos a val
4. /task #595  — Fix auth: mode is read directly from useSearchParams with no entitlement or Pro check anywhere

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W5B
[→] #600 — Fix requirements: The Study more handler's buildQueue call omits the getIntroductionDueCardIds parameter that initialQ   ← starting now
[ ] #590 — Fix tests: A comment claims a cited sibling test already proves global mode gets a null onStudyMore handler, bu
[ ] #599 — Fix code-quality: const currentCard = queue[pos]! is evaluated before the if (isDone) branch that would make pos a val
[ ] #595 — Fix auth: mode is read directly from useSearchParams with no entitlement or Pro check anywhere

## Files You Own (edit ONLY these)
app/study/page.tsx
app/study/page.test.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
hooks/useInterruptConfig.ts
hooks/useStudySession.test.ts
hooks/useStudySession.ts  (read-only reference — Adam's stream is fixing this in Wave 5)
store/srsStore.ts
tests/srsStore.test.ts

## Task Definitions

### Task #600

### Task #600: Fix requirements: The Study more handler's buildQueue call omits the getIntroductionDueCardIds parameter that initialQ

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The Study more handler's buildQueue call omits the getIntroductionDueCardIds parameter that initialQueue's construction at line 62 does pass. A card mid-intensive-introduction-phase due today would be silently excluded from a rebuilt Study more queue, even though the same unit's initial session load would have included it. at app/study/page.tsx:Study more handler vs initialQueue construction:129.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at app/study/page.tsx:Study more handler vs initialQueue construction:129
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F014 — severity 6 — requirements

---

### Task #590

### Task #590: Fix tests: A comment claims a cited sibling test already proves global mode gets a null onStudyMore handler, bu

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A comment claims a cited sibling test already proves global mode gets a null onStudyMore handler, but that sibling test never checks the has-study-more attribute at all. Neither the global-mode-null case nor the unit-mode-non-null case for onStudyMore has any real test coverage. at app/study/page.test.tsx:comment near lines 326-328:326.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:comment near lines 326-328:326
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F004 — severity 3 — tests

---

### Task #599

### Task #599: Fix code-quality: const currentCard = queue[pos]! is evaluated before the if (isDone) branch that would make pos a val

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
const currentCard = queue[pos]! is evaluated before the if (isDone) branch that would make pos a valid index. Currently harmless but the non-null assertion's precondition is checked after the assertion is made rather than before. at app/study/page.tsx:render body:109.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/study/page.tsx:render body:109
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F013 — severity 2 — code-quality

---

### Task #595

### Task #595: Fix auth: mode is read directly from useSearchParams with no entitlement or Pro check anywhere

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
mode is read directly from useSearchParams with no entitlement or Pro check anywhere. This predates Batch 23 entirely and CLAUDE.md section 5 explicitly documents entitlement as an intentional, owner-confirmed client-only honor-system trade-off, not a bug to fix. at app/study/page.tsx:mode=interrupt query param handling:0.
NEW

**Acceptance Criteria:**
- [ ] Fix auth issue at app/study/page.tsx:mode=interrupt query param handling:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F009 — severity 2 — auth

---

## QA Agent Memory (first 100 lines)

# QA Agent Memory — plyglt

## Test Framework
Vitest 4 with vi.mock, vi.fn, vi.spyOn. @testing-library/react for hook tests.
Test command: `npm test`. Coverage: `npm test -- --coverage`.

## Test Count and Coverage (CONFIRMED run 10 — 2026-07-01)
- **897 tests across 49 test files** (confirmed again after Tasks #154, #155, #157, #158, #120, #121)
- vitest.config.ts now excludes `tests/e2e/**` — Playwright E2E runs separately via `npm run test:e2e`
- Coverage thresholds: lines=84, funcs=79, branches=81, stmts=82
- **UPDATED (Batch 18 WorldClass, 2026-07-08): 1085 tests across 53 test files.** Coverage still exceeds all thresholds (lines 91.13%, branches 82.24%, funcs 86.91%, stmts 88.08%). New: `tests/srs.test.ts` gained a `prerequisitesMet` describe block (5 cases); `hooks/useStudySession.test.ts` gained a prerequisite-gating describe block (3 `renderHook`-based cases); `tests/answerCheck.test.ts` gained ~38 exact-value regression cases for the article-stripping fix and 2 follow-on fresh-eyes bug fixes (length-gate, leading-whitespace); `tests/entitlement.test.ts` gained 3 `console.error`-spy tests closing a real gap where redaction was never actually verified at the log call, only at the return value.
- All thresholds met. Thresholds only ever increase — never lower.

## Rule 14 Status (every user-facing component needs co-located test)
COMPLETE (all have tests as of Batch 9):
- components/StudyCard.test.tsx ✓
- components/DifficultyBar.test.tsx ✓
- components/BuyModal.test.tsx ✓
- components/EntitlementValidator.test.tsx ✓
- components/InterruptHandler.test.tsx ✓
- components/LevelSection.test.tsx ✓
- components/StudyDoneScreen.test.tsx ✓
- components/StudyResumePrompt.test.tsx ✓
- components/UnitRow.test.tsx ✓
- components/Stat.test.tsx ✓
- components/settings/Section.test.tsx ✓
- components/LanguageGrid.test.tsx ✓ (Task #104)
- components/UpdateChecker.test.tsx ✓ (Task #102)
- hooks/useStudySession.test.ts ✓
- hooks/useLicenseActivation.test.ts ✓
- hooks/useExportImport.test.ts ✓
- hooks/useLangPack.test.ts ✓
- hooks/useStatsData.test.ts ✓
- app/settings/page.test.tsx ✓ (Task #106)
- app/page.test.tsx ✓ (Task #111 — 4 behavioral tests — conversion surface)
- app/study/page.test.tsx ✓ (Task #112 — 3 behavioral tests — core study loop)
- app/learn/page.test.tsx ✓ (Task #113 — 3 behavioral tests)
- app/stats/page.test.tsx ✓ (Task #114 — 2 behavioral tests + BRAND "last seen" regression guard)

Rule 14 is now FULLY COMPLETE for all app pages and components.

## Introduction Engine Test Gaps (Batch 5 audit — 2026-07-02)

`tests/introduction.test.ts` has meaningful unit coverage but several structural gaps:

- **[F14 sev:4] No seam test** — no test traces `recordResult → shouldAppearToday → getIntroductionDueCardIds` through the store. The dead-write bug (F01 — triple-wrong reset) is invisible to unit tests because `recordResult` is tested in isolation. A seam test calling `getIntroductionDueCardIds` after a triple-wrong result would have caught it. Add to `tests/srsStore.test.ts` or a new `tests/seam_introduction.test.ts`.

- **[F16 sev:3] 15/22 phase-day entries untested** — `MAX_APPEARANCES_BY_PHASE_DAY` has 22 entries. Only days 1, 2, 4, 8, 11, 15, 22 are value-asserted. Days 3, 5, 6, 7, 9, 10, 12-14, 16-21 have no assertions. Use a parameterized test.

- **[K008 sev:7] shouldAppearToday: missing critical test path** — no test for `dayOfPhase=11`, `lastSeenDate=today`, `appearancesToday=1`. This is the exact case that exposes the unlimited-appearances bug on every-other-day phase days.

- **[F21 sev:4] recordResult return fields under-asserted** — IntroductionRecord has 10 fields. No single test asserts more than 5. Correct-path tests never assert `dayOfPhase` preservation. Add a full-field enumeration test per Rule 16.

- **[F15 sev:2] toContain pseudocode in getNextCardType suite** — `getNextCardType(null, ["recognize","produce"])` is deterministic (always returns "recognize"). Test at line 278 uses `toContain` — a broken implementation always returning pool[0] would pass. Change to `toBe("recognize")`.

- **[F22 sev:3] shouldGraduate tested only at boundary** — only values 14 and 15 tested. Add: `consecutiveCorrect=0` (obviously false), `consecutiveCorrect=16` (above threshold, still true).

- **File size**: 298 lines — 19% over 250-line Rule 1 limit. Split after adding new tests.

## Key Test Files and What They Cover
- `tests/srsStore.test.ts` — FSRS scheduling, introduction engine store actions, migration chain
- `tests/entitlement.test.ts` — full activation→pack-unlock seam; deactivation path; invoke=false branch (Task #119)
- `tests/seam_studyLoop.test.ts` — session-start auto-introduction integration test
- `tests/introduction.test.ts` — lib/introduction.ts unit + branch coverage (100% branches)
- `tests/migrations.test.ts` — Zustand store migration chain
- `tests/tauri.test.ts` — lib/tauri.ts web-mode no-ops
- `tests/featureFlags.test.ts` — isProEnabled combinator (3 cases: on+sub=true, on+free=false, off+sub=false)
- `tests/checkout.test.ts` — CHECKOUT_URLS constant values, re-export identity
- `app/stats/page.test.tsx` — BRAND copy regression guard: all "Nd ago" occurrences must be preceded by "last seen"
- `tests/packLoader.test.ts` — includes Task #152 "specialty pack merge path" describe block: 3 tests (happy path merge, base_pack_not_loaded, idempotent) that fail if isReadySpecialtyPack block is removed

## E2E Test Infrastructure (Task #153 — COMPLETE)
- `playwright.config.ts` — Playwright config; port 3099 (avoids collision with other local services on 3000). `reuseExistingServer: !CI`.
- `tests/e2e/study-session.spec.ts` — Smoke test covering 5 steps: language picker renders → click Italian → navigate to /learn → A1 unit visible → StudyCard renders + card advances.
- `package.json` — `"test:e2e": "playwright test"` script (separate from `npm test`; unit suite unchanged).
- `.gitignore` — `/test-results` and `/playwright-report` excluded.
- Run with: `npx playwright test` (starts dev server on port 3099 automatically).
- Do NOT add E2E tests to the Vitest `npm test` pipeline.

## Known Test Quality Issues
- RESOLVED (Task #158 COMPLETE 2026-07-01): 6 redundant `toBeDefined()` patterns removed from learn + stats page tests.
- RESOLVED (Task #157 COMPLETE 2026-07-01): `getSpecialtyPacks()` filter test added — "getSpecialtyPacks with non-empty registry" describe block (3 cases: it/es/fr).
- RESOLVED (Task #227 COMPLETE 2026-07-07): `PRICING.annual` exact value ("$34.99/yr") now pinned directly in `tests/checkout.test.ts` against the real constant (closes a gap open since run 10).
- RESOLVED (Task #183 COMPLETE 2026-07-07): ~50 existence-only assertions (`.toBeDefined()`/`.toBeTruthy()`/`.not.toBeNull()`) hardened to specific-value assertions across 13 files. AGENTS.md's grep gate is now permanent (no longer conditional on Task #183). See `.autocode/patterns.md` 2026-07-07 entry for the 5 findings caught during this task's own 8-agent audit (a B7/Rule 18 fixture bug in my own fix, a stale AGENTS.md cross-reference, finding-ID namespace collisions, misapplied existence-check tags).
- RESOLVED (Task #227 COMPLETE 2026-07-07): AGENTS.md's grep gate extended to also check `.toBeGreaterThan(0)` (the 4th banned pattern the prose already documented). All 6 unjustified instances tightened to exact-value assertions (MASTERY_STABILITY_DAYS, PRICING.annual, FSRS stability, buildQueue length/order, Zustand snapshot count, LOAD_PACK_ERROR_MESSAGES per-discriminant). Also closed 2 more Task #183 debt items in the same pass: full 7-field CardProgress assertions in exportBackup/importBackup tests, and 4 recomputed-Date-API validUntil assertions replaced with a hardcoded epoch literal.
- RESOLVED (Task #227 COMPLETE 2026-07-07): `tests/importBackup.test.ts:35-41` renamed from "handles v0 backup... via migration chain" (described nonexistent `activeSession`/migration-chain behavior) to "accepts a backup with an empty cards map," with strengthened assertions.

## Informational Notes
- Stale worktree at `.claude/worktrees/agent-a1f394e6195614543/` — vitest correctly excludes it; can be pruned with `git worktree remove .claude/worktrees/agent-a1f394e6195614543`

## Seam Coverage
- Activation → setEntitlement → isPackUnlocked: COVERED
- Deactivation → clearEntitlement → pack locked: COVERED
- Introduction engine → store → session: COVERED
- Session → commitSession → srsStore: COVERED
- isProEnabled(flag, licenseType) combinator: COVERED (3 cases)
- CHECKOUT_URLS constants: COVERED
- deactivateLicense when invoke returns false: COVERED (Task #119)
- Specialty pack merge path (isReadySpecialtyPack branch): COVERED (Task #152 — 3 tests)
- Full E2E user path (no mocks): COVERED (Task #153 — Playwright smoke test)

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (note: other streams are editing other files concurrently;
  a failure in a file you did not touch is not yours to fix, but confirm it via `git status`
  before assuming that)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) —
  the real Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production
  fix and confirm your new test fails, then restore it and confirm it passes. State explicitly
  in your completion.md which tasks got a live Deletion Test vs. a traced-by-hand verification
  (e.g. because the production file was off-limits to you this wave).

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or
shows changes you don't recognize, report it in your completion.md rather than resolving it
yourself with a repo-wide command — a prior wave (B2 audit round 1) lost 8 units of another
agent's uncommitted work this exact way.

## When You Finish
Write your completion summary to .autocode/stream-W5B/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W5B | #600 #590 #599 #595
