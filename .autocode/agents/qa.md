---
agent: qa
last-updated: 2026-06-27
runs: 3
---
# QA Agent Memory — plyglt

## Codebase Model

**Test framework:** Vitest 4 with `vi.mock`, `vi.fn`, `vi.spyOn`. Config in `vitest.config.ts`.

**Test locations:** Two locations:
1. `tests/` — flat directory for lib/store/seam tests
2. Co-located `.test.tsx` files inside `components/` and `hooks/` — required by Rule 14; partially implemented as of Batch 3

**Stack:** Next.js 16.2.9, React 19, Zustand 5 (store in `store/`), Tauri 2 (desktop bridge in `lib/tauri.ts`), FSRS v4 scheduler.

**Current test count:** ~515 `it()` calls across ~28 test files (updated 2026-06-27 after Batch 3; prior: 310 across 16 files).

**Coverage baseline (2026-06-27):** Needs re-measurement after Batch 3 additions. Prior baseline (2026-06-26): stmts=83.49%, branches=80.23%, functions=80.82%, lines=85.37%. Thresholds configured in `vitest.config.ts`: lines=81, funcs=75, branches=75, stmts=79 — NOT ratcheted to match actuals (SCTS kaizen violation — Task C pending).

**Skipped tests:** None found (clean).

**Critical paths identified:**
1. `loadPack → buildQueue → rateCard → saveActiveSession` — the full study loop
2. `parseBackup → useSRSStore.setState → getDueCards` — restore path
3. FSRS mathematical invariants over arbitrary inputs (difficulty ∈ [1,10], dueDate ≥ now for non-again, stability monotonicity)
4. `getNewCards` prerequisite gating — gates all content progression
5. Entitlement grant logic — `licenseType` + `unlockedPacks[]` interaction

**Mock quality verified:**
- `vi.mock("@/lib/tauri")` in `entitlement.test.ts` — correct; tests real parsing logic, not mock behavior.
- `fetch`/`crypto` stubs in `packLoader.test.ts` — legitimate environment stubs; SHA-256 verification uses real `node:crypto`.

---

## Test Coverage Map

| Module / File | Test File | Status |
|---|---|---|
| `lib/answerCheck.ts` | `tests/answerCheck.test.ts` | EXISTS — 18 real tests |
| `lib/cardLabels.ts` | `tests/cardLabels.test.ts` | EXISTS — real assertions |
| `lib/exportBackup.ts` | `tests/exportBackup.test.ts` | EXISTS — 7 real tests |
| `lib/featureFlags.ts` | `tests/featureFlags.test.ts` | EXISTS — 7 real tests |
| `lib/storage.ts` | `tests/storage.test.ts` | EXISTS — Tauri branch excluded (documented) |
| `lib/language.ts` | `tests/language.test.ts` | EXISTS — poka-yoke issue RESOLVED (2026-06-27); now asserts `cfg.code === code` with continue guard |
| `lib/srs.ts` | `tests/srs.test.ts` | EXISTS |
| `lib/packLoader.ts` | `tests/packLoader.test.ts` | EXISTS |
| `lib/entitlement.ts` | `tests/entitlement.test.ts` | EXISTS — ok:true paths covered; seam tests added (see Resolved) |
| `hooks/useExportImport.ts` | `hooks/useExportImport.test.ts` | EXISTS — 3 tests; import error branch (ok:false) untested — sev:4 |
| `hooks/useStudySession.ts` | — | NO TEST — sev:7 — Task #056 |
| `hooks/useLicenseActivation.ts` | — | NO TEST — sev:6 — Task #057 |
| `components/UnitRow.tsx` | `components/UnitRow.test.tsx` | EXISTS — 5 real tests |
| `components/Stat.tsx` | `components/Stat.test.tsx` | EXISTS — 5 real tests |
| `components/settings/Toggle.tsx` | `components/settings/Toggle.test.tsx` | EXISTS — 6 real tests |
| `components/StudyCard.tsx` | `components/StudyCard.test.tsx` | EXISTS — missing `wasClose=true` yellow border path — sev:3 — Task #055 |
| `components/EntitlementValidator.tsx` | `components/EntitlementValidator.test.tsx` | EXISTS — 8 tests (WorldClass) |
| `components/LevelSection.tsx` | — | NO CO-LOCATED TEST — sev:3 |
| `components/StudyDoneScreen.tsx` | — | NO CO-LOCATED TEST — sev:3 |
| `components/StudyResumePrompt.tsx` | — | NO CO-LOCATED TEST — sev:3 |
| `components/settings/Section.tsx` | — | NO CO-LOCATED TEST — sev:2 |
| `app/study/page.tsx` | — | NO TEST |
| `app/learn/page.tsx` | — | NO TEST |
| `app/settings/page.tsx` | — | NO TEST |
| `app/stats/page.tsx` | — | NO TEST |
| Seam: parseBackup → getDueCards | `tests/seam_importRestore.test.ts` | EXISTS — 6 thorough tests (CLOSED 2026-06-27) |
| Seam: loadPack → saveActiveSession | `tests/seam_studyLoop.test.ts` + `tests/study_loop.test.ts` | EXISTS — study_loop: 6 FSRS state tests; seam_studyLoop: 4 pipeline integration tests, atomicity verified |
| FSRS invariants (property-based) | — | NO PROPERTY TEST |
| `getNewCards` prerequisite logic | — | NO TEST — `store/srsStore.ts:127-131` uncovered |
| `store/srsStore.ts` prerequisitesMet | — | NO TEST — lines 81-82 uncovered |

