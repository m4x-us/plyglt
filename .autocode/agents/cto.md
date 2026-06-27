---
agent: cto
last-updated: 2026-06-26
meets: 2
---
# CTO Memory — plyglt

## Strategic Priorities
(From owner answers — updated 2026-06-26)

1. **Finish Batch 1 before any new sprints** — Owner confirmed 2026-06-26: complete all Batch 1 tasks before any new feature work, content completion, or Pro feature additions. No introduction engine sprint, no curriculum push, no Pro feature until Batch 1 is fully closed.
2. **Security + Correctness together in Batch 1** — HIGH security bugs and Wave 1 SRS correctness fixes are treated as the same category. No distinction between "security sprint" and "correctness sprint."
3. **BRAND.md is authoritative** — Lifetime entitlement code is dead and should be deleted. Any future entitlement work must check BRAND.md first.
4. **BRAND violations (overdue/emojis/exclamation) wait for Batch 3 refactors** — Owner confirmed 2026-06-26: these are real violations but are not surgical Batch 1 fixes. They will be addressed when the route files are fully refactored in Batch 3.
5. **Client-only entitlement is intentional** — Honor-system model for offline-first is an accepted trade-off. Do NOT propose server-side verification architectures unless owner re-opens this decision.
6. **Fresh task numbering** — Prior Wave 1 (#1–#13) and Batch D/D2 naming are superseded. `.autocode/tasks.md` is now canonical. Do not reference old naming.
7. **Content generation is a separate track** — Missing 68 curriculum units are not engineering tasks. Task list covers code only.

## Team Health

### Agent Performance
| Agent | Runs | Audit Reject Rate | Known Blind Spots | Last Updated |
|-------|------|-------------------|-------------------|--------------|
| security | 2 | — | Did not catch CONTRIBUTING_LANGUAGE.md lifetime refs in Task #001 scope | 2026-06-26 |
| architect | 2 | — | Missed lib/importBackup.ts upward import in run 1; packLoader:223-226 silent catch not caught in run 1 | 2026-06-26 |
| qa | 2 | — | Task #056 misattributed to srsStore.test.ts — actually lib/constants.ts | 2026-06-26 |
| docs | 2 | — | none recorded yet | 2026-06-26 |

### Quality Trends
| Task | WorldClass Score | Tests at Close | Coverage at Close |
|------|-----------------|----------------|-------------------|
| #001 | 98/100 (5 audits + 4 WC cycles) | 303 | stmts=80.3%, funcs=76.15% |
| #002 | 97/100 | 310 | stmts=80.3%, funcs=76.15% |
| #003 | 98/100 (REOPENED — sub-tasks #059-#070) | 310 | stmts=80.3%, funcs=76.15% |

**Current baseline (2026-06-26):**
Tests: 310 | stmts=83.49% | branches=80.23% | functions=80.82% | lines=85.37%
Thresholds: lines=81, funcs=75, branches=75, stmts=79 (SCTS kaizen violation — not ratcheted after improvement; new task added)

### WorldClass Trend
Run 1 → Task #001: 70/100 (MAX_CYCLES) → 83/100 (+13 after re-run) → 93/100 → 98/100
Run 2 → Task #002: 97/100
Run 3 → Task #003: 98/100 (REOPENED on product grounds, not quality)

## Open Escalations

1. ~~**Persisted "lifetime" store values after Task #001**~~ — **RESOLVED (Task #001 Cycle 2):** ENTITLEMENT_VERSION bumped to 2. v2 migration coerces unknown licenseType to "subscription" — old lifetime users keep access, now go through proper expiry code path.

2. **Sentence generator go/no-go** — BRAND.md flags this as "under evaluation." No task created. If approved, it becomes Batch 3 or later work.

3. **Language stub inheritance** — `lib/langRegistry.ts` has fr/de/pt pointing to SPANISH config. When French/German/Portuguese packs ship, which config should they inherit from? Decision needed before those packs are scaffolded.

4. **ALL_PACK_CODES vs READY_PACK_CODES split (Task #068)** — Should the loadPack guard validate against all registered pack codes (including `ready: false` packs) or only packs that are actually ready to download? Task #068 is blocked on this decision. Current behavior: guard passes for es/fr/de/pt but CDN rejects. If early rejection is desired, a READY_PACK_CODES subset is needed.

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

## Task Cycle Log

| Date | Batch | Tasks Completed | WorldClass Score | Notes |
|------|-------|-----------------|------------------|-------|
| 2026-06-24 | /meet run #1 | 0/33 | — | Initial onboarding. 33 tasks generated across 4 batches. |
| 2026-06-25 | Batch 1 | 2/70 (#001, #002 COMPLETE; #003 REOPENED) | avg 97.7/100 | 70 tasks across 6 batches after Task #003 re-audit. Task #009 also resolved (no /task cycle — resolved during #001 work). |
| 2026-06-26 | /meet run #2 | 0 new since last /meet | — | 6 new tasks added (#071-#076 approx), 1 task confirmed RESOLVED (#009). CONTRIBUTING_LANGUAGE.md gap found — new Batch 4 task. |

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
