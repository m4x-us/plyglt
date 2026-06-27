---
agent: architect
last-updated: 2026-06-26
runs: 2
---
# Architecture Agent Memory — plyglt

## Codebase Model

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Desktop app wrapped in Tauri; web routes served via Next.js App Router.

**Layer structure (top → bottom):**
- `app/` — Route pages (must stay ≤ 150 lines). Currently: `learn/page.tsx`, `study/page.tsx`, `settings/page.tsx`, `stats/`, `layout.tsx`, `page.tsx`
- `components/` — UI components with co-located `.test.tsx` (currently missing). Key: `StudyCard.tsx`, `EntitlementValidator.tsx`, `InterruptHandler.tsx`
- `hooks/` — React hooks. Key: `useLangPack.ts` (transitively loaded by every route via packLoader)
- `store/` — Zustand stores. Key: `srsStore.ts` (9 importers), `settingsStore.ts`, `entitlementStore.ts`
- `lib/` — Pure utilities. Key: `srs.ts` (11 importers — highest blast radius), `storage.ts` (7 importers), `language.ts` (6 importers), `packLoader.ts` (2 direct, transitively loaded everywhere), `tauri.ts`, `queue.ts`, `entitlement.ts`, `langRegistry.ts`, `importBackup.ts`
- `content/` — Card data and types. Key: `types.ts`
- `scripts/` — Build tooling (`exportPack.ts`, `validatePack.ts`)
- `public/packs/` — Compiled language pack JSON files

**Blast-radius ranking (highest risk to change):**
1. `lib/srs.ts` — 11 importers
2. `lib/langRegistry.ts` — 10 importers (updated 2026-06-26; previously ranked below storage.ts)
3. `store/srsStore.ts` — 9 importers
4. `lib/storage.ts` — 7 importers
5. `lib/language.ts` — 6 importers
6. `lib/packLoader.ts` — 2 direct, but transitively loaded by every route via `useLangPack.ts`

**Compliant files (confirmed have correct `// =======` headers):** `lib/packLoader.ts`, `lib/storage.ts`, `lib/tauri.ts`

## Recurring Patterns

**Oversized route files:** Route pages accumulate business logic and inline components rather than delegating to `hooks/` and `components/`. Found in all three non-trivial routes. Pattern: logic that belongs in a store selector or hook is written as a closure inside the component body.

**Silent catch blocks:** Error swallowing pattern found in at least 5 locations across `lib/` and `hooks/`. Each catch discards the error without logging or surfacing to the user. Violates SCTS Stop-the-Line rule.

**Inline data→UI mappings in render:** Dictionaries and classifier functions defined inside the render body rather than as named constants at module scope or in dedicated pure modules. Found in `app/study/page.tsx` and `app/learn/page.tsx`.

**Missing `// =======` human headers:** 15 of 18 audited files are non-compliant. The three compliant files share a pattern — they are the utility/adapter files in `lib/` that were written earliest. All store, hook, component, and non-trivial lib files are missing headers.

