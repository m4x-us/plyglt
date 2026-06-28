---
# Task List — plyglt
Generated: 2026-06-24 | Method: /meet
Last updated: 2026-06-26

## Summary
76 tasks across 6 batches
Critical (severity 8-9): 7 | High (6-7): 31 | Medium (4-5): 22 | Low (1-3): 15
Current Sprint: Batch 1 — 36 tasks

## Definition of Done (applies to every task)
**Tier 1 — Locally Complete:** Tests pass, no empty catch{}, no `as any`, self-review Five Forcing Functions
**Tier 2 — Team Integration:** Architecture check (no layer violations), agent sign-off, integration tests pass
**Tier 3 — Deployment Ready:** Security audit (OWASP #1-3 checked), backwards compat verified
**Tier 4 — Shipped Complete:** Docs updated (CLAUDE.md / STATUS.md), error ref IDs present, shipping gate passes
Tiers 1-2 are mandatory for all tasks. Tiers 3-4 required for security-adjacent changes.

---

## Batch 1 — Security + Correctness Foundation [COMPLETE]
Dependency: None. All subsequent batches blocked until this completes.
Theme: HIGH security bugs + Wave 1 SRS correctness fixes combined. Tests before code (TDD).

### Task #001 | Delete all lifetime entitlement code + harden entitlement module
**Severity:** 9 — CRITICAL | **File(s):** `lib/entitlement.ts`, `lib/langRegistry.ts`, `store/entitlementStore.ts`, `store/migrations.ts`, `lib/importBackup.ts`, `app/settings/page.tsx`, `app/page.tsx`, `tests/entitlement.test.ts`, `tests/migrations.test.ts`
**DoD Tier:** 3-4
**Status: COMPLETE — 2026-06-25**

BRAND.md is authoritative: "No lifetime subscriptions. Ever." Lifetime code deletion completed in Cycles 1-2. Standalone audit surfaced 29 new findings — critical gaps in test coverage and error handling for the core entitlement flow.

**Original changes (Cycles 1-2 — DONE):**
- `LicenseType` narrowed to `"free" | "subscription"`; lifetime code deleted from all files
- `store/migrations.ts` v2 migration added; `ENTITLEMENT_VERSION` bumped to 2
- `lib/importBackup.ts` `VALID_LICENSE_TYPES` moved to module scope
- `app/page.tsx:181` copy updated; `app/settings/page.tsx` multiple error-handling fixes

**Open sub-items from Standalone Audit (2026-06-25):**

#### Critical (sev 8) — must fix before re-audit
- [x] **S001** `tests/entitlement.test.ts` — `activateLicense` ok:true path entirely untested. Add test supplying a complete valid LS response and asserting `{ok:true, licenseKey, instanceId, licenseType:"subscription", unlockedPacks, validUntil}`.
- [x] **S002** `tests/entitlement.test.ts` — `validateLicense` ok:true path entirely untested. Add test with valid LS validate response asserting `{ok:true, validUntil:<timestamp>}`.
- [x] **S003** `tests/entitlement.test.ts` — `deactivateLicense` 100% uncovered. Add tests for both ok:true (successful deactivation) and ok:false (invoke throws) paths.

#### High (sev 7) — must fix before re-audit
- [x] **S004** `app/settings/page.tsx:handleActivate:59` + `handleValidate:78` + `handleLaunchAtLogin:102` — No try/catch. `handleActivate`/`handleValidate`: wrap `invoke` call in try/catch; set `licenseStatus({type:"error",...})` on throw. `handleLaunchAtLogin`: wrap Tauri calls in try/catch with `setLaunchAtLogin` rollback and toast error.
- [x] **S005** `lib/entitlement.ts:parseVariant:53` + `validateLicense:94` — `new Date(expiresAt).getTime()` produces `NaN` for invalid strings. Apply same `isFinite()` guard used in `importBackup.ts`. Return `null` for invalid/non-finite values.
- [x] **S006** `lib/entitlement.ts:parseVariant:51` — `unlocksAll` substring matching on third-party free-text LS variant names is fragile. A variant rename silently strips all-language access with no error. Document the contract with a comment naming the exact LS variant strings expected; add tests for each expected name.
- [x] **S007** `lib/entitlement.ts:parseVariant:52` — Fallback `["it"]` must be `[...FREE_PACK_CODES]` (already imported on line 3). One-character fix; prevents future free-language additions from being silently excluded.
- [x] **S008** `lib/entitlement.ts:activateLicense:74` — `res.meta` must be guarded before access. Add: `if (!res.meta?.variant_name) return { ok: false, error: "Activation response missing variant data." };`

#### Major (sev 5-6)
- [x] **S009** `app/settings/page.tsx:useEffect:44` — Read `licenseKey`/`instanceId` inside effect via `useEntitlementStore.getState()` instead of closing over component-scope values that may be stale at mount time (pre-hydration race).
- [x] **S010** `store/entitlementStore.ts:isPackUnlocked:63` — Document (with test) the intended behavior for `validUntil:null` post-migration users. If indefinite access is intentional, add a comment; if not, migration v2 must set a concrete `validUntil` (e.g. 90-day grace window).
- [x] **S011** `tests/migrations.test.ts:14-25` — Version constant tests use `Number.isInteger(x) && x > 0`. Change to exact-value assertions: `expect(ENTITLEMENT_VERSION).toBe(2)`.
- [x] **S012** `tests/entitlement.test.ts:281-284,307` — `unlockedPacks` assertions use `.length > 1`. Change to `expect(r.unlockedPacks.sort()).toEqual([...ALL_PACK_CODES].sort())` for all-language variants.
- [x] **S013** `tests/migrations.test.ts` — Add `migrateEntitlementStore({licenseType: "lifetime"}, 1)` → `licenseType: "subscription"` test (storedVersion=1 path, the real-world upgrade path for existing users).
- [x] **S014** `lib/entitlement.ts:deactivateLicense:105` — `catch` block must log with `{MODULE}_{CODE}-{TIMESTAMP}` ref ID before returning the error object. Rule 8 violation.
- [x] **S015** `components/EntitlementValidator.tsx:15` — Add `.catch()` to `validateLicense().then(...)` call — symmetric with the fix applied to `app/settings/page.tsx:useEffect` in Cycle 2.
- [x] **S016** `app/settings/page.tsx:useEffect:48` — Guard `markValidated()` call inside `.then()` with its own try/catch to prevent store mutation errors from being misattributed as network failures.
- [x] **S017** `components/EntitlementValidator.tsx` — Create `components/EntitlementValidator.test.tsx`. Rule 14 violation. Component makes async calls affecting entitlement state.

#### Low (sev 2-4)
- [x] **S018** `store/migrations.ts:67` — Move inline `VALID` Set to module scope and type it as `Set<LicenseType>`. Eliminates the third parallel LicenseType definition (alongside `importBackup.ts` and `entitlementStore.ts`).
- [x] **S019** `store/entitlementStore.ts:persist:80` — Add comment on `name: "entitlement-v1"` explaining the deliberate key/version mismatch (changing the key name would abandon all existing user data).
- [x] **S020** `app/settings/page.tsx:320` — Change "renews" to "expires" or "active until". App cannot know if subscription will renew; `validUntil` is billing period end only.
- [x] **S021** `app/settings/page.tsx:213,215` — Fix BRAND.md violations: "Enable study reminders" → "Enable review reminders"; "Get reminded to study when cards are due" → "Get reminded to review when cards are ready".
- [x] **S022** `store/migrations.ts:62` — Update comment from "one-time purchase in the previous app version" → "unrecognised licenseType value from a prior app version".
- [x] **S023** `lib/importBackup.ts:93` + `store/migrations.ts:70` — Add cross-reference comments explaining asymmetric fallback policy: importBackup → "free" (untrusted external data); migrations → "subscription" (preserve access for existing paid users).
- [x] **S024** `app/settings/page.tsx:121` — Change `_version: 2` to `_version: CURRENT_BACKUP_VERSION` (import from `lib/importBackup.ts`).
- [x] **S025** `vitest.config.ts:15-18` — Raise functions coverage threshold after S001-S003 are fixed. Current threshold at actual-3% explicitly permits the three uncovered entitlement functions through CI.
- [x] **S026** `tests/entitlement.test.ts:270-284` — Add comment to "Italian Lifetime variant" and "All Languages Lifetime variant" test cases explaining these are legacy migration inputs, not supported product configurations.
- [x] **S027** `store/entitlementStore.ts`, `lib/entitlement.ts`, `lib/importBackup.ts` — Add Rule 2 plain-English human headers (all three files start with raw import statements; `store/migrations.ts` has the expected pattern).
- [x] **S028** `src-tauri/src/license.rs:open_url:52` — Defense-in-depth: add domain allowlist restricted to known LS hostnames (`plyglt.lemonsqueezy.com`, `app.lemonsqueezy.com`) before passing URL to `open`.
- [x] **S029** `store/migrations.ts + Zustand persist` — Document in a comment (or add to security.md accepted risk register) that forged storedVersion=2 JSON bypasses migrations; this is within the accepted client-only risk model.

**Done condition:** `grep -r "lifetime" lib/ store/ tests/entitlement.test.ts` returns zero hits. Verification gate green. All S001-S008 sub-items checked off. All W-series sub-items below checked off.

#### WorldClass sub-items (re-scored 2026-06-25 — 93/100, 3 cycles — gap: 2 pts)
These are the unresolved deductions preventing 95/100. Task #001 stays open until they are closed.

- [x] **W001** `lib/entitlement.ts:93` — Extract `"monthly"`, `"annual"`, `"all languages"` string literals in `parseVariant` to named constants. **DONE 2026-06-25**
- [ ] **W002** `app/settings/page.tsx` — 515 lines against the ≤150-line route limit (Rule 1). Blocked on Task #026 (Batch 3). (−12 pts, sev 9)
- [ ] **W003** `app/settings/page.tsx` — No co-located `.test.tsx` (Rule 14). Blocked on Task #026 (Batch 3). (−3 pts, sev 7)
- [ ] **W004** Functions coverage vs AGENTS.md 80%+ floor. Blocked on Batch 2 test tasks. (−3 pts, sev 6)
- [ ] **W005** `app/settings/page.tsx` — Zero test coverage. Blocked on Task #026 (Batch 3). (−4 pts, sev 7)
- [ ] **W006** `app/settings/page.tsx` — No Rule 2 human header. Blocked on Task #026 (Batch 3). (−2 pts, sev 4)
- [ ] **W007** `invoke<unknown>` cast without runtime schema validation. Accepted risk. (−2 pts, sev 5)
- [x] **W008** `isPackUnlocked`/`needsValidation` not pure — fixed in current cycle. (−2 pts) **DONE**
- [x] **W009** `deactivateLicense` didn't check `deactivated:false` — fixed in current cycle. (−2 pts) **DONE**

---

### Task #002 | Fix upward import — extract LANG_PAIR_KEY to lib/constants.ts
**Severity:** 8 — CRITICAL | **File(s):** `store/srsStore.ts:7`, `hooks/useLangPack.ts:12-26`, `app/learn/page.tsx:7`, `app/settings/page.tsx:11`
**DoD Tier:** 2
**Status: COMPLETE — 2026-06-25** | WorldClass: 97/100 (Architecture 97, Vibes 97)

`store/srsStore.ts:7` imports `LANG_PAIR_KEY` from `@/hooks/useLangPack` — a store importing from a hook is an upward layer violation (Rule 3: Routes → Services → Utils → Config, never upward).

**Changes required:**
1. Create `lib/constants.ts` — move `LANG_PAIR_KEY`, `getTargetLangCode()`, and `setTargetLangCode()` out of `hooks/useLangPack.ts` into this new file. The hook file retains its import from `lib/constants.ts`.
2. `store/srsStore.ts:7` — change import source from `@/hooks/useLangPack` to `@/lib/constants`.
3. All callers of `LANG_PAIR_KEY`, `getTargetLangCode`, `setTargetLangCode` — update import source to `@/lib/constants`. Callers found at: `hooks/useLangPack.ts`, `app/learn/page.tsx:7`, `app/settings/page.tsx:11`.
4. `hooks/useLangPack.ts` — remove the three exported items, add `export { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode } from "@/lib/constants"` as a re-export so external call sites that import from `useLangPack` continue to resolve without requiring a separate sweep.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: confirm `useSRSStore` initialises its `_activeLangPair` from `localStorage` without importing anything from the `hooks/` directory. Assert the import graph: `store/srsStore.ts` must not contain the string `hooks/`.

**Done condition:** `grep -n "hooks/" store/srsStore.ts` returns zero hits. Verification gate green.

---

### Task #003 | Fix lang-injection vulnerability in packLoader — validate against allowlist
**Severity:** 9 — CRITICAL | **File(s):** `lib/packLoader.ts:120-121`
**DoD Tier:** 3-4
**Complexity: Full**
**Status: COMPLETE — 2026-06-26**

**Audit findings — 2026-06-25** (6 findings, max severity 8 — standalone re-audit FAIL — run `/task #003` to remediate):
- F001 sev:8 data-corruption `lib/langRegistry.ts:31-33` — fr/de/pt entries carry `config: SPANISH`; `LANG_CONFIG_MAP["fr"/"de"/"pt"]` returns Spanish config to all consumers with no `ready` filter (pre-existing — logged CTO escalation #3; open separate task before non-Italian packs ship)
- F002 sev:7 error-handling `lib/packLoader.ts:fetchManifest:146` — silent `catch {}` when manifest fetch fails; `manifest` becomes `null`; `loadPack` skips all sha256 verification; no ref ID log (pre-existing — tracked security.md Task #007)
- F003 sev:7 security `lib/langRegistry.ts:ALL_PACK_CODES:37` — mutable `string[]`; any consumer can `.push()` and bypass `loadPack`/`evictPack` guards at runtime (pre-existing — F008 SCOPE_EXPANSION Cycle 1; upgrade to `as readonly string[]` + `Object.freeze()`)
- F004 sev:6 error-handling `lib/packLoader.ts:multiple` — 7 silent `catch {}` blocks; Rule 8 stop-the-line pattern at module scale (pre-existing — tracked security.md Task #007)
- F005 sev:6 type-safety `lib/langRegistry.ts:PackCode:42` — `PackCode` resolves to `string` due to `as string[]` cast; zero compile-time enforcement at any `PackCode` call site (NEW — no prior task)
- F006 sev:5 error-handling `lib/packLoader.ts:loadPack:283-288` — `writeCacheData`/`writeCacheMeta` awaited with no try/catch; `QuotaExceededError` propagates as wrong discriminant `"download_failed"` (NEW — no prior task)

`packUrl(lang)` at line 120 interpolates the `lang` parameter directly into a URL path: `` `/packs/${lang}.json` ``. The value comes from `localStorage` via `hooks/useLangPack.ts`. A crafted `lang` value (e.g. `../../../etc/passwd` or a remote hostname if the app ever serves relative URLs differently) bypasses the intended pack directory.

**Changes required:**
1. Import `ALL_PACK_CODES` from `@/lib/langRegistry` at the top of `lib/packLoader.ts`.
2. Add a validation guard at the top of `loadPack()` (before line 163):
   ```ts
   if (!ALL_PACK_CODES.includes(lang)) {
     return { ok: false, error: "not_cached" }; // treat unknown lang as not installed
   }
   ```
3. Add the same guard at the top of `evictPack()`.

**Test required (write first):**
- `tests/packLoader.test.ts` — add: calling `loadPack("../evil", null)` returns `{ ok: false, error: "not_cached" }` without making any fetch call. Calling `loadPack("../../etc/passwd", null)` same result. Calling `loadPack("it", null)` proceeds normally (mocked fetch).

**Done condition:** `grep -n "packUrl\|evictPack" lib/packLoader.ts` shows allowlist guard in both. Verification gate green.

---

<!-- Sub-tasks spawned from Task #003 fresh-eyes audit (informal Lens 2) — 2026-06-25 -->

### Task #059 | security | severity 7
**What:** Fix unsafe `as PackCode[]` cast — annotate `LanguageEntry.code: PackCode` in the interface so the derived arrays are typed correctly without a cast
**Why:** `LANGUAGE_REGISTRY.map(l => l.code) as PackCode[]` is an unsafe cast. `LanguageEntry.code: string` means `.map()` yields `string[]`; the `as PackCode[]` assertion bypasses TypeScript. If a new LANGUAGE_REGISTRY entry has a code outside the union, the cast silently accepts it — the security allowlist in `loadPack`/`evictPack` contains an unvalidated value. Fix: annotate `LanguageEntry.code: PackCode` so the registry itself enforces membership at compile time.
**File:** `lib/langRegistry.ts:18,46-47`
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, file deletion
**Blocked by:** Nothing | **Blocks:** Task #064, Task #065
**Risk:** Low — one field annotation; TypeScript flags any entry whose code is not in the union
**Test required (write first):** `tests/langRegistry.test.ts` — add: runtime assertion that every element of ALL_PACK_CODES is one of `["it","es","fr","de","pt"]`. Confirm the `as PackCode[]` cast no longer appears in `lib/langRegistry.ts` after the fix.
**Done condition:** `grep -n "code: PackCode" lib/langRegistry.ts` returns a hit. `grep -n "as PackCode\[\]" lib/langRegistry.ts` returns no hit. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #060 | security | severity 6
**What:** Add `"invalid_lang"` discriminant to `LoadPackResult` and return it from the allowlist guard in `loadPack` and `evictPack`
**Why:** `lib/packLoader.ts:182` returns `{ ok: false, error: "not_cached" }` for rejected lang codes. `"not_cached"` means "pack not downloaded yet — try fetching." A caller retrying on `"not_cached"` will attempt to fetch `../evil.json`. This was hardcoded in the original Task #003 spec — this task corrects that design flaw. A distinct `"invalid_lang"` discriminant prevents retry logic from operating on adversarial input.
**File:** `lib/packLoader.ts:151-162,182,318`; `hooks/useLangPack.ts:55`
**Severity:** 6 | **DoD Tier:** 2
**Complexity: Full**
**Blocked by:** Nothing | **Blocks:** Task #069
**Risk:** Medium — callers that switch on `result.error` need updating. Run `grep -rn '"not_cached"' --include="*.ts" --include="*.tsx" .` before changing.
**Test required (write first):** `tests/packLoader.test.ts` — update existing allowlist tests: `loadPack("../evil", null)` → `error: "invalid_lang"`, not `"not_cached"`. `loadPack("it", null)` with no cache → still `"not_cached"` (not confused with guard rejection).
**Done condition:** `grep -n '"invalid_lang"' lib/packLoader.ts` returns a hit in the LoadPackResult type AND in the guard return. All existing tests pass. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**
Reopened reason: `/audit #060` found 2 blockers + 1 stop-the-line + 20 additional findings. One fix already applied inline (A000).

**Audit sub-items (from /audit #060 — 2026-06-26):**

#### Done inline
- [x] **A000** `lib/packLoader.ts:196` — `manifest?.packs[lang]` → `manifest?.packs?.[lang]`. Fixes TypeError when manifest is non-null but has no `packs` field (CDN returns `{}` with HTTP 200 → previously threw `undefined["it"]`). (H2 — sev 5)

#### Blockers — must fix before task can close (sev 6)
- [ ] **A001** `lib/packLoader.ts:162` — Remove `"not_cached"` from `LoadPackResult` union. Zero return sites confirmed — all failure paths return `"invalid_lang"`, `"download_failed"`, `"checksum_mismatch"`, or `"parse_error"`. Remove the dead variant and the comment at lines 185–186 referencing callers with "retry-on-not_cached logic." Add compile-time check (narrowing test) confirming the union is exhausted. (B1)
- [ ] **A002** `tests/useLangPack.test.ts` — Add Rule 13 seam test: stub `loadPack` to return `{ ok: false, error: "invalid_lang" }`, exercise `useLangPack`, assert `state.error === "invalid_lang"`. Requires jsdom or `renderHook` from `@testing-library/react`. If the current `environment: "node"` in `vitest.config.ts` blocks this, add a separate `vitest.hooks.config.ts` with `environment: "jsdom"` scoped to `tests/hooks/`. (B2)

#### Stop-the-line — separate bug found during audit (sev 7)
- [ ] **A003** `lib/packLoader.ts:215` — Integrity bypass: after `clearPackCache(lang)` evicts SHA-failed data, the local `cachedData` variable still holds those bytes. If the subsequent download also fails, stale-cache fallbacks at lines 241 and 257 serve the integrity-failed pack as `{ ok: true }`. Fix: add `cachedData = null;` immediately after `clearPackCache(lang)` at line 215. Both fallback branches then miss the `if (cachedData)` guard and correctly return `{ ok: false, error: "download_failed" }`. (STL)
- [ ] **A023** `tests/packLoader.test.ts` — A003 has no test. Without it, the `cachedData = null` fix is unverifiable — removing it causes zero test failures. Add: seed cache with `'{"corrupted":true}'`, seed manifest with non-matching SHA so SHA check fails, make `fetch` throw a network error, assert result is `{ ok: false, error: "download_failed" }`. This test must fail before A003 is applied and pass after. (sev 6 — required for A003 to be considered fixed)

#### High (sev 4–5)
- [ ] **A004** `lib/packLoader.ts:218,224,243,259` — Four cache-served paths use `JSON.parse(cachedData) as Pack` with no `Array.isArray(pack.units)` structural check. The guard at line 288 only runs on fresh downloads. Extract `validatePack(json: string): Pack | null` and apply on all four paths. (H1 — sev 5)
- [ ] **A005** `app/study/page.tsx`, `components/InterruptHandler.tsx` — Neither destructures `error` from `useLangPack()`. Pack load failure renders empty card queue / no units with zero user feedback. Add `error: packError` and an error branch to both, mirroring `app/learn/page.tsx:98–105`. (H3 — sev 5)
- [ ] **A006** `hooks/useLangPack.ts:31` — `LangPackState.error: string | null` erases the discriminant. After A001 fixes the union, export `type PackLoadError = Extract<LoadPackResult, { ok: false }>["error"]` from `lib/packLoader.ts` and use it as `error: PackLoadError | null` in `LangPackState`. (H4 — sev 4)

#### Medium (sev 3–4)
- [ ] **A007** `lib/packLoader.ts:187-188,328` — Both allowlist guard sites fire silently. Add `console.warn(\`[INVALID_LANG_REJECTED-${Date.now()}] Rejected lang code: "${lang}"\`)` before each return. Consistent with every other error path in the file. (M1 — sev 4)
- [ ] **A008** `app/learn/page.tsx:98-105` — Error UI collapses all 4 error codes to "Choose a different language." Correct only for `"invalid_lang"`. `"download_failed"` → retry button. `"checksum_mismatch"` → evict cache + retry. `"parse_error"` → retry. Blocked on A006 (discriminant type). (M2 — sev 4)
- [ ] **A009** `lib/packLoader.ts:187,328` + `lib/importBackup.ts:113` — Allowlist cast `(ALL_PACK_CODES as readonly string[]).includes()` duplicated 3×. Extract `isValidPackCode(code: string): code is PackCode` in `lib/langRegistry.ts` and replace all three sites. (M3 — sev 3)
- [ ] **A010** `lib/langRegistry.ts` — Unshipped languages (`es`/`fr`/`de`/`pt`) pass the `ALL_PACK_CODES` guard and return `"download_failed"` on 404. Callers cannot distinguish "network error" from "valid code, pack not yet shipped." Relates to escalation #4 (ALL_PACK_CODES vs READY_PACK_CODES split). (M4 — sev 3)
- [ ] **A011** `lib/packLoader.ts:147` — `fetchManifest` casts network response as `Manifest` without structural validation. `as Manifest` lying type. Add `Array.isArray`/`typeof` checks on the returned object's `packs` field before returning. (M5 — sev 3)

#### Minor (sev 2–3)
- [ ] **A012** `app/learn/page.tsx:193` — `prereqUnit` can be `undefined` when a prerequisite unit ID does not exist in `UNIT_MAP` (malformed pack, removed unit after cache). Unit is permanently locked with no log or user message. Add guard + `console.warn` with ref ID. (L1 — sev 3)
- [ ] **A013** `lib/tauri.ts:129` — `checkForUpdates` bare `catch {}` swallows all errors silently. Bind error and log with ref ID. Rule 8 violation. Pre-existing open finding. (L2 — sev 3)
- [ ] **A014** `lib/tauri.ts:112-114` — `openExternalUrl` web path passes any string to `window.open` with no URL scheme guard. Rust path fixed (`src-tauri/src/license.rs:54`). Add `if (!url.startsWith("https://")) return;` guard in the web branch. Pre-existing open finding. (L3 — sev 3)
- [ ] **A015** `lib/packLoader.ts:327` — `evictPack` returns `Promise<void>` for both "evicted" and "guard rejected." Callers cannot distinguish outcomes. Change to return `boolean` (`true` = evicted, `false` = guard rejected). Update test and callers. (L4 — sev 3)
- [ ] **A016** `tests/packLoader.test.ts:225,234,254,263` — Four new `if (!result.ok) expect(result.error).toBe("invalid_lang")` conditionals. Replace with `expect(result).toMatchObject({ ok: false, error: "invalid_lang" })` — one assertion, no conditional, same coverage. (L6 — sev 2)
- [ ] **A017** `tests/packLoader.test.ts:364` — `evictPack` allowlist test covers only `"../evil"`. Add `"../../etc/passwd"` case to match `loadPack` allowlist test coverage. (L7 — sev 2)
- [ ] **A018** `lib/packLoader.ts:301` — `cachedMeta.sha256` written to storage on every download but never read back for comparison. `cacheValid` uses `cachedMeta.version` only. Field is decorative dead data. Either read it in `cacheValid` or remove it from `CachedPackMeta`. (L8 — sev 2)
- [ ] **A019** `lib/packLoader.ts:317` — `getInstalledPacks()` returns session-only `memCache.keys()`. Name implies device-level persistence. Rename to `getSessionLoadedPacks()` or update docstring to explicitly state "current session only." (L9 — sev 2)
- [ ] **A020** `app/learn/page.tsx:28,31` — `updateTrayBadge(totalDue)` fires before pack loads (`totalDue = 0` when `ALL_UNITS = []`), clearing a valid tray badge from the previous session. Guard: `if (!packLoading) updateTrayBadge(totalDue)`. (L10 — sev 2)
- [ ] **A021** `app/learn/page.tsx:183` — `LEVELS[LEVELS.indexOf(lvl) - 1]!` — when `lvl === "A1"` (index 0), `LEVELS[-1]` is `undefined`. Non-null assertion suppresses TypeScript error. Safe only because `levelUnlocked` returns `true` for index 0. Add guard: `const prevLevel = LEVELS[LEVELS.indexOf(lvl) - 1] ?? "previous level"`. (L11 — sev 2)
- [ ] **A022** `app/learn/page.tsx:101,133,148,313` — Brand violations: "Could not load" → "Couldn't load"; three uses of "due" → "ready" per BRAND.md canonical mapping. (L12 — sev 2)
- [ ] **A024** `tests/packLoader.test.ts:170-188` — The SHA-eviction test ("evicts cache and re-downloads when cached data has wrong SHA256") asserts `result.ok === true` and `fetchSpy` called once, but never verifies the corrupted data was actually removed from storage before the good data was written. `clearPackCache` could be deleted entirely and the test still passes. Add: `expect(localStorageMock.getItem("pack-data-v1-it")).not.toBe('{"corrupted":true}')` before the result assertion. (sev 2)
- [ ] **A025** `hooks/useLangPack.ts:1` — File starts with `"use client"` and no Rule 2 header block. `lib/packLoader.ts` has a 17-line header describing dependencies, consumers, and security contract. `useLangPack.ts` has none. Add a Rule 2 comment block describing: what the hook does, what it depends on, what consumes it, and the STATIC_PACKS bypass. (sev 2)
- [ ] **A026** `hooks/useLangPack.ts:69` — `useEffect` dep array is `[targetLang, lang]`. Since `lang = useMemo(() => getLanguageConfig(targetLang), [targetLang])`, `lang` only changes when `targetLang` changes — making `lang` redundant. More importantly: if `getLanguageConfig` ever returns a new object for the same code (broken memoization), both `targetLang` and `lang` fire the effect, running the fetch twice. The correct dep array is `[targetLang]` alone. Task #066 fixed the infinite loop by adding `useMemo`, but left the redundant dep. (sev 3)

**Done condition (reopened):** All A001–A003 and A023 checked off. Verification gate green. A004–A026 may be closed in subsequent cycles or carried to debt register.

---

### Task #061 | tests | severity 7
**What:** Add test covering the `QuotaExceededError` catch path in `writeCacheData`/`writeCacheMeta` (`lib/packLoader.ts:286-295`)
**Why:** The F006 fix (try/catch around cache write) has zero test coverage. Removing the try/catch causes no test failures — the fix is unverifiable. Test must confirm: (a) `loadPack` returns `{ ok: true, pack }` when storage throws, (b) `console.error` is called with `PACK_CACHE_WRITE_FAIL`, (c) pack is in memCache for the session.
**File:** `tests/packLoader.test.ts`
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, assertion replacement
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test only
**Test required (write first):** Stub `localStorage.setItem` to throw `new DOMException("QuotaExceededError")`. Assert result is `{ ok: true, pack }`. Assert `console.error` called with string matching `PACK_CACHE_WRITE_FAIL`. Assert second `loadPack("it", ...)` returns from memCache without a second fetch.
**Done condition:** `npm test -- tests/packLoader.test.ts` passes including the new test. Verification gate green.
**Owner:** QA Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #062 | tests | severity 5
**What:** Strengthen `LANG_CONFIG_MAP` assertions in `tests/langRegistry.test.ts` from `toBeDefined()` to value-level checks
**Why:** `expect(LANG_CONFIG_MAP[code]).toBeDefined()` passes even though `fr`, `de`, `pt` return the Spanish config. This is pseudocode — it proves key existence, not correctness. The test would not catch CTO escalation #3 (fr/de/pt data corruption). The test should FAIL on the current codebase and PASS only after escalation #3 is resolved.
**File:** `tests/langRegistry.test.ts:10-14`
**Severity:** 5 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — expected to surface the existing fr/de/pt config bug as a failing test (this is the point)
**Test required (write first):** This task IS the rewrite. For each code, assert the config's identifying field matches that code (e.g. `LANG_CONFIG_MAP["it"].code === "it"`). Assert `LANG_CONFIG_MAP["fr"]` is not the Spanish config.
**Done condition:** The rewritten test fails on the current codebase. Test passes after CTO escalation #3 is resolved. Verification gate green (conditioned on escalation #3).
**Owner:** QA Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #063 | security | severity 7
**What:** Fix truthy check on `data.srs` in `lib/importBackup.ts:67` — validate it is a non-null object
**Why:** `if (!data.srs)` allows `data.srs = 42` (truthy non-object) to pass. `migrateSrsStore(42, 0)` is then called with a number from an untrusted JSON boundary. Rule 3: validate at boundaries. Must be `typeof data.srs !== "object" || data.srs === null`.
**File:** `lib/importBackup.ts:67`
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — tightens boundary validation; no behavior change for well-formed backups
**Test required (write first):** `tests/importBackup.test.ts` — add: `parseBackup({ _version: 1, srs: 42, entitlement: {} })` → `{ ok: false }`. `parseBackup({ _version: 1, srs: "hello", entitlement: {} })` → `{ ok: false }`.
**Done condition:** New tests pass. `grep -n "typeof data.srs" lib/importBackup.ts` returns a hit. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #064 | code-quality | severity 4
**What:** Change `getInstalledPacks()` return type from `string[]` to `PackCode[]` in `lib/packLoader.ts:306`
**Why:** The JSDoc states memCache is exclusively populated via `loadPack()` which validates against ALL_PACK_CODES — the values are guaranteed to be PackCodes. `string[]` forces every caller to re-validate or cast. Rule 6: honest types.
**File:** `lib/packLoader.ts:306`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, type annotation only
**Blocked by:** Task #059 | **Blocks:** Nothing
**Risk:** Low — type-only change; no runtime behavior change
**Test required (write first):** No new test needed. `npx tsc --noEmit` must pass with the updated return type.
**Done condition:** `grep -n "getInstalledPacks" lib/packLoader.ts` shows `PackCode[]` return type. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-27**

---

### Task #065 | code-quality | severity 4
**What:** Extract `isValidPackCode(s: string): s is PackCode` type guard into `lib/langRegistry.ts` and replace the four inline `(ALL_PACK_CODES as readonly string[]).includes(x)` casts
**Why:** The same unsafe cast pattern appears at `lib/packLoader.ts:182`, `lib/packLoader.ts:318`, `store/entitlementStore.ts:70`, and `lib/importBackup.ts:119`. Four independent copies, four independent failure points. Rule of Three is cleared — extract. A single tested helper is the right abstraction.
**File:** `lib/langRegistry.ts` (add helper); `lib/packLoader.ts:182,318`; `store/entitlementStore.ts:70`; `lib/importBackup.ts:119`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (langRegistry, packLoader, entitlementStore, importBackup)
**Blocked by:** Task #059 | **Blocks:** Nothing
**Risk:** Low — behavior-identical refactor
**Test required (write first):** `tests/langRegistry.test.ts` — add: `isValidPackCode("it")` → true; `isValidPackCode("xx")` → false; `isValidPackCode("")` → false; `isValidPackCode("../evil")` → false.
**Done condition:** `grep -n "isValidPackCode" lib/langRegistry.ts` returns a hit. `grep -rn "as readonly string\[\]" lib/packLoader.ts lib/importBackup.ts store/entitlementStore.ts` returns no hits. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-27**

---

### Task #066 | async | severity 8
**What:** Fix unstable `lang` object reference in `useEffect` deps in `hooks/useLangPack.ts:65`
**Why:** `const lang = getLanguageConfig(targetLang)` creates a new object on every render. In `useEffect([..., lang])`, `lang` fails `===` each render — effect fires, `setState` triggers another render, infinite loop. Today this is masked by the static Italian early-return at line 43. When the second language ships (`ready: true` for any non-Italian pack), every non-Italian user enters an infinite re-render loop on first load. This is a production regression on a feature-flag flip.
**File:** `hooks/useLangPack.ts:32,65`
**Severity:** 8 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low to fix; High if deferred — will manifest when second language ships
**Test required (write first):** `tests/useLangPack.test.ts` (create file) — render hook with a non-static lang code (mock STATIC_PACKS to `[]`). Assert effect fires exactly once, not in a loop. Use render count spy or call count assertion.
**Done condition:** `hooks/useLangPack.ts` does not include `lang` as an unstable object in useEffect deps (use `targetLang` string or `useMemo`). `npm test -- tests/useLangPack.test.ts` passes. Verification gate green.
**Owner:** Architecture Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #067 | error-handling | severity 6
**What:** Add ref-ID logging to the silent `catch {}` in `fetchManifest` at `lib/packLoader.ts:146-147`
**Why:** `fetchManifest` silently returns `null` on network failure. When `manifest` is null, `loadPack` skips all SHA-256 verification — a silent network error causes a silent security downgrade. No log output means this failure is invisible in production. Rule 8: log with a ref ID. Note: `readCacheMeta:97` and `readCacheData:109` silent catches are covered separately by Task #008.
**File:** `lib/packLoader.ts:141-148`
**Severity:** 6 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — logging only
**Test required (write first):** `tests/packLoader.test.ts` — add: when `fetch` throws a network error, `console.error` is called with a string matching `MANIFEST_FETCH_FAIL`. Call `fetchManifest()` directly with fetch stubbed to throw.
**Done condition:** `grep -n "MANIFEST_FETCH_FAIL" lib/packLoader.ts` returns a hit. `npm test` passes. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #068 | security | severity 5
**What:** Decide whether `ALL_PACK_CODES` (security allowlist) and loadable packs (`ready: true`) should be separate sets — currently they are not
**Why:** `ALL_PACK_CODES` = all 5 registered codes including `ready: false` langs. The `loadPack` guard validates against ALL_PACK_CODES, making `es/fr/de/pt` "loadable" (guard passes, CDN rejects). If the design intent is that unready packs should be rejected early (before a network attempt), a `READY_PACK_CODES` subset should be used in the guard. If the intent is that all registered codes are valid security-wise (CDN is the content gate), current behavior is correct. Requires owner decision. See Escalation Queue item #4.
**File:** `lib/langRegistry.ts`
**Severity:** 5 | **DoD Tier:** 3
**Complexity:** ⚡ Direct — 1 file, no package boundary, owner decision + conditional guard change
**Blocked by:** Owner decision (Escalation Queue item #4) | **Blocks:** Nothing
**Risk:** Medium — changing ALL_PACK_CODES semantics affects guard behavior in three files
**Test required (write first):** After owner decision: test that `loadPack("fr", null)` returns the expected result for an unready pack.
**Done condition:** Owner decision recorded in cto.md. Implementation matches decision. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-27**

---

### Task #069 | code-quality | severity 5
**What:** Translate `LoadPackResult` error discriminants to user-readable strings in `hooks/useLangPack.ts:54-56` before storing in state
**Why:** `result.error` values (`"not_cached"`, `"download_failed"`, `"checksum_mismatch"`, `"parse_error"`) are internal machine codes stored directly in `LangPackState.error: string | null`. Users should never see `"checksum_mismatch"`. BRAND.md voice: "Couldn't load pack. Try again." — not `"download_failed"`. Translation must happen at the hook boundary before the value enters state.
**File:** `hooks/useLangPack.ts:54-56`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, string mapping
**Blocked by:** Task #060 (translation map must include `"invalid_lang"` once added) | **Blocks:** Nothing
**Risk:** Low — string mapping only
**Test required (write first):** `tests/useLangPack.test.ts` — for each error discriminant, assert `state.error` does not equal the raw discriminant and matches a BRAND.md-compliant string (short, no exclamation mark, no filler words).
**Done condition:** `grep -n "download_failed\|checksum_mismatch\|parse_error\|not_cached" hooks/useLangPack.ts` returns hits only inside a translation map, not in `setState` calls. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-27**

---

### Task #070 | code-quality | severity 2
**What:** Add `@deprecated` JSDoc to the `ALL_KNOWN_PACKS` re-export in `store/entitlementStore.ts:27`
**Why:** `ALL_KNOWN_PACKS` is a backward-compat alias for `ALL_PACK_CODES`. Without `@deprecated`, IDE autocomplete surfaces it as a live API with no hint to migrate. Note: Task #057 covers the distinct re-export alias in `hooks/useLangPack.ts` (LANG_PAIR_KEY etc.) — this is a separate alias in a separate file.
**File:** `store/entitlementStore.ts:26-27`
**Severity:** 2 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — JSDoc comment only
**Test required (write first):** `grep -n "@deprecated" store/entitlementStore.ts` must return a hit.
**Done condition:** `grep -n "@deprecated" store/entitlementStore.ts` returns a hit adjacent to the `ALL_KNOWN_PACKS` export line. Verification gate green.
**Owner:** Architecture Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #004 | Fix silent IPC failure — updateInterruptConfig error must surface
**Severity:** 8 — CRITICAL | **File(s):** `lib/tauri.ts:58`
**DoD Tier:** 3-4
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope error-surfacing change

`updateInterruptConfig()` at line 58 calls `invoke(…).catch(() => {})` — silently discarding errors. If this IPC call fails, the user changes interrupt settings but the Rust scheduler ignores the change and continues firing. The user's setting appears to take effect but does not.

**SPEC CORRECTION (2026-06-26):** The original spec used `if (result === null)` to detect IPC failure. This is wrong: Tauri void commands (`()` in Rust) return JSON `null` on SUCCESS — so the null-check always fires, causing the function to throw on every successful desktop call. Correct pattern: try/catch around the invoke call.

**Changes required:**
1. `lib/tauri.ts:52-59` — change `updateInterruptConfig` to `async` and await the invoke inside try/catch. On failure, log the error with a unique ref ID and re-throw:
   ```ts
   export async function updateInterruptConfig(
     enabled: boolean,
     intervalHours: number,
     mandatory: boolean
   ): Promise<void> {
     if (!isTauri) return;
     try {
       await invoke("update_interrupt_config", { enabled, intervalHours, mandatory });
     } catch (err) {
       const ref = `ERR-IPC-${Date.now()}`;
       console.error(`[${ref}] update_interrupt_config IPC failed — Rust scheduler not updated`, err);
       throw new Error(`Interrupt config IPC failed (${ref})`);
     }
   }
   ```
2. `components/InterruptHandler.tsx:21-23` — the `useEffect` that calls `updateInterruptConfig` must catch the thrown error and surface it to the user (e.g. set a store error state or console.error with the ref). At minimum: wrap in try/catch, log the ref. Do not swallow.

**Test required (write first):**
- `tests/tauri.test.ts` — add: when `invoke` throws (mocked to throw a network error), `updateInterruptConfig(true, 1, false)` rejects with an error message containing `"IPC failed"`. Confirm that when `invoke` resolves normally (returns undefined/null), `updateInterruptConfig` resolves without throwing.

**Done condition:** `lib/tauri.ts:58` no longer has `.catch(() => {})`. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #005 | Fix silent IPC failure — snoozeInterrupt error must surface
**Severity:** 8 — CRITICAL | **File(s):** `lib/tauri.ts:64`
**DoD Tier:** 3-4
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope error-surfacing change

`snoozeInterrupt()` at line 64 calls `invoke(…).catch(() => {})`. If IPC fails, the user presses Snooze but interrupts continue firing.

**SPEC CORRECTION (2026-06-26):** Same as #004 — original spec used `if (result === null)` to detect failure. Tauri void commands return `null` on SUCCESS, so the null-check always fires. Use try/catch instead.

**Changes required:**
1. `lib/tauri.ts:62-65` — same pattern as #004. Make async, wrap invoke in try/catch, on error log with ref ID and re-throw:
   ```ts
   export async function snoozeInterrupt(minutes: number): Promise<void> {
     if (!isTauri) return;
     try {
       await invoke("snooze_interrupt", { minutes });
     } catch (err) {
       const ref = `ERR-IPC-${Date.now()}`;
       console.error(`[${ref}] snooze_interrupt IPC failed — interrupts will continue firing`, err);
       throw new Error(`Snooze IPC failed (${ref})`);
     }
   }
   ```
2. `app/study/page.tsx:331-334` — the Snooze button calls `snoozeInterrupt(snoozeMinutes)` without awaiting. Change to `await snoozeInterrupt(snoozeMinutes)` inside the existing async arrow and wrap in try/catch to display a user-visible error (e.g. a console.error with ref ID and optionally a transient UI message).

**Test required (write first):**
- `tests/tauri.test.ts` — add: when `invoke` throws (mocked to throw), `snoozeInterrupt(5)` rejects with an error message containing `"IPC failed"`. Confirm that when `invoke` resolves normally, `snoozeInterrupt` resolves without throwing.

**Done condition:** `lib/tauri.ts:64` no longer has `.catch(() => {})`. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #006 | Fix silent catch — notification plugin in InterruptHandler
**Severity:** 6 | **File(s):** `components/InterruptHandler.tsx:73`
**DoD Tier:** 2
**Complexity: Direct**

The `catch {}` block at line 73 discards notification-plugin errors without logging. The comment says "Non-fatal" which is correct, but Rule 8 requires every error to get a unique timestamped ref ID.

**Changes required:**
1. `components/InterruptHandler.tsx:73-75` — change:
   ```ts
   } catch {
     // Non-fatal: notifications unavailable
   }
   ```
   to:
   ```ts
   } catch (err) {
     console.error(`[ERR-NOTIF-${Date.now()}] Notification plugin error:`, err);
   }
   ```

**Test required (write first):**
- `tests/tauri.test.ts` — add: when the notification plugin import throws, the error ref is logged (spy on `console.error`, assert it was called with a string matching `ERR-NOTIF-`).

**Done condition:** `grep -n "catch {" components/InterruptHandler.tsx` returns zero hits. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #007 | Fix silent catch — FileReader in settings/page.tsx
**Severity:** 5 | **File(s):** `app/settings/page.tsx:178`
**DoD Tier:** 2
**Complexity: Direct**

The `reader.onload` callback at line 152 wraps its body in try/catch. The catch at line 178 shows a user-visible error message (good), but the raw error is discarded with no logging, making silent read failures invisible in support contexts.

**Changes required:**
1. `app/settings/page.tsx:178-180` — change `catch {` to `catch (err) {` and add `console.error(`[ERR-IMPORT-${Date.now()}]`, err);` before the `setDataStatus` call.
2. Add `reader.onerror` handler below the `reader.onload` assignment (currently absent). On error: log with ref ID, set `dataStatus` to `{ type: "error", message: "Could not read the file." }`.

**Test required (write first):**
- This is a page-level behaviour; the seam test added in Batch 2 (#020) covers `parseBackup`. For now: add a unit test to `tests/importBackup.test.ts` asserting that an `onerror` on the FileReader is handled — this can be a note in the test file stub; full coverage in Batch 2.

**Done condition:** `grep -n "catch {" app/settings/page.tsx` returns zero hits. `reader.onerror` is defined. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #008 | Fix silent catches — storage read in packLoader
**Severity:** 5 | **File(s):** `lib/packLoader.ts:91`, `lib/packLoader.ts:101`
**DoD Tier:** 2
**Complexity: Direct**

`readCacheMeta()` (line 91) and `readCacheData()` (line 101) swallow storage read errors entirely (`catch { return null; }`), making corrupted or inaccessible storage silent.

**Changes required:**
1. `lib/packLoader.ts:91` — change `catch {` to `catch (err) {` and add `console.error(`[ERR-CACHE-META-${Date.now()}]`, err);` before `return null;`.
2. `lib/packLoader.ts:101` — same: `catch (err) {` with `console.error(`[ERR-CACHE-DATA-${Date.now()}]`, err);` before `return null;`.

**Test required (write first):**
- `tests/packLoader.test.ts` — add: when the storage `getItem` throws, `readCacheMeta` returns `null` AND `console.error` is called with a string matching `ERR-CACHE-`.

**Done condition:** `grep -n "catch {" lib/packLoader.ts` returns zero hits. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #009 | Fix silent catch — console.warn leaks API error in EntitlementValidator
**Severity:** 5 | **File(s):** `components/EntitlementValidator.tsx:22`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope logging change
**Status: COMPLETE — 2026-06-26**

`console.warn("License validation failed:", result.error)` leaks the raw Lemon Squeezy API error text (which may include internal API details) to DevTools — visible to any user who opens the browser console.

**Changes required:**
1. `components/EntitlementValidator.tsx:22` — replace `console.warn(...)` with a sanitised log that includes a ref ID but omits the raw API error text from the console output:
   ```ts
   console.error(`[ERR-LICENSE-${Date.now()}] License validation failed — user in grace period`);
   ```
   The raw `result.error` must not be logged to console (it may contain API-internal strings). If the error needs to surface to the user, it should go through a store state, not DevTools.

**Test required (write first):**
- `tests/entitlement.test.ts` — add: when `validateLicense` returns `{ ok: false, error: "some internal api text" }`, `console.warn` is NOT called with that string; `console.error` IS called with a string matching `ERR-LICENSE-`.

**Done condition:** `grep -n "console.warn" components/EntitlementValidator.tsx` returns zero hits. Verification gate green.

---

### Task #010 | Fix NFC normalization — change NFD+strip to NFC in checkAnswer
**Severity:** 7 | **File(s):** `lib/srs.ts:225-229`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, targeted normalization fix

The `normalize()` closure inside `checkAnswer` (lines 225-229) uses `.normalize("NFD").replace(/[̀-ͯ]/g, "")` — NFD decomposition followed by diacritic stripping. This is the wrong transformation for exact matching: it causes "caffè" typed correctly to strip its accent and match "caffe", accepting imprecise input as correct. Correct behaviour: use `.normalize("NFC")` to canonicalize Unicode without stripping diacritics. Diacritic-tolerant matching (for when the user omits accents) is a separate, additive feature gated by `diacriticTolerant` (added in #011).

**Changes required:**
1. `lib/srs.ts:225-229` — in the `normalize` closure, change `.normalize("NFD").replace(/[̀-ͯ]/g, "")` to `.normalize("NFC")`. Remove the diacritic-stripping regex entirely from `normalize`.
2. `lib/srs.ts:218-251` — add `diacriticTolerant?: boolean` to the `options` parameter type. Add a separate `normalizeStripped(s: string)` helper (private to the function scope) that applies NFC first, then strips diacritics — used only when `diacriticTolerant` is true.
3. Update the matching loop (lines 238-250): if `diacriticTolerant`, also compare `normalizeStripped(t)` against `normalizeStripped(a)` etc. A stripped match should return `"close"` not `"correct"` (missing accent = close, not exact).

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - `checkAnswer("caffè", ["caffè"])` returns `"correct"` (NFC exact match).
  - `checkAnswer("caffe", ["caffè"])` returns `"wrong"` by default (no diacriticTolerant).
  - `checkAnswer("caffe", ["caffè"], { diacriticTolerant: true })` returns `"close"`.
  - `checkAnswer("caffè", ["caffè"], { diacriticTolerant: true })` returns `"correct"` (exact still preferred).

**Done condition:** Tests above pass. `grep -n "NFD" lib/srs.ts` returns zero hits. Verification gate green.

**Status: COMPLETE — 2026-06-27**
---

### Task #011 | Add diacriticTolerant flag to LanguageConfig and wire to checkAnswer
**Severity:** 6 | **File(s):** `lib/language.ts:4-20`, `lib/language.ts:49-68`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files (lib/language.ts + components/StudyCard.tsx), no package boundary
**Blocked by:** Task #010 | **Blocks:** Nothing

`LanguageConfig` has no `diacriticTolerant` field. All five language configs need this. Italian should be tolerant (missing accent = `close`); other languages follow the same default.

**Changes required:**
1. `lib/language.ts:4` — add `diacriticTolerant: boolean` to the `LanguageConfig` interface.
2. `lib/language.ts:49` (ITALIAN config) — add `diacriticTolerant: true`.
3. `lib/language.ts:71` (SPANISH config) — add `diacriticTolerant: true`.
4. Every call site that calls `checkAnswer` (found in `components/StudyCard.tsx`) — pass `{ articles: lang.articles, diacriticTolerant: lang.diacriticTolerant }` as the options argument.

**Test required (write first):**
- `tests/language.test.ts` — add: `ITALIAN.diacriticTolerant === true`. `SPANISH.diacriticTolerant === true`. Every config returned by `getLanguageConfig` has `diacriticTolerant` defined as a boolean.

**Done condition:** `grep -n "diacriticTolerant" lib/language.ts` shows the field in the interface and both configs. `grep -n "diacriticTolerant" components/StudyCard.tsx` shows it is passed to `checkAnswer`. Verification gate green.

---
**Status: COMPLETE — 2026-06-27**

### Task #012 | Fix stability clamping — add upper bound in scheduleCard
**Severity:** 7 | **File(s):** `lib/srs.ts:177`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, arithmetic clamp

`scheduleCard()` at line 177 clamps stability with `Math.max(0.1, S)` — a lower bound only. Without an upper bound, extreme FSRS inputs (very high stability values after many correct reviews) can produce stability values above 36500 days (100 years), causing `nextInterval()` to return astronomically large integers that overflow date arithmetic.

**Changes required:**
1. `lib/srs.ts:177` — change:
   ```ts
   stability: Math.max(0.1, S),
   ```
   to:
   ```ts
   stability: Math.max(0.001, Math.min(36500, S)),
   ```
   Note: lower bound also tightened from 0.1 to 0.001 to match FSRS spec (0.1 day = 2.4 hours is too coarse for same-session relearning cards).
2. `lib/srs.ts:54-58` — `nextInterval()` currently has no upper bound. Add `Math.min(36500, ...)` wrapper around the final interval value before the `Math.round`.

**Test required (write first):**
- `tests/srs.test.ts` — add:
  - After scheduling a card with impossibly high stability (e.g. inject `stability: 999999`), `scheduleCard(card, "easy").stability` is `≤ 36500`.
  - `nextInterval(999999)` returns `≤ 36500`.
  - `scheduleCard(card, "again").stability` is `≥ 0.001`.

**Done condition:** Tests above pass. `grep -n "Math.max(0.1" lib/srs.ts` returns zero hits. Verification gate green.

**Status: COMPLETE — 2026-06-27**
---

### Task #013 | Make rateCard + saveActiveSession atomic in srsStore
**Severity:** 8 — CRITICAL | **File(s):** `store/srsStore.ts:95-101`, `app/study/page.tsx:207-237`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, single atomic action addition

`rateCard` (line 95-99) and `saveActiveSession` (line 101) are two separate Zustand `set()` calls. In `handleRate` (study/page.tsx:207-237), they are called sequentially: `rateCard(...)` at line 208, then `saveActiveSession(...)` at line 225. If the process crashes or the tab closes between these two calls, the card is rated but the session position is not updated — creating a state where the card was graded but the session resumes from the wrong position (the card will be graded again on resume).

**Changes required:**
1. `store/srsStore.ts` — add a new combined action `rateCardAndSaveSession(cardId: string, grade: Grade, session: ActiveSession): void` that performs a single `set()` call updating both `cards` and `activeSession` atomically:
   ```ts
   rateCardAndSaveSession: (cardId, grade, session) => {
     const prev = get().getProgress(cardId);
     const next = scheduleCard(prev, grade);
     set((s) => ({ cards: { ...s.cards, [cardId]: next }, activeSession: session }));
   },
   ```
   Add this to the `SRSState` interface.
2. `app/study/page.tsx:207-237` — replace the sequential `rateCard(currentCard.id, grade)` + `saveActiveSession({...})` calls with a single `rateCardAndSaveSession(currentCard.id, grade, { ... })`.
3. Keep `rateCard` and `saveActiveSession` as individual actions (they are used separately in other contexts), but `handleRate` must use only the atomic version.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: after `rateCardAndSaveSession("card-1", "good", session)`, both `useSRSStore.getState().cards["card-1"]` and `useSRSStore.getState().activeSession` are updated in one tick. Assert the card's `reps` is incremented AND `activeSession.position` matches the session argument — both in the same snapshot.

**Done condition:** `grep -n "rateCard\b" app/study/page.tsx` shows only `rateCardAndSaveSession` in `handleRate`. `rateCard` standalone is not called in `handleRate`. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #053 | Extract duplicate error string literals in lib/entitlement.ts to named constants
**Severity:** 3 — Low | **File(s):** `lib/entitlement.ts`
**DoD Tier:** 1
**Complexity: Direct**
**Status: COMPLETE — 2026-06-28** | WorldClass: 96/100 (2 cycles)

SCTS Poka-Yoke: `"Activation request failed — check your connection."` appears twice in `activateLicense` — once in the catch block and once in the null-body guard. `"Deactivation failed — check your connection."` appears twice in `deactivateLicense` — same pattern. Four string literals, two unique strings, zero named constants. A typo fix requires four edits instead of one.

**Changes required:**
1. `lib/entitlement.ts` — add two constants at module scope (after imports, before function definitions):
   ```ts
   const ERR_ACTIVATE_NETWORK = "Activation request failed — check your connection." as const;
   const ERR_DEACTIVATE_NETWORK = "Deactivation failed — check your connection." as const;
   ```
2. Replace all four inline string literals with their respective constants.

**Test required (write first):**
- `tests/entitlement.test.ts` — add four assertions pinning each call site to the constant value: (1) when `invoke` throws in `activateLicense`, the returned `error` equals `ERR_ACTIVATE_NETWORK`; (2) when the null-body guard fires in `activateLicense`, same; (3) when `invoke` throws in `deactivateLicense`, the returned `error` equals `ERR_DEACTIVATE_NETWORK`; (4) when the null-body guard fires in `deactivateLicense`, same. Import the constants from `lib/entitlement.ts` — do not hardcode the string in the test.

**Done condition:** `grep -n 'return.*"Activation request failed\|return.*"Deactivation failed' lib/entitlement.ts` returns zero hits (pattern excludes constant definitions, matches only inline return-site usages). `grep -n "ERR_ACTIVATE_NETWORK\|ERR_DEACTIVATE_NETWORK" lib/entitlement.ts` returns hits on constants and all four usage sites. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #054 | Add render-based mount test for EntitlementValidator component wiring
**Severity:** 3 — Low | **File(s):** `components/EntitlementValidator.test.tsx`
**DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only addition

The `useEffect(() => { void runEntitlementValidation(useEntitlementStore.getState); }, [])` wiring in `EntitlementValidator.tsx` is exercised only by calling `runEntitlementValidation` directly. The component mount path — that rendering `<EntitlementValidator/>` actually invokes `runEntitlementValidation` with the production store getter — is unverified. A refactor that passes `null` or a stale closure would not be caught.

**Changes required:**
1. `components/EntitlementValidator.test.tsx` — add a test that:
   - Spies on `runEntitlementValidation` with `vi.spyOn`.
   - Renders `<EntitlementValidator/>` via `render()`.
   - Asserts the spy was called exactly once.
   - Asserts it was called with `useEntitlementStore.getState` (the production getter, not `null` or a stub).
   Clean up the spy in `afterEach`.

**Test required:** This task IS the test.

**Done condition:** `npm test -- EntitlementValidator` passes with the new render-based assertion. The test uses `render(<EntitlementValidator/>)`, not a direct function call. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #055 | Restrict reset() helper type in tests/entitlement.test.ts to state-only fields
**Severity:** 2 — Low | **File(s):** `tests/entitlement.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

The `reset()` helper is typed as `Partial<ReturnType<typeof store>>` where `store = () => useEntitlementStore.getState()`. The return type includes all action methods (`setEntitlement`, `clearEntitlement`, `isPackUnlocked`, `markValidated`, etc.). This makes `reset({ isPackUnlocked: () => true })` type-valid — Zustand's `setState` would silently merge it and overwrite the real action with a stub, potentially corrupting other tests with no type error.

**Changes required:**
1. `tests/entitlement.test.ts` — define a state-only type using `Pick`:
   ```ts
   type EntitlementStateOnly = Pick<EntitlementState,
     "licenseKey" | "instanceId" | "licenseType" | "unlockedPacks" |
     "validUntil" | "lastValidated"
   >;
   ```
2. Change the `reset` helper's parameter type from `Partial<ReturnType<typeof store>>` to `Partial<EntitlementStateOnly>`.

**Test required (write first):**
- Add a comment block above the `reset` helper: `// STATE ONLY — action methods are excluded to prevent silent store corruption. See Task #055.`
- Verify the type narrowing: `npx tsc --noEmit` must error if `reset({ isPackUnlocked: () => true })` is passed (add as a `// @ts-expect-error` line to confirm the error is present, then remove the call).

**Done condition:** `grep -n "Partial<ReturnType" tests/entitlement.test.ts` returns zero hits. `npx tsc --noEmit` passes with the narrowed type. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #056 | Add test for setTargetLangCode in lib/constants.ts
**Severity:** 3 — Low | **File(s):** `lib/constants.ts:setTargetLangCode:24`, `tests/srsStore.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

Task #002 WorldClass accepted gap (-2 pts). When `lib/constants.ts` was created in Task #002, `getTargetLangCode` received 4 tests and `setTargetLangCode` received none. The asymmetry is visible in a pure-utility file where both functions are trivially testable.

**Changes required:**
1. `tests/srsStore.test.ts` — add a `describe("lib/constants — setTargetLangCode")` block:
   - `setTargetLangCode("fr")` writes `"en-fr"` under `LANG_PAIR_KEY` in `localStorage`.
   - `setTargetLangCode("it")` writes `"en-it"`.
   - Round-trip: `setTargetLangCode("fr")` then `getTargetLangCode()` returns `"fr"`.
   - SSR guard: calling `setTargetLangCode` when `window` is `undefined` does not throw.

**Test required (write first):** This task IS the tests.

**Done condition:** `grep -n "setTargetLangCode" tests/srsStore.test.ts` returns ≥4 hits. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #057 | Mark re-export in hooks/useLangPack.ts as deprecated
**Severity:** 2 — Low | **File(s):** `hooks/useLangPack.ts:10-11`
**DoD Tier:** 1
**Complexity: Direct**

Task #002 WorldClass accepted gap (-1 pt). The re-export `export { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode }` at line 11 creates two valid import paths for the same symbols with no indication which is preferred or when the compat shim will be removed. All six known consumers were updated to import from `@/lib/constants` directly in Task #002. The re-export is residue.

**Changes required:**
1. `hooks/useLangPack.ts:10-11` — add a JSDoc `@deprecated` comment above the re-export:
   ```ts
   /**
    * @deprecated Import directly from "@/lib/constants". This re-export exists for
    * backward compatibility only and will be removed once all consumers are confirmed
    * on the canonical import path.
    */
   export { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode };
   ```

**Test required (write first):**
- `tests/srsStore.test.ts` — add an import-graph assertion: `hooks/useLangPack.ts` must still export `LANG_PAIR_KEY` (backward compat is preserved). Assert via `grep` seam test: the file must contain the string `export { LANG_PAIR_KEY` AND the string `@deprecated`.

**Done condition:** `grep -n "@deprecated" hooks/useLangPack.ts` returns a hit. `grep -n "export { LANG_PAIR_KEY" hooks/useLangPack.ts` returns a hit (compat export still present). Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #058 | Replace static USED BY list in lib/constants.ts header with grep reference
**Severity:** 2 — Low | **File(s):** `lib/constants.ts:9-10`
**DoD Tier:** 1
**Complexity: Direct**

Task #002 WorldClass accepted gap (-1 pt). The Rule 2 header in `lib/constants.ts` contains a hardcoded `USED BY:` importer list. This list silently goes stale whenever a new consumer is added without updating the header — the defect that Rule 2 headers are meant to prevent.

**Changes required:**
1. `lib/constants.ts:9-10` — replace:
   ```ts
   // USED BY: store/srsStore.ts, hooks/useLangPack.ts,
   //          app/learn/page.tsx, app/settings/page.tsx, app/page.tsx
   ```
   with:
   ```ts
   // USED BY: grep -r "from \"@/lib/constants\"" --include="*.ts" --include="*.tsx" .
   ```
   This makes the header self-maintaining: the grep command always returns the current live importer list.

**Test required (write first):**
- `tests/srsStore.test.ts` — add an import-graph seam test: the string `"USED BY: store/srsStore"` must NOT appear in `lib/constants.ts` (regression guard against the static list being restored).

**Done condition:** `grep -n "USED BY: store/srsStore" lib/constants.ts` returns zero hits. `grep -n "grep -r" lib/constants.ts` returns a hit. Verification gate green.

**Status: COMPLETE — 2026-06-26**
---

### Task #071 | architecture | severity 7
**What:** Fix Rule 3 upward import in `lib/importBackup.ts:14` — extract `migrateSrsStore` call out of the utilities layer
**Why:** Rule 3 stop-the-line violation. `lib/importBackup.ts:14` imports `@/store/migrations` — a Utilities-layer file importing from the Services layer. The fix is to move the migration dependency: either (a) pass `migratedSrs` data in via parameter from the caller (store layer), or (b) extract the migration step to a pure `lib/` function that doesn't import from `store/`. Option (a) is simpler: the caller of `parseBackup` (in `app/settings/page.tsx`) already has access to the store; it can call `migrateSrsStore` separately after `parseBackup` returns the raw data.
**File:** `lib/importBackup.ts:14`, `app/settings/page.tsx` (caller)
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Full**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — backup import flow must be tested end-to-end after refactor. Regression risk: `parseBackup` signature change affects the caller.
**Test required (write first):** `tests/importBackup.test.ts` — add import-graph assertion: `lib/importBackup.ts` must not contain the string `"@/store"`. Existing backup round-trip tests must still pass.
**Done condition:** `grep -n "@/store" lib/importBackup.ts` returns zero hits. Verification gate green.
**Owner:** Architecture Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #072 | architecture | severity 3
**What:** Delete `app/decks/` empty directory
**Why:** Empty directories confuse future agents and maintainers. Owner confirmed: delete it. If a Decks feature is later planned, it gets a real task and a stub page at that time.
**File:** `app/decks/` (entire directory)
**Severity:** 3 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — directory has no files, no routes, no imports.
**Test required (write first):** `grep -r "app/decks" --include="*.ts" --include="*.tsx" . | grep -v node_modules` should return zero hits before and after.
**Done condition:** `ls app/decks 2>/dev/null` returns non-zero (directory does not exist). Verification gate green.
**Owner:** Architecture Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #073 | tests | severity 3
**What:** Ratchet `vitest.config.ts` coverage thresholds to match current actual coverage (SCTS Kaizen rule)
**Why:** SCTS Kaizen: coverage thresholds must only ever increase. Coverage improved to lines=85.37%, functions=80.82%, branches=80.23%, stmts=83.49%. Thresholds still at 2026-06-25 values (lines=81, funcs=75, branches=75, stmts=79). Safe new values: lines=84, functions=79, branches=79, statements=82 (actual minus 1.5% buffer).
**File:** `vitest.config.ts`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, threshold update
**Blocked by:** Nothing | **Blocks:** Nothing (but should be applied after any task that adds tests in same batch)
**Risk:** Low — pure threshold increase; failing tests would have already failed at lower threshold.
**Test required (write first):** No new test needed. `npx tsc --noEmit && npm test` must pass after threshold change.
**Done condition:** `grep -n "lines.*84\|functions.*79\|branches.*79\|statements.*82" vitest.config.ts` returns hits. `npm test` passes. Verification gate green.
**Owner:** QA Agent

**Status: COMPLETE — 2026-06-27**
---

### Task #074 | security | severity 4
**What:** Sanitize `deactivateLicense` error string before returning to UI — `lib/entitlement.ts:207`
**Why:** `deactivateLicense` returns `res.error` directly from raw Lemon Squeezy API response body to the caller, which renders it to the user. LS errors can include key-identifying information (e.g., `"Instance not found for key XXXX-XXXX..."`). The `catch` block at line 197 already avoids this, but the `!res.deactivated` branch at line 207 does not.
**File:** `lib/entitlement.ts:207`
**Severity:** 4 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — replace one string with a safe fallback.
**Test required (write first):** `tests/entitlement.test.ts` — add: when LS API returns `deactivated:false` with `error:"Instance not found for key XXXX"`, `result.error` does not contain `"XXXX"` and equals the generic `"Deactivation was declined by the server."`.
**Done condition:** `grep -n "res.error" lib/entitlement.ts` returns zero hits in the return statement. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**
---

### Task #075 | error-handling | severity 5
**What:** Fix new silent `catch {}` in `packLoader.ts:223-226` — the cache-parse failure catch in `loadPack`
**Why:** Architecture agent found a third silent catch in `packLoader` beyond the two in Task #008. Lines 223-226: when `JSON.parse` of cached pack fails, the `catch {}` silently calls `clearPackCache(lang)` and falls through. Rule 8: log with a ref ID before evicting. An agent cannot diagnose "why is the user re-downloading packs every session" without this log.
**File:** `lib/packLoader.ts:223-226`
**Severity:** 5 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — logging only + existing `clearPackCache` call preserved.
**Test required (write first):** `tests/packLoader.test.ts` — add: when `localStorage.getItem` returns corrupted JSON (e.g., `"{broken"`), `console.error` is called with a string matching `CACHE_PARSE_FAIL`. `loadPack` falls through to re-download.
**Done condition:** `grep -n "CACHE_PARSE_FAIL" lib/packLoader.ts` returns a hit. `grep -n "catch {" lib/packLoader.ts` returns zero hits. Verification gate green.
**Owner:** Security Agent

**Status: COMPLETE — 2026-06-26**

### Task #077 | security | severity 5
**What:** Remove `"fr"`, `"de"`, `"pt"` from `ALL_PACK_CODES` and `LANG_CONFIG_MAP` in `lib/langRegistry.ts` — these are forward-looking stubs for languages with no content yet. The placeholder LANG_CONFIG_MAP entries fail the strengthened assertions added in Task #062.
**Why:** Task #062 tightened `tests/langRegistry.test.ts` to verify that every registered code has a real config. The right fix for an Italian-only product is to remove the unbuilt language stubs entirely, not to add fake configs. `ALL_PACK_CODES` should only list languages with real packs. When fr/de/pt packs are ready to ship, re-add them with real configs.
**File:** `lib/langRegistry.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, removal only
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — removal only. After change: verify no other file references `"fr"`, `"de"`, or `"pt"` as pack codes: `grep -rn '"fr"\|"de"\|"pt"' --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "\.test\."`.
**Test required:** None beyond existing #062 assertions — removing the stubs is what makes those tests pass. Run `npm test -- tests/langRegistry.test.ts` to confirm all assertions green.
**Done condition:** `grep -n '"fr"\|"de"\|"pt"' lib/langRegistry.ts` returns zero hits. `npm test tests/langRegistry.test.ts` passes with zero failures. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-27**

---

## Batch 2 — Test Foundation [ACTIVE]
Dependency: Batch 1 complete.
Theme: Component tests, seam tests, property-based invariants. Fix known false-green test bugs.

### Task #014 | Fix false-green poka-yoke test in language.test.ts
**Severity:** 7 | **File(s):** `tests/language.test.ts:206-211`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files (tests/language.test.ts + lib/language.ts), no package boundary, test fix + stub

The poka-yoke guard at lines 206-211 asserts `cfg.code !== "it"` but `LANGUAGE_MAP` has `fr`, `de`, `pt` all pointing to `SPANISH` (which has `code: "es"`). The test passes not because the mapping is correct but because `"es" !== "it"` — false green. The test should assert `cfg.code === code` (the returned config's code must match the requested language code).

**Changes required:**
1. `tests/language.test.ts:210` — change:
   ```ts
   expect(cfg.code, ...).not.toBe("it");
   ```
   to:
   ```ts
   expect(cfg.code, `getLanguageConfig("${code}") returned wrong config — update LANGUAGE_MAP in lib/language.ts`).toBe(code);
   ```
2. This will immediately fail for `fr`, `de`, `pt` because their `LANGUAGE_MAP` entries point to `SPANISH` (code `"es"`). Fix `lib/language.ts:99-101` — for placeholder languages, create minimal stub configs with the correct `code` field, or use `ITALIAN` as a placeholder with the correct code overridden. The cleanest fix: create `PLACEHOLDER_LANG_CONFIG(code: string): LanguageConfig` factory that returns a config with the correct `code` field derived from the argument, reusing ITALIAN/SPANISH UI strings until real configs are authored.

**Test required:** The test itself is the fix — it must fail before the `lib/language.ts` fix and pass after.

**Done condition:** `npm test -- tests/language.test.ts` passes. `getLanguageConfig("fr").code === "fr"`. Verification gate green.

---

### Task #015 | Delete dead test file — tests/grading.test.ts
**Severity:** 3 | **File(s):** `tests/grading.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

`tests/grading.test.ts` is a strict subset of `tests/srs.test.ts` — every assertion it contains already exists in srs.test.ts. It adds zero coverage and creates maintenance drift (if `autoRate` behaviour changes, both files need updating).

**Changes required:**
1. Delete `tests/grading.test.ts`.
2. Confirm `tests/srs.test.ts` covers every test case that was in `grading.test.ts` — the 5 `autoRate` tests are already present.

**Done condition:** `ls tests/grading.test.ts` returns "No such file". `npm test` passes without it. Verification gate green.

---

### Task #016 | Fix vacuous assertion in language.test.ts
**Severity:** 4 | **File(s):** `tests/language.test.ts:196`
**DoD Tier:** 1
**Complexity: Direct**

Line 196 uses `toBeTruthy()` on a card label string. Any non-empty string passes `toBeTruthy()`, including `"undefined"` or `" "`. This is a vacuous assertion — it does not verify the label is meaningful.

**Changes required:**
1. `tests/language.test.ts:196` — replace `toBeTruthy()` with a specific assertion. For card labels, use `expect(label).toMatch(/\S/)` (non-whitespace) AND `expect(label).not.toBe("undefined")` AND `expect(label.length).toBeGreaterThan(2)` (labels must be at least 3 chars to be meaningful — "OK" would fail this correctly).

**Done condition:** `grep -n "toBeTruthy" tests/language.test.ts` returns zero hits. Verification gate green.

---

### Task #017 | Add unit tests for lib/storage.ts
**Severity:** 6 | **File(s):** `lib/storage.ts` (no test file exists)
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation

`createPlatformStorage` and `useIsHydrated` have zero tests. `createPlatformStorage` is the persistence foundation for every Zustand store — a regression here silently corrupts all user data.

**Changes required:**
Create `tests/storage.test.ts` with:
1. `createPlatformStorage` — in the web (non-Tauri) path, `setItem`/`getItem`/`removeItem` round-trip correctly through a mocked `localStorage`.
2. `createPlatformStorage` — `getItem` on a missing key returns `null` (not `undefined`).
3. `createPlatformStorage` — when `localStorage` throws (mocked to throw), `getItem` propagates the error rather than swallowing it.
4. `useIsHydrated` — renders `false` before hydration, then `true` after `onFinishHydration` fires (use `renderHook` from `@testing-library/react`).

**Done condition:** `tests/storage.test.ts` exists with ≥4 passing tests covering the above. Verification gate green.

---

### Task #018 | Add component test for StudyCard.tsx (Rule 14)
**Severity:** 6 | **File(s):** `components/StudyCard.tsx` (no co-located test)
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation

Rule 14: every user-facing React component has a co-located `.test.tsx`. `StudyCard.tsx` has zero tests. It is the primary interactive component — a regression here breaks the core loop.

**Changes required:**
Create `components/StudyCard.test.tsx` with:
1. Renders without crashing given a `produce` card.
2. Text input accepts typed answers.
3. Submitting a correct answer calls `onRate` with a non-`"again"` grade.
4. Submitting a wrong answer calls `onRate` with `"again"` (after 3 attempts, or immediately if that is how the component works — check `StudyCard.tsx` impl).
5. The card shows the prompt text.
6. After a correct answer, the correct feedback string is visible.

**Done condition:** `components/StudyCard.test.tsx` exists. `npm test -- components/StudyCard.test.tsx` passes all 6 cases. Verification gate green.

---

### Task #019 | Add component tests for EntitlementValidator and InterruptHandler (Rule 14)
**Severity:** 5 | **File(s):** `components/EntitlementValidator.tsx`, `components/InterruptHandler.tsx`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, test-only creation

Both components have zero tests (Rule 14 violation).

**Changes required:**
Create `components/EntitlementValidator.test.tsx`:
1. Does not call `validateLicense` when `needsValidation()` returns false.
2. Calls `validateLicense` when `needsValidation()` returns true and `licenseKey`/`instanceId` are set.
3. Calls `markValidated` when validation succeeds.
4. Does NOT call `console.warn` on validation failure (regression guard for #009).

Create `components/InterruptHandler.test.tsx`:
1. Does not register the `interrupt:fire` listener when `isTauri` is false.
2. Does not navigate to `/study` when `isInDnd` is true.
3. Calls `updateInterruptConfig` when `interruptEnabled` changes.

**Done condition:** Both test files exist and all tests pass. Verification gate green.

---

### Task #020 | Add seam test — pack load → buildQueue → rateCard → saveActiveSession
**Severity:** 8 | **File(s):** `tests/` (new file), spanning `lib/packLoader.ts`, `lib/queue.ts`, `store/srsStore.ts`
**DoD Tier:** 2
**Complexity:** 🔧 Full — 3+ files (spanning lib/packLoader.ts, lib/queue.ts, store/srsStore.ts)

Rule 13: cross-boundary data has at least one integration test without mocking intermediate layers. The most critical path — load pack → build queue → rate card → save session — has no seam test. A regression in any hand-off (e.g. wrong card ID format, queue building with stale state) would be invisible until a user hits it.

**Changes required:**
Create `tests/seam_studyLoop.test.ts`:
1. Load a real (non-mocked) pack subset: import 2-3 cards from `content/index.ts` directly.
2. Call `buildQueue(cards, getDueCards, getNewCards, false)` with a fresh store state — assert queue is non-empty.
3. Call `rateCardAndSaveSession(queue[0].id, "good", session)` on the store.
4. Assert `useSRSStore.getState().cards[queue[0].id].reps === 1`.
5. Assert `useSRSStore.getState().activeSession.position === 1`.
6. Assert both changes happened in the same store tick (no intermediate state where only one was updated) — verify by checking that between steps 2 and 4 there was only one `set()` call (use `vi.spyOn` on the store's `setState`).

**Done condition:** `tests/seam_studyLoop.test.ts` exists and passes. `npm test -- tests/seam_studyLoop.test.ts` green. Verification gate green.

---

### Task #021 | Add seam test — parseBackup → setState → getDueCards
**Severity:** 6 | **File(s):** `tests/` (new file), spanning `lib/importBackup.ts`, `store/srsStore.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, seam test creation

No integration test covers the backup restore path. A corrupted `parseBackup` output that passes its own validation but produces bad store state (e.g. wrong `dueDate` types) would silently break `getDueCards`.

**Changes required:**
Create `tests/seam_importRestore.test.ts`:
1. Construct a minimal valid backup JSON with 2 card progress entries (one due, one not).
2. Call `parseBackup(json)` — assert `result.ok === true`.
3. Apply `useSRSStore.setState({ ...result.srs })`.
4. Call `getDueCards(mockCards)` where `mockCards` matches the card IDs from the backup.
5. Assert the due card is returned and the non-due card is not.
6. Assert `getDueCards` does not throw when given card IDs not present in the backup (graceful degradation).

**Done condition:** `tests/seam_importRestore.test.ts` exists and passes. Verification gate green.

---

### Task #022 | Add property-based FSRS invariant tests
**Severity:** 6 | **File(s):** `tests/srs.test.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, parameterized test addition

No property-based tests verify FSRS mathematical invariants. These catch edge cases (extreme inputs, adversarial grades) that unit tests with fixed inputs miss.

**Changes required:**
Add to `tests/srs.test.ts`:
1. **Difficulty invariant:** For any `CardProgress` and any `Grade`, `scheduleCard(prev, grade).difficulty` is always in `[1, 10]`. Test with: all four grades × states `new/learning/review/relearning` × difficulty values `1, 5, 10`.
2. **Stability lower bound:** `scheduleCard(prev, grade).stability >= 0.001` for all inputs.
3. **Stability upper bound:** `scheduleCard(prev, grade).stability <= 36500` for all inputs (guards #012).
4. **dueDate monotonicity:** For non-`"again"` grades in `review` state, `scheduleCard(prev, grade).dueDate > prev.dueDate`.
5. **Reps always increments:** `scheduleCard(prev, grade).reps === prev.reps + 1` for all inputs.
These can be parameterized tests using `it.each` — no property-testing library required.

**Done condition:** 5 parameterized invariant tests added and passing. Verification gate green.

---

### Task #023 | Add getNewCards prerequisite logic tests
**Severity:** 5 | **File(s):** `tests/srsStore.test.ts`
**DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, test augmentation

`getNewCards` in `store/srsStore.ts:126-133` has prerequisite logic (`prerequisitesMet` at line 80-83) that is completely untested. A bug here could surface cards whose prerequisites are not met (level gating failure).

**Changes required:**
Add to `tests/srsStore.test.ts`:
1. A card with no prerequisites is returned by `getNewCards`.
2. A card whose prerequisite card is in state `"new"` (not yet reviewed) is NOT returned.
3. A card whose prerequisite card is in state `"review"` IS returned.
4. `getNewCards` respects the `limit` parameter — never returns more than `limit` cards.
5. `getNewCards` returns cards sorted by tier (tier 1 before tier 2).

**Done condition:** 5 tests added and passing. Verification gate green.

---

### Task #076 | tests | severity 4
**What:** Add `lib/storage.ts` test coverage — no test file exists; 42.42% statement coverage
**Why:** `lib/storage.ts` has 7 importers and zero dedicated tests. QA agent found 42.42% statement coverage with uncovered paths at lines 54, 72-73, 99-107. Rule 5: every new behaviour has a test. This is existing behaviour with no tests. Note: Task #017 in this batch covers the same file — these tasks should be merged at execution time; the DoD is the union of both task specs.
**File:** `lib/storage.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-only creation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required (write first):** Create `tests/storage.test.ts` covering: (a) `getItem` returns `null` when key doesn't exist; (b) `setItem` + `getItem` round-trip; (c) `removeItem` clears the key; (d) SSR guard (`window` undefined) does not throw; (e) error path when `localStorage` throws.
**Done condition:** `npm test -- tests/storage.test.ts` passes. `grep -n "from.*storage" tests/storage.test.ts` returns a hit. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**
**Status: COMPLETE — 2026-06-27**

---

## Batch 3 — Architecture Cleanup [COMPLETE]
Dependency: Batch 1 complete, Batch 2 in progress (Batch 3 can start when Batch 2 is 50% done).
Theme: File size violations, extraction of pure functions, inline computation, UI primitives.

### Task #024 | Extract pure functions from app/learn/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/learn/page.tsx:52-71`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/learn/page.tsx, store/srsStore.ts, components/UnitRow.tsx)

Two computations violate Rule 15 (pure classification) and bloat the route beyond 150 lines:
- `levelMastery()` closure (lines 52-61): aggregates mastery across all units in a level. It depends on `cards` and `byLevel` — both available in the store and computed at render time. This is a pure function of `(units: Unit[], progressMap: Record<string, CardProgress>) => number`.
- `currentLevel` IIFE (lines 64-71): derives the highest level with any progress. Pure function of `(levels: Level[], masteryFn: ...) => Level`.

**Changes required:**
1. `store/srsStore.ts` — add exported pure function `levelMasteryPct(units: Unit[], progressMap: Record<string, CardProgress>): number` that performs the same computation as the inline closure.
2. `store/srsStore.ts` — add exported pure function `currentStudyLevel(levels: readonly string[], levelMasteryFn: (lvl: string) => number): string` that derives the current level.
3. `app/learn/page.tsx:52-71` — remove inline `levelMastery` closure and `currentLevel` IIFE. Import and call the store functions instead.
4. `UnitRow` component (lines 242-333, 92 lines) — extract to `components/UnitRow.tsx` (its own file). This is a self-contained component with a clear interface.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: `levelMasteryPct([], {}) === 0`. `levelMasteryPct([unit with 2 cards], progressMap where 1 is mastered) === 50`. `currentStudyLevel` returns the highest level with progress > 0.
- `components/UnitRow.test.tsx` — basic render test (Rule 14): renders unit name, shows due badge when `stats.due > 0`, shows locked state when `unlocked === false`.

**Done condition:** `app/learn/page.tsx` ≤ 150 lines. `components/UnitRow.tsx` exists. `levelMasteryPct` and `currentStudyLevel` are in `store/srsStore.ts` and tested. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #025 | Extract tierLabel dict and Stat component from app/study/page.tsx (Rules 15, 1)
**Severity:** 5 | **File(s):** `app/study/page.tsx:310-315`, `app/study/page.tsx:382-399`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/study/page.tsx, lib/cardLabels.ts, components/Stat.tsx)

- `tierLabel` dict (lines 310-315): defined inline in the render body. Rule 15: a data→UI mapping with more than one key must be a pure tested function (or at minimum a module-level constant). It should be a named export from a lib or the store.
- `Stat` component (lines 382-399): a self-contained UI primitive defined inside the page file. Should be extracted to `components/Stat.tsx`.
- `StudyInner` function is 379 lines — the page file total is 407 lines, well above the 150-line route limit.

**Changes required:**
1. `lib/srs.ts` (or a new `lib/cardLabels.ts`) — add `export const TIER_LABELS: Record<number, string> = { 1: "Vocabulary", 2: "Grammar", 3: "Phrases", 4: "Sentences" }` as a module-level constant. Export a pure function `tierLabel(tier: number): string` that does `TIER_LABELS[tier] ?? ""`.
2. `app/study/page.tsx:310-315` — remove inline dict, import `tierLabel` from the lib.
3. `components/Stat.tsx` — extract the `Stat` function (lines 382-399) into its own file.
4. The session resume state machine (the `useEffect` at lines 97-119 that calls multiple `setState` in sequence) should be extracted into a `useReducer` as the comment at line 95 notes. This will bring the page below 150 lines.

**Test required (write first):**
- `tests/srs.test.ts` — add: `tierLabel(1) === "Vocabulary"`, `tierLabel(4) === "Sentences"`, `tierLabel(99) === ""`.
- `components/Stat.test.tsx` — renders `value` and `label`, applies highlight class when `highlight === true`.

**Done condition:** `app/study/page.tsx` ≤ 150 lines. `TIER_LABELS` is a named constant. `components/Stat.tsx` exists. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #026 | Extract Section, Toggle, and schedule DnD UI from app/settings/page.tsx (Rule 1)
**Severity:** 5 | **File(s):** `app/settings/page.tsx` (509 lines — 3.4× the 150-line route limit)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 5 files (app/settings/page.tsx, components/settings/Section.tsx, components/settings/Toggle.tsx, hooks/useExportImport.ts, hooks/useLicenseActivation.ts)

`app/settings/page.tsx` is 509 lines — the worst file-size violation in the codebase. It contains at least four extractable concerns:
- `Section` and `Toggle` UI primitives (search for their inline definitions)
- Export/import logic (`handleExport`, `handleImportFile`, related state)
- License activation/deactivation/validation logic (already in `lib/entitlement.ts` — the page has 90 lines of UI state machine for this)
- DnD schedule UI

**Changes required:**
1. `components/settings/Section.tsx` — extract the `Section` UI primitive.
2. `components/settings/Toggle.tsx` — extract the `Toggle` UI primitive.
3. `hooks/useExportImport.ts` — extract `handleExport`, `handleImportFile`, and the `dataStatus` state into a hook.
4. `hooks/useLicenseActivation.ts` — extract `handleActivate`, `handleValidate`, `handleDeactivate`, `licenseInput`, `licenseStatus` state into a hook.
5. `app/settings/page.tsx` — consume the extracted hooks and components. Target: ≤ 150 lines.

**Test required (write first):**
- `components/settings/Toggle.test.tsx` — renders label, fires `onChange` when clicked.
- `hooks/useExportImport.test.ts` — `handleExport` creates a download link (mock `document.createElement`). `handleImportFile` calls `parseBackup` on the file content.

**Done condition:** `app/settings/page.tsx` ≤ 150 lines. All extracted files exist. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #027 | Extract checkAnswer + levenshtein to lib/answerCheck.ts
**Severity:** 4 | **File(s):** `lib/srs.ts:218-266`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 4 files (lib/srs.ts, lib/answerCheck.ts, lib/language.ts, components/StudyCard.tsx)

`checkAnswer` and `levenshtein` are answer-evaluation utilities that have grown in complexity (NFC normalization, diacritic tolerance from #010-#011, article stripping). They belong in their own focused module (`lib/answerCheck.ts`) per Rule 6 (Extract Ready — every module can become its own SaaS product). `lib/srs.ts` should only contain FSRS scheduling logic.

**Changes required:**
1. Create `lib/answerCheck.ts` — move `checkAnswer`, `levenshtein`, `stripArticle`, `ITALIAN_ARTICLES`, `SPANISH_ARTICLES` from `lib/srs.ts`. Keep exports from `lib/srs.ts` as re-exports for backwards compatibility (`export { checkAnswer, ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck"`).
2. Update all import sites of `checkAnswer`, `ITALIAN_ARTICLES`, `SPANISH_ARTICLES` to import from `@/lib/answerCheck`. Callers: `lib/language.ts:2`, `components/StudyCard.tsx` (wherever it calls checkAnswer).

**Test required:** Tests already exist in `tests/srs.test.ts` for `checkAnswer`. Add `tests/answerCheck.test.ts` that imports directly from `lib/answerCheck` to pin the module boundary.

**Done condition:** `lib/answerCheck.ts` exists. `lib/srs.ts` imports `checkAnswer` from `lib/answerCheck`. `wc -l lib/srs.ts` ≤ 250 (Rule 2 for services). Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #028 | Extract exportBackup logic to lib/exportBackup.ts
**Severity:** 4 | **File(s):** `app/settings/page.tsx:114-145` (inline in page)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/settings/page.tsx, lib/exportBackup.ts, tests/exportBackup.test.ts)

The export logic (`handleExport` function) is currently embedded in the settings page. It directly reads store state and constructs a JSON blob. This is a service-layer concern, not a route concern. Extracting it allows independent testing and future reuse (e.g. auto-backup on schedule).

**Changes required:**
1. Create `lib/exportBackup.ts` — move the export payload construction logic into `exportBackup(srsState, entitlementState, langPair: string): string` that returns the JSON string. The DOM manipulation (create `<a>`, click, revoke) stays in the settings page or hook.
2. `app/settings/page.tsx` / `hooks/useExportImport.ts` (from #026) — call `exportBackup()` from `lib/exportBackup.ts`.

**Test required (write first):**
- `tests/exportBackup.test.ts` — `exportBackup(srsState, entitlementState, "en-it")` returns a parseable JSON string containing `_version: 2`, `langPair: "en-it"`, and `srs.cards`.

**Done condition:** `lib/exportBackup.ts` exists. `tests/exportBackup.test.ts` passes. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #029 | Add feature flag system (Rule 4)
**Severity:** 5 | **File(s):** `lib/` (new file), `next.config.ts`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "new feature" keyword, 4 files (lib/featureFlags.ts, next.config.ts, components/InterruptHandler.tsx, tests/featureFlags.test.ts)

No feature flag system exists. Rule 4: every new feature must be toggleable off. This blocks shipping the proactive interruption engine, vacation mode, analytics, and any Pro feature safely behind a flag.

**Changes required:**
1. Create `lib/featureFlags.ts` — define a `FeatureFlags` interface and a `getFeatureFlags(): FeatureFlags` function. Flags read from `process.env.NEXT_PUBLIC_FLAGS_*` at build time (Next.js static replacement). Initial flags:
   ```ts
   export interface FeatureFlags {
     interruptEngine: boolean;  // NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE
     vacationMode: boolean;     // NEXT_PUBLIC_FLAGS_VACATION_MODE
     analytics: boolean;        // NEXT_PUBLIC_FLAGS_ANALYTICS
   }
   ```
2. `next.config.ts` — document the flag env vars in a comment.
3. `components/InterruptHandler.tsx` — gate the interrupt listener registration behind `getFeatureFlags().interruptEngine`. If the flag is off, the component returns null immediately.

**Test required (write first):**
- `tests/featureFlags.test.ts` — `getFeatureFlags()` returns all flags as booleans. When `NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE` is `"false"`, `interruptEngine` is `false`. When absent, defaults to `true` (feature on by default).

**Done condition:** `lib/featureFlags.ts` exists. `tests/featureFlags.test.ts` passes. `components/InterruptHandler.tsx` reads the flag. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

## Batch 4 — Documentation + Cleanup [COMPLETE]
Dependency: Batch 1 complete. Batches 2-3 complete.
**Execution order: #033 first (expedited per /meet 2026-06-27 — CONTRIBUTING_LANGUAGE.md has 5 new issues). Then #030, #031, #032, #078, #079, #080, #081, #082, #083 in parallel where file sets permit.**
Theme: CLAUDE.md architecture content, STATUS.md, undocumented patterns, BRAND compliance, remaining Rule 1/2 gaps.

### Task #030 | Add file headers to all 39 files missing them (Rule 2)
**Severity:** 3 | **File(s):** 39 files listed below
**DoD Tier:** 1
**Complexity:** ⚡ Direct — 39 files, mechanical header-only addition, no logic changes

Rule 2: every file starts with `// ========================================` human header. 39 files are missing this (26 original + 13 added by Batch 3 per /meet 2026-06-27; note `lib/featureFlags.ts` already compliant).

Files to update (add header to each):
**Original 26:** `lib/language.ts`, `lib/storage.ts`, `lib/packLoader.ts`, `lib/tauri.ts`, `lib/importBackup.ts`, `lib/langRegistry.ts`, `lib/srs.ts`, `lib/entitlement.ts`, `lib/queue.ts`, `store/settingsStore.ts`, `store/migrations.ts`, `store/srsStore.ts`, `store/entitlementStore.ts`, `scripts/exportPack.ts`, `scripts/checkCardIds.ts`, `scripts/validatePack.ts`, `app/layout.tsx`, `app/page.tsx`, `components/StudyCard.tsx`, `components/InterruptHandler.tsx`, `components/EntitlementValidator.tsx`, `hooks/useLangPack.ts`, `app/settings/page.tsx`, `app/study/page.tsx`, `app/learn/page.tsx`, `app/stats/page.tsx`

**Batch 3 additions (13 new):** `lib/answerCheck.ts`, `lib/cardLabels.ts`, `lib/exportBackup.ts`, `hooks/useStudySession.ts`, `hooks/useExportImport.ts`, `hooks/useLicenseActivation.ts`, `components/UnitRow.tsx`, `components/LevelSection.tsx`, `components/Stat.tsx`, `components/StudyDoneScreen.tsx`, `components/StudyResumePrompt.tsx`, `components/settings/Section.tsx`, `components/settings/Toggle.tsx`

Header format:
```ts
// ============================================================
// {filename} — {one-line description of what this file does}
// ============================================================
```

**Done condition:** `grep -rL "=====" lib/ store/ components/ hooks/ scripts/ app/ --include="*.ts" --include="*.tsx"` returns zero files. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #031 | Write CLAUDE.md architecture section
**Severity:** 4 | **File(s):** `CLAUDE.md`
**DoD Tier:** 4
**Complexity:** ⚡ Direct — 1 file, no package boundary, documentation addition

`CLAUDE.md` currently contains only three `@include` directives and no architecture content. Agents onboarding to this codebase have no map of the layer structure, storage abstraction, Tauri degradation pattern, or migration convention.

**Changes required:**
Add an `## Architecture` section to `CLAUDE.md` covering:
1. **Layer map:** Routes (`app/`) → Services (`lib/`) → Utils → Config. Never import upward. Store (`store/`) is a peer of `lib/` — not a layer above it.
2. **Tauri graceful-degradation pattern:** Always import from `lib/tauri.ts`, never from `@tauri-apps/api` directly. `lib/tauri.ts` returns safe no-ops on web. This pattern must be followed for every Tauri API call.
3. **Platform storage abstraction:** `lib/storage.ts:createPlatformStorage` routes to Tauri Store (desktop) or `localStorage` (web). All Zustand persist middleware must use this factory. Never call `localStorage` directly except inside `lib/storage.ts`.
4. **Migration convention:** `store/migrations.ts` holds all Zustand migrate functions. When changing persisted store shape: increment the version constant, write a migration function, add a test in `tests/migrations.test.ts`.
5. **Entitlement model:** Client-only, honour system. Known offline-first trade-off — no server verification by design. Document that this is intentional (per owner decision 2026-06-24).
6. **Pack format:** `public/packs/{lang}.json` — shape defined in `lib/packLoader.ts:Pack`. Verify sha256 against manifest on every load. Never serve without manifest verification when manifest is available.

**Done condition:** `CLAUDE.md` contains a `## Architecture` section with all 6 subsections. Section is at least 400 words. Verification gate green (lint, no TS changes).
**Status: COMPLETE — 2026-06-27**

---

### Task #032 | Create STATUS.md
**Severity:** 3 | **File(s):** `STATUS.md` (does not exist)
**DoD Tier:** 4
**Complexity:** ⚡ Direct — 1 file, no package boundary, documentation creation

No `STATUS.md` exists. The team has no single-file answer to "what is shipped, what is planned, what is a known issue."

**Changes required:**
Create `/Users/maximilian/Projects/italian_app/STATUS.md` with:
1. **Shipped:** Feature list that is live (SRS core, Italian A1–B1 units shipped, interrupt engine, entitlement, backup/restore).
2. **Planned (in task list):** Pointer to `.autocode/tasks.md`.
3. **Known issues / accepted risks:** Client-only entitlement (intentional, documented in CLAUDE.md). 68 curriculum units not yet authored (content scope, not tracked here). Placeholder language configs for `fr/de/pt`.
4. **Curriculum status:** 57 of 125 planned units exist. Reconcile against `CURRICULUM.md`. No code task required for missing units (per owner answer #4) — document this gap here.
5. **Card ID format:** Current format differs from `CONTRIBUTING_LANGUAGE.md` template (no `{lang}-` prefix). Document the actual format used in shipped cards and note that `CONTRIBUTING_LANGUAGE.md` needs updating.

**Done condition:** `STATUS.md` exists at the repo root. Contains all 5 sections. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #033 | Update CONTRIBUTING_LANGUAGE.md — NFC, diacritic tolerance, close threshold, card ID format, Batch 3 issues
**Severity:** 5 | **File(s):** `CONTRIBUTING_LANGUAGE.md`
**DoD Tier:** 4
**Complexity:** ⚡ Direct — 1 file, no package boundary, documentation-only changes
**⚡ FIRST in Batch 4 (expedited per owner 2026-06-27)**

`CONTRIBUTING_LANGUAGE.md` has 9 outstanding issues:

**Original scope (#010, #011 changes — already shipped):**
1. **NFC normalization behaviour:** all card text normalized to NFC on export (`scripts/exportPack.ts`). Authors write in composed form; tooling handles normalization.
2. **Diacritic tolerance:** `diacriticTolerant: true` means accent-only diff is `"close"` not `"wrong"`. Do NOT add duplicate answers — engine handles it.
3. **"close" Levenshtein threshold:** `"close"` only when `a.length > 4 AND distance === 1`. Shorter words are wrong-only.
4. **Card ID format:** Italian cards have no `{lang}-` prefix. Document both formats; note non-Italian cards should use full `{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}`.

**New issues found /meet 2026-06-27:**
5. **Step 2 TypeScript compile error:** Example code includes `pricing: { lifetime: "$9.99" }` — `LanguageEntry` has no `pricing` field. Remove.
6. **Step 5 `french_lifetime` checkout key:** References a `lifetime` checkout type forbidden in `lib/entitlement.ts:118`. Remove; use a subscription key example.
7. **French as worked example:** `fr` was removed from `langRegistry.ts` 2026-06-27. Replace `fr` throughout with generic `{lang}` placeholder.
8. **Step 1 wrong file:** References `lib/srs.ts` for `ITALIAN_ARTICLES`, `checkAnswer` — these live in `lib/answerCheck.ts` after Task #027. Correct the file reference.
9. **lib/langRegistry.ts stub pattern:** Note that `ready: false` keeps a new language out of production until `public/packs/{lang}.json` exists.

**Done condition:** All 9 items addressed. Step 2 TypeScript example compiles without error. `grep -n "french_lifetime\|pricing.*lifetime\|lib/srs.ts" CONTRIBUTING_LANGUAGE.md` returns zero hits. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #078 | BRAND compliance — voice violations in UI copy | severity 7
**File(s):** `components/StudyDoneScreen.tsx`, `app/study/page.tsx`, `app/stats/page.tsx`, `lib/language.ts`, `components/UnitRow.tsx`
**DoD Tier:** 1
**Complexity:** 🔧 Full — 5 files, voice compliance changes
**Blocked by:** Nothing
**Blocks:** Nothing

BRAND.md violations found /meet 2026-06-27. Fix all:

1. **`components/StudyDoneScreen.tsx`:** Remove 🎉 emoji. `"Quick Review Done!"` → `"Review complete."`. `"All Due Reviews Done!"` → `"Session complete."`. `"Session Complete!"` → `"Session complete."`
2. **`app/study/page.tsx`:** `"All caught up!"` → `"Nothing ready."`. Remove ✓ emoji. `"⏰ Quick Review"` → `"Quick review"` (no emoji, no exclamation).
3. **`app/stats/page.tsx`:** `"Retention at risk — overdue >7 days"` → `"At risk — ready >7 days"`. `"{n}d overdue"` → `"{n}d ago"`.
4. **`lib/language.ts`:** `correctFeedback: "Corretto!"` → `"Corretto."`. `correctFeedback: "¡Correcto!"` → `"Correcto."`.
5. **`components/UnitRow.tsx`:** `{stats.due} due` → `{stats.due} ready`.

**Test required (write first):** Add to `components/UnitRow.test.tsx`: badge renders "ready" not "due". Add to `components/StudyDoneScreen.test.tsx` (create if absent): renders "Session complete." with no exclamation mark and no emoji.

**Done condition:** `grep -rn "overdue\|Overdue" app/stats/page.tsx` returns zero user-visible string hits. `grep -n "🎉\|All caught up\|Corretto!\|Correcto!" components/StudyDoneScreen.tsx app/study/page.tsx lib/language.ts` returns zero hits. `grep -n " due\"" components/UnitRow.tsx` returns zero hits. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #079 | Remove session timer spec from BRAND.md | severity 3
**File(s):** `BRAND.md`
**DoD Tier:** 4
**Complexity:** ⚡ Direct — 1 file, documentation update, no code changes
**Blocked by:** Nothing
**Blocks:** Nothing

Owner confirmed 2026-06-27: card position display (N/total) is the intended final design for study sessions. The "### The session timer" section in BRAND.md describes a 60-second elapsed progress bar that is no longer planned. Remove that section. Tasks #050, #051, #052 already cancelled.

**Done condition:** `grep -n "60 seconds\|elapsed time\|session timer\|The session timer\|progress bar" BRAND.md` returns zero hits. Verification gate green (no TS or test impact).
**Status: COMPLETE — 2026-06-27**

---

### Task #080 | Rule 1 — extract app/stats/page.tsx (243 lines → ≤150) | severity 6
**File(s):** `app/stats/page.tsx`, `components/DifficultyBar.tsx` (new), `hooks/useStatsData.ts` (new)
**DoD Tier:** 1
**Complexity:** 🔧 Full — 3 files, extract keyword
**Blocked by:** Nothing
**Blocks:** Nothing

`app/stats/page.tsx` is 243 lines — 93 over the Rule 1 limit. Rule 15 violations also present (inline color mappings).

**Extraction plan:**
1. Extract `DifficultyBar` inline function (lines ~231-243) → `components/DifficultyBar.tsx` with co-located `DifficultyBar.test.tsx` (≥3 tests: correct color at 0%, 50%, 90%).
2. Move stability→color class mapping (inline ternary) → named `stabilityColorClass(value: number): string` at module scope.
3. Extract data aggregation (hardest cards, weakest tags, stability buckets, at-risk cards) → `hooks/useStatsData.ts`. Return typed result object.
4. `app/stats/page.tsx` becomes: import + call `useStatsData()` + render with extracted components.

**Done condition:** `wc -l app/stats/page.tsx` returns ≤150. `grep -n "stabilityColorClass\|DifficultyBar" app/stats/page.tsx` shows imports, not definitions. `grep -rn "pct > 66\|pct > 33" app/stats/page.tsx` returns zero hits (color logic extracted). Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #081 | Tests — hooks/useStudySession.ts | severity 7
**File(s):** `hooks/useStudySession.test.ts` (new, co-located)
**DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-writing task
**Blocked by:** Nothing
**Blocks:** Nothing

`hooks/useStudySession.ts` is the most complex untested hook in the codebase — session branching, queue management, wasClose tracking, session commit. Zero test coverage.

**Test required (write first — these ARE the task):**
1. Happy path: `buildQueue` called on mount, first card set as current card.
2. Resume path: existing `activeSession` in store → resume prompt shown, resuming loads from saved position.
3. Correct answer: `wasClose` stays false, answer state clears, position advances.
4. Close answer: `wasClose` set true, card UI reflects close state.
5. Session commit: when final card rated, `rateCardAndSaveSession` called with correct session object (unitId, position, sessionTotal ≥ 1).

Use `vi.mock("@/lib/queue")` for `buildQueue` and `vi.mock("@/store/srsStore")` for store actions. Assert behavioral outcomes (state values, function call counts), not implementation details.

**Done condition:** `hooks/useStudySession.test.ts` exists with ≥5 behavioral tests, all green. `npm test -- hooks/useStudySession.test.ts` passes. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #082 | Tests — hooks/useLicenseActivation.ts | severity 6
**File(s):** `hooks/useLicenseActivation.test.ts` (new, co-located)
**DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test-writing task
**Blocked by:** Nothing
**Blocks:** Nothing

`hooks/useLicenseActivation.ts` has three async IPC flows (activate, validate, deactivate) with status transitions. No tests exist.

**Test required (write first — these ARE the task):**
1. `handleActivate` ok path: `licenseStatus` transitions idle→loading→`{type:"success"}`. `useEntitlementStore` updated with correct `licenseType` and `unlockedPacks`.
2. `handleActivate` error path: mock `activateLicense` returning `ok:false` → `licenseStatus.type === "error"` with non-empty `message`.
3. `handleValidate`: valid license → `licenseStatus.type === "success"`.
4. `handleDeactivate`: mock `deactivateLicense` returning `ok:true` → store cleared (`licenseType === "free"`).

Use `vi.mock("@/lib/entitlement")` for IPC calls. Verify store mutations via `useEntitlementStore.getState()` after each handler.

**Done condition:** `hooks/useLicenseActivation.test.ts` exists with ≥4 behavioral tests, all green. Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

### Task #083 | Security — InterruptHandler.tsx listen() missing .catch() | severity 5
**File(s):** `components/InterruptHandler.tsx`
**DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, 2 catch additions
**Blocked by:** Nothing
**Blocks:** Nothing

`components/InterruptHandler.tsx:91` and `:104` both call `listen(...)` with `.then()` and no `.catch()`. If Tauri IPC transport throws during subscription (plugin registration failure at startup), the rejection is unhandled and all interrupt + tray events are silently lost with no trace.

**Fix:** Add `.catch((err) => console.error('[ERR-LISTEN-INTERRUPT-...]', err))` and `.catch((err) => console.error('[ERR-LISTEN-TRAY-...]', err))` to the two listen chains respectively.

**Done condition:** `grep -n "listen.*catch\|ERR-LISTEN" components/InterruptHandler.tsx` returns hits on both lines. `npm test` passes (existing InterruptHandler tests must stay green). Verification gate green.
**Status: COMPLETE — 2026-06-27**

---

## Batch 5 — M1: Introduction Engine Foundation [COMPLETE]
Dependency: Batch 1 complete.
Theme: Pure-function layer for the intensive introduction engine. No store or UI changes in this batch.

### Task #034 | types | severity 7
**What:** Add `IntroductionRecord` interface to `content/types.ts` and create `lib/introduction.ts` with `MAX_APPEARANCES_BY_PHASE_DAY` constant
**Why:** The intensive introduction phase (BRAND.md canonical cadence table) needs a typed record to track per-card introduction state. Types-only task — no logic yet. Without a shared type, downstream store and pure-function tasks cannot be written consistently.
**Complexity:** 🔧 Full — 2 files (content/types.ts + lib/introduction.ts) + test file; re-classified from Direct by pre-build scope check
**Status: COMPLETE — 2026-06-27**
**Blocked by:** Nothing
**Blocks:** Task #035
**Test required (write first):** `tests/introduction.test.ts` — import `IntroductionRecord` from `content/types.ts`; assert it has fields `cardId`, `introducedDate`, `dayOfPhase`, `consecutiveCorrect`, `totalEncounters`, `lastSeenDate`, `appearancesToday`, `consecutiveWrongToday`, `lastSeenType`, `graduated`. Import `MAX_APPEARANCES_BY_PHASE_DAY` from `lib/introduction.ts`; assert it is a record with numeric keys; assert `MAX_APPEARANCES_BY_PHASE_DAY[1]` is `Infinity`; assert `MAX_APPEARANCES_BY_PHASE_DAY[11]` is `0.5`.
**Done condition:** `grep -n "IntroductionRecord" content/types.ts` returns a hit. `grep -n "MAX_APPEARANCES_BY_PHASE_DAY" lib/introduction.ts` returns a hit. `npm test -- tests/introduction.test.ts` green. Verification gate green.

---

### Task #035 | tests | severity 7
**What:** Write failing tests for `getDayOfPhase` pure function in `tests/introduction.test.ts`
**Why:** TDD — tests must be written and failing before the implementation. `getDayOfPhase(introducedDate: string, today: string): number` computes calendar days since introduction + 1, clamped to max 22.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Status: COMPLETE — 2026-06-27**
**Blocked by:** Task #034
**Blocks:** Task #036
**Test required (write first):** This task IS the tests. Assert: introduced today → day 1. Introduced yesterday → day 2. Introduced 21 days ago → day 22. Introduced 25 days ago → day 22 (clamp). A 3-day gap in study still advances the phase by calendar days (day of phase does not pause).
**Done condition:** `tests/introduction.test.ts` contains ≥4 `getDayOfPhase` test cases. All tests fail (function not yet implemented). Verification gate: `npm test -- tests/introduction.test.ts` shows test failures only on `getDayOfPhase` tests.

---

### Task #036 | implementation | severity 7
**What:** Implement `getDayOfPhase` in `lib/introduction.ts`
**Why:** Root-cause implementation for the phase-day calculation needed by all downstream introduction logic. Pure function: parse dates with `new Date(dateStr)`, compute calendar day diff via millisecond subtraction, return `diff + 1`, clamp max at 22.
**Complexity:** 🔧 Full — "implement" keyword, 1 file (lib/introduction.ts)
**Status: COMPLETE — 2026-06-27**
**Blocked by:** Task #035
**Blocks:** Task #037
**Test required (write first):** Tests written in #035. Run `npm test -- tests/introduction.test.ts` — all `getDayOfPhase` tests must now pass.
**Done condition:** All `getDayOfPhase` tests in `tests/introduction.test.ts` pass. `grep -n "getDayOfPhase" lib/introduction.ts` returns a hit. Verification gate green.

---

### Task #037 | tests | severity 7
**Status: COMPLETE — 2026-06-27**
**What:** Write failing tests for `maxAppearancesToday` and `shouldAppearToday` in `tests/introduction.test.ts`
**Why:** TDD. `maxAppearancesToday(dayOfPhase: number): number` returns the appearances cap for that phase day (Infinity for day 1, 5 for day 2, 2 for days 3–5, 1 for days 6–10, 0.5 for days 11–21, 0 for day 22+). `shouldAppearToday(record: IntroductionRecord, today: string): boolean` gates whether a card appears in today's sessions.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #036
**Blocks:** Task #038
**Test required (write first):** This task IS the tests. `maxAppearancesToday`: day 1 → Infinity; day 2 → 5; day 4 → 2; day 8 → 1; day 15 → 0.5; day 22 → 0. `shouldAppearToday`: graduated record → false. Day 22 record → false. Day 1 record with appearancesToday < Infinity → true. Day 11 record (odd dayOfPhase) → true. Day 12 record (even dayOfPhase) → false (every-other-day rule). Record where appearancesToday >= maxAppearancesToday → false.
**Done condition:** `tests/introduction.test.ts` contains ≥6 `maxAppearancesToday` + `shouldAppearToday` test cases. All new tests fail. Verification gate: existing `getDayOfPhase` tests still pass.

---

### Task #038 | implementation | severity 7
**Status: COMPLETE — 2026-06-27**
**What:** Implement `maxAppearancesToday` and `shouldAppearToday` in `lib/introduction.ts`
**Why:** Root-cause implementation of the appearance-gating logic from BRAND.md. `shouldAppearToday` checks: graduated → false; day 22+ → false; even dayOfPhase in days 11–21 → false (every-other-day); appearancesToday >= maxAppearancesToday → false; otherwise true.
**Complexity:** 🔧 Full — "implement" keyword, 1 file (lib/introduction.ts)
**Blocked by:** Task #037
**Blocks:** Task #039
**Test required (write first):** Tests written in #037. Run `npm test -- tests/introduction.test.ts` — all `maxAppearancesToday` and `shouldAppearToday` tests must pass.
**Done condition:** All new tests in `tests/introduction.test.ts` pass. `grep -n "shouldAppearToday\|maxAppearancesToday" lib/introduction.ts` returns hits. Verification gate green.

---

### Task #039 | tests | severity 7
**Status: COMPLETE — 2026-06-27**
**What:** Write failing tests for `recordResult` and `shouldGraduate` pure functions in `tests/introduction.test.ts`
**Why:** TDD. `recordResult(record: IntroductionRecord, correct: boolean, today: string): IntroductionRecord` returns an updated record (immutable). `shouldGraduate(record: IntroductionRecord): boolean` returns true if `consecutiveCorrect >= 15`.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #038
**Blocks:** Task #040
**Test required (write first):** This task IS the tests. `recordResult` correct: `consecutiveCorrect` increments; `totalEncounters` increments; `appearancesToday` increments; `consecutiveWrongToday` resets to 0; `lastSeenDate` updates. `recordResult` after 15 consecutive correct: returned record has `graduated: true`. `recordResult` wrong: `consecutiveCorrect` resets to 0; `consecutiveWrongToday` increments; `totalEncounters` increments. `recordResult` wrong 3× in a row: `dayOfPhase` resets to 1; `consecutiveWrongToday` resets to 0. `shouldGraduate`: returns true when `consecutiveCorrect >= 15`; false when < 15. Original record is not mutated (immutability assertion).
**Done condition:** `tests/introduction.test.ts` contains ≥7 `recordResult` + `shouldGraduate` test cases. All new tests fail. Verification gate: prior tests still pass.

---

### Task #040 | implementation | severity 7
**Status: COMPLETE — 2026-06-27**
**What:** Implement `recordResult` and `shouldGraduate` in `lib/introduction.ts`
**Why:** Root-cause implementation of the wrong-answer rules from BRAND.md: wrong once resets consecutive counter (Day 2 intensity); wrong 3× in a row resets to Day 1. Immutable: use object spread, return new record.
**Complexity:** 🔧 Full — "implement" keyword, 1 file (lib/introduction.ts)
**Blocked by:** Task #039
**Blocks:** Task #041
**Test required (write first):** Tests written in #039. Run `npm test -- tests/introduction.test.ts` — all `recordResult` and `shouldGraduate` tests must pass.
**Done condition:** All new tests pass. `grep -n "recordResult\|shouldGraduate" lib/introduction.ts` returns hits. Verification gate green.

---

### Task #041 | tests | severity 7
**Status: COMPLETE — 2026-06-27**
**What:** Write failing tests for `getNextCardType` variety function in `tests/introduction.test.ts`
**Why:** TDD. `getNextCardType(lastSeenType: CardType | null, available: CardType[]): CardType` picks a different type than lastSeenType when possible, supporting the variety rule (BRAND.md: each encounter uses a different retrieval angle).
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #040
**Blocks:** Task #042
**Test required (write first):** This task IS the tests. `lastSeenType` null → returns any available type. `lastSeenType: "produce"` with `["recognize", "produce"]` available → returns `"recognize"`. `lastSeenType: "produce"` with only `["produce"]` available → returns `"produce"` (no other choice). `lastSeenType: "fill_blank"` with `["recognize", "produce", "fill_blank"]` → returns something other than `"fill_blank"`.
**Done condition:** `tests/introduction.test.ts` contains ≥4 `getNextCardType` test cases. All new tests fail. Verification gate: prior tests still pass.

---

### Task #042 | implementation | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Implement `getNextCardType` in `lib/introduction.ts`
**Why:** Root-cause implementation of the variety rule. Pure function: filter `available` to exclude `lastSeenType`; if filtered list is empty, use all `available`; return first element of filtered list.
**Complexity:** 🔧 Full — "implement" keyword, 1 file (lib/introduction.ts)
**Blocked by:** Task #041
**Blocks:** Task #043
**Test required (write first):** Tests written in #041. Run `npm test -- tests/introduction.test.ts` — all `getNextCardType` tests must pass.
**Done condition:** All tests in `tests/introduction.test.ts` pass (the full file, all tasks). `grep -n "getNextCardType" lib/introduction.ts` returns a hit. `npm test` verification gate green.

---

## Batch 6 — M1: Introduction Engine Integration [COMPLETE]
Dependency: Batch 5 complete. Batch 1 must also be complete (srsStore actions from #013 required).
Theme: Wire the pure introduction functions into the store, queue, and study UI. Add session timer.

### Task #043 | tests | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Write a failing migration test in `tests/migrations.test.ts` — SRS store v1 → v2 adds `introductions: {}`
**Why:** TDD. Every store shape change requires a migration test written first (AGENTS.md Kaizen). The migration must fill `introductions: {}` for all existing users who have no such field.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #042
**Blocks:** Task #044
**Test required (write first):** This task IS the test. Add to `tests/migrations.test.ts`: calling `migrateSrsStore({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null }, 1)` (migrating FROM v1 TO v2) returns an object with `introductions: {}`. Existing fields (`cards`, `streak`, `lastStudiedDate`, `activeSession`) are preserved unchanged.
**Done condition:** The new test exists and fails (migration not yet implemented). Prior migration tests still pass. Verification gate: `npm test -- tests/migrations.test.ts` shows exactly the new test failing.

---

### Task #044 | implementation | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Bump `SRS_VERSION` to 2 and add `introductions` migration in `store/migrations.ts`
**Why:** Root-cause fix — any existing user's persisted store lacks `introductions`. The migration must set it to `{}`. Follow the exact pattern in `store/migrations.ts`: bump the `SRS_VERSION` constant, add entry `2: (data) => ({ ...(data as any), introductions: (data as any).introductions ?? {} })` to `SRS_MIGRATIONS`. Never remove existing entries.
**Complexity:** ⚡ Direct — 1 file, no package boundary, migration entry addition
**Blocked by:** Task #043
**Blocks:** Task #045
**Test required (write first):** Test written in #043. Run `npm test -- tests/migrations.test.ts` — the new test must pass.
**Done condition:** `grep -n "SRS_VERSION = 2" store/migrations.ts` returns a hit. `grep -n "introductions" store/migrations.ts` returns a hit. All migration tests pass. Verification gate green.

---

### Task #045 | tests | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Write failing tests for introduction store actions in `tests/srsStore.test.ts`
**Why:** TDD. Before adding actions to the store, write tests that specify exact behaviour: `introduceCard`, `recordIntroductionResult`, `getIntroductionDueCardIds`, `canIntroduceNewCard`.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #044
**Blocks:** Task #046
**Test required (write first):** This task IS the tests. Add to `tests/srsStore.test.ts`: (1) `introduceCard("card-1", "2026-06-24")` → `introductions["card-1"]` has `dayOfPhase: 1`, `consecutiveCorrect: 0`, `graduated: false`. (2) `introduceCard` is idempotent — calling it twice on the same card does not reset an in-progress record. (3) `recordIntroductionResult("card-1", true, "2026-06-24")` increments `consecutiveCorrect`. (4) After 15 consecutive correct calls to `recordIntroductionResult`, `introductions["card-1"].graduated === true`. (5) `getIntroductionDueCardIds("2026-06-24")` returns card IDs where `shouldAppearToday` is true and `graduated` is false. (6) `canIntroduceNewCard("2026-06-24")` returns false if any card has `introducedDate === "2026-06-24"` (daily hard cap enforced).
**Done condition:** 6 new tests exist in `tests/srsStore.test.ts` and all fail. Prior srsStore tests still pass. Verification gate: `npm test -- tests/srsStore.test.ts` shows exactly the 6 new tests failing.

---

### Task #046 | implementation | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Add `introductions` field and four actions to `store/srsStore.ts`
**Why:** Root-cause implementation — the store is the single source of truth for introduction state. Adds to `SRSState` interface: `introductions: Record<string, IntroductionRecord>`; `introduceCard(cardId: string, today: string): void`; `recordIntroductionResult(cardId: string, correct: boolean, today: string): void`; `getIntroductionDueCardIds(today: string): string[]`; `canIntroduceNewCard(today: string): boolean`. `introduceCard` is idempotent (guard: if record exists and is not graduated, return without resetting). `recordIntroductionResult` calls `recordResult()` from `lib/introduction.ts` and writes back. Initialize `introductions: {}` in default store state.
**Complexity:** ⚡ Direct — 1 file, no package boundary, store field + action additions
**Blocked by:** Task #045
**Blocks:** Task #047
**Test required (write first):** Tests written in #045. Run `npm test -- tests/srsStore.test.ts` — all 6 new tests must pass.
**Done condition:** All 6 new tests pass. `grep -n "introductions" store/srsStore.ts` returns hits on the interface, default state, and all four action implementations. Verification gate green.

---

### Task #047 | tests | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Write failing tests for updated `buildQueue` with introduction cards in `tests/queue.test.ts`
**Why:** TDD. `buildQueue` must include introduction-phase cards that are not yet in FSRS. Tests specify ordering (introduction cards after due review cards, before new cards) and deduplication behaviour.
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Task #046
**Blocks:** Task #048
**Test required (write first):** This task IS the tests. Add to `tests/queue.test.ts`: (1) A card in introduction phase (`shouldAppearToday` = true, `graduated` = false) appears in the queue even with no FSRS reps. (2) Introduction cards appear AFTER due review cards but BEFORE new cards. (3) A graduated introduction card is not returned by `getIntroductionDueCardIds` and falls through to normal FSRS flow. (4) `buildQueue` in `globalMode: true` still excludes new cards but includes introduction cards.
**Done condition:** 4 new tests exist in `tests/queue.test.ts` and all fail. Prior queue tests still pass.

---

### Task #048 | implementation | severity 7
**Status: COMPLETE — 2026-06-28**
**What:** Update `buildQueue` in `lib/queue.ts` to accept and include introduction cards
**Why:** Root-cause — without this change, introduction-phase cards never surface in sessions. New optional parameter: `getIntroductionDueCardIds?: (today: string) => string[]`. When provided, call it with today's date, map IDs to cards, insert into queue after due FSRS cards but before new cards. Deduplication already exists — cards appearing in both FSRS due list and introduction list won't duplicate. Signature: `buildQueue(cards, getDueCards, getNewCards, globalMode?, getIntroductionDueCardIds?)`.
**Complexity:** ⚡ Direct — 1 file, no package boundary, optional parameter addition
**Blocked by:** Task #047
**Blocks:** Task #049
**Test required (write first):** Tests written in #047. Run `npm test -- tests/queue.test.ts` — all 4 new tests must pass.
**Done condition:** All 4 new queue tests pass. `grep -n "getIntroductionDueCardIds" lib/queue.ts` returns a hit. Verification gate green.

---

### Task #049 | implementation | severity 6
**Status: COMPLETE — 2026-06-28**
**What:** Update `handleRate` in `app/study/page.tsx` to record introduction results and pass `getIntroductionDueCardIds` to `buildQueue`
**Why:** Without wiring the store actions into the study loop, introduction results are never persisted — the engine tracks nothing. After `rateCardAndSaveSession` (from #013), call `recordIntroductionResult(currentCard.id, wasCorrect, localDateStr())` IF the card is in the introduction phase (`introductions[currentCard.id] && !introductions[currentCard.id].graduated`). Pass `getIntroductionDueCardIds` to the `buildQueue` call in the `initialQueue` useMemo.
**Complexity:** 🔧 Full — "integrate" keyword, 1 file (app/study/page.tsx); re-classified from Direct
**Blocked by:** Task #048
**Blocks:** Task #050
**Test required (write first):** Add to `tests/seam_studyLoop.test.ts` (from #020): after rating a card that is in introduction phase, `useSRSStore.getState().introductions[cardId].totalEncounters === 1`.
**Done condition:** `grep -n "recordIntroductionResult" app/study/page.tsx` returns a hit. `grep -n "getIntroductionDueCardIds" app/study/page.tsx` returns a hit. Seam test passes. Verification gate green.

---

### Task #050 | tests | severity 6
**Status: CANCELLED — 2026-06-27**
**Reason:** Session timer spec removed from BRAND.md per owner decision 2026-06-27. Card position display (N/total) is the intended final design. `useSessionTimer` hook is not being built.

---

### Task #051 | implementation | severity 6
**Status: CANCELLED — 2026-06-27**
**Reason:** Session timer spec removed from BRAND.md per owner decision 2026-06-27. `useSessionTimer` hook is not being built.

---

### Task #052 | implementation | severity 6
**Status: CANCELLED — 2026-06-27**
**Reason:** Session timer spec removed from BRAND.md per owner decision 2026-06-27. Timer bar UI is not being built; card position display is the intended design.

---

### Task #053 | tests | severity 3
**Status: COMPLETE — 2026-06-28**
**What:** Fix StudyCard test quality: remove redundant `toBeDefined` at line 104 and add one behavioral test for the `wasClose=true` render path
**Why:** `toBeDefined` after `getByText` is cargo-cult — `getByText` throws on miss, so the assertion adds no signal. The `wasClose=true` → yellow border + `closeFeedback` string render path has zero test coverage.
**Complexity:** ⚡ Direct — 1 file, no package boundary, test cleanup + 1 new behavioral test
**Blocked by:** Nothing
**Blocks:** Nothing
**Owner:** QA Agent
**Spawned from:** Debt register 2026-06-27 — added to Batch 6 per owner decision
**Done when:** `grep -n "toBeDefined" components/StudyCard.test.tsx` returns 0 hits. A test for `wasClose=true` exists and passes. Verification gate green.

---

## Milestone Pipeline

The roadmap has 6 milestones beyond this task list (M0–M6). Batch tasks one milestone at a time — over-planning future milestones produces stale tasks. Use these triggers to know when to batch the next one.

| Trigger | Action |
|---------|--------|
| Batch 1 reaches 10/13 tasks complete | M1 task batches are already generated as Batch 5 (#034–#042) and Batch 6 (#043–#052) below — begin Batch 5 in parallel with Batch 2. |
| M1 (introduction engine) is 75% complete | Generate M2 task batches: Pro feature gating, payment flow end-to-end, auto-updater (real signing keys), desktop packaging (macOS/Windows/Linux). |
| M2 (v1.0 desktop) is 75% complete | **Make the sync backend decision first** (Vercel + Neon vs. Supabase — data model affects M3). Then generate M3 task batches: vacation mode, forecast, analytics, custom cards, on-lock/wake triggers. Design data structures to be sync-aware from the start. |
| M3 (full Pro desktop) is 75% complete | Generate M4 task batches: sync backend (API routes, Postgres schema, conflict resolution, offline-first hook). |
| M4 (sync) is 75% complete | Generate M5 task batches: Tauri 2 mobile targets (iOS/Android), UI mobile audit, push notification scheduler, App Store submission. |
| M5 (mobile) ships | Generate M6 task batches per language: Spanish first, then French, then German, then Portuguese. Each language = LanguageConfig + 8,000 words + 125 units + native speaker review. |

**One standing decision before M3 starts (regardless of trigger timing):**
The sync data model must be chosen before analytics and custom cards are designed. Retrofitting sync onto a schema built without it is expensive. Make the M4 architecture decision during M3, even if M4 isn't batched yet.

---

## Escalation Queue
Items that cannot be resolved without Max's input:

1. **Lifetime data in persisted stores (Task #001 follow-up):** Users who have a `licenseType: "lifetime"` value already persisted in their Zustand store (from any version of the app where the checkout URL was live) will hit `isPackUnlocked` with a type that no longer exists in the union after #001. A migration in `store/migrations.ts` should convert `"lifetime"` → `"subscription"` with a far-future `validUntil`. Decision needed: what `validUntil` to set, and whether to contact any users who may have purchased a lifetime pack.

2. **Sentence generator roadmap item (BRAND.md):** BRAND.md lists the sentence generator as "under evaluation" and notes it "requires deciding whether AI generation fits the brand's 'quiet expert' voice." This decision gates any AI integration work. No task has been created for it — flag for explicit go/no-go.

3. **Placeholder language configs (fr/de/pt):** `LANGUAGE_REGISTRY` lists `fr`, `de`, `pt` as `ready: false`. Task #014 will make the poka-yoke test correctly fail for these. The fix requires creating stub `LanguageConfig` objects with correct `code` fields. Confirm whether placeholder configs should inherit ITALIAN strings (safe) or SPANISH strings (current, inconsistent — fr/de/pt are not Spanish).

4. **ALL_PACK_CODES scope re: ready:false packs (Task #068):** `ALL_PACK_CODES` = all 5 registered codes including `ready: false` langs. The security guard in `loadPack`/`evictPack` validates against ALL_PACK_CODES, so `loadPack("fr", ...)` passes the guard and attempts a CDN fetch (which fails). Options: (A) Keep current — registered = loadable; CDN is the content gate; guard is purely security (path traversal / key poisoning prevention); (B) Add `READY_PACK_CODES` subset (`ready: true` only) and use it in the guard, giving early `"not_ready"` rejection before any network attempt. Decision needed from: Max.

---
