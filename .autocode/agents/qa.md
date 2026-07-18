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
- getSpecialtyPacks() filter with populated registry: COVERED (Task #157 — 3 tests)
- Stats page Pro gate (isProEnabled(flags.analytics, licenseType)): COVERED (Task #155 — 3 tests: free/pro/flag=false)

## Systemic Patterns (from /patterns 2026-07-08 health report)

- **Test Quality** (43 occurrences, 22 audit cycles, avg severity 4.2) — the single most recurring finding category in this codebase's history. Concentrated failure modes: existence-only assertions (`.toBeDefined()`/`.not.toBeNull()`) on deterministic values, tests that inject state directly via `setState` instead of exercising the real write path (now Rule 20 in philosophy.md), and B7/Rule 18 violations where the assertion would pass even if the described production code were deleted or broken. Before signing off any test file: run the Deletion Test on every `it()` block.
- **Error Protection** (12 occurrences, 8 cycles, avg severity 4.7) — repeated gaps in error-path coverage, particularly asymmetric logging (one call site in a shared helper logs, a sibling call site added later does not).
- New standing check to apply going forward: Rule 20 (Spec-to-Runtime Traceability) — verify every spec requirement's test exercises the real production entry point, and grep for orphan callers on any function implementing a requirement.

## Run History
10 runs total. Blind spots: Task #056 misattributed (run 2); test count jumped 310→515 in Batch 3; useLangPack.ts 0% branch coverage missed until run 4; LanguageGrid.tsx Rule 14 gap first flagged run 5; projected test count 908 was wrong — actual 843 (confirmed run 6); Batch 9 closed all Rule 14 gaps for app pages (run 7); Batch 12 added +32 tests post-Task #148-150 (run 8 count was 888); Batch 13 added +3 (run 9 — 891 total); Two minor issues found in Batch 12-13 code: redundant toBeDefined assertions (6 instances) and untested getSpecialtyPacks filter predicate (run 9 — both resolved by run 10). Run 10: clean pass at 897. One minor open: PRICING.annual exact value not pinned by real-constant test.

## Past Findings — Resolved (Task #378, 2026-07-17, stream W14A)
- Pseudocode assertions in hooks/useLangPack.test.ts (#296 expect.any(Array)+length>0; units.length>0 with invalid existence-check tag) — resolved: reference-identity assertions to ALL_UNITS.
- Cancellation tests proved nothing (React 18 silent no-op) — resolved: stale-language-switch test discriminates the cancelled guard; unmount tests renamed to their honest cache-warming claim.
- Rule 20a gaps: eviction-generation tests drove setState injection — resolved: both now call the real clearEntitlement; RTL auto-cleanup inertness (vitest globals off, setup.ts registers no cleanup) documented and worked around file-level; repo-wide fix still open debt (tests/setup.ts one-liner).
