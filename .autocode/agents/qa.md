---
agent: qa
last-updated: 2026-06-26
runs: 2
---
# QA Agent Memory — plyglt

## Codebase Model

**Test framework:** Vitest 4 with `vi.mock`, `vi.fn`, `vi.spyOn`. Config in `vitest.config.ts`.

**Test locations:** All tests live under `tests/` (flat, not co-located). The project's Rule 14 requires co-located `.test.tsx` files for components — none currently exist; all component tests are absent.

**Stack:** Next.js 16.2.9, React 19, Zustand 5 (store in `store/`), Tauri 2 (desktop bridge in `lib/tauri.ts`), FSRS v4 scheduler.

**Current test count:** 310 `it()` calls across 16 test files (updated 2026-06-26; new file: `tests/study_loop.test.ts` with 6 tests added this session).

**Coverage baseline (2026-06-26):** stmts=83.49%, branches=80.23%, functions=80.82%, lines=85.37%. Thresholds configured in `vitest.config.ts` but NOT ratcheted to match actuals (SCTS kaizen violation — see Task C below).

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
| `lib/storage.ts` | — | NO TEST — gap (42.42% stmts, Task F) |
| `lib/language.ts` | `tests/language.test.ts` | Exists; has quality issues (see Findings #2, #3) |
| `lib/srs.ts` | `tests/srs.test.ts` | Exists |
| `lib/grading.ts` | `tests/grading.test.ts` | Exists; dead weight (strict subset of srs.test.ts, Finding #10) |
| `lib/packLoader.ts` | `tests/packLoader.test.ts` | Exists |
| `lib/entitlement.ts` | `tests/entitlement.test.ts` | Exists; bypass variant missing (Finding #9) |
| `components/StudyCard.tsx` | — | NO TEST — Rule 14 violation |
| `components/EntitlementValidator.tsx` | — | NO TEST — Rule 14 violation |
| `components/InterruptHandler.tsx` | — | NO TEST — Rule 14 violation |
| `app/study/page.tsx` | — | NO TEST |
| `app/learn/page.tsx` | — | NO TEST |
| `app/settings/page.tsx` | — | NO TEST |
| `app/stats/page.tsx` | — | NO TEST |
| Seam: loadPack → saveActiveSession | `tests/study_loop.test.ts` + `tests/seam_studyLoop.test.ts` | EXISTS — study_loop: 6 FSRS state tests; seam_studyLoop: 4 pipeline integration tests (buildQueue→rateCard→saveActiveSession, atomicity pin) added 2026-06-27 |
| Seam: parseBackup → getDueCards | — | NO SEAM TEST |
| FSRS invariants (property-based) | — | NO PROPERTY TEST |
| `getNewCards` prerequisite logic | — | NO TEST — `store/srsStore.ts:127-131` uncovered |
| `store/srsStore.ts` prerequisitesMet | — | NO TEST — lines 81-82 uncovered |

---

## Recurring Patterns

**Vacuous assertions:** `toBeTruthy()` used on string values instead of asserting exact content. Produces false green — any non-empty string passes. Pattern seen in `tests/language.test.ts`. Scan all test files for `toBeTruthy()` / `toBeFalsy()` on string or object values and replace with exact assertions.

**Poka-yoke tests that do not guard what they claim:** A test asserts `cfg.code !== "it"` to verify non-Italian fallback, but multiple non-Italian codes all return the same wrong config (code `"es"`), so the assertion passes even when the function is broken. Pattern: negative assertions on shared wrong values can mask bugs. Prefer `cfg.code === expectedCode`.

**Dead weight test files:** `tests/grading.test.ts` is a strict subset of `tests/srs.test.ts` — no unique assertions. When a new test file is added that covers the same function as an existing file, check for duplication before expanding.

**Missing atomicity pin:** `rateCard` and `saveActiveSession` are never asserted together. Any test of SRS state mutation should also assert the persistence call, or the crash-safety contract is unverifiable.

**Component test absence:** No `.test.tsx` files co-located with any component. This is a systematic gap, not one-off. All future component work should include co-located tests per Rule 14.

---

## Known Blind Spots

_(Populated by /patterns after multiple runs.)_

---

## Past Findings — Open

| Task # | Location | Description |
|---|---|---|
| Batch 2, Task #014 | `lib/storage.ts` | No test file. `createPlatformStorage` (localStorage + Tauri branches) and `useIsHydrated` hook untested. |
| Batch 2, Task #015 | `components/StudyCard.tsx` | No co-located `StudyCard.test.tsx`. Rule 14 violation. |
| Batch 2, Task #016 | `components/EntitlementValidator.tsx` | No co-located test file. Rule 14 violation. |
| Batch 2, Task #017 | `components/InterruptHandler.tsx` | No co-located test file. Rule 14 violation. |
| Batch 2, Task #018 (HIGH) | `tests/language.test.ts:206-211` | Poka-yoke false green: asserts `cfg.code !== "it"` but fr/de/pt all return Spanish config (code `"es"`), so assertion passes even when function returns wrong config. Must assert `cfg.code === code`. |
| Batch 2, Task #019 | `tests/language.test.ts:196` | Vacuous assertion: `toBeTruthy()` on a card label string. Should assert exact value (`cfg.code === code` or exact string). |
| Batch 2, Task #020 (RESOLVED 2026-06-27) | `tests/seam_studyLoop.test.ts` | Seam test created: 4 tests covering buildQueue→rateCard→saveActiveSession pipeline with real cards, no intermediate mocks. Atomicity verified via store.subscribe. |
| Batch 1, Task #013 + Batch 2 (RESOLVED 2026-06-27) | `tests/seam_studyLoop.test.ts:atomicity` | `rateCard` and `saveActiveSession` now asserted together in seam test — subscribe captures snapshots, verifies no partial-write state exists. |
| Batch 2, Task #021 (HIGH) | — | No seam test for `parseBackup → useSRSStore.setState → getDueCards`. Restored state not validated against SRS engine. |
| Batch 2, Task #022 | — | No property-based FSRS invariant tests. Mathematical invariants (difficulty ∈ [1,10], dueDate ≥ now for non-again, stability monotonicity) not validated over arbitrary inputs. |
| Batch 2, Task #023 | — | `getNewCards` prerequisite logic untested. No test verifies cards with unmet prerequisites are withheld and released when met. Gates all content progression. |
| Batch 2, Task #024 | — | Entitlement bypass variant untested: no test verifies that `unlockedPacks[]` alone without valid `licenseType` confers nothing. |
| Batch 2, Task #025 | `tests/grading.test.ts` | Dead weight: strict subset of `tests/srs.test.ts` for `autoRate`. No unique assertions. Should be removed or expanded with distinct cases. |
| — | `tests/migrations.test.ts:migrateEntitlementStore:101` | No test for `storedVersion=1` path — `migrateEntitlementStore(data, 1)` (v1→v2 only) is the real-world upgrade path for existing users and has zero coverage. Add: `migrateEntitlementStore({licenseType:"lifetime",...}, 1)` → `licenseType:"subscription"`. |
| — | `lib/entitlement.ts:parseVariant:51` | No tests for `includes("annual")` matching "semiannual"/"biannual" or `includes("monthly")` matching "bimonthly". Store operator controls LS variant names but a rename silently downgrades all-language buyers to Italian only. |
| — | BRAND.md compliance | BRAND.md voice violations found in files outside Task #001 scope: `lib/language.ts:58-59,81` (exclamation marks in correctFeedback/closeFeedback), `components/StudyCard.tsx:177` ("Not quite." — prohibited), `app/study/page.tsx:158,246,263` (exclamation marks in completion headings), `app/stats/page.tsx:121,131` ("overdue" in user-visible text — explicitly prohibited by BRAND.md). |
| — (Standalone Audit 3, sev:8) | `tests/entitlement.test.ts` / `lib/entitlement.ts:63-78` | `activateLicense` ok:true path entirely untested. Success branch (parseVariant call + return {ok:true,...}) has zero coverage. Happy path of primary business function uncovered. |
| — (Standalone Audit 3, sev:8) | `tests/entitlement.test.ts` / `lib/entitlement.ts:84-96` | `validateLicense` ok:true path entirely untested. Lines returning {ok:true, validUntil} have zero coverage. |
| — (Standalone Audit 3, sev:8) | `tests/entitlement.test.ts` / `lib/entitlement.ts:101-108` | `deactivateLicense` 100% uncovered. Every line (try, invoke, return ok:true, catch return ok:false) untested. |
| — (Standalone Audit 3, sev:7) | `lib/entitlement.ts:parseVariant:53` + `validateLicense:94` | Invalid `expires_at` string produces `NaN` stored as `validUntil`. `Date.now() > NaN + TTL` is always false → subscription never expires → permanent access. `importBackup.ts` uses `isFinite()` guard; `entitlement.ts` does not. |
| — (Standalone Audit 3, sev:7) | `lib/entitlement.ts:parseVariant:52` | Fallback hardcodes `["it"]` instead of `[...FREE_PACK_CODES]` (already imported). Second free language addition would leave single-language variant holders Italian-only. |
| — (Standalone Audit 3, sev:7) | `lib/entitlement.ts:activateLicense:74` | `res.meta` not guarded against undefined. `LsActivateBody` declares `meta:LsMeta` as non-optional but value is cast from `unknown`. Malformed LS response without `meta` throws `TypeError` as unhandled rejection. |
| — (Standalone Audit 3, sev:6) | `store/entitlementStore.ts:isPackUnlocked:63` | Post-migration lifetime users receive indefinite access. Former lifetime users have `validUntil:null`; expiry guard only fires when `validUntil !== null`. Business intent unverified by any test. |
| — (Standalone Audit 3, sev:6) | `tests/migrations.test.ts:14-25` | Version constant tests use range checks (`Number.isInteger(x) && x > 0`) not exact values. ENTITLEMENT_VERSION left at 1 would pass. Should assert `expect(ENTITLEMENT_VERSION).toBe(2)`. |
| — (Standalone Audit 3, sev:6) | `tests/entitlement.test.ts:281-284,307` | `unlockedPacks` assertions use `.length > 1` and `.toContain` not exact equality. Function returning two packs when five expected would pass. |
| — (Standalone Audit 3, sev:6) | `tests/migrations.test.ts:67` | Migration v2 direct-call with non-string `licenseType` (e.g. numeric 42 from JSON corruption) has zero test. `typeof 42 !== "string"` → defaults to "free". Behavior correct but branch untested. |
| — (Standalone Audit 3, sev:4) | `app/settings/page.tsx:320-322` | "renews" copy is factually wrong for cancelled subscriptions. App does not know if user cancelled. `validUntil` is billing period end, not a renewal promise. Should say "expires" or "active until." |
| — (Standalone Audit 3, sev:4) | `app/settings/page.tsx:213,215` | BRAND.md voice violations in Task #001 scope: "Enable study reminders" (study → review), "Get reminded to study when cards are due" (study → review; are due → are ready). |
| — (Standalone Audit 3, sev:3) | `tests/entitlement.test.ts:270-284` | Test cases named "Italian Lifetime variant" and "All Languages Lifetime variant" have no comment explaining these are legacy migration tests. Future developers may think lifetime variants are supported. |
| Task #056 (F002) | `lib/constants.ts:setTargetLangCode:24-26` | `setTargetLangCode` has no test. Note: **function lives in `lib/constants.ts` not `store/srsStore.ts`** (location corrected 2026-06-26). `getTargetLangCode` received 4 tests in same commit — asymmetry unexplained. `lib/constants.ts` overall at 57.14% stmt coverage; lines 25-26 uncovered. |
| Task C | `vitest.config.ts` | SCTS kaizen violation: coverage thresholds not ratcheted after improvement. Current actuals: lines=85.37%, funcs=80.82%, branches=80.23%, stmts=83.49%. Thresholds must be ratcheted to lines=84, funcs=79, branches=79, stmts=82 to prevent silent regression. |
| Task F (Batch 2) | `lib/storage.ts` | 42.42% stmt coverage. No dedicated test file. `createPlatformStorage` (localStorage + Tauri branches) and `useIsHydrated` hook untested. Supercedes the earlier gap entry in this table (Task #014 row). |
| — | `store/srsStore.ts:81-82` | `prerequisitesMet` lines 81-82 uncovered. Gates card access; branch logic untested. |
| — | `store/srsStore.ts:127-131` | `getNewCards` lines 127-131 uncovered. Controls new card introduction; prerequisite gating branch untested. |

---

## Past Findings — Resolved

| Task | Location | Description |
|------|----------|-------------|
| Task #001 | tests/migrations.test.ts:101 | Test asserted "lifetime" preserved through migration — codified the bug. Fixed Cycle 2: now asserts "lifetime"→"subscription". Round-trip tests for "free" and "subscription" added. |
| Task #001 | tests/entitlement.test.ts | Lifetime test cases present. Fixed Cycle 1: replaced with BRAND.md compliance block. |
| Task #001 WorldClass | tests/entitlement.test.ts | activateLicense ok:true path entirely untested (sev:8). Fixed WorldClass — ok:true, all ok:false branches, null/missing instance path, and three seam tests added. 303 tests total. |
| Task #001 WorldClass | tests/entitlement.test.ts | validateLicense ok:true path entirely untested (sev:8). Fixed WorldClass — ok:true tests added including null-expiry case and struct-guard (valid:true + non-active status). |
| Task #001 WorldClass | tests/entitlement.test.ts | deactivateLicense 100% uncovered (sev:8). Fixed WorldClass — ok:true, ok:false (API error, null-error fallback), throw path all covered. |
| Task #001 WorldClass | tests/entitlement.test.ts:281 | unlockedPacks weak `.length > 1` assertions. Fixed WorldClass — exact array equality with `[...ALL_PACK_CODES].sort()`. |
| Task #001 WorldClass | tests/migrations.test.ts:14-25 | Version constant range checks instead of exact values. Fixed WorldClass — `expect(ENTITLEMENT_VERSION).toBe(2)` exact assertions. |
| Task #001 WorldClass | tests/entitlement.test.ts | validateLicense→markValidated→isPackUnlocked seam test missing. Fixed WorldClass — seam test added covering full renewal path (expired → locked → validate → markValidated → unlocked). |
| Task #001 WorldClass | tests/entitlement.test.ts | touchValidated direct unit test missing. Fixed WorldClass — test asserts lastValidated updates while validUntil unchanged. |
| Task #001 WorldClass | components/EntitlementValidator.test.tsx | No co-located test file (Rule 14). Fixed WorldClass — 8 tests created testing all branches of runEntitlementValidation including ok:false touchValidated and throw catch paths. |