---

## Recurring Patterns

**Vacuous assertions:** ZERO instances found in 2026-06-27 audit — all Batch 3 tests use specific value assertions. Pattern remains a watch item for future test writes: `toBeTruthy()` / `toBeFalsy()` on string or object values produces false green; replace with exact assertions.

**Poka-yoke false green:** RESOLVED in `tests/language.test.ts` (2026-06-27). Was: asserting `cfg.code !== "it"` — passed for any non-Italian code, including wrong ones (all returned Spanish config). Fixed: now asserts `cfg.code === code` with continue guard per-language. Lesson: prefer exact positive assertions over negative assertions on shared values.

**Dead weight test files:** `tests/grading.test.ts` DELETED (2026-06-27). Was a strict subset of `tests/srs.test.ts` for `autoRate` with no unique assertions. When a new test file covers the same function as an existing one, check for duplication before expanding.

**Missing atomicity pin:** RESOLVED in `tests/seam_studyLoop.test.ts` (2026-06-27). `rateCard` and `saveActiveSession` now asserted together via `store.subscribe` snapshot verification — no partial-write state between the two calls. Watch for new atomicity gaps as the introduction engine is built.

**Component test absence:** Partially resolved in Batch 3. `UnitRow`, `Stat`, `settings/Toggle`, `StudyCard`, `EntitlementValidator` now have co-located tests. `LevelSection`, `StudyDoneScreen`, `StudyResumePrompt`, `settings/Section` still missing. All future component work must include co-located tests per Rule 14.

**Missing seam tests:** `parseBackup → getDueCards` seam now EXISTS. Watch for new seams introduced by the upcoming introduction engine (new card introduction flow will add at least one new seam).

---

## Known Blind Spots

_(Populated by /patterns after multiple runs.)_

---

## Past Findings — Open