**Upward import violation (RESOLVED Task #002):** `store/srsStore.ts` imported from `hooks/useLangPack.ts`. Fixed: `LANG_PAIR_KEY`, `getTargetLangCode`, `setTargetLangCode` extracted to `lib/constants.ts`. `hooks/useLangPack.ts` re-exports for backward compat. All consumers updated.

**No test co-location:** Zero components or route pages have `.test.tsx` siblings. The test gap is total across `components/` and `app/`.

## Known Blind Spots

[Leave empty — populated by /patterns after multiple runs]

## Past Findings — Open

| Task | Location | Description |
|------|----------|-------------|
| Task #002 (RESOLVED) | store/srsStore.ts:7 → lib/constants.ts | Upward import fixed. LANG_PAIR_KEY/getTargetLangCode/setTargetLangCode moved to lib/constants.ts. WorldClass 97/100. |
| Task #002 — F003 | hooks/useLangPack.ts:useLangPack:65 | `lang = getLanguageConfig(targetLang)` is unstable object reference in useEffect deps. Infinite re-render for non-static packs masked by static-pack early return on line 43. Latent bug when second language ships. |
| Task #003 (RESOLVED) | lib/packLoader.ts | Validate lang param before use — DONE |
| Task #003 standalone re-audit | lib/langRegistry.ts:PackCode:42 | `PackCode` resolves to `string` due to `as string[]` cast; derive from `typeof LANGUAGE_REGISTRY[number]["code"]` for proper union type |
| Task #003 standalone re-audit | lib/packLoader.ts:loadPack:283 | `writeCacheData`/`writeCacheMeta` no try/catch; `QuotaExceededError` propagates as wrong `"download_failed"` discriminant |
| CTO escalation #3 (pre-existing) | lib/langRegistry.ts:31-33 | fr/de/pt entries use `config: SPANISH` as placeholders; `LANG_CONFIG_MAP` exported without ready filter — data corruption for all consumers querying these codes |
| Batch 3 | app/settings/page.tsx (509 lines) | Extract export/backup logic (lines 114–185) → `lib/exportBackup.ts`; extract Section/Toggle inline components (lines 465–509) → `components/settings/` |
| Batch 3 | app/study/page.tsx (407 lines) | Extract session resume state machine (lines 60–119) → `hooks/useStudySession.ts`; extract Stat inline component (lines 382–399) → `components/`; move `tierLabel` dict (lines 310–315) to module scope |
| Batch 3 | app/learn/page.tsx (333 lines) | Move `levelMastery()`/`levelUnlocked()`/`currentLevel` (lines 52–71) → `store/srsStore.ts` selectors; replace inline `UnitRow` classname expression (lines 258–329) with named pure function |
| Batch 3 | lib/srs.ts (266 lines) | Extract `checkAnswer` + `levenshtein` + `ITALIAN_ARTICLES` → `lib/answerCheck.ts` (reduces srs.ts to ~170 lines) |
| Batch 4 | lib/srs.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | lib/queue.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | lib/language.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | lib/entitlement.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | lib/langRegistry.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | lib/importBackup.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | content/types.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | store/srsStore.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | store/settingsStore.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | store/entitlementStore.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | hooks/useLangPack.ts | Missing `// =======` human header (Rule 2) |
| Batch 4 | app/study/page.tsx | Missing `// =======` human header (Rule 2) |
| Batch 4 | app/settings/page.tsx | Missing `// =======` human header (Rule 2) |
| Batch 4 | app/learn/page.tsx | Missing `// =======` human header (Rule 2) |
| Batch 4 | components/StudyCard.tsx | Missing `// =======` human header (Rule 2) |
| — | (codebase-wide) | Rule 4 violation: No feature flag system exists anywhere |
| — | lib/tauri.ts:118 | Rule 8 violation: Silent catch — error discarded without log or user surface |
| — | lib/packLoader.ts:91 | Rule 8 violation: Silent catch |
| — | lib/packLoader.ts:103 | Rule 8 violation: Silent catch |
| — | lib/packLoader.ts:139 | Rule 8 violation: Silent catch |
| Task #002 (RESOLVED) | hooks/useLangPack.ts:58 | Rule 8 violation: Silent catch — fixed with console.error([LANGPACK_LOAD_FAIL-${Date.now()}], e) |
| — | app/settings/page.tsx:49,155,186 | Rule 8 violation: console.error calls missing MODULE_CODE-TIMESTAMP ref ID format — errors logged but not correlatable to user incidents |
| — | app/settings/page.tsx:154 | Rule 8 violation: reader.onerror handler discards ProgressEvent — DOMException on target.error never read or logged |
| — | app/settings/page.tsx:44-52 | Rule 8 violation: silent background revalidation failure logged but not surfaced to user via licenseStatus update |
| — (Standalone Audit 3, sev:7) | app/settings/page.tsx:handleActivate:59 + handleValidate:78 | No try/catch around invoke calls. If invoke throws, licenseStatus stays stuck in {type:"loading"}, UI permanently disabled with no user feedback. Stop-the-line violation. |
| — (Standalone Audit 3, sev:7) | app/settings/page.tsx:handleLaunchAtLogin:102 | No try/catch. setLaunchAtLogin fires before Tauri call. If enableAutostart/disableAutostart throws, toggle already flipped, UI permanently out of sync with OS with no feedback or rollback. |
| — (Standalone Audit 3, sev:6) | app/settings/page.tsx:useEffect:44 | licenseKey and instanceId captured from Zustand at mount time. persist middleware may not have hydrated before first render in Next.js App Router. If component mounts before hydration, licenseKey/instanceId are null, guard fires early, revalidation never runs silently. Should use useEntitlementStore.getState() inside effect. |
| — (Standalone Audit 3, sev:6) | app/settings/page.tsx:useEffect:48 | If markValidated() throws during torn store state, exception propagates into .then() scope and is caught by .catch(), logging misleading "Silent license revalidation failed" when root cause is actually a store mutation error. |
| — (Standalone Audit 3, sev:5) | lib/entitlement.ts:deactivateLicense:105 | catch block uses String(e) discarding stack trace; no console.error with {MODULE}_{CODE}-{TIMESTAMP} ref ID. Rule 8 violation. |
| — (Standalone Audit 3, sev:5) | app/settings/page.tsx:handleExportBackup:121 | _version:2 is a magic number. Should be _version: CURRENT_BACKUP_VERSION (imported from importBackup.ts). If CURRENT_BACKUP_VERSION bumps, exported backups silently stay at version 2. |
| — (Standalone Audit 3, sev:4) | lib/importBackup.ts:93-95 + store/migrations.ts:70 | importBackup coerces unknown licenseType → "free"; migrations coerce unknown → "subscription". Neither file references the other. Developer reading one in isolation cannot infer why same invalid input produces different outputs. |
| — (Standalone Audit 3, sev:3) | vitest.config.ts:15-18 | Functions coverage threshold set to actual-3%, explicitly permitting the three uncovered entitlement functions (S001-S003) to pass CI without error. |
| — | store/migrations.ts:ENTITLEMENT_MIGRATIONS[2]:67 | Poka-yoke violation: inline untyped new Set(["free","subscription"]) is third parallel LicenseType definition; frozen by migration immutability rule; no TypeScript enforcement |
| — | store/migrations.ts:ENTITLEMENT_MIGRATIONS[2]:62 | Comment says "one-time purchase" — perpetuates deleted pricing concept; should say "legacy licenseType value from prior app version" |
| — | store/entitlementStore.ts:persist:80 | persist key "entitlement-v1" does not reflect ENTITLEMENT_VERSION=2; misleading to future developers; needs comment explaining deliberate mismatch |
| — | lib/tauri.ts:46,58,64 | Rule 8 violation: .catch(() => {}) silently swallows Tauri IPC errors — severity varies by command (update_tray_badge low, update_interrupt_config high) |
| — | components/InterruptHandler.tsx:29 | Rule 8 violation: validateLicense .then() has no .catch(); unhandled rejection on IPC error |
| — | (codebase-wide) | Rule 12 violation: Zero modules expose typed agent tools |
| — | components/StudyCard.tsx | Rule 14 violation: No co-located `.test.tsx` |
| — | components/EntitlementValidator.tsx | Rule 14 violation: No co-located `.test.tsx` |
| — | components/InterruptHandler.tsx | Rule 14 violation: No co-located `.test.tsx` |
| — | app/study/page.tsx | Rule 14 violation: No route test |
| — | app/learn/page.tsx | Rule 14 violation: No route test |
| — | app/settings/page.tsx | Rule 14 violation: No route test |
| — | app/study/page.tsx:310-315 | Rule 15 violation: `tierLabel` dict defined in render body |
| — | app/learn/page.tsx:258-329 | Rule 15 violation: `UnitRow` multi-branch classname expression inline |
| — | app/learn/page.tsx:64-71 | Rule 15 violation: `currentLevel` computation inline in component |
| — | app/learn/page.tsx:52-61 | Rule 15 violation: `levelMastery()` closure defined inside component |
| New Task A (Batch 1) | `lib/importBackup.ts:14` | Rule 3 upward violation: Utilities layer imports `@/store/migrations` (Services layer). `importBackup.ts` is in `lib/` (pure utilities) but directly imports from `store/migrations`. The shared type/constant should be extracted to `lib/` instead. |
| New Task E | `lib/packLoader.ts:223-226` | Rule 8 violation: silent catch {} block — error discarded without log or user surface. (Lines 97-99 and 107-111 covered by Task #008; this is a separate third occurrence.) |
| New Task (Batch 1) | `app/decks/` | Empty directory — owner decided to delete. No files, no routes, no references. Remove the directory. |

## Past Findings — Resolved

| Task | Location | Description |
|------|----------|-------------|
| Task #001 | app/settings/page.tsx:178 | Rule 8: bare catch without binding. Fixed Cycle 2 — catch(e) + console.error added. |
| Task #001 | app/settings/page.tsx:46 | Rule 8: validateLicense no .catch(). Fixed Cycle 2 — .catch() with logging added. |
| Task #001 | app/settings/page.tsx:151 | Rule 8: FileReader.onerror never assigned. Fixed Cycle 2 — handler added. |
| Task #001 | lib/importBackup.ts:parseBackup:92 | VALID_LICENSE_TYPES Set created inside function body on every call. Fixed Cycle 2 — moved to module scope. |
| Task #001 | lib/entitlement.ts:parseVariant | isSubscription misleading variable, unlocksAll single-word substring match. Fixed Cycle 2 — variable removed, uses "all languages" multi-word match. |
| Task #001 WorldClass | lib/entitlement.ts | Missing `// ===` Rule 2 header. Fixed WorldClass cycle — header with DEPENDS ON / USED BY added. |
| Task #001 WorldClass | lib/langRegistry.ts | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | store/entitlementStore.ts | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | lib/importBackup.ts | Missing `// ===` Rule 2 header. Fixed WorldClass cycle. |
| Task #001 WorldClass | store/migrations.ts | JSDoc header replaced with canonical `// ===` header. Fixed WorldClass cycle. |
| Task #001 WorldClass | components/EntitlementValidator.tsx | Rule 14: no co-located `.test.tsx`. Fixed WorldClass cycle — `EntitlementValidator.test.tsx` created with 8 behavioral tests for `runEntitlementValidation`. |
| Task #001 WorldClass | store/entitlementStore.ts:127,130 | `"entitlement-v1"` magic string duplicated in persist config (two sites that could diverge). Fixed WC_CYCLE 3 — extracted to `const ENTITLEMENT_STORE_KEY`. |
| Task #001 WorldClass | lib/entitlement.ts:parseVariant | LsValidateBody type reused LsActivateBody (lying type). Fixed WorldClass — `LsValidateBody` created as separate type. |
| Task #001 WorldClass | lib/entitlement.ts | Missing try/catch on activateLicense invoke call. Fixed WorldClass — `ENTITLEMENT_ACTIVATE_FAIL` ref ID added. |
| Task #001 WorldClass | lib/licenseTypes.ts | LicenseType lived in store layer — Rule 3 upward import. Fixed WorldClass — moved to `lib/licenseTypes.ts`, store re-exports. |
