---
agent: architect
last-updated: 2026-06-27
runs: 3
---
# Architecture Agent Memory — plyglt

## Codebase Model (updated)

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Desktop app wrapped in Tauri; web routes served via Next.js App Router.

**Layer structure (top → bottom):**
- `app/` — Route pages (must stay ≤ 150 lines). COMPLIANT after Batch 3: `learn/page.tsx` (127 lines), `study/page.tsx` (148 lines), `settings/page.tsx` (150 lines). VIOLATION: `stats/page.tsx` (243 lines — Task #055).
- `components/` — UI components with co-located `.test.tsx`. New from Batch 3: `UnitRow`, `LevelSection`, `Stat`, `StudyDoneScreen`, `StudyResumePrompt`, `settings/Section`, `settings/Toggle`. Key existing: `StudyCard.tsx`, `EntitlementValidator.tsx`, `InterruptHandler.tsx`.
- `hooks/` — React hooks. New from Batch 3: `useStudySession`, `useExportImport`, `useLicenseActivation`. Key existing: `useLangPack.ts`.
- `store/` — Zustand stores. Key: `srsStore.ts` (14 importers — HIGHEST blast radius as of 2026-06-27; up from 9), `settingsStore.ts`, `entitlementStore.ts`.
- `lib/` — Pure utilities. New from Batch 3: `answerCheck.ts`, `cardLabels.ts`, `exportBackup.ts`, `featureFlags.ts`. Key existing: `srs.ts` (11 importers), `langRegistry.ts` (~12 importers), `storage.ts` (~9 importers), `language.ts` (~9 importers), `packLoader.ts`, `tauri.ts`, `queue.ts`, `entitlement.ts`, `constants.ts`, `licenseTypes.ts`.
- `content/` — Card data and types. Key: `types.ts`.
- `scripts/` — Build tooling (`exportPack.ts`, `validatePack.ts`).
- `public/packs/` — Compiled language pack JSON files.

**Blast-radius ranking (updated 2026-06-27 — highest risk to change):**
1. `store/srsStore.ts` — 14 importers (up from 9 in Batch 3; NEW #1 — flag any interface changes as HIGH risk)
2. `lib/langRegistry.ts` — ~12 importers
3. `lib/srs.ts` — 11 importers
4. `lib/storage.ts` — ~9 importers
5. `lib/language.ts` — ~9 importers
6. `lib/packLoader.ts` — 2 direct, but transitively loaded by every route via `useLangPack.ts`

**Compliant files (confirmed have correct `// =======` headers):** `lib/packLoader.ts`, `lib/storage.ts`, `lib/tauri.ts`, `lib/entitlement.ts`, `lib/langRegistry.ts`, `lib/importBackup.ts`, `store/entitlementStore.ts`, `store/migrations.ts`, `lib/featureFlags.ts` (Batch 3 addition — already compliant at creation).

## Recurring Patterns (updated)

**Oversized route files:** Route pages accumulate business logic and inline components rather than delegating to `hooks/` and `components/`. Batch 3 reduced 3 routes to compliant size. `stats/page.tsx` (243 lines) is the sole remaining violation.

**Silent catch blocks:** Error swallowing pattern found in at least 7 confirmed locations across `lib/`, `hooks/`, and `components/`. Each catch discards the error without logging or surfacing to the user. Violates SCTS Stop-the-Line rule. Partially remediated in Task #001/WorldClass; new instances confirmed in `lib/tauri.ts`, `lib/packLoader.ts`, and `components/InterruptHandler.tsx`.

**Inline data→UI mappings in render:** Dictionaries and classifier functions defined inside the render body rather than as named constants at module scope or in dedicated pure modules. Partially resolved in Batch 3 (study and learn routes). `stats/page.tsx` retains inline color mapping dictionaries (Task #055, Rule 15).

**Missing `// =======` human headers (Rule 2):** 39 files identified (26 pre-Batch 3 + 13 Batch 3 additions). `lib/featureFlags.ts` is the only Batch 3 file that shipped compliant. All tracked under Task #030.

**Brand copy violations (terminology):** UI strings using forbidden terms ("overdue", "due") instead of canonical terms ("ready"). Found in `app/stats/page.tsx` (lines 121, 131) and `components/UnitRow.tsx` (line 82). Tracked under Task #053.

**No test co-location:** Zero route pages have test files. Batch 3 components (`UnitRow`, `LevelSection`, `Stat`, `StudyDoneScreen`, `StudyResumePrompt`, `settings/Section`, `settings/Toggle`) also have no `.test.tsx` siblings. `components/EntitlementValidator.tsx` is the sole compliant component (test added in WorldClass cycle).

## Known Blind Spots (updated)

**Rule 1 compliance audit incomplete during Batch 3:** Line-count compliance was verified for 4 of 5 non-trivial routes (`learn`, `study`, `settings`, `page`). `app/stats/page.tsx` was not checked and shipped at 243 lines undetected. When performing Rule 1 audits, enumerate every file under `app/` explicitly using a directory listing — do not rely on a remembered partial list of routes.

**Blast-radius drift after Batch 3:** `store/srsStore.ts` grew from 9 to 14 importers in a single batch without a corresponding architectural review. Importer counts should be re-verified after any batch that adds or reorganises files.

## Past Findings — Open

| Task | Location | Description |
|------|----------|-------------|
| Task #055 | `app/stats/page.tsx` (243 lines) | Rule 1 violation: route exceeds 150-line limit. Also contains Rule 15 violations: inline color mapping dictionaries defined in render body. |
| Task #053 | `app/stats/page.tsx:121` | BRAND.md violation: UI copy uses "overdue" — must use "ready". |
| Task #053 | `app/stats/page.tsx:131` | BRAND.md violation: UI copy uses "{n}d overdue" — must use "ready". |
| Task #053 | `components/UnitRow.tsx:82` | BRAND.md violation: badge reads "due" — must read "ready". |
| Task #030 | (39 files) | Rule 2: 39 files missing `// =======` human headers. 26 original (including `lib/srs.ts`, `lib/queue.ts`, `lib/language.ts`, `content/types.ts`, `store/srsStore.ts`, `store/settingsStore.ts`, `hooks/useLangPack.ts`, `app/study/page.tsx`, `app/settings/page.tsx`, `app/learn/page.tsx`, `app/stats/page.tsx`, `components/StudyCard.tsx`, and others) plus 13 Batch 3 additions (all Batch 3 files except `lib/featureFlags.ts`). |
| Task #002 — F003 | `hooks/useLangPack.ts:65` | `lang = getLanguageConfig(targetLang)` is unstable object reference in useEffect deps. Infinite re-render for non-static packs masked by static-pack early return on line 43. Latent bug when a second language ships. |
| Task #003 standalone | `lib/packLoader.ts:283` | `writeCacheData`/`writeCacheMeta` no try/catch; `QuotaExceededError` propagates as wrong `"download_failed"` discriminant. |
| — | `lib/tauri.ts:118` | Rule 8: silent catch — error discarded without log or user surface. |
| — | `lib/packLoader.ts:91` | Rule 8: silent catch. |
| — | `lib/packLoader.ts:103` | Rule 8: silent catch. |
| — | `lib/packLoader.ts:139` | Rule 8: silent catch. |
| New Task E | `lib/packLoader.ts:223-226` | Rule 8: silent catch {} block — third occurrence (lines 97–99 and 107–111 are covered separately above). |
| — | `app/settings/page.tsx:49,155,186` | Rule 8: console.error calls missing MODULE_CODE-TIMESTAMP ref ID format — errors not correlatable to user incidents. |
| — | `app/settings/page.tsx:154` | Rule 8: reader.onerror handler discards ProgressEvent — DOMException on target.error never read or logged. |
| — | `app/settings/page.tsx:44-52` | Rule 8: silent background revalidation failure logged but not surfaced to user via licenseStatus update. |
| — (sev:7) | `app/settings/page.tsx:handleActivate:59 + handleValidate:78` | No try/catch around invoke calls. licenseStatus gets stuck in `{type:"loading"}` on error; UI permanently disabled with no user feedback. Stop-the-line violation. |
| — (sev:7) | `app/settings/page.tsx:handleLaunchAtLogin:102` | No try/catch. setLaunchAtLogin fires before Tauri call. If enableAutostart/disableAutostart throws, toggle is already flipped — permanently out of sync with OS, no feedback, no rollback. |
| — (sev:6) | `app/settings/page.tsx:useEffect:44` | licenseKey/instanceId captured from Zustand at mount time. persist middleware may not have hydrated before first render in Next.js App Router. If component mounts before hydration, values are null and revalidation silently never runs. Should use `useEntitlementStore.getState()` inside the effect. |
| — (sev:6) | `app/settings/page.tsx:useEffect:48` | If `markValidated()` throws during torn store state, exception propagates into `.then()` scope and is caught by `.catch()`, logging misleading "Silent license revalidation failed" when root cause is a store mutation error. |
| — (sev:5) | `lib/entitlement.ts:deactivateLicense:105` | catch block uses `String(e)`, discarding stack trace. No `console.error` with `{MODULE}_{CODE}-{TIMESTAMP}` ref ID. Rule 8 violation. |
| — (sev:5) | `app/settings/page.tsx:handleExportBackup:121` | `_version:2` is a magic number — should be `_version: CURRENT_BACKUP_VERSION`. If `CURRENT_BACKUP_VERSION` bumps, exported backups silently stay at version 2. |
| — (sev:4) | `lib/importBackup.ts:93-95 + store/migrations.ts:70` | importBackup coerces unknown licenseType → "free"; migrations coerce unknown → "subscription". Neither file references the other. Developer reading either in isolation cannot infer why the same invalid input produces different outputs. |
| — (sev:3) | `vitest.config.ts:15-18` | Functions coverage threshold set to actual-3%, explicitly permitting three uncovered entitlement functions (S001–S003) to pass CI without error. |
| — | `store/migrations.ts:ENTITLEMENT_MIGRATIONS[2]:67` | Poka-yoke violation: inline untyped `new Set(["free","subscription"])` is a third parallel LicenseType definition. Frozen by migration immutability rule. No TypeScript enforcement. |
| — | `store/migrations.ts:ENTITLEMENT_MIGRATIONS[2]:62` | Comment says "one-time purchase" — perpetuates a deleted pricing concept. Should say "legacy licenseType value from prior app version". |
| — | `store/entitlementStore.ts:80` | persist key "entitlement-v1" does not reflect `ENTITLEMENT_VERSION=2`. Misleading to future developers. Needs a comment explaining the deliberate mismatch. |
| — | `lib/tauri.ts:46,58,64` | Rule 8: `.catch(() => {})` silently swallows Tauri IPC errors. Severity varies by command: `update_tray_badge` (low), `update_interrupt_config` (high). |
| — | `components/InterruptHandler.tsx:29` | Rule 8: `validateLicense` `.then()` has no `.catch()`. Unhandled rejection on IPC error. |
| — | (codebase-wide) | Rule 12 violation: Zero modules expose typed agent tools. |
| — | `components/StudyCard.tsx` | Rule 14: No co-located `.test.tsx`. |
| — | `components/InterruptHandler.tsx` | Rule 14: No co-located `.test.tsx`. |
| — | Batch 3 components | Rule 14: `UnitRow`, `LevelSection`, `Stat`, `StudyDoneScreen`, `StudyResumePrompt`, `settings/Section`, `settings/Toggle` — all missing `.test.tsx` siblings. |
| — | `app/study/page.tsx` | Rule 14: No route test. |
| — | `app/learn/page.tsx` | Rule 14: No route test. |
| — | `app/settings/page.tsx` | Rule 14: No route test. |
| — | `app/stats/page.tsx` | Rule 14: No route test. |
| — | `app/decks/` | Empty directory — owner decided to delete. No files, no routes, no references. Remove the directory. |
| Task #034 AUDIT-001 (sev:2) | `content/types.ts:IntroductionRecord:consecutiveWrongToday` | Field name implies daily reset boundary; BRAND.md rule is "consecutive wrongs in a row" (streak spans calendar days). `recordResult` (#040) must clarify whether this counter resets at midnight or only on correct answers. |
| Task #034 AUDIT-002 (sev:2) | `lib/introduction.ts:MAX_APPEARANCES_BY_PHASE_DAY:8` | `Record<number, number>` types all index accesses as `number` at compile time; runtime returns `undefined` for days 23+. `maxAppearancesToday` (#038) must guard the `day >= 22` case before indexing. |

## Past Findings — Resolved

| Task | Location | Description |
|------|----------|-------------|
| Task #001 | `app/settings/page.tsx:178` | Rule 8: bare catch without binding. Fixed Cycle 2 — catch(e) + console.error added. |
| Task #001 | `app/settings/page.tsx:46` | Rule 8: validateLicense no .catch(). Fixed Cycle 2 — .catch() with logging added. |
| Task #001 | `app/settings/page.tsx:151` | Rule 8: FileReader.onerror never assigned. Fixed Cycle 2 — handler added. |
| Task #001 | `lib/importBackup.ts:parseBackup:92` | VALID_LICENSE_TYPES Set created inside function body on every call. Fixed Cycle 2 — moved to module scope. |
| Task #001 | `lib/entitlement.ts:parseVariant` | isSubscription misleading variable, unlocksAll single-word substring match. Fixed Cycle 2 — variable removed, uses "all languages" multi-word match. |
| Task #001 WorldClass | `lib/entitlement.ts` | Missing `// ===` Rule 2 header. Fixed WorldClass cycle — header with DEPENDS ON / USED BY added. |
| Task #001 WorldClass | `lib/langRegistry.ts` | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | `store/entitlementStore.ts` | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | `lib/importBackup.ts` | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | `store/migrations.ts` | JSDoc header replaced with canonical `// ===` header. Fixed WorldClass cycle. |
| Task #001 WorldClass | `components/EntitlementValidator.tsx` | Rule 14: no co-located `.test.tsx`. Fixed WorldClass cycle — `EntitlementValidator.test.tsx` created with 8 behavioral tests for `runEntitlementValidation`. |
| Task #001 WorldClass | `store/entitlementStore.ts:127,130` | "entitlement-v1" magic string duplicated in persist config. Fixed WC_CYCLE 3 — extracted to `const ENTITLEMENT_STORE_KEY`. |
| Task #001 WorldClass | `lib/entitlement.ts:parseVariant` | LsValidateBody type reused LsActivateBody (lying type). Fixed WorldClass — `LsValidateBody` created as separate type. |
| Task #001 WorldClass | `lib/entitlement.ts` | Missing try/catch on activateLicense invoke call. Fixed WorldClass — `ENTITLEMENT_ACTIVATE_FAIL` ref ID added. |
| Task #001 WorldClass | `lib/licenseTypes.ts` | LicenseType lived in store layer — Rule 3 upward import. Fixed WorldClass — moved to `lib/licenseTypes.ts`, store re-exports. |
| Task #002 (RESOLVED) | `store/srsStore.ts:7 → lib/constants.ts` | Upward import fixed. `LANG_PAIR_KEY`, `getTargetLangCode`, `setTargetLangCode` moved to `lib/constants.ts`. `hooks/useLangPack.ts` re-exports for backward compat. WorldClass 97/100. |
| Task #053 WorldClass | `lib/entitlement.ts:17` | Section comment "Network error messages" was misleading (4 of 6 constants are not network errors). Fixed: renamed to "Error message constants". |
| Task #053 WorldClass | `lib/entitlement.ts:24` | ERR_DEACTIVATE_DECLINED used passive voice ("was declined by the server") — BRAND.md violation. Fixed: "Deactivation declined." |
| Task #053 WorldClass | `lib/entitlement.ts:158,162,182,187,190` | 5 remaining inline error strings not extracted to constants. Fixed: ERR_ACTIVATE_NO_VARIANT, ERR_ACTIVATE_NO_KEY, ERR_VALIDATE_NETWORK, ERR_VALIDATE_NULL, ERR_VALIDATE_INACTIVE added and used at all sites. |
| Task #053 WorldClass | `tests/entitlement.test.ts:272` | activateLicense null-response test asserted only ok:false — split weak-guard + constants-block pattern. Fixed: single strong assertion, redundant describe block deleted. |
| Task #053 WorldClass | `tests/entitlement.test.ts:379` | validateLicense license-key-absent test asserted only ok:false — ERR_LICENSE_NOT_ACTIVE path unpinned. Fixed: assertion added. |
| Task #003 (RESOLVED) | `lib/packLoader.ts` | Validate lang param before use — DONE. |
| Rule 4 (RESOLVED — Batch 3) | (codebase-wide) | No feature flag system existed anywhere. RESOLVED — `lib/featureFlags.ts` created in Batch 3 and ships with compliant Rule 2 header. |
| CTO escalation #3 (RESOLVED 2026-06-27) | `lib/langRegistry.ts:31-33` | fr/de/pt entries used `config: SPANISH` as placeholders; `LANG_CONFIG_MAP` exported without ready filter causing data corruption for all consumers. RESOLVED — stub entries removed from registry. |
| Task #003 standalone (RESOLVED 2026-06-27) | `lib/langRegistry.ts:PackCode:42` | `PackCode` resolved to `string` due to `as string[]` cast. RESOLVED — now `"it" | "es"` literal union. |
| New Task A / Batch 3 (RESOLVED 2026-06-27) | `lib/importBackup.ts:14` | Rule 3 upward violation: utilities layer imported `@/store/migrations` (services layer). RESOLVED — shared type/constant extracted to `lib/`. |
| Batch 3 (RESOLVED) | `app/settings/page.tsx` (509 lines) | Rule 1: 509 lines. RESOLVED — reduced to 150 lines. exportBackup logic extracted to `lib/exportBackup.ts`; Section/Toggle inline components extracted to `components/settings/`. |
| Batch 3 (RESOLVED) | `app/study/page.tsx` (407 lines) | Rule 1: 407 lines. RESOLVED — reduced to 148 lines. Session resume state machine extracted to `hooks/useStudySession.ts`; Stat extracted to `components/`; tierLabel dict moved to module scope. |
| Batch 3 (RESOLVED) | `app/learn/page.tsx` (333 lines) | Rule 1: 333 lines. RESOLVED — reduced to 127 lines. levelMastery/levelUnlocked/currentLevel moved to store selectors; UnitRow classname expression extracted to pure function. |
| Batch 3 (RESOLVED) | `lib/srs.ts` (266 lines) | Rule 1: oversized. RESOLVED — `checkAnswer`, `levenshtein`, and `ITALIAN_ARTICLES` extracted to `lib/answerCheck.ts`, reducing `srs.ts` to ~170 lines. |
| Batch 3 Rule 15 (RESOLVED) | `app/study/page.tsx:310-315` | `tierLabel` dict defined in render body. RESOLVED — moved to module scope in Batch 3 refactor. |
| Batch 3 Rule 15 (RESOLVED) | `app/learn/page.tsx:258-329` | `UnitRow` multi-branch classname expression inline. RESOLVED — extracted to named pure function in Batch 3 refactor. |
| Batch 3 Rule 15 (RESOLVED) | `app/learn/page.tsx:64-71` | `currentLevel` computation inline in component. RESOLVED — moved to store selector in Batch 3 refactor. |
| Batch 3 Rule 15 (RESOLVED) | `app/learn/page.tsx:52-61` | `levelMastery()` closure defined inside component. RESOLVED — moved to store selector in Batch 3 refactor. |