| Task # | Sev | Location | Description |
|---|---|---|---|
| Task #056 | 7 | `hooks/useStudySession.ts` | No test file. Full hook covering session loading, card rating, and session completion untested. |
| Task #057 | 6 | `hooks/useLicenseActivation.ts` | No test file. License activation flow in UI layer untested. |
| Task #055 | 3 | `components/StudyCard.test.tsx` | Missing "close" feedback path: `wasClose=true` → yellow border not covered. BRAND task adds test. |
| — | 4 | `hooks/useExportImport.test.ts` | Import error branch (`ok:false`) untested. Only happy path covered. |
| — | 3 | `components/LevelSection.tsx` | No co-located `LevelSection.test.tsx`. Rule 14 violation. |
| — | 3 | `components/StudyDoneScreen.tsx` | No co-located `StudyDoneScreen.test.tsx`. Rule 14 violation. |
| — | 3 | `components/StudyResumePrompt.tsx` | No co-located `StudyResumePrompt.test.tsx`. Rule 14 violation. |
| — | 2 | `components/settings/Section.tsx` | No co-located `Section.test.tsx`. Rule 14 violation. |
| Task C | — | `vitest.config.ts` | SCTS kaizen violation: coverage thresholds not ratcheted after Batch 3. Must re-measure actuals, then ratchet thresholds to current actuals. Current configured thresholds: lines=81, funcs=75, branches=75, stmts=79. |
| — | — | `store/srsStore.ts:81-82` | `prerequisitesMet` lines 81-82 uncovered. Gates card access; branch logic untested. |
| — | — | `store/srsStore.ts:127-131` | `getNewCards` lines 127-131 uncovered. Controls new card introduction; prerequisite gating branch untested. |
| — | — | FSRS property tests | No property-based FSRS invariant tests. Mathematical invariants (difficulty ∈ [1,10], dueDate ≥ now for non-again, stability monotonicity) not validated over arbitrary inputs. |
| — | 7 | `lib/entitlement.ts:parseVariant:53` + `validateLicense:94` | Invalid `expires_at` string produces `NaN` stored as `validUntil`. `Date.now() > NaN + TTL` is always false → subscription never expires → permanent access. `importBackup.ts` uses `isFinite()` guard; `entitlement.ts` does not. |
| — | 7 | `lib/entitlement.ts:parseVariant:52` | Fallback hardcodes `["it"]` instead of `[...FREE_PACK_CODES]` (already imported). Second free language addition would leave single-language variant holders Italian-only. |
| — | 7 | `lib/entitlement.ts:activateLicense:74` | `res.meta` not guarded against undefined. `LsActivateBody` declares `meta:LsMeta` as non-optional but value is cast from `unknown`. Malformed LS response without `meta` throws `TypeError` as unhandled rejection. |
| — | 6 | `store/entitlementStore.ts:isPackUnlocked:63` | Post-migration lifetime users receive indefinite access. Former lifetime users have `validUntil:null`; expiry guard only fires when `validUntil !== null`. Business intent unverified by any test. |
| — | 6 | `tests/migrations.test.ts:67` | Migration v2 direct-call with non-string `licenseType` (e.g. numeric 42 from JSON corruption) has zero test. `typeof 42 !== "string"` → defaults to "free". Behavior correct but branch untested. |
| — | 4 | `app/settings/page.tsx:320-322` | "renews" copy is factually wrong for cancelled subscriptions. `validUntil` is billing period end, not a renewal promise. Should say "expires" or "active until." |
| — | 4 | `app/settings/page.tsx:213,215` | BRAND.md voice violations: "Enable study reminders" (study → review), "Get reminded to study when cards are due" (study → review; are due → are ready). |
| — | 3 | `tests/entitlement.test.ts:270-284` | Test cases named "Italian Lifetime variant" and "All Languages Lifetime variant" have no comment clarifying these are legacy migration tests. Future developers may assume lifetime variants are still supported. |
| — | — | BRAND.md compliance | Voice violations outside Task #001 scope: `lib/language.ts:58-59,81` (exclamation marks in correctFeedback/closeFeedback), `components/StudyCard.tsx:177` ("Not quite." — prohibited), `app/study/page.tsx:158,246,263` (exclamation marks in completion headings), `app/stats/page.tsx:121,131` ("overdue" in user-visible text — explicitly prohibited). |
| — | — | `lib/entitlement.ts:parseVariant:51` | No tests for `includes("annual")` matching "semiannual"/"biannual" or `includes("monthly")` matching "bimonthly". A variant rename silently downgrades all-language buyers to Italian only. |

---

## Past Findings — Resolved

