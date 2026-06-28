---
agent: cto
last-updated: 2026-06-27
meets: 3
---
# CTO Memory — plyglt

## Strategic Priorities
(From owner answers — updated 2026-06-27)

1. **Batch 4 = CURRENT SPRINT: docs + cleanup + BRAND + remaining gaps** — Owner confirmed 2026-06-27. Execution order: Task #033 first (CONTRIBUTING_LANGUAGE.md has 9 issues, expedited per owner), then Tasks #030, #031, #032, #053–#058 in parallel where file sets permit.
2. **BRAND compliance is Batch 4 priority, not deferred** — Owner 2026-06-27 reverses 2026-06-26 hold. BRAND violations (exclamation marks, emoji, "overdue", "due" badge) now Task #053 in Batch 4.
3. **Session timer spec removed from BRAND.md** — Owner confirmed 2026-06-27: 60-second elapsed progress bar spec is superseded. Card position display (N/total) is final design. Tasks #050, #051, #052 CANCELLED. Task #054 removes spec from BRAND.md.
4. **Batch 5 = Introduction Engine Foundation — after all gaps close** — Owner confirmed 2026-06-27: no intro engine sprint until all Batch 4 gaps done (Rule 1, BRAND, missing tests, security fix in #058).
5. **Vacation mode / Forecast / Analytics: Batch 7+** — Owner confirmed 2026-06-27.
6. **BRAND.md is authoritative** — Lifetime entitlement code deleted. Any future entitlement work checks BRAND.md first.
7. **Client-only entitlement is intentional** — Honor-system offline-first. Do NOT propose server-side verification architectures.
8. **Fresh task numbering** — `.autocode/tasks.md` canonical. Prior Wave 1 naming superseded.
9. **Content generation is a separate track** — Missing 68 curriculum units are not engineering tasks.

## Team Health

### Agent Performance
| Agent | Runs | Audit Reject Rate | Known Blind Spots | Last Updated |
|-------|------|-------------------|-------------------|--------------|
| security | 3 | — | CONTRIBUTING_LANGUAGE.md lifetime refs missed in run 1; all Batch 3 IPC findings now confirmed CLOSED | 2026-06-27 |
| architect | 3 | — | Missed importBackup upward import in run 1; missed stats/page.tsx Rule 1 violation in run 2 (243 lines) | 2026-06-27 |
| qa | 3 | — | Task #056 misattributed run 2; test count jumped 310→515 in Batch 3 — new gap map generated run 3 | 2026-06-27 |
| docs | 3 | — | Did not catch CONTRIBUTING_LANGUAGE.md stale file refs (fr example, lib/srs.ts ref) until run 3 | 2026-06-27 |

### Quality Trends
| Task | WorldClass Score | Tests at Close | Coverage at Close |
|------|-----------------|----------------|-------------------|
| #001 | 98/100 (5 audits + 4 WC cycles) | 303 | stmts=80.3%, funcs=76.15% |
| #002 | 97/100 | 310 | stmts=80.3%, funcs=76.15% |
| #003 | 98/100 (REOPENED — sub-tasks #059-#070) | 310 | stmts=80.3%, funcs=76.15% |
| Batch 3 | — (stream work) | ~515 | stmts=83.49%, branches=80.23%, funcs=80.82%, lines=85.37% |

**Current baseline (2026-06-27):**
Tests: ~515 | stmts=83.49% | branches=80.23% | functions=80.82% | lines=85.37%
Thresholds: lines=81, funcs=75, branches=75, stmts=79 (SCTS kaizen violation — not ratcheted after improvement; task pending)

### WorldClass Trend
Run 1 → Task #001: 70/100 (MAX_CYCLES) → 83/100 (+13 after re-run) → 93/100 → 98/100
Run 2 → Task #002: 97/100
Run 3 → Task #003: 98/100 (REOPENED on product grounds, not quality)

## Open Escalations

1. ~~**Persisted "lifetime" store values after Task #001**~~ — **RESOLVED (Task #001 Cycle 2):** ENTITLEMENT_VERSION bumped to 2. v2 migration coerces unknown licenseType to "subscription" — old lifetime users keep access, now go through proper expiry code path.

2. **Sentence generator go/no-go** — BRAND.md flags this as "under evaluation." No task created. If approved, it becomes Batch 3 or later work.

3. ~~**Language stub inheritance**~~ — **RESOLVED 2026-06-27:** fr/de/pt stubs removed from `lib/langRegistry.ts`. Only `it` and `es` are registered. When new packs ship, they will be added fresh with their own config.

4. **ALL_PACK_CODES vs READY_PACK_CODES split (Task #068)** — Should the loadPack guard validate against all registered pack codes (including `ready: false` packs) or only packs that are actually ready to download? Task #068 is blocked on this decision. Current behavior: guard validates against registered codes only. With fr/de/pt removed, this is lower priority but still unresolved for es (ready: false).

5. **Task #001 WorldClass — app/settings/page.tsx remaining gap** — 515-line route file with zero test coverage blocks WorldClass from reaching 95/100. Accepted per owner; will be resolved when Task #026 (Batch 3) splits the file. No action needed until Batch 3.

## New Findings — 2026-06-26 /meet Session

Findings surfaced by this session's examination (not in Batch 1 when the session started):
- **lib/importBackup.ts:14 Rule 3 violation** — New task added to Batch 1. Owner decision: fix now.
- **app/decks/ empty directory** — New task added to Batch 1 (delete it). Owner decision: delete.
- **lib/packLoader.ts:223-226 silent catch** — New task added to Batch 1 (merge or standalone).
- **lib/entitlement.ts:207 deactivateLicense exposes raw LS API error** — New task added to Batch 1.
- **SCTS kaizen violation: coverage thresholds not ratcheted** — New task added (Direct, Batch 1 candidate).
- **lib/storage.ts zero test file, 42% coverage** — New task added to Batch 2.
- **CONTRIBUTING_LANGUAGE.md lifetime references** — Task #001 scope missed this file entirely. New docs task added to Batch 4.
- **Task #009 (EntitlementValidator console.warn) RESOLVED** — Raw LS error no longer propagated; logged a controlled string.

## New Findings — 2026-06-27 /meet Session (Batch 3 post-review)

Batch 3 shipped 205 new tests (310→515) and 14 new source files. /meet run 3 surfaced:

**Architecture:**
- `app/stats/page.tsx` 243 lines — Rule 1 violation. Task #055 added.
- 13 of 14 Batch 3 new files missing Rule 2 headers. Task #030 expanded from 26→39 files.
- `store/srsStore.ts` blast radius grew from 9→14 importers. Flag any interface changes as HIGH risk.

**BRAND compliance (new Batch 4 priority per owner):**
- `components/StudyDoneScreen.tsx`: 3 exclamation marks + 🎉 emoji.
- `app/study/page.tsx`: "All caught up!" + ✓ emoji + "⏰ Quick Review".
- `app/stats/page.tsx`: "overdue" in user-visible strings at lines 121, 131.
- `lib/language.ts`: "Corretto!" and "¡Correcto!" — exclamation marks forbidden.
- `components/UnitRow.tsx`: badge reads "due" instead of "ready".
All consolidated into Task #053.

**Security:**
- `components/InterruptHandler.tsx:91,104`: `listen()` chains without `.catch()` — MEDIUM. Task #058 added.
- `components/InterruptHandler.tsx:70`: `enterMandatoryMode()` not in try/catch — LOW.

**QA (missing tests):**
- `hooks/useStudySession.ts`: no test file — sev:7. Task #056 added.
- `hooks/useLicenseActivation.ts`: no test file — sev:6. Task #057 added.

**Docs:**
- `CONTRIBUTING_LANGUAGE.md` has 9 total issues (4 original + 5 new from Batch 3). Task #033 expanded. Expedited to head of Batch 4 per owner.
- Session timer spec in BRAND.md superseded — Task #054 will remove it.

**Resolved by Batch 3 (confirmed /meet 2026-06-27):**
- lib/importBackup.ts upward import: RESOLVED
- fr/de/pt language stubs: REMOVED from langRegistry
- PackCode type widening: FIXED (now "it" | "es" literal union)
- Security tasks #004, #005, #006, #006b, #007: ALL CLOSED by Batch 3 IPC error handling improvements

## Task Scoping Rules

Lessons from Task #001 (2026-06-25):

**Rule: "Delete X and harden Y" is always two tasks.**
When a task combines a targeted change (delete a feature, rename a field) with an open-ended quality mandate ("harden the module"), the audit scope expands to cover every line in every touched file. Pre-existing debt in those files gets pulled into the task and blocks completion. Split these at planning time:
- Task A: the targeted change — narrow scope, fast audit, clear done condition
- Task B: the hardening — explicit scope boundary, separate WorldClass cycle, its own timeline

**Rule: Open-ended mandates need an explicit scope cap.**
If a task must include hardening work, add a line to the task definition: "Audit scope is limited to [specific functions/interfaces]. Pre-existing findings in adjacent code become new tasks, not blockers." Without this, every touched file's debt becomes fair game.

**Rule: Large files inflate task cost non-linearly.**
A 1-line change in a 500-line file pulls the entire file into audit scope. Before assigning a task that touches `app/settings/page.tsx` or any other Rule 1 violator, estimate the pre-existing debt in that file and either: (a) schedule the decomposition task first, or (b) add an explicit scope cap to the task definition.

**Rule: Scope must include all files that reference a deleted artifact.**
Task #001 deleted lifetime checkout URLs and pricing from code files but did not touch CONTRIBUTING_LANGUAGE.md — which still has `pricing: { lifetime: "$9.99" }` templates. Any task that deletes an artifact must grep for all references across the full repository including docs files.

## Conflict Register

| Date | Conflict | Resolution |
|------|----------|------------|
| 2026-06-24 | BRAND.md says "No lifetime" but lib/entitlement.ts had active lifetime checkout URLs | Resolved by owner: delete all lifetime code. BRAND.md is authoritative. |
| 2026-06-24 | Prior Wave 1/Batch D naming vs fresh /meet task list | Resolved by owner: start fresh. .autocode/tasks.md supersedes all prior naming. |
| 2026-06-26 | BRAND violations (overdue/🎉/🔥) are user-visible now but files already scheduled for Batch 3 refactor | Resolved by owner: hold until Batch 3. Not a surgical Batch 1 fix. |
| 2026-06-26 | lib/importBackup.ts Rule 3 upward import — add to Batch 1 or group into Batch 2 | Resolved by owner: add to Batch 1. Stop-the-line violation, fix now. |
| 2026-06-27 | BRAND violations still present after Batch 3 — move to Batch 4 or hold further? | Resolved by owner: Batch 4 priority. Task #053 created. |
| 2026-06-27 | Session timer spec in BRAND.md vs card position display — which is intended design? | Resolved by owner: card position (N/total) is final. BRAND.md session timer section superseded. Tasks #050-#052 CANCELLED. |
| 2026-06-27 | Task #030 scope — include 13 Batch 3 additions or separate task? | Resolved by owner: update Task #030 in place. Expanded from 26→39 files. |

## Task Cycle Log

| Date | Batch | Tasks Completed | WorldClass Score | Notes |
|------|-------|-----------------|------------------|-------|
| 2026-06-24 | /meet run #1 | 0/33 | — | Initial onboarding. 33 tasks generated across 4 batches. |
| 2026-06-25 | Batch 1 | 2/70 (#001, #002 COMPLETE; #003 REOPENED) | avg 97.7/100 | 70 tasks across 6 batches after Task #003 re-audit. Task #009 also resolved (no /task cycle — resolved during #001 work). |
| 2026-06-26 | /meet run #2 | 0 new since last /meet | — | 6 new tasks added (#071-#076 approx), 1 task confirmed RESOLVED (#009). CONTRIBUTING_LANGUAGE.md gap found — new Batch 4 task. |
| 2026-06-27 | /meet run #3 | 0 new (Batch 3 work confirmed complete) | — | 6 new tasks added (#053-#058), 3 tasks CANCELLED (#050-#052), Task #030 expanded (26→39 files), Task #033 expanded (4→9 issues) + expedited. Batch 3 post-review: 205 new tests, 14 new source files, security tasks #004-#007 all confirmed CLOSED. 7 owner decisions recorded. |

### Task #001 | Delete all lifetime entitlement code + harden entitlement module
Status: COMPLETE | Cycle 5 | Started: 2026-06-24 | Completed: 2026-06-25
(Full cycle history in prior CTO memory — preserved in git via tasks.md)
Final WorldClass: 98/100

### Task #002 | Fix upward import — extract LANG_PAIR_KEY to lib/constants.ts
Status: COMPLETE | Cycle 2 | Started: 2026-06-25 | Completed: 2026-06-25
WorldClass: 97/100

### Task #003 | Fix lang-injection vulnerability in packLoader — validate against allowlist
Status: REOPENED — 2026-06-25
WorldClass at COMPLETE: 98/100
Reopened reason: Fresh-eyes audit found 12 new findings. Sub-tasks #059–#070 added to task list.
(Full cycle history preserved in tasks.md)

### Task #060 | Add "invalid_lang" discriminant to LoadPackResult | Status: REOPENED | Cycle 1 | 2026-06-26

#### Cycle 1 — 2026-06-26 — /audit standalone invocation
Status: RETURN — 2 task-scope blockers + 1 stop-the-line + 20 additional findings
7 parallel agents (A, B, S, N, K, W, R). One inline fix applied (A000: manifest?.packs?.[lang]).
Blockers: A001 (dead "not_cached" discriminant), A002 (Rule 13 seam test missing)
Stop-the-line: A003 (SHA-failed data served after eviction + network failure — lib/packLoader.ts:215)
Carries: A004–A022 added as sub-items in tasks.md
Next cycle: fix A001+A002+A003, verify gate green, re-run /audit

### Task #034 | Add IntroductionRecord interface and MAX_APPEARANCES_BY_PHASE_DAY constant | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Full Task (re-classified from Direct; pre-build scope check: 2 files + test file = 3 total)
Build approach: content/types.ts:IntroductionRecord:48 (interface appended); lib/introduction.ts:MAX_APPEARANCES_BY_PHASE_DAY:8 (constant, new file); tests/introduction.test.ts (5 structural + behavioral tests, new file)
Scripts: PASS (tsc 0 errors · 722/722 tests · lint 0 errors)
Audit findings (structured):
  [F001|sev:2|names|content/types.ts:IntroductionRecord:consecutiveWrongToday|Field name implies daily reset; BRAND.md rule is consecutive streak spanning days; recordResult (#040) must clarify|NEW]
  [F002|sev:2|types|lib/introduction.ts:MAX_APPEARANCES_BY_PHASE_DAY:8|Record<number,number> types missing keys as number; runtime undefined for day 23+; maxAppearancesToday (#038) must guard|NEW]
  [F003|sev:1|names|content/types.ts:IntroductionRecord:dayOfPhase|Dual semantics: calendar-computed by getDayOfPhase AND overridden by wrong-answer reset; implementation tasks must clarify|NEW]
Fixed this cycle: — | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — first cycle
WorldClass score: 99/100 — PASS (threshold: 95)

### Task #035 | Write failing tests for getDayOfPhase | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Direct Task (Builder path)
Build approach: tests/introduction.test.ts:getDayOfPhase describe block:71 (5 tests added; getDayOfPhase imported from lib/introduction.ts — not yet exported, causing TS2305 + TypeError at runtime as expected for TDD red phase)
Scripts: PASS (targeted gate: 5 getDayOfPhase tests fail, 5 existing tests pass — full tsc broken intentionally)
Spot check: PASS
Done-when: PASS (5 test cases ≥4 required; all fail with TypeError as spec'd; existing tests unaffected)
Fixed this cycle: — | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #036 | Implement getDayOfPhase in lib/introduction.ts | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Full Task (Builder path)
Build approach: lib/introduction.ts:getDayOfPhase:36 (new export; ISO UTC parsing, Math.floor diff/86_400_000+1, Math.min clamp to 22)
Scripts: PASS (tsc 0 errors · 727/727 tests · lint 0 errors)
Audit findings (structured):
  [AUD-001|sev:2|correctness|lib/introduction.ts:getDayOfPhase:36|undocumented pre-condition today≥introducedDate; no lower-bound guard; negative diffDays returns 0 or negative|NEW→debt]
  [AUD-002|sev:1|tests|tests/introduction.test.ts:getDayOfPhase|no test for diffDays=20 (day 21, boundary below clamp)|NEW→debt]
Fixed this cycle: — | Still open: — | New findings: AUD-001, AUD-002 (both logged to debt.md) | Regression signal: NO
CTO diagnosis run: NO — first cycle
WorldClass score: 97/100 — PASS (threshold: 95)

### Task #037 | Write failing tests for maxAppearancesToday and shouldAppearToday | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Direct Task (Builder path)
Build approach: tests/introduction.test.ts:106–171 (6 maxAppearancesToday tests + 6 shouldAppearToday tests + 1 getDayOfPhase day-21 debt clearance; makeRecord helper at module scope; maxAppearancesToday + shouldAppearToday imported but not yet exported → TS2305 + TypeError as expected for TDD red phase)
Scripts: PASS (targeted gate: 12 new tests fail, 11 existing pass)
Spot check: WARN — 1 item sev:2 (only 1 positive shouldAppearToday assertion; logged to debt.md)
Done-when: PASS (≥6 new failing tests; existing getDayOfPhase tests unaffected)
Fixed this cycle: Task #036 audit sev:1 (getDayOfPhase day-21 boundary test) | Still open: — | New findings: DSC-001 sev:2 → debt.md | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #038 | Implement maxAppearancesToday and shouldAppearToday | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Full Task (Builder path)
Build approach: lib/introduction.ts — import type IntroductionRecord:4; maxAppearancesToday:46 (MAX_APPEARANCES_BY_PHASE_DAY lookup + ?? 0 guard for AUDIT-002); shouldAppearToday:52 (graduated gate → max===0 gate → 0.5 parity gate → date-boundary reset → cap check)
Scripts: PASS (tsc 0 errors · 740/740 tests · lint 0 errors)
Audit findings: none
Fixed this cycle: AUDIT-002 (Record<number,number> undefined guard via ?? 0) | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — first cycle
WorldClass score: 99/100 — PASS (threshold: 95)

### Task #039 | Write failing tests for recordResult and shouldGraduate | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Direct Task (Builder path)
Build approach: tests/introduction.test.ts:179–231 (2 shouldGraduate + 5 recordResult + 1 shouldAppearToday day-13 debt clearance; immutability test patched in-place for DSC-001 sev:2 poka-yoke fix)
Scripts: PASS (targeted gate: 7 new tests fail, 24 existing pass)
Spot check: WARN — 3 items (DSC-001 sev:2 fixed in-place; DSC-002+003 sev:1 → debt.md)
Done-when: PASS (7 failing tests ≥7 required; prior tests unaffected)
Fixed this cycle: Task #037 spot check sev:2 (shouldAppearToday day-13 positive test) | Still open: — | New findings: DSC-002, DSC-003 → debt.md | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #040 | Implement recordResult and shouldGraduate | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Full Task (Builder path)
Build approach: lib/introduction.ts:shouldGraduate:63 (consecutiveCorrect>=15); lib/introduction.ts:recordResult:68 (spread-then-override; effectiveAppearancesToday date-boundary reset; correct path: increment+graduated gate; wrong path: consecutiveWrongToday; Day 1 reset at >=3). AUD-001 caller-contract comment added in-place.
Scripts: PASS (tsc 0 errors · 748/748 tests · lint 0 errors)
Audit findings:
  [AUD-001|sev:3|correctness|lib/introduction.ts:recordResult|caller must update dayOfPhase separately|FIXED in-place — comment added]
  [AUD-002|sev:1|correctness|lib/introduction.ts:recordResult|BRAND.md "Day 2 intensity" ambiguity on single wrong|NEW→debt]
Fixed this cycle: AUD-001 (caller contract comment) | Still open: — | New findings: AUD-002 → debt.md | Regression signal: NO
CTO diagnosis run: NO — first cycle
WorldClass score: 97/100 — PASS (threshold: 95)

### Task #041 | Write failing tests for getNextCardType | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Direct Task (Builder path)
Build approach: tests/introduction.test.ts:235–265 (4 getNextCardType tests; 2 recordResult debt-clearance tests; DSC-001 sev:2 fixed in-place — added toContain containment assertion to test 4)
Scripts: PASS (targeted gate: 4 new tests fail, 33 existing pass)
Spot check: WARN — 1 item sev:2 (fixed in-place via Poka-Yoke)
Done-when: PASS (4 failing tests ≥4 required; prior tests unaffected)
Fixed this cycle: Task #039 sev:1×2 (2nd-wrong non-reset test + consecutiveCorrect===15 assertion) | Still open: — | New findings: none to debt | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #042 | Implement getNextCardType | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Full Task (Builder path)
Build approach: lib/introduction.ts:getNextCardType:113 (filter available, fallback to full available, explicit throw on empty); getDayOfPhase:37 Math.max(1,...) lower-bound clamp (debt item 1); recordResult Day 2 comment (debt item 2). CardType added to imports.
Scripts: PASS (tsc 0 errors · 755/755 tests · lint 0 errors in changed files)
Audit findings:
  [AUD-001|sev:2|tests|lib/introduction.ts:getDayOfPhase:37|clamp path untested for today<introducedDate|FIXED in-place — test added]
  [AUD-002|sev:1|correctness|lib/introduction.ts:getNextCardType:113|caller contract undocumented|FIXED in-place — comment added]
Fixed this cycle: AUD-001 + AUD-002 (in-place) | Still open: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — first cycle
WorldClass score: 100/100 — PASS (threshold: 95)

### Task #043 | Write failing migration test SRS v1→v2 | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: tests/migrations.test.ts — 2 new tests in migrateSrsStore() block: (1) v1→v2 adds introductions:{} + preserves fields [FAILS]; (2) v1→v2 preserves existing introductions via ??{} [PASSES in red phase — no-op keeps data]
Scripts: PASS (targeted gate: 1 failing, 28 passing)
Spot check: WARN — 1 item sev:2 (missing preservation test), fixed in-place
Done-when: PASS (exactly 1 new test failing, prior tests unaffected)
Fixed this cycle: DSC-001 (preservation test added in-place) | Still open: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #044 | Bump SRS_VERSION to 2 + introductions migration | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: store/migrations.ts:23 SRS_VERSION 1→2; store/migrations.ts:36-40 migration entry 2 with `{ ...d, introductions: d.introductions ?? {} }`; tests/migrations.test.ts "SRS_VERSION is 1"→"SRS_VERSION is 2"
Scripts: PASS (tsc 0 · 757/757 tests · lint clean in changed files)
Spot check: PASS
Done-when: PASS (both grep checks hit; all 29 migration tests pass)
Fixed this cycle: — | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #045 | Write failing tests for srsStore introduction actions | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: tests/srsStore.test.ts — new describe block with 8 failing tests (6 specified + 2 spot-check additions): introduceCard creates record, idempotency, recordIntroductionResult increments, 15-correct graduates, getIntroductionDueCardIds positive, canIntroduceNewCard false, canIntroduceNewCard true, getIntroductionDueCardIds excludes graduated
Scripts: PASS (targeted gate: 8 failing, 42 passing)
Spot check: WARN — 2 items sev:2+1 (canIntroduceNewCard true branch + graduated exclusion), fixed in-place
Done-when: PASS (≥6 failing, prior tests unaffected)
Fixed this cycle: DSC-001 sev:2, DSC-002 sev:1 (both in-place) | Still open: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #046 | Add introductions field and 4 actions to srsStore | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: store/srsStore.ts — IntroductionRecord import from content/types; getDayOfPhase/recordResult/shouldAppearToday imports from lib/introduction; introductions field on SRSState interface + default state {}; 4 actions: introduceCard (idempotent guard), recordIntroductionResult (dayOfPhase patch + recordResult), getIntroductionDueCardIds (filter via shouldAppearToday), canIntroduceNewCard (some check on introducedDate). Tests updated: as Record<string,unknown> casts removed now that type is known.
Scripts: PASS (tsc 0 · 765/765 tests · all 50 srsStore tests pass)
Spot check: PASS
Done-when: PASS (grep hits on interface, default state, all 4 action implementations)
Fixed this cycle: — | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #047 | Write failing queue introduction tests | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: tests/queue.test.ts — new describe block with buildQueueExt typed cast (forward-types 5th param without ts-expect-error); 4 tests: containment, ordering via indexOf, dual-mechanism (FSRS + intro), globalMode. DSC-001 sev:3 fixed via typed cast; DSC-002 sev:1 fixed via longer test name.
Scripts: PASS (tsc 0 · targeted gate: 4 failing, 9 passing)
Spot check: WARN — 2 items (sev:3 tsc error fixed; sev:1 name fixed — both in-place)
Done-when: PASS (4 new tests fail, prior 9 pass, tsc clean)
Fixed this cycle: DSC-001 + DSC-002 (both in-place) | Still open: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #048 | Extend buildQueue with optional intro parameter | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path)
Build approach: lib/queue.ts:buildQueue — added optional 5th param `getIntroductionDueCardIds?: (today: string) => string[]`; inline YYYY-MM-DD local date; introCards collected into array, pushed after due loop but before remaining new; existing dedup handles overlap.
Scripts: PASS (tsc 0 · 13/13 tests pass)
Spot check: WARN — 1 item (DSC-001 sev:2 inline date computation could drift — logged to debt.md)
Done-when: PASS (all 13 queue tests pass, grep confirms parameter exists)
Fixed this cycle: — | Still open: — | New findings: DSC-001 (→debt.md) | Regression signal: NO
CTO diagnosis run: NO — Direct task

---

### Task #010 | Fix NFC normalization in checkAnswer | Status: COMPLETE | Cycle 1 | Completed: 2026-06-26 | Stream: W1D

#### Cycle 1 — 2026-06-26 — Full Task (Build + inline audit + inline WorldClass)
Build approach: `lib/srs.ts:227-239` — replaced `normalize()`'s `.normalize("NFD").replace(...)` with `.normalize("NFC")`. Added `normalizeStripped()` helper (NFD+strip→NFC, function-scoped). Added `diacriticTolerant?: boolean` to options type. Added `isAccentOnly` check in loop — strips Levenshtein "close" path for accent-only diffs when diacriticTolerant=false; returns "close" when true. `tests/srs.test.ts` — updated old "accent stripped to e" test (was asserting wrong behavior), added 5 new diacriticTolerant behavior tests.
Scripts: PASS (60/60 srs tests; TypeScript clean in W1D files; lint warnings in W1B-owned file only)
Complexity path: Full (algorithm change + new parameter + multi-change)
Done-when: PASS (spirit) — tests pass; `grep -n "NFD" lib/srs.ts` returns 2 hits in `normalizeStripped` helper (intentional — stripping Unicode diacritics necessarily requires NFD decomposition as intermediate step; the OLD erroneous NFD usage in base `normalize` is eliminated)
Inline WorldClass: ~98/100 — all 8 standards met; `normalizeStripped` is an honest abstraction used multiple times; tests are behavioral
Fixed this cycle: NFD+strip in normalize() | Still open: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — first cycle

### Task #012 | Fix stability clamping upper bound in scheduleCard | Status: COMPLETE | Cycle 1 | Completed: 2026-06-26 | Stream: W1D

#### Cycle 1 — 2026-06-26 — Direct Task (Builder path)
Build approach: `lib/srs.ts:57` — added `Math.min(36500, ...)` inside `nextInterval()` return; `lib/srs.ts:177` — changed `Math.max(0.1, S)` to `Math.max(0.001, Math.min(36500, S))` in `scheduleCard()`. `tests/srs.test.ts` — updated "at least 0.1" lower bound test to reflect new 0.001 bound, added 4 new clamping tests (upper bound on both easy+good, dueDate overflow, lower bound).
Scripts: PASS (64/64 srs tests)
Complexity path: Direct — no audit, no WorldClass
Done-when: PASS (`grep -n "Math.max(0.1" lib/srs.ts` returns zero hits)
Fixed this cycle: missing upper bound on stability | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #011 | Add diacriticTolerant flag to LanguageConfig and wire to checkAnswer | Status: COMPLETE | Cycle 1 | Completed: 2026-06-27

#### Cycle 1 — 2026-06-27 — Direct Task (Builder path)
Build approach: lib/language.ts:LanguageConfig:14 — added diacriticTolerant:boolean field; lib/language.ts:ITALIAN:58 and SPANISH:81 — set diacriticTolerant:true; components/StudyCard.tsx:submit:64 — replaced `lang.articles ? { articles } : undefined` with `{ articles: lang.articles, diacriticTolerant: lang.diacriticTolerant }`; tests/language.test.ts — added 3 diacriticTolerant assertions
Scripts: PASS
Spot check: PASS
Done-when: PASS
Fixed this cycle: — | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — Direct task

### Task #049 | Wire introduction engine into study loop | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Full Task (Builder path)
Build approach: app/study/page.tsx:8 — added localDateStr to srsStore import; app/study/page.tsx:30 — added recordIntroductionResult, introductions, getIntroductionDueCardIds to useSRSStore destructuring; app/study/page.tsx:51 — added getIntroductionDueCardIds as 5th arg to buildQueue; app/study/page.tsx:142 — wrapped onRate with inline arrow that calls recordIntroductionResult when card is in intro phase; tests/seam_studyLoop.test.ts — added introductions:{} to beforeEach reset + new totalEncounters===1 assertion test
Scripts: PASS (tsc 0 errors · 770/770 tests · lint 0 errors)
Audit findings: none — 0 findings (security clean, correctness verified, test assertions behavioral)
WorldClass score: ~98/100 — PASS
Done-when: PASS (both grep conditions hit; seam test passes; gate green)
Fixed this cycle: introduction results now persisted on every card rating; intro cards now surfaced in study queue | Still open: — | New findings: — | Regression signal: NO
CTO diagnosis run: NO — first cycle, clean diff

### Task #053 | Extract duplicate error string literals to named constants | Status: COMPLETE | WorldClass: 96/100 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — /audit standalone invocation
5 parallel agents (A, B, S, N, K) + merge Agent C.
Verdict: CONDITIONAL PASS → 4 blockers fixed inline → PASS
Highest severity: 6 | Blockers resolved: 4
Build approach (minimum fix list):
  - tests/entitlement.test.ts:257,269,411 — `.toContain("not active")` → `.toBe(ERR_LICENSE_NOT_ACTIVE)` (3 assertions, eliminates unused-import lint warning)
  - tests/entitlement.test.ts:283 — `.stringContaining("Activation request failed")` → `.toBe(ERR_ACTIVATE_NETWORK)`
  - tests/entitlement.test.ts:501,509 — `.stringContaining("Deactivation failed")` → `.toBe(ERR_DEACTIVATE_NETWORK)`
  - tests/entitlement.test.ts:396-400 — added `if (r.ok) throw + expect(r.error).toBe("Validation request failed.")` to validateLicense null-path test
  - .autocode/tasks.md:654 — rewrote done condition grep to exclude constant definitions (`return.*"..."` pattern)
Scripts after fixes: PASS (tsc 0, 770/770, lint clean on entitlement)
Done-when: PASS (revised grep returns exit:1; constants + 4 usage sites confirmed)
Debt logged: F3 (5 remaining inline strings in validate/activate), F6 (String(e) key leak risk in deactivate log), F7 (raw res.error to UI in activate/validate), F9 (naming imprecision on ERR_*_NETWORK)
WorldClass: pending
Fixed this cycle: 3 toContain assertions pinned to ERR_LICENSE_NOT_ACTIVE; 3 stringContaining assertions pinned to ERR_*_NETWORK constants; validateLicense null-path test asserts error message; done condition rewritten to be verifiable | Regression signal: NO

#### WorldClass Cycle 1 — 2026-06-28 — COMBINED: 88 (Arch: 88, Vibes: 87) → REMEDIATION
Deductions: BRAND passive voice in ERR_DEACTIVATE_DECLINED (-3 arch); misleading comment (-1 arch); 3 duplicate tests (-3 arch, -2 vibes); raw string literal in F5 fix (.toBe("Validation request failed.")) (-5 arch, -5 vibes); validateLicense zero constants (-3 vibes); 2 activateLicense inline strings (-3 vibes)
Remediation applied:
  - lib/entitlement.ts: comment "Error message constants"; ERR_DEACTIVATE_DECLINED "Deactivation declined."; added ERR_ACTIVATE_NO_VARIANT, ERR_ACTIVATE_NO_KEY, ERR_VALIDATE_NETWORK, ERR_VALIDATE_NULL, ERR_VALIDATE_INACTIVE; used all at call sites
  - tests/entitlement.test.ts: import all 11 constants; .toBe(ERR_ACTIVATE_NO_VARIANT/ERR_ACTIVATE_NO_KEY); .toBe(ERR_VALIDATE_NETWORK/ERR_VALIDATE_NULL); remove 3 duplicate tests; add ERR_VALIDATE_INACTIVE test
  - Debt items F3, F6, F9 resolved within remediation scope

#### WorldClass Cycle 2 — 2026-06-28 — COMBINED: 96 (Arch: 98, Vibes: 92) → PASS
Remaining deductions: activateLicense null-response split weak/strong test pattern (-2 arch, -3 vibes); validateLicense license-key-absent path no error assertion (-5 vibes, sev:5)
Final fixes before close: upgraded activateLicense null-response guard to assert ERR_ACTIVATE_NETWORK + deleted standalone constants describe block; added ERR_LICENSE_NOT_ACTIVE assertion to validateLicense license-key-absent test
Scripts: PASS (tsc 0, 767/767, lint clean) | WorldClass: 96/100 PASS

### Task #049 | Wire introduction engine into study loop | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Full Task (Adam, W1A)
Build approach: app/study/page.tsx — destructured recordIntroductionResult + introductions + getIntroductionDueCardIds from useSRSStore (line 30); passed getIntroductionDueCardIds as 5th arg to buildQueue in initialQueue useMemo (line 51); inlined recordIntroductionResult call in onRate callback guarded by `!r.graduated` check (line 142); tests/seam_studyLoop.test.ts — 5 seam tests added
Scripts: PASS (tsc 0 · 768/768 tests pass)
Spot check: PASS — implementation verified via done-when grep hits (line 30 + 142 for both functions)
Done-when: PASS
Fixed this cycle: — | New findings: none | Regression signal: NO
CTO diagnosis run: NO — stream window (no /task flow)

### Task #053 | Fix StudyCard test quality | Status: COMPLETE | Cycle 1 | Completed: 2026-06-28

#### Cycle 1 — 2026-06-28 — Direct Task (Builder path, inline fix)
Build approach: components/StudyCard.test.tsx:104 — replaced .toBeDefined() with .textContent assertion; added test 7 (lines 124–132) — "il gato" triggers real checkAnswer("close") → asserts container.querySelector(".border-yellow-500") not null + "Quasi! Close enough." text content
Scripts: PASS (tsc 0 · 768/768 · lint clean)
Spot check: PASS — 0 toBeDefined hits confirmed; new test fails if wasClose branch missing
Done-when: PASS
Fixed this cycle: DSC-001 (toBeDefined pseudocode) | New findings: none | Regression signal: NO
CTO diagnosis run: NO — Direct task