| Resolved | Location | Description |
|---|---|---|
| Batch 3 / 2026-06-27 | `tests/language.test.ts:206-211` | Poka-yoke false green: was asserting `cfg.code !== "it"` (any non-Italian code passed). Fixed: now asserts `cfg.code === code` with continue guard per-language. |
| Batch 3 / 2026-06-27 | `tests/language.test.ts:196` | Vacuous `toBeTruthy()` on card label string. Fixed alongside poka-yoke fix — exact value assertions now used. |
| Batch 3 / 2026-06-27 | `tests/grading.test.ts` | Dead weight file: strict subset of `tests/srs.test.ts` for `autoRate` with no unique assertions. File deleted — no unique assertions lost. |
| Batch 3 / 2026-06-27 | `tests/seam_importRestore.test.ts` | No seam test for `parseBackup → useSRSStore.setState → getDueCards`. File now exists with 6 thorough tests — restored state validated against SRS engine. |
| Batch 3 / 2026-06-27 | `tests/entitlement.test.ts` | `activateLicense` ok:true path (sev:8) entirely untested. Fixed: S001 test added with specific field assertions covering the success branch of the primary business function. |
| Batch 3 / 2026-06-27 | `tests/entitlement.test.ts` | Entitlement bypass variant untested: no test for `unlockedPacks[]` alone without valid `licenseType`. Fixed: `isPackUnlocked` with free `licenseType` + `unlockedPacks` now tested. |
| Batch 3 / 2026-06-27 | `tests/migrations.test.ts` | `storedVersion=1` path (v1→v2 real-world upgrade for existing users) had zero coverage. Fixed: test for `migrateEntitlementStore({licenseType:"lifetime",...}, 1)` → `licenseType:"subscription"` added. |
| Batch 3 / 2026-06-27 | `tests/seam_studyLoop.test.ts` | `rateCard` and `saveActiveSession` never asserted together. Fixed: seam test uses `store.subscribe` snapshot verification — no partial-write state between the two calls. |
| Task #001 WorldClass | `tests/entitlement.test.ts` | `validateLicense` ok:true path entirely untested (sev:8). Fixed: ok:true tests added including null-expiry case and struct-guard (valid:true + non-active status). |
| Task #001 WorldClass | `tests/entitlement.test.ts` | `deactivateLicense` 100% uncovered (sev:8). Fixed: ok:true, ok:false (API error, null-error fallback), throw path all covered. |
| Task #001 WorldClass | `tests/entitlement.test.ts:281` | `unlockedPacks` weak `.length > 1` / `.toContain` assertions. Fixed: exact array equality with `[...ALL_PACK_CODES].sort()`. |
| Task #053 WorldClass | `tests/entitlement.test.ts` | 3 duplicate pinning tests in "error message constants" describe block. Fixed: block reduced to 1 genuinely additive test, then that test merged into the main null safety describe block as a strong assertion. |
| Task #053 WorldClass | `tests/entitlement.test.ts:379` | validateLicense license-key-absent path asserted ok:false only — ERR_LICENSE_NOT_ACTIVE unpinned. Fixed: full constant assertion added. |
| Task #053 WorldClass | `tests/entitlement.test.ts` | `.toContain("variant")` and `.toContain("license key")` weak assertions for activateLicense struct paths. Fixed: upgraded to `.toBe(ERR_ACTIVATE_NO_VARIANT)` and `.toBe(ERR_ACTIVATE_NO_KEY)`. |
| Task #053 WorldClass | `tests/entitlement.test.ts` | validateLicense catch and null-path assertions using stringContaining / raw string. Fixed: `.toBe(ERR_VALIDATE_NETWORK)` and `.toBe(ERR_VALIDATE_NULL)`. |
| Task #001 WorldClass | `tests/migrations.test.ts:14-25` | Version constant range checks instead of exact values. Fixed: `expect(ENTITLEMENT_VERSION).toBe(2)` exact assertions. |
| Task #001 WorldClass | `tests/entitlement.test.ts` | `validateLicense → markValidated → isPackUnlocked` seam test missing. Fixed: seam test covers full renewal path (expired → locked → validate → markValidated → unlocked). |
| Task #001 WorldClass | `tests/entitlement.test.ts` | `touchValidated` direct unit test missing. Fixed: test asserts `lastValidated` updates while `validUntil` unchanged. |
| Task #001 WorldClass | `components/EntitlementValidator.test.tsx` | No co-located test file (Rule 14). Fixed: 8 tests created covering all branches of `runEntitlementValidation` including ok:false `touchValidated` and throw/catch paths. |
| Task #001 | `tests/migrations.test.ts:101` | Test asserted "lifetime" preserved through migration — codified the bug. Fixed: now asserts "lifetime"→"subscription". Round-trip tests for "free" and "subscription" added. |
| Task #001 | `tests/entitlement.test.ts` | Lifetime test cases present. Fixed: replaced with BRAND.md compliance block. |
