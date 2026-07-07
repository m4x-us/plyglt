---
# Task List — plyglt
Generated: 2026-06-24 | Method: /meet
Last updated: 2026-07-01

## Summary
177 tasks across 17 batches (Batches 1–9, 11–13 COMPLETE; Batch 10 mostly COMPLETE — 2 tasks owner-blocked (#122, #123); Batch 14 CURRENT SPRINT; Batches 15–17 PLANNED)
Critical (severity 8-9): 19 | High (6-7): 39 | Medium (4-5): 37 | Low (1-3): 22
Current Sprint: Batch 14 (M3 macOS OS Hooks — stop-the-line pre-reqs first: #173–#177, then #159–#164)

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

## Batch 2 — Test Foundation [COMPLETE]
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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

---

### Task #016 | Fix vacuous assertion in language.test.ts
**Severity:** 4 | **File(s):** `tests/language.test.ts:196`
**DoD Tier:** 1
**Complexity: Direct**

Line 196 uses `toBeTruthy()` on a card label string. Any non-empty string passes `toBeTruthy()`, including `"undefined"` or `" "`. This is a vacuous assertion — it does not verify the label is meaningful.

**Changes required:**
1. `tests/language.test.ts:196` — replace `toBeTruthy()` with a specific assertion. For card labels, use `expect(label).toMatch(/\S/)` (non-whitespace) AND `expect(label).not.toBe("undefined")` AND `expect(label.length).toBeGreaterThan(2)` (labels must be at least 3 chars to be meaningful — "OK" would fail this correctly).

**Done condition:** `grep -n "toBeTruthy" tests/language.test.ts` returns zero hits. Verification gate green.

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27** (DoD partially met — Task #090 completes localStorage coverage)

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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

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

**Status: COMPLETE — 2026-06-27**

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

## Batch 7 — Foundation Stabilization [COMPLETE]
Dependency: Batches 1–6 complete.
Theme: Introduction engine activation, coverage floor, Rule 1 fix for app/page.tsx, brand violations, docs currency, security debt.
Execution order: #084 → #085 (TDD pair, sequential). All other tasks are independent and can run in parallel.

### Task #084 | tests | severity 8
**What:** Write a failing seam test for session-start introduction auto-selection in `tests/seam_studyLoop.test.ts`
**Why:** TDD — test must fail before implementation (#085). The test specifies the observable contract: after a study session initialises when no card has been introduced today, `useSRSStore.getState().introductions` must contain at least one entry. This is the entry point that activates the entire introduction engine.
**File:** `tests/seam_studyLoop.test.ts`
**Severity:** 8 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, TDD test-writing
**Blocked by:** Nothing | **Blocks:** Task #085
**Risk:** Low — test-only task.
**Test required (write first):** This task IS the test. Add to `tests/seam_studyLoop.test.ts`: mock `useStudySession` hook initialisation with a pack of at least 2 cards, empty `srsStore.cards`, empty `srsStore.introductions`, and `canIntroduceNewCard` returning true. After init, assert `Object.keys(useSRSStore.getState().introductions).length >= 1`.
**Done condition:** New test exists and FAILS (implementation not yet done). Prior seam tests still pass. `npm test -- tests/seam_studyLoop.test.ts` shows exactly the new test failing.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #085 | implementation | severity 8
**What:** Implement session-start introduction auto-selection in `hooks/useStudySession.ts`
**Why:** Root-cause activation of the introduction engine. Nothing currently calls `introduceCard()` — the entire intensive 22-phase introduction cadence from BRAND.md is dead code. On session init, check `canIntroduceNewCard(localDateStr())`. If true, find the first card from the loaded pack that has no entry in `srsStore.introductions` AND no entry in `srsStore.cards`, sorted by tier ascending (tier 1 before tier 2 per BRAND.md), and call `introduceCard(cardId, localDateStr())`. This makes the card appear in the queue via the existing `getIntroductionDueCardIds` call in `app/study/page.tsx:51`.
**File:** `hooks/useStudySession.ts`
**Severity:** 8 | **DoD Tier:** 2
**Complexity:** 🔧 Full — implement keyword, integration with srsStore + packLoader + session init
**Blocked by:** Task #084 | **Blocks:** Nothing
**Risk:** Medium — this triggers the first call to `introduceCard()` in production. The store action is idempotent (guarded against re-introduction), but the selection logic must be correct to pick the right card.
**Test required (write first):** Test written in #084. Run `npm test -- tests/seam_studyLoop.test.ts` — the new test must pass.
**Done condition:** `grep -n "introduceCard\|canIntroduceNewCard" hooks/useStudySession.ts` returns hits. After session init with at least one unintroduced card, `Object.keys(useSRSStore.getState().introductions).length >= 1`. Seam test passes. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #086 | tests | severity 7
**What:** Write behavioral tests for `hooks/useLangPack.ts` hook body (lines 51–87), then ratchet branches threshold
**Why:** `hooks/useLangPack.ts` is at 0% branch coverage — the primary cause of the branch floor crisis (79.2% actual vs 79% threshold, only 0.2pp headroom). The existing test file only tests constants and deprecated re-exports; it never exercises the hook body. After the hook tests land, the branches threshold must be ratcheted from 79 → 81.
**File:** `hooks/useLangPack.test.ts`, `vitest.config.ts`
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no impl keywords
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task plus threshold number bump.
**Test required (write first):** This task IS the tests. Add to `hooks/useLangPack.test.ts` using `renderHook` from `@testing-library/react` and `vi.mock("@/lib/packLoader")`: (1) On mount with a valid lang code, `loadPack` is called and state transitions from loading → loaded with the returned pack. (2) On mount with a failing `loadPack`, state transitions from loading → error. (3) Changing the target lang triggers a new `loadPack` call. (4) The `pack` returned matches the mock data (not undefined). After tests pass: update `vitest.config.ts` branches threshold from 79 → 81.
**Done condition:** `hooks/useLangPack.test.ts` has ≥4 behavioral tests all green. `grep -n "branches.*81" vitest.config.ts` returns a hit. `npm test` branches coverage ≥ 81%. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #087 | implementation | severity 6
**What:** Extract BuyModal and language-selector from `app/page.tsx` (253 lines → ≤ 150)
**Why:** `app/page.tsx` is 253 lines — 69% over the 150-line route ceiling (Rule 1). A new Rule 1 violation discovered in /meet run 4. The page contains inline BuyModal UI and language-selector logic that each belong in their own component.
**File:** `app/page.tsx`, `components/BuyModal.tsx`, `components/BuyModal.test.tsx`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — extract keyword, 3 files
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — the buy/Pro modal is the primary conversion surface. Test before and after to verify nothing is lost.
**Test required (write first):** Create `components/BuyModal.test.tsx` (Rule 14): renders Pro feature list, fires onClose when close button clicked, fires onActivate when activate button clicked. Add to co-located test: verify no occurrence of "lifetime" in rendered output (regression guard against Task #001).
**Done condition:** `wc -l app/page.tsx` returns ≤ 150. `components/BuyModal.tsx` exists. `grep -n "BuyModal" app/page.tsx` shows import, not definition. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #088 | implementation | severity 5
**What:** Fix two BRAND violations — learn page "due" terminology and stats page "Nd ago" guilt counters
**Why:** Task #078 (Batch 4) fixed study/stats/settings/language/UnitRow but missed `app/learn/page.tsx`. Two violations remain: hero stat "cards due" and CTA "Review all {N} due cards →". Also: `app/stats/page.tsx` "at risk" section shows per-card staleness as `"{N}d ago"` — implies overdue debt, contradicts BRAND.md stress-free principle. Owner decision: reframe as `"last seen {N}d ago"` (neutral information, not guilt).
**File:** `app/learn/page.tsx`, `app/stats/page.tsx`
**Severity:** 5 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 2 files, cosmetic string changes only
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — string-only changes.
**Test required (write first):** Add to learn page test (or create): `grep -n "cards due\|due cards" app/learn/page.tsx` returns zero hits after fix. Add to stats test: rendered "at risk" counters match `"last seen \d+d ago"` pattern (not bare `"\d+d ago"`).
**Done condition:** `grep -n '".*due\b' app/learn/page.tsx` returns zero user-visible string hits. `grep -n '"[0-9]d ago"' app/stats/page.tsx` returns zero hits (replaced by "last seen" prefix). Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #089 | security | severity 5
**What:** Harden `activateLicense` and `validateLicense` in `lib/entitlement.ts` — sanitize raw Lemon Squeezy errors before returning to caller
**Why:** `lib/entitlement.ts:155` (activateLicense) and `:196` (validateLicense) return `res.error` directly to the caller, which propagates to the UI. Raw LS error strings may contain internal API details, rate-limit headers, or request context. `deactivateLicense` was hardened in Task #074 (Batch 3) — the same fix was not applied to the other two functions. Debt register F7, severity 5.
**File:** `lib/entitlement.ts`, `tests/entitlement.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no impl keyword match
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — any change to error message strings may affect UI error display. Verify the UI renders the sanitized message correctly.
**Test required (write first):** Add to `tests/entitlement.test.ts`: when `activateLicense` mock returns `{ ok: false, error: "internal LS API error with request details" }`, the returned `error` field from the hook does NOT contain "internal LS API error with request details" — it is replaced with a user-safe string. Same for `validateLicense`.
**Done condition:** `grep -n "res\.error" lib/entitlement.ts` returns zero hits on activateLicense (line 155) and validateLicense (line 196). Both now return a named constant or sanitized string. Tests pass. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #090 | tests | severity 4
**What:** Add `lib/storage.ts` localStorage path coverage — complete Task #017 DoD
**Why:** Task #017 created `tests/storage.test.ts` but only covered SSR-guard paths (`window` undefined). The actual localStorage get/set/remove paths at lines 48, 66–67, 75–76, 102–110 remain at 42.42% statement coverage. The DoD for #017 required "setItem + getItem round-trip" and "removeItem clears the key" — neither was actually covered.
**File:** `tests/storage.test.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test augmentation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required (write first):** Add to `tests/storage.test.ts` using `vi.stubGlobal('localStorage', createLocalStorageMock())`: (a) `setItem` + `getItem` round-trip returns the stored value. (b) `removeItem` after `setItem` makes `getItem` return null. (c) `getItem` on missing key returns null (not undefined). (d) `setItem` when `localStorage.setItem` throws propagates the error. Cover lines 48, 66–67, 75–76 explicitly.
**Done condition:** `npm test -- tests/storage.test.ts` passes with ≥ 4 new tests. `lib/storage.ts` statement coverage ≥ 80%. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #091 | tests | severity 4
**What:** Add branch coverage for `lib/introduction.ts` lines 49, 60–79, 120
**Why:** `lib/introduction.ts` is at 81.81% branch coverage. Three uncovered areas: (a) `maxAppearancesToday` day > 22 fallback (`?? 0`, line 49); (b) `shouldAppearToday` compound branch logic (lines 60–79) not all paths exercised; (c) `recordResult` date-reset path at line 120 (`lastSeenDate !== today` resets `appearancesToday` to 1 rather than incrementing).
**File:** `tests/introduction.test.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, test augmentation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required (write first):** Add to `tests/introduction.test.ts`: (a) `maxAppearancesToday(25) === 0` (out-of-bounds phase day). (b) `shouldAppearToday` with a record where `lastSeenDate === today` AND `appearancesToday >= maxAppearancesToday(dayOfPhase)` → false. (c) `recordResult` called with `correct=true` on a record where `lastSeenDate !== today` → returned record has `appearancesToday === 1` (reset, not increment). (d) At least one additional `shouldAppearToday` path exercising a branch not covered by existing tests.
**Done condition:** `npm test -- tests/introduction.test.ts` passes. `lib/introduction.ts` branch coverage ≥ 88%. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #092 | tests | severity 3
**What:** Complete Rule 14 for remaining untested components and hooks
**Why:** Four components and two hooks still lack co-located tests. Rule 14: every user-facing React component has a co-located `.test.tsx`. The missing hook tests also leave important business logic (stats data aggregation, import error path) uncovered.
**File:** `components/LevelSection.test.tsx`, `components/StudyResumePrompt.test.tsx`, `components/settings/Section.test.tsx`, `hooks/useStatsData.test.ts`, `hooks/useExportImport.test.ts`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 5 files
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required (write first):** (1) `components/LevelSection.test.tsx`: renders unit names, shows locked badge when `unlocked === false`, shows progress when cards exist. (2) `components/StudyResumePrompt.test.tsx`: renders "Resume" prompt text, calls `onResume` when Resume clicked, calls `onDiscard` when Discard clicked. (3) `components/settings/Section.test.tsx`: renders title prop, renders children. (4) `hooks/useStatsData.test.ts`: `hardestCards` returns cards with lowest retention rate; `atRiskCards` returns only cards with `dueDate` more than 7 days ago. (5) `hooks/useExportImport.test.ts` augmentation: `handleImportFile` when `parseBackup` returns `ok:false` → `dataStatus.type === "error"` (currently only `ok:true` branch is tested).
**Done condition:** All 5 files exist. `npm test` passes. `grep -rL "test" components/LevelSection.tsx components/StudyResumePrompt.tsx components/settings/Section.tsx` returns zero hits (all have tests). Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #093 | docs | severity 4
**What:** Fix stale CLAUDE.md and STATUS.md content; add introduction engine architecture documentation
**Why:** Three stale claims and two missing sections discovered in /meet run 4. (1) CLAUDE.md §6 last line and STATUS.md §3 both claim fr/de/pt stubs exist in `lib/langRegistry.ts` — they were removed in Batch 3. A new agent will search for non-existent code. (2) `lib/introduction.ts` is a substantial subsystem with invariants agents must not violate — entirely absent from CLAUDE.md. (3) Coverage thresholds absent from AGENTS.md verification gate.
**File:** `CLAUDE.md`, `STATUS.md`, `AGENTS.md`
**Severity:** 4 | **DoD Tier:** 4
**Complexity:** 🔧 Full — 3 files
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — docs only.
**Changes required:**
1. `CLAUDE.md §6`: Remove sentence "Stubs for `fr`, `de`, and `pt` exist in the registry but are not user-visible." — stale.
2. `STATUS.md §3`: Remove "Placeholder language configurations for fr, de, pt" from Known Issues. Add note that stubs were removed 2026-06-27.
3. `CLAUDE.md`: Add `### 7. Introduction Engine` section — `lib/introduction.ts` is a pure-function module (no React, no Zustand) implementing the 22-phase intensive introduction cadence from BRAND.md. Integrates with `store/srsStore.ts` via four actions: `introduceCard`, `recordIntroductionResult`, `getIntroductionDueCardIds`, `canIntroduceNewCard`. Key invariant: lib/ module must remain pure. Card graduation requires 15 consecutive correct retrievals. One new card per day maximum enforced by `canIntroduceNewCard`.
4. `STATUS.md §1 (Shipped)`: Add "Introduction engine (`lib/introduction.ts` + srsStore integration) — M1 complete."
5. `AGENTS.md` verification gate: add current thresholds after "all coverage thresholds met" — `lines=84, funcs=79, branches=79, stmts=82`. Note: thresholds only ever increase.
**Done condition:** `grep -n "fr.*stub\|stub.*fr\|fr.*de.*pt" CLAUDE.md STATUS.md` returns zero hits. `grep -n "Introduction Engine\|lib/introduction" CLAUDE.md` returns a hit. `grep -n "lines=84\|funcs=79" AGENTS.md` returns hits. Verification gate green.
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #094 | housekeeping | severity 2
**What:** Mark tasks #014–#023 as COMPLETE in `.autocode/tasks.md`
**Why:** All ten Batch 2 tasks were implemented in the "Build Batch 1+2" and "Build Batch 3" commits but their tasks.md entries were never updated with COMPLETE status. This creates a false impression that Batch 2 is still active. Only Task #076 was correctly marked COMPLETE.
**File:** `.autocode/tasks.md`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, mechanical status additions
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — documentation only.
**Changes required:** For each of tasks #014, #015, #016, #017, #018, #019, #020, #021, #022, #023: verify the done-when condition is met (run the grep or ls command from the task), then add `**Status: COMPLETE — 2026-06-27**` below the `**Owner:**` line. Note: Task #017 DoD is only partially met (localStorage paths uncovered — Task #090 completes it). Mark #017 as COMPLETE for the parts done; Task #090 is the follow-on.
**Done condition:** `grep -c "Status: COMPLETE" .autocode/tasks.md` increases by 10. `grep -n "#014\|#015\|#016\|#017\|#018\|#019\|#020\|#021\|#022\|#023" .autocode/tasks.md` shows all 10 with COMPLETE status. Verification gate green (no code changes).
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-29**

---

## Batch 8 — Quality & Architecture Hardening | 16 tasks | [COMPLETE]

### Task #095 | security | severity 9
**What:** Fix deactivation-always-failure bug — `ls_deactivate_license` returns `Result<(), String>`, which Tauri serialises as JSON `null`; TypeScript null-guard at `lib/entitlement.ts:215` fires, returns `{ ok: false, error: ERR_DEACTIVATE_NETWORK }`, and `clearEntitlement()` is never called. The license is consumed at Lemon Squeezy but the local store stays active. STOP-THE-LINE: this silently corrupts paid user data on every deactivation attempt.
**Why:** Every paid user who deactivates (e.g., to transfer to a new device) permanently loses an activation slot at LS with no path to recover it without contacting LS support. The root cause is a Rust/TypeScript serialisation mismatch: `Ok(())` → JSON `null` → TypeScript null-guard treats null as network failure.
**File:** `src-tauri/src/license.rs`, `lib/entitlement.ts`
**Severity:** 9 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, Rust + TypeScript changes
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** High — any error in the Rust return-type change will break the deactivation IPC call entirely. Write the test first.
**Test required (write first):** In `tests/entitlement.test.ts`: add a test that mocks `invoke` to return `null` and verifies `deactivateLicense()` returns `{ ok: true }` (not `{ ok: false, error: ERR_DEACTIVATE_NETWORK }`). This test will fail before the fix and pass after.
**What to change:**
1. `src-tauri/src/license.rs`: Change `ls_deactivate_license` return type from `Result<(), String>` to `Result<bool, String>`. Return `Ok(true)` on success (after HTTP 200 check), `Err(message)` on failure. Tauri will serialise `Ok(true)` as JSON `true`, not `null`.
2. `lib/entitlement.ts`: In `deactivateLicense()`, change the null-guard at line ~215 from `if (raw == null)` to `if (raw !== true)` — i.e., only treat non-true values as failure. A `true` response means LS deactivation succeeded.
**Done condition:** `npm test -- tests/entitlement.test.ts` passes with the new deactivation test green. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #096 | security | severity 6
**What:** Add user-facing confirmation gate before `downloadAndInstall()` in `lib/tauri.ts:checkForUpdates()`. Currently `update.downloadAndInstall()` fires immediately on `update.available` with no user consent.
**Why:** A compromised or misconfigured update endpoint would auto-install a binary without user action. The user must confirm "Restart to update" before installation begins. This is a supply-chain risk guard.
**File:** `lib/tauri.ts`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, single function change
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — single function modification.
**Test required (write first):** In `tests/tauri.test.ts` (or co-located test): add a test that mocks `tauri-plugin-updater` to return an available update and verifies `checkForUpdates()` calls a `onUpdateAvailable` callback (or equivalent) before calling `downloadAndInstall()`. The test should confirm that without the callback being invoked (or returning true), `downloadAndInstall()` is not called.
**What to change:** Add an `onUpdateAvailable?: (version: string) => Promise<boolean>` optional param to `checkForUpdates()`. If provided and returns `false`, skip install. If not provided, prompt via the existing `invoke("show_update_dialog")` Tauri command or return `{ available: true, version }` to the caller so the UI can gate it. Simplest approach: return `{ available: true, version: update.version }` from `checkForUpdates()` without auto-installing, and let the UI call `downloadAndInstall` explicitly.
**Done condition:** `checkForUpdates()` never calls `update.downloadAndInstall()` unconditionally. Caller receives update availability and controls install timing. Test passes. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #097 | security | severity 5
**What:** Fix two silent-failure paths in `components/InterruptHandler.tsx`: (1) `await enterMandatoryMode()` at line ~73 has no try/catch — IPC failure silently drops; (2) background license validation at lines ~43–50 calls `validateLicense()` but on `r.ok === false` never calls `touchValidated()` — causes LS API to be hammered on every mount during network outage.
**Why:** For (1): if Tauri IPC fails, the interrupt route opens but the window lock never activates — user can dismiss the study session without studying. For (2): `needsValidation()` returns true again immediately after a failed validation, so every subsequent InterruptHandler mount triggers another LS API call until the network recovers — potentially hundreds of calls in a session.
**File:** `components/InterruptHandler.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, two targeted fixes
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — two independent fixes in the same component.
**Test required (write first):** In `components/InterruptHandler.test.tsx`: (1) Test that when `enterMandatoryMode` rejects, the error is caught and logged (not propagated). (2) Test that when `validateLicense` returns `{ ok: false }`, `touchValidated` is still called.
**What to change:**
1. Wrap `await enterMandatoryMode()` in try/catch with explicit error logging: `try { await enterMandatoryMode(); } catch (e) { console.error("[IH-001] enterMandatoryMode failed:", e); }`.
2. In the background validation `.then()` handler: add `else { touchValidated(); }` after the `if (r.ok)` block (call `touchValidated()` on both success and soft failure to reset the TTL; the store action already handles both cases correctly).
**Done condition:** Both changes present. Tests pass. `grep -n "enterMandatoryMode" components/InterruptHandler.tsx` shows a try/catch wrapping it. `grep -n "touchValidated" components/InterruptHandler.tsx` shows it's called in both branches. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #098 | security | severity 3
**What:** Add license key format and length validation before forwarding to IPC in `hooks/useLicenseActivation.ts`. Currently only `.trim()` is applied — any-length string is sent to LS API unchanged.
**Why:** Defense-in-depth: a megabyte-scale input would forward to LS unchanged. LS will reject it, but only after a network round-trip. A length cap and character allowlist provides an immediate, local rejection with a user-visible error.
**File:** `hooks/useLicenseActivation.ts`
**Severity:** 3 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, validation at input boundary
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — additive validation only.
**Test required (write first):** In `hooks/useLicenseActivation.test.ts`: test that submitting a string of 300 characters sets an error state and does NOT call the activate function.
**What to change:** After `.trim()`, add: `if (key.length > 200 || !/^[A-Za-z0-9\-]+$/.test(key)) { setActivationError("Invalid license key format."); return; }`. Lemon Squeezy license keys are alphanumeric + hyphens, max ~64 chars — 200 is a generous cap.
**Done condition:** Test passes. `grep -n "key.length" hooks/useLicenseActivation.ts` returns a hit. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #099 | architecture | severity 2
**What:** Fix `lib/featureFlags.ts` false-string recognition — only `"false"` currently disables a flag; `"0"`, `"off"`, and `"False"` all leave flags enabled.
**Why:** Any developer setting `NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE=0` or `=off` will be confused when the flag remains active. Standard env-var convention expects `"false"`, `"0"`, `"off"`, `"no"` all to disable.
**File:** `lib/featureFlags.ts`
**Severity:** 2 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, single utility function change
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — internal deployment flags, no user-visible behaviour change.
**Test required (write first):** In a new or existing featureFlags test: verify that `"0"`, `"off"`, `"false"`, `"False"`, `"no"`, `"NO"` all produce `false` for the flag value.
**What to change:** Change the flag parser from `v !== "false"` to `!["false", "0", "off", "no"].includes(v?.toLowerCase() ?? "")`.
**Done condition:** Test passes. `grep -n "toLowerCase" lib/featureFlags.ts` returns a hit. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #100 | architecture | severity 4
**What:** Add `isProEnabled(flagValue: boolean, licenseType: LicenseType): boolean` combinator to `lib/featureFlags.ts` and export it.
**Why:** M2 will add ~5 call sites that need "flag AND subscription" checks (interrupt toggle, vacation mode, analytics, forecast, custom cards). Without a named combinator, each call site invents inline logic. Poka-yoke: the right thing must be automatic.
**File:** `lib/featureFlags.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, single function addition
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — additive export.
**Test required (write first):** In a featureFlags test: verify `isProEnabled(true, "subscription")` returns `true`; `isProEnabled(true, "free")` returns `false`; `isProEnabled(false, "subscription")` returns `false`.
**What to change:** Add to `lib/featureFlags.ts`: `export function isProEnabled(flagValue: boolean, licenseType: LicenseType): boolean { return flagValue && licenseType === "subscription"; }`. Import `LicenseType` from `@/lib/licenseTypes`.
**Done condition:** Test passes. `grep -n "isProEnabled" lib/featureFlags.ts` returns a hit. `import { LicenseType }` is present. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #101 | architecture | severity 3
**What:** Extract checkout URL constants and pricing from `lib/entitlement.ts` into a new `lib/checkout.ts`. `lib/entitlement.ts` mixes API-call logic with presentation constants (checkout URLs, pricing display strings, portal URL). These belong in a dedicated module.
**Why:** `lib/entitlement.ts` will grow further in M2. Checkout constants are referenced by `components/BuyModal.tsx` and will be referenced by future marketing components. Separation keeps entitlement.ts focused on LS API calls and validation logic.
**File:** `lib/entitlement.ts` (modify), `lib/checkout.ts` (new)
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 2 files, extraction with re-exports
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — entitlement.ts has several importers. Re-export from entitlement.ts to maintain backwards compatibility.
**What to change:**
1. Create `lib/checkout.ts`: move `LS_STORE_SLUG`, `CHECKOUT_URLS`, `PRICING`, `CUSTOMER_PORTAL_URL` constants from `lib/entitlement.ts` into this file. Export them.
2. In `lib/entitlement.ts`: add `export { LS_STORE_SLUG, CHECKOUT_URLS, PRICING, CUSTOMER_PORTAL_URL } from "@/lib/checkout"` re-exports. All existing callers continue to work without changes.
3. Check all importers of `lib/entitlement.ts` — if any import CHECKOUT_URLS or PRICING directly, they continue working via the re-export.
**Done condition:** `grep -n "LS_STORE_SLUG\|CHECKOUT_URLS\|PRICING\|CUSTOMER_PORTAL" lib/checkout.ts` returns 4 hits. `grep -n "from.*checkout" lib/entitlement.ts` returns a re-export hit. `npm test` passes. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #102 | architecture | severity 5
**What:** Create `components/UpdateChecker.tsx` — an invisible component that calls `checkForUpdates()` from `lib/tauri.ts` on mount (Tauri environment only), then mounts it inside `components/EntitlementValidator.tsx` alongside the existing validation logic.
**Why:** `lib/tauri.ts:checkForUpdates()` has zero call sites — it is dead code. The natural home for a background check is `EntitlementValidator`, which is already an invisible Tauri-aware component mounted in `app/layout.tsx`. Adding update-checking here avoids bloating any visible page component and re-uses the existing isTauri guard pattern.
**File:** `components/UpdateChecker.tsx` (new), `components/EntitlementValidator.tsx` (modify)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, new component + wiring
**Blocked by:** #096 (checkForUpdates() must return availability info, not auto-install, before it can be safely called from a component) | **Blocks:** Nothing
**Risk:** Medium — mounts in layout, runs on every page. Must be a no-op in web/test environments.
**Test required (write first):** In `components/UpdateChecker.test.tsx`: test that in a non-Tauri environment (isTauri = false), `checkForUpdates()` is NOT called on mount.
**What to change:**
1. Create `components/UpdateChecker.tsx`: `useEffect(() => { if (!isTauri) return; checkForUpdates().then(result => { if (result?.available) { /* log or surface to UI */ } }); }, [])`. Import `isTauri` from `@/lib/tauri` and `checkForUpdates` from `@/lib/tauri`.
2. In `components/EntitlementValidator.tsx`: import `UpdateChecker` and render `<UpdateChecker />` in the null-returning JSX.
**Done condition:** `components/UpdateChecker.tsx` exists. `components/UpdateChecker.test.tsx` exists. `grep -n "UpdateChecker" components/EntitlementValidator.tsx` returns a hit. `grep -n "checkForUpdates" lib/tauri.ts` has at least one caller now. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #103 | architecture | severity 2
**What:** Trim `app/settings/page.tsx` from 153 lines to ≤150 lines (Rule 1: routes ≤150 lines).
**Why:** The page is 3 lines over the route limit. Any M2 addition (Pro gate for interrupt toggle, vacation mode toggle) will push it further over. Fix the limit breach before adding M2 UI.
**File:** `app/settings/page.tsx`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no logic change
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — refactor only, no logic change. Do NOT change any behaviour.
**What to change:** Remove or condense at least 3 lines without changing behaviour. Options: (a) collapse multi-line JSX attributes to single lines where idiomatic; (b) remove redundant blank lines; (c) inline a single-use constant that adds a line without value. No logic changes, no handler moves, no import changes.
**Done condition:** `wc -l app/settings/page.tsx` prints ≤150. `npm test` passes. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #104 | tests | severity 5
**What:** Write `components/LanguageGrid.test.tsx` — Rule 14 violation. `LanguageGrid.tsx` is a 94-line component implementing the Pro feature gating UI (locked/unlocked language display, upgrade CTA). It has zero tests.
**Why:** This is the only `components/*.tsx` file missing a test. It is the primary M2 surface for Pro gating — the component that renders "Free" vs "Unlock" vs "In development" states. Zero coverage on a Pro-gating component is a Rule 14 stop-the-line.
**File:** `components/LanguageGrid.test.tsx` (new)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 1 file (new test), requires reading LanguageGrid.tsx to understand props
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only task.
**What to change:** Create `components/LanguageGrid.test.tsx`. Test all three render states:
1. Italian (always free): renders with "Free" badge, calls `onSelect("it")` when clicked.
2. Unlocked paid pack (`isPackUnlocked("es") === true && entry.ready`): renders selectable, calls `onSelect("es")` when clicked.
3. Locked paid pack: renders upgrade CTA (pricing string), calls `onUpgradeClick` when clicked.
4. Locked NOT-ready pack: renders "In development" or similar, no click handler.
Each test must assert specific rendered text/class or callback invocation — not just `.toBeDefined()`.
**Done condition:** `components/LanguageGrid.test.tsx` exists. `npm test -- components/LanguageGrid.test.tsx` passes with ≥4 tests. `grep -c "expect(" components/LanguageGrid.test.tsx` ≥ 6 (real assertions, not pseudocode). Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #105 | tests | severity 3
**What:** Strengthen blob assertions in `hooks/useExportImport.test.ts` — currently `expect(URL.createObjectURL).toHaveBeenCalled()` without argument inspection.
**Why:** The current assertions verify `createObjectURL` was called but not WHAT blob was passed. A silent data corruption in the serialisation path (wrong store data in the export blob) would pass the current tests. Per Rule 16 (Enumerate Before You Assert), assert the specific value.
**File:** `hooks/useExportImport.test.ts`
**Severity:** 3 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, assertion augmentation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test-only, additive assertions.
**What to change:** After `expect(URL.createObjectURL).toHaveBeenCalled()`: add `expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))`. Also verify the anchor href was set to the object URL: extract the return value of `createObjectURL` mock and assert it appears in the anchor element's `href` attribute. Use `vi.mocked(URL.createObjectURL).mock.results[0].value` to get the mock return value.
**Done condition:** `grep -n "toHaveBeenCalledWith\|mock.results" hooks/useExportImport.test.ts` returns hits. `npm test -- hooks/useExportImport.test.ts` passes. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #106 | tests | severity 4
**What:** Write at least 3 behavioural tests for `app/settings/page.tsx` covering: (1) `handleLaunchAtLogin` toggle calls `enableAutostart`/`disableAutostart` via Tauri; (2) license key entry and activation wiring; (3) interrupt engine toggle wiring.
**Why:** `app/settings/page.tsx` is the highest-risk page for M2 — it contains Tauri side-effect handlers, license activation, and (soon) interrupt engine Pro gating. It currently has zero tests. Rule 14 applies to user-facing pages.
**File:** `app/settings/page.tsx.test.tsx` → `app/settings/page.test.tsx` (co-located)
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 1 file (new test), requires mocking Tauri + store
**Blocked by:** #103 (trim page first so test baseline is stable) | **Blocks:** Nothing
**Risk:** Low — test-only task.
**Test required:** Write `app/settings/page.test.tsx`. Three it() blocks minimum:
1. `handleLaunchAtLogin toggle → enableAutostart called` (mock `@tauri-apps/plugin-autostart`, render settings, check the toggle, verify `enableAutostart` was called).
2. `license activation → activateLicense called with trimmed key` (render, type in license key input, click Activate, verify hook called).
3. `interrupt engine toggle → interruptEnabled changes in store` (render, check the toggle, verify store action called).
Each must assert specific values — not just that a function was called.
**Done condition:** `app/settings/page.test.tsx` exists. `npm test -- app/settings/page.test.tsx` passes with ≥3 tests. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #107 | docs | severity 2
**What:** Update `AGENTS.md` coverage threshold in the verification gate: change `branches=79` to `branches=81`.
**Why:** Task #086 ratcheted branches from 79 → 81. AGENTS.md still shows the old threshold. A new session reading AGENTS.md would set a failing CI threshold on its first ratchet check.
**File:** `AGENTS.md`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, single number change
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — docs only.
**What to change:** Find the coverage thresholds line in AGENTS.md verification gate. Change `branches=79` to `branches=81`.
**Done condition:** `grep -n "branches=81" AGENTS.md` returns a hit. `grep -n "branches=79" AGENTS.md` returns zero hits. Verification gate green.
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #108 | docs | severity 3
**What:** Update `CLAUDE.md` to document four modules missing from the architecture description: `lib/utils.ts`, `hooks/useStudySession.ts`, `components/BuyModal.tsx`, `components/LanguageGrid.tsx`.
**Why:** A new agent session starting with only CLAUDE.md would not know where the canonical date helper lives (might duplicate `localDateStr`), would not understand the session management contract (`useStudySession` has a 12-param interface), and would not understand the role of BuyModal or LanguageGrid in the conversion funnel.
**File:** `CLAUDE.md`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, additive documentation
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — docs only.
**What to change:** Add to the appropriate sections in CLAUDE.md:
1. In §1 Layer Map (lib/ entry): add `utils.ts` — pure utility functions; currently exports `localDateStr(d?)` for local-time ISO date strings. Used by `useStudySession`, `lib/queue.ts`.
2. In §1 Layer Map (hooks/ entry, or a new line): add `useStudySession.ts` — session management hook. 12-param contract: manages queue, position, ratings, active session commit, and session-start introduction auto-selection. Do not add business logic here.
3. In §1 Layer Map (components/ entry, or a note): add `BuyModal.tsx` — primary conversion surface. Renders pricing and opens checkout URLs via `openExternalUrl`. Receives `onActivate` callback for key entry flow. `LanguageGrid.tsx` — language picker rendered on `app/page.tsx`; implements Free/Unlock/In-development display states.
**Done condition:** `grep -n "utils.ts\|useStudySession\|BuyModal\|LanguageGrid" CLAUDE.md` returns ≥4 hits. Verification gate green.
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #109 | docs | severity 2
**What:** Update `STATUS.md`: (1) add M2 milestone description under §2; (2) update introduction engine entry from "M1 complete" to "fully live (session-start activation wired in hooks/useStudySession.ts)".
**Why:** A new session has no idea what M2 means without opening tasks.md. STATUS.md should be the authoritative at-a-glance view of where the project stands. The intro engine entry is ambiguous — "M1 complete" doesn't communicate that `introduceCard()` is now called in production.
**File:** `STATUS.md`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, additive text
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — docs only.
**What to change:**
1. Add under §2 (or create §2 if missing): "M2 — Desktop shipping: Pro feature gating, Lemon Squeezy payment flow end-to-end, auto-updater with real signing keys, macOS packaging (signed + notarised). Windows/Linux packaging deferred to Batch 9."
2. Change intro engine STATUS.md entry from "M1 complete" to "fully live — lib/introduction.ts + srsStore integration + session-start activation (hooks/useStudySession.ts, 2026-06-29)".
**Done condition:** `grep -n "M2\|Desktop shipping" STATUS.md` returns a hit. `grep -n "fully live\|session-start activation" STATUS.md` returns a hit. Verification gate green.
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-29**

---

### Task #110 | consistency | severity 5
**What:** Resolve the 2 remaining Full debt items in `lib/entitlement.ts`: (1) extract 5 remaining inline error strings at lines ~151,162,182,186,190 in `activateLicense` and `validateLicense` to named `ERR_*` constants; (2) harden `activateLicense` and `validateLicense` to not pass raw `res.error` from Lemon Squeezy to callers — replace with safe internal constants (same pattern as `deactivateLicense` was hardened in Task #053). Items (2) [String(e)] and (3) [ERR naming dual-use comment] from the original scope were absorbed and completed in Task #095.
**Why:** Inline error strings at lines ~151,162,182,186,190 prevent consistent error message management. Raw res.error from LS API flowing to callers/UI is a severity-5 security debt (F7 from Task #053 audit) — any error string from LS could contain sensitive data. Task #095 fixed deactivateLicense; activate and validate remain.
**File:** `lib/entitlement.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 1 file, 2 related changes
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — error message constants and safe error mapping; no behaviour change for happy paths.
**What to change:**
1. Extract 5 inline error strings in activateLicense (lines ~151, 162) and validateLicense (lines ~182, 186, 190) to named `ERR_*` constants at the top of the file (same pattern as existing ERR_ACTIVATE_NETWORK etc.).
2. In activateLicense: replace `return { ok: false, error: ERR_ACTIVATION_FAILED }` calls that use `res.error` directly — map to internal constants only (never `res.error`). Same for validateLicense.
3. Remove the 2 Full debt entries from `.autocode/debt.md` (Task #053 sev:4 inline strings + Task #053 sev:5 raw res.error).
**Done condition:** `grep -n "ERR_" lib/entitlement.ts | wc -l` ≥ 15 (5 new constants added). No `res.error` string passed to callers in activateLicense or validateLicense. `grep -n "Task #053" .autocode/debt.md` returns zero hits (debt cleared). Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-29**

---

## Escalation Queue
Items that cannot be resolved without Max's input:

1. **Lifetime data in persisted stores (Task #001 follow-up):** Users who have a `licenseType: "lifetime"` value already persisted in their Zustand store (from any version of the app where the checkout URL was live) will hit `isPackUnlocked` with a type that no longer exists in the union after #001. A migration in `store/migrations.ts` should convert `"lifetime"` → `"subscription"` with a far-future `validUntil`. Decision needed: what `validUntil` to set, and whether to contact any users who may have purchased a lifetime pack.

2. **Sentence generator roadmap item (BRAND.md):** BRAND.md lists the sentence generator as "under evaluation" and notes it "requires deciding whether AI generation fits the brand's 'quiet expert' voice." This decision gates any AI integration work. No task has been created for it — flag for explicit go/no-go.

3. **Placeholder language configs (fr/de/pt):** `LANGUAGE_REGISTRY` lists `fr`, `de`, `pt` as `ready: false`. Task #014 will make the poka-yoke test correctly fail for these. The fix requires creating stub `LanguageConfig` objects with correct `code` fields. Confirm whether placeholder configs should inherit ITALIAN strings (safe) or SPANISH strings (current, inconsistent — fr/de/pt are not Spanish).

4. **ALL_PACK_CODES scope re: ready:false packs (Task #068):** `ALL_PACK_CODES` = all 5 registered codes including `ready: false` langs. The security guard in `loadPack`/`evictPack` validates against ALL_PACK_CODES, so `loadPack("fr", ...)` passes the guard and attempts a CDN fetch (which fails). Options: (A) Keep current — registered = loadable; CDN is the content gate; guard is purely security (path traversal / key poisoning prevention); (B) Add `READY_PACK_CODES` subset (`ready: true` only) and use it in the guard, giving early `"not_ready"` rejection before any network attempt. Decision needed from: Max.

---

---

## Batch 9 — Quality Hardening | 9 tasks | [COMPLETE]
Dependency: Batch 8 complete.
Theme: Rule 14 completion (4 page routes), CI enforcement, docs accuracy, architecture debt. Owner priority: quality before M2 ships.

### Task #111 | tests | severity 7
**What:** Create `app/page.test.tsx` with ≥3 behavioral tests covering: (1) `LanguageGrid` renders with Free / Unlock states based on entitlement; (2) `BuyModal` opens when an upgrade CTA is clicked; (3) language selection navigates to the study route. Use the same mock patterns as `app/settings/page.test.tsx` — mock `@/lib/storage`, `@/lib/tauri`, `@/store/entitlementStore` reset in `beforeEach`.
**Why:** Rule 14 stop-the-line. `app/page.tsx` (107 lines) is the primary conversion surface: it contains `LanguageGrid` + `BuyModal` + entitlement-gated language selection. Zero test coverage on the page that drives subscription upgrades.
**File:** `app/page.test.tsx` (new)
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — test-only addition.
**Completion gates:** QA Agent sign-off
**Done when:** `app/page.test.tsx` exists with ≥3 behavioral tests; `npm test` passes; `grep -r "page.test.tsx" app/` returns 1 hit.
**Complexity:** 🔧 Full — new file, mocks ≥3 components/hooks
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #112 | tests | severity 7
**What:** Create `app/study/page.test.tsx` with ≥3 behavioral tests covering: (1) `StudyCard` renders the first card in the queue; (2) `StudyDoneScreen` appears when queue is empty; (3) `InterruptHandler` mounting does not throw. Use same mock strategy: `@/lib/storage` no-op, store reset per test.
**Why:** Rule 14 stop-the-line. `app/study/page.tsx` (150 lines) is the core study loop — the feature every user spends the most time in. It integrates `useStudySession` (12-param contract), `InterruptHandler`, `StudyCard`, and `StudyDoneScreen`. Zero tests on the most-used page.
**File:** `app/study/page.test.tsx` (new)
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — test-only addition.
**Completion gates:** QA Agent sign-off
**Done when:** `app/study/page.test.tsx` exists with ≥3 behavioral tests; `npm test` passes; `grep -r "study/page.test.tsx" app/` returns 1 hit.
**Complexity:** 🔧 Full — new file, mocks useStudySession + InterruptHandler
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #113 | tests | severity 5
**What:** Create `app/learn/page.test.tsx` with ≥2 behavioral tests covering: (1) unit list renders from pack data with correct lock/unlock state per entitlement; (2) clicking a locked unit shows the upgrade prompt (or opens BuyModal). Mock `@/lib/packLoader` and `@/lib/storage`.
**Why:** Rule 14 stop-the-line. `app/learn/page.tsx` (130 lines) contains pack-unlock gating logic — the first screen a new user sees after language selection.
**File:** `app/learn/page.test.tsx` (new)
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — test-only addition.
**Completion gates:** QA Agent sign-off
**Done when:** `app/learn/page.test.tsx` exists with ≥2 behavioral tests; `npm test` passes.
**Complexity:** 🔧 Full — new file, mocks packLoader + entitlement
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #114 | tests | severity 5
**What:** Create `app/stats/page.test.tsx` with ≥2 behavioral tests covering: (1) stats render with correct "last seen Nd ago" neutral framing (not "Nd ago" alone); (2) empty state renders when no cards have been studied. Use `useStatsData` mock.
**Why:** Rule 14 stop-the-line. `app/stats/page.tsx` (146 lines) contains the BRAND-compliant counter framing added in Task #088. A regression could silently re-introduce guilt-inducing copy.
**File:** `app/stats/page.test.tsx` (new)
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — test-only addition.
**Completion gates:** QA Agent sign-off
**Done when:** `app/stats/page.test.tsx` exists with ≥2 behavioral tests including a "last seen" copy assertion; `npm test` passes.
**Complexity:** 🔧 Full — new file, mocks useStatsData
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #115 | ci | severity 6
**What:** Add three missing steps to `.github/workflows/ci.yml`: (1) `npm run lint` after the type-check step; (2) `--coverage` flag on the `npm test` invocation; (3) `npm audit --audit-level=high` after install. The existing 2 moderate vulns (next/postcss) are known and low-risk — `--audit-level=high` gates on new high/critical vulns without blocking CI on the known moderate chain.
**Why:** The CI pipeline currently misses: lint errors (caught locally but not in CI), coverage threshold regressions (thresholds enforced in vitest.config.ts but `npm test` without `--coverage` skips the check), and new high/critical CVEs. A push to main could introduce all three silently.
**File:** `.github/workflows/ci.yml`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — additive CI steps. If lint fails on current code, fix the lint errors first.
**Completion gates:** Architecture Agent sign-off
**Done when:** `.github/workflows/ci.yml` contains `npm run lint`, `npm test -- --coverage`, and `npm audit --audit-level=high`; `git push` to main produces a green CI run with all three steps visible in the Actions log.
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope change
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #116 | docs | severity 4
**What:** Update `CLAUDE.md` with 7 accuracy gaps from Batch 8, plus `STATUS.md` with 1 gap: (1) §2 Tauri Gateway — add `checkForUpdates()`, `enableAutostart()`, `disableAutostart()` to the listed exports; (2) Notable modules — add `lib/checkout.ts` entry; (3) Notable modules — add `lib/featureFlags.ts:isProEnabled` combinator; (4) Notable modules — add `UpdateChecker.tsx` description; (5) §5 Entitlement Model — add cross-ref to `lib/checkout.ts` for pricing constants; (6) §7 Introduction Engine — add session-start activation sentence (hooks/useStudySession.ts mount, Task #085, 2026-06-29); (7) STATUS.md §1 Shipped — add "Auto-updater wired (signing keys are Batch 10 prerequisites)". QA memory note: correct test baseline to 843 in any doc that references it (memory was projecting 908).
**Why:** 7 doc gaps identified in run 6 examination. A new agent starting in Batch 9/10 will look for checkout constants in `lib/entitlement.ts` (wrong since Task #101), will add a second introduction activation path (missing the session-start note), and will not know about `isProEnabled` — the mandatory combinator for all Pro-gated features.
**File:** `CLAUDE.md`, `STATUS.md`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — docs only.
**Completion gates:** Docs Agent sign-off
**Done when:** `grep "checkout.ts\|isProEnabled\|UpdateChecker\|checkForUpdates\|session-start" CLAUDE.md` returns ≥5 hits; `grep "auto-updater" STATUS.md` returns ≥1 hit in the Shipped section.
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope change
**Owner:** Docs Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #117 | architecture | severity 2
**What:** Fix the `USED BY` comment in `lib/featureFlags.ts:5` — currently contains a shell command as a static comment (`grep -r "from \"@/lib/featureFlags\""...`). Replace with actual caller list: `components/InterruptHandler.tsx` (production). Update when new callers are added.
**Why:** Rule 2 violation. A shell command embedded in a static comment is never executed and can never be updated automatically. Callers change; the comment does not. A future agent reading this comment will trust stale data.
**File:** `lib/featureFlags.ts`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — comment change only.
**Completion gates:** Architecture Agent sign-off
**Done when:** `head -8 lib/featureFlags.ts` shows a USED BY line listing actual caller files (not a shell command).
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope change
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #118 | architecture | severity 4
**What:** Audit every Pro-gated call site and ensure all use the `isProEnabled(flagValue, licenseType)` combinator from `lib/featureFlags.ts`. Run: `grep -rn 'licenseType === "subscription"' lib/ components/ hooks/ app/ --include="*.ts" --include="*.tsx" | grep -v ".test."`. For each hit: replace inline check with `isProEnabled(getFeatureFlags().[relevantFlag], licenseType)`. If the interrupt engine is intentionally ungated (owner decision 2026-06-29: free users can enable), exclude that specific call site from the audit scope and add a comment.
**Why:** `isProEnabled` was added in Task #100 as the single combinator for all Pro-gated features. Only `InterruptHandler.tsx` uses it in production today. Any future feature that bypasses the combinator and checks `licenseType === "subscription"` directly creates two divergent code paths — the flag framework cannot disable a Pro feature without also touching the inline check.
**File:** Multiple — grep to discover, then edit each hit
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — audit and cosmetic code path changes only. No behaviour change (inline check and combinator are logically identical).
**Completion gates:** Architecture Agent sign-off
**Done when:** `grep -rn 'licenseType === "subscription"' lib/ components/ hooks/ app/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "licenseTypes.ts"` returns 0 hits (or only the intentionally-excepted interrupt engine comment).
**Complexity:** 🔧 Full — grep across all layers, edit multiple files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #119 | tests | severity 2
**What:** Close 3 sev:2 debt items from debt.md in a single pass: (1) `tests/entitlement.test.ts` — add test for `deactivateLicense()` when `invoke` returns boolean `false` (the `raw !== true` guard exists but the branch is untested); (2) `lib/entitlement.ts:216` — rename log string `ENTITLEMENT_DEACTIVATE_EMPTY` to `ENTITLEMENT_DEACTIVATE_NON_TRUE` to accurately describe the condition (fires for any non-true invoke response, not just null/empty); (3) `lib/entitlement.ts:138` and `:179` — add `console.error` before returning `ERR_ACTIVATION_FAILED` and `ERR_VALIDATE_INACTIVE` when `res.error` is truthy, so the raw LS error string is logged at least once (not discarded silently).
**Why:** 3 Direct severity-2 items deferred to debt.md since Tasks #095 and #110. Small fixes, negligible risk, best batched together.
**File:** `tests/entitlement.test.ts`, `lib/entitlement.ts`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — test addition + two-line log changes.
**Completion gates:** QA Agent sign-off
**Done when:** (1) `npm test -- tests/entitlement.test.ts` passes including the new `invoke=false` test; (2) `grep "ENTITLEMENT_DEACTIVATE_EMPTY" lib/entitlement.ts` returns 0 hits; (3) `grep "console.error" lib/entitlement.ts` returns ≥2 hits in the activateLicense/validateLicense error branches; (4) 3 rows removed from debt.md.
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope change
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

## Batch 10 — M2 macOS Shipping Infrastructure | 11 tasks | [CURRENT SPRINT]
Dependency: Batch 9 complete. Owner actions (LS store creation, Apple Developer ID certificate) must be completed before tasks #120–#122 can close.
Theme: The infrastructure prerequisites for distributing plyglt as a signed macOS desktop app. Windows/Linux packaging is Batch 11.

### Task #120 | build | severity 9
**What:** Create the Lemon Squeezy store at https://dashboard.lemonsqueezy.com — products: "plyglt Pro Monthly" ($4.99/mo) and "plyglt Pro Annual" ($34.99/yr). Confirm the store slug. If the slug is not "plyglt", update `lib/checkout.ts:LS_STORE_SLUG` to match the real slug and verify `CHECKOUT_URLS.monthly` and `CHECKOUT_URLS.annual` return 200. Also configure the license activation webhook in LS to call `lib/entitlement.ts:activateLicense` contract spec.
**Why:** Owner confirmed LS store does not yet exist (2026-06-29). Every "Upgrade to Pro" click in the current build leads to a 404. The payment funnel is entirely non-functional. This is a prerequisite for M2.
**File:** `lib/checkout.ts` (if slug differs from "plyglt"), `CONTRIBUTING_LANGUAGE.md` (add LS product setup note)
**Blocks:** Batch 10 completion (cannot distribute without payment)
**Blocked by:** Nothing (owner action)
**Risk:** Medium — any slug mismatch requires a code change propagated to all URL callers (blast radius: 5 files import checkout.ts).
**Completion gates:** Security Agent sign-off (LS URLs return 200)
**Done when:** `curl https://plyglt.lemonsqueezy.com/buy/monthly` (or updated slug) returns HTTP 200; `grep LS_STORE_SLUG lib/checkout.ts` matches the real LS store slug.
**Complexity:** ⚡ Direct — 1 file (if slug update needed), otherwise owner action only
**Owner:** Architecture Agent

---

### Task #121 | security | severity 9
**What:** Generate an ed25519 signing keypair for the Tauri auto-updater: run `tauri signer generate -w ~/.tauri/plyglt.key`. Place the **public key** in `src-tauri/tauri.conf.json:plugins.updater.pubkey`. Add the **private key** as a GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`. Never commit the private key. Verify the public key format matches Tauri's expected base64-encoded ed25519 spec.
**Why:** `src-tauri/tauri.conf.json:46` has the literal placeholder `"REPLACE_WITH_TAURI_SIGNING_PUBLIC_KEY"`. The auto-updater cannot validate update manifests without a real public key. Shipping a binary with a placeholder pubkey accepts any update payload without signature verification — a supply-chain risk.
**File:** `src-tauri/tauri.conf.json`
**Blocks:** Task #123 (release workflow cannot sign without the key)
**Blocked by:** Nothing (owner action)
**Risk:** High — private key loss requires regenerating the keypair AND updating every deployed binary's pubkey (forces all users through a manual update). Store private key securely. Document in CONTRIBUTING_LANGUAGE.md.
**Completion gates:** Security Agent sign-off
**Done when:** `grep "REPLACE_WITH" src-tauri/tauri.conf.json` returns 0 hits for the pubkey field; CI secret `TAURI_SIGNING_PRIVATE_KEY` is confirmed set in GitHub repository settings.
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope change
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #122 | security | severity 9
**What:** Configure macOS code signing in CI: obtain an Apple Developer ID Application certificate (from developer.apple.com), export as a .p12 file, add the following GitHub Actions secrets: `APPLE_CERTIFICATE` (base64-encoded .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` (e.g. "Developer ID Application: Max Smith (TEAM_ID)"), `APPLE_ID` (Apple ID email), `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`. Update `src-tauri/tauri.conf.json:bundle.macOS.signingIdentity` from `null` to the certificate common name.
**Why:** `src-tauri/tauri.conf.json:33` has `"signingIdentity": null`. macOS Gatekeeper rejects unsigned binaries from unidentified developers. Users on macOS 13+ cannot open an unsigned app via standard installation. This is a hard distribution blocker.
**File:** `src-tauri/tauri.conf.json`
**Blocks:** Task #123 (release workflow must embed signing identity)
**Blocked by:** Nothing (owner action — requires Apple Developer Program membership)
**Risk:** High — certificate mismatch or wrong signing identity silently produces an unsigned binary. Validate with `codesign --verify --verbose` on the built .app.
**Completion gates:** Security Agent sign-off
**Done when:** `grep "signingIdentity" src-tauri/tauri.conf.json` returns a non-null string value; a test macOS build on CI produces a notarized .dmg that opens without Gatekeeper warning on a clean macOS install.
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope change
**Owner:** Security Agent

---

### Task #123 | build | severity 8
**What:** Create `.github/workflows/release.yml` — a GitHub Actions workflow triggered on `push: tags: ['v*']` that: (1) runs the Tauri build matrix for macOS only (targeting `aarch64-apple-darwin` and `x86_64-apple-darwin`); (2) signs the .app using the Apple certificate secrets from Task #122; (3) notarizes the .app via `xcrun notarytool`; (4) uses `tauri-action` to generate the update manifest (`latest.json`); (5) uploads artifacts to a GitHub Release using `softpronic/action-gh-release` or equivalent; (6) uses `TAURI_SIGNING_PRIVATE_KEY` from Task #121 to sign the update manifest. Update `src-tauri/tauri.conf.json:plugins.updater.endpoints[0]` to point to the real GitHub Releases URL (replacing the REPLACE_WITH_REPO placeholder).
**Why:** No release workflow exists. Building, signing, and distributing plyglt currently requires the developer's local machine. CI cannot produce a distributable binary. This is the final M2 prerequisite before a public macOS release.
**File:** `.github/workflows/release.yml` (new), `src-tauri/tauri.conf.json` (update endpoint)
**Blocks:** Nothing (end of M2 chain)
**Blocked by:** Task #121 (signing keypair), Task #122 (Apple certificate CI secrets)
**Risk:** High — incorrect signing, notarization failure, or artifact naming mismatch breaks distribution silently. Test with a pre-release tag (v0.1.0-beta.1) before the real v0.1.0 tag. Validate with `xcrun stapler validate` and a Gatekeeper check on a clean macOS machine.
**Completion gates:** Security Agent sign-off + Architecture Agent sign-off
**Done when:** Pushing a `v*` tag triggers the workflow; the resulting GitHub Release contains a signed .dmg and a `latest.json` manifest; `curl [endpoint]` returns the manifest with valid ed25519 signature; `grep "REPLACE_WITH_REPO" src-tauri/tauri.conf.json` returns 0 hits.
**Complexity:** ⚡ Direct — 2 files, no package boundary, no implementation-scope keywords in What
**Owner:** Security Agent

---

### Task #124 | build | severity 4
**What:** Add a notification permission onboarding explanation to the interrupt engine enable flow. When a user first toggles "Enable review reminders" ON in `app/settings/page.tsx`, show a short explanation before the OS permission dialog fires: "plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this." If the user previously denied permission on macOS, show a graceful fallback: "Enable notifications for plyglt in System Settings → Notifications." (no repeat dialog, just the instruction).
**Why:** Product agent found: "the first time a Pro user enables the interrupt engine, a notification permission dialog appears mid-session with no prior explanation." macOS does not allow re-prompting after a denial. Users who reflexively click "Don't Allow" lose the core Pro differentiator with no recovery path visible in the UI.
**File:** `app/settings/page.tsx`, possibly a new small `components/NotificationPermissionGate.tsx`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — UI-only addition. Does not change Tauri IPC calls.
**Completion gates:** Architecture Agent sign-off
**Done when:** Toggling "Enable review reminders" ON shows an explanation sentence before the OS dialog fires (or inline in the settings card before the toggle if permission has already been granted); `npm test` passes; no Tauri IPC changes.
**Complexity:** ⚡ Direct — 2 files, no package boundary, no implementation-scope keywords in What
**Owner:** Architecture Agent

---

### Task #125 | build | severity 3
**What:** Add `npm audit --audit-level=high` to `.github/workflows/ci.yml` AND document the 2 known moderate vulns (postcss/next chain) in `STATUS.md §3 Known Issues`: "2 moderate npm vulnerabilities in the next/postcss dependency chain (CVE tracked). Unfixable without a major Next.js downgrade. Severity: moderate (build-time CSS ReDoS, not runtime). CI gates on high/critical only."
**Why:** CI currently has no `npm audit` step (Task #115 adds high/critical gating). The 2 moderate vulns that already exist need to be documented so future agents don't waste time investigating them. Without documentation they appear as unknown/new on every fresh examination.
**File:** `.github/workflows/ci.yml`, `STATUS.md`
**Blocks:** Nothing
**Blocked by:** Task #115 (adds the audit step — this task adds documentation for the known exceptions)
**Risk:** Low — documentation + CI step addition.
**Completion gates:** Docs Agent sign-off
**Done when:** `grep "npm audit" .github/workflows/ci.yml` returns ≥1 hit; `grep "moderate" STATUS.md` returns ≥1 hit in Known Issues section.
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope change
**Owner:** Docs Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #154 | code | severity 8
**What:** Delete `components/InterruptHandler.tsx` lines 39–56 — the duplicate license revalidation block (`needsValidation()` check + `validateLicense()` call + `markValidated()`/`touchValidated()` branches). `EntitlementValidator.tsx` already runs identical logic on mount in `app/layout.tsx`. When both components mount simultaneously, Zustand reads `needsValidation()` as true for both before either effect's `touchValidated()` propagates — producing two concurrent Lemon Squeezy API calls on every app launch when validation is due.
**Why:** SCTS Andon cord — two concurrent LS API calls on every launch when validation is due. Could exhaust LS rate limits, create duplicate validation events, and masks the responsibility boundary (`EntitlementValidator.tsx` owns revalidation). Stop-the-line.
**File:** `components/InterruptHandler.tsx`, `components/InterruptHandler.test.tsx`
**Severity:** 8 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file (+ test), deletion only
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — `InterruptHandler.test.tsx` must add a test verifying the component does NOT call `validateLicense` on mount.
**Done when:** `components/InterruptHandler.tsx` contains no `needsValidation`, `validateLicense`, `markValidated`, or `touchValidated` import or call. `components/InterruptHandler.test.tsx` has a new assertion that renders `<InterruptHandler />` and asserts `validateLicense` was NOT called. `npm test` passes.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #155 | product | severity 6
**What:** Gate `app/stats/page.tsx` behind `isProEnabled(flags.analytics, licenseType)`. Import `useSettingsStore` to get `licenseType`. Import `getFeatureFlags` and `isProEnabled` from `lib/featureFlags`. Add gate at top of page component: if `!isProEnabled(flags.analytics, licenseType)` render a Pro upgrade prompt (matching the pattern in other gated surfaces) instead of the stats view. Wire `flags.analytics` from `getFeatureFlags()`.
**Why:** BRAND.md lists Analytics as Pro-only. The `analytics` feature flag exists in `lib/featureFlags.ts:35` but is never wired to `app/stats/page.tsx` — every free user sees the stats page. Owner decision 2026-07-01: gate it. Without this the flag is a dead symbol and free users have access to a Pro feature.
**File:** `app/stats/page.tsx`, `app/stats/page.test.tsx`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no implementation-scope keywords in What
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — 2 new test cases: (1) free user sees upgrade prompt, (2) Pro user sees stats. Also test analytics flag=false shows prompt even for Pro.
**Done when:** Free users (licenseType="free") see an upgrade prompt on `/stats`. Pro users see full stats. Flag=false blocks even Pro users. `app/stats/page.test.tsx` has ≥2 new gate test cases. `npm test` passes with no coverage regression.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #156 | architecture | severity 5
**What:** Extract specialty-pack handling from `lib/packLoader.ts` (currently 426 lines — 26 over Rule 1 service ceiling of 400) into new `lib/specialtyPackLoader.ts`. Move: `isReadySpecialtyPack` guard logic, specialty pack download + sha256 verify + merge into `memCache[baseLang]`, `loadedAddOns` array, `getLoadedAddOns()` export, `"base_pack_not_loaded"` error path. `lib/packLoader.ts` calls `lib/specialtyPackLoader.ts` for the specialty branch. Keep `clearCacheForTesting` exports accessible to tests (either re-export or expose from both modules). Add Rule 2 header to `lib/specialtyPackLoader.ts`.
**Why:** Rule 1 — service files cap at 400 lines. `lib/packLoader.ts` is at 426 lines and will grow as specialty packs ship. Extract now avoids a larger refactor later.
**File:** `lib/packLoader.ts`, `lib/specialtyPackLoader.ts` (new), `tests/packLoader.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files + 1 new, refactor
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — all 28+ existing packLoader tests must continue passing, including the 3 specialty pack merge path tests.
**Done when:** `lib/packLoader.ts` ≤ 400 lines. `lib/specialtyPackLoader.ts` exists with Rule 2 header. All existing packLoader tests pass (no regressions). `npm test` passes. No coverage regression.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #157 | tests | severity 4
**What:** Add a test describe block to `tests/langRegistry.test.ts` exercising `getSpecialtyPacks(lang)` with a non-empty `SPECIALTY_PACKS` registry. Use `vi.mock`/`vi.hoisted` to temporarily replace `SPECIALTY_PACKS` with a 3-pack mock (2 with `baseLang: "it"`, 1 with `baseLang: "es"`). Assert: `getSpecialtyPacks("it")` returns exactly the 2 Italian packs; `getSpecialtyPacks("es")` returns exactly the 1 Spanish pack; `getSpecialtyPacks("fr")` returns [].
**Why:** The `sp.baseLang === lang` filter predicate in `getSpecialtyPacks()` has no test with a non-empty registry. LanguageGrid tests mock the function entirely. If someone adds specialty packs and misspells `baseLang`, no test catches it.
**File:** `tests/langRegistry.test.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, tests only
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** This task IS the test.
**Done when:** `tests/langRegistry.test.ts` has a new describe block "getSpecialtyPacks with non-empty registry" with ≥3 test cases. `npm test` passes.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #158 | tests | severity 3
**What:** Replace 6 redundant `expect(screen.getByX(...)).toBeDefined()` patterns with bare calls or specific value assertions. Locations: `app/learn/page.test.tsx` lines 96, 97, 105, 106 and `app/stats/page.test.tsx` lines 69, 83. `screen.getByText()` and `screen.getByTestId()` already throw if absent — `.toBeDefined()` adds zero signal. Use specific text/value assertions where a meaningful check is possible; otherwise use bare `screen.getByText('...')`.
**Why:** Kaizen — pseudocode assertions pass when the implementation is wrong. Rule 5 requires tests that fail with wrong output.
**File:** `app/learn/page.test.tsx`, `app/stats/page.test.tsx`
**Severity:** 3 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, test cleanup
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** The fixes ARE the tests.
**Done when:** Neither file has `.toBeDefined()` wrapping a `getBy*` result. `npm test` passes.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-01**

## Batch 11 — A1 Spanish Source-Language Translation | 21 tasks | [COMPLETE]
Dependency: Batch 10 is owner-blocked (Tasks #120–#122 need owner actions). These tasks are fully independent and run immediately.
Theme: Add `es` (Spanish) source-language fields to all 20 A1 Italian unit files. One task per unit + one export/validate task. All 20 unit tasks are independent — no cross-dependencies.

Schema reference (`content/types.ts`):
- `produce` cards only: `prompts?: Record<string, string>` → e.g. `prompts: { es: "rojo" }`
- `recognize` cards only: `translations?: Record<string, string[]>` → e.g. `translations: { es: ["rojo"] }`
- `conjugate` / `fill_blank` / `passage_cloze`: no translation fields — prompts are already in Italian; skip these.

---

### Task #126 | content | severity 5
**What:** Open `content/cards/a1-unit-01-greetings.ts`. For every `produce` card add `prompts: { es: "..." }` with the Spanish translation of the English prompt. For every `recognize` card add `translations: { es: ["..."] }` with Spanish translation(s) matching the English `accepted` array. Skip `conjugate`, `fill_blank`, and `passage_cloze` cards entirely.

Unit theme — Greetings & Identity. Key equivalents: buongiorno → buenos días; buonasera → buenas tardes; buonanotte → buenas noches; ciao → hola / adiós; arrivederci → hasta luego; grazie → gracias; prego → de nada; bene → bien; male → mal; così così → más o menos; italiano/a → italiano/a; americano/a → americano/a; inglese → inglés/inglesa; francese → francés/francesa. For produce cards with English sentence prompts (T3/T4), translate the full sentence to Spanish.
**Why:** Spanish speakers see English prompts when studying Italian. The `types.ts` schema already supports `Card.prompts` and `Card.translations` for non-English source languages.
**File:** `content/cards/a1-unit-01-greetings.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only; no existing fields modified.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-01-greetings.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #127 | content | severity 5
**What:** Open `content/cards/a1-unit-02-bar.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — At the Bar/Café. Key equivalents: caffè → café; cappuccino → capuchino; acqua → agua; vino → vino; birra → cerveza; pane → pan; conto → cuenta; tavolo → mesa; cameriere → camarero; quanto costa → cuánto cuesta; vorrei → quisiera; per favore → por favor; un bicchiere di → un vaso de; ho sete → tengo sed; ho fame → tengo hambre.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-02-bar.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-02-bar.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #128 | content | severity 5
**What:** Open `content/cards/a1-unit-03-family.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Family & Relationships. Key equivalents: madre → madre; padre → padre; fratello → hermano; sorella → hermana; figlio → hijo; figlia → hija; nonno → abuelo; nonna → abuela; zio → tío; zia → tía; cugino/a → primo/a; marito → marido/esposo; moglie → esposa; fidanzato/a → novio/a; amico/a → amigo/a; mio/mia → mi; tuo/tua → tu.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-03-family.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-03-family.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #129 | content | severity 5
**What:** Open `content/cards/a1-unit-04-city.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — The City & Getting Around. Key equivalents: città → ciudad; piazza → plaza; strada → calle; negozio → tienda; supermercato → supermercado; chiesa → iglesia; museo → museo; farmacia → farmacia; banca → banco; stazione → estación; autobus → autobús; metro → metro; vicino a → cerca de; lontano da → lejos de; dov'è → dónde está; a destra → a la derecha; a sinistra → a la izquierda; dritto → recto.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-04-city.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-04-city.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #130 | content | severity 5
**What:** Open `content/cards/a1-unit-05-time.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Days, Months & Time. Key equivalents: lunedì → lunes; martedì → martes; mercoledì → miércoles; giovedì → jueves; venerdì → viernes; sabato → sábado; domenica → domingo; gennaio → enero; febbraio → febrero; marzo → marzo; aprile → abril; maggio → mayo; giugno → junio; luglio → julio; agosto → agosto; settembre → septiembre; ottobre → octubre; novembre → noviembre; dicembre → diciembre; oggi → hoy; domani → mañana; ieri → ayer; mattina → mañana (morning); sera → tarde/noche; ora → hora; minuto → minuto.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-05-time.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-05-time.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #131 | content | severity 5
**What:** Open `content/cards/a1-unit-06-describing.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Describing People & Things. Key equivalents: alto/a → alto/a; basso/a → bajo/a; grande → grande; piccolo/a → pequeño/a; bello/a → bonito/a / hermoso/a; brutto/a → feo/a; giovane → joven; vecchio/a → viejo/a / anciano/a; magro/a → delgado/a; grasso/a → gordo/a; lungo/a → largo/a; corto/a → corto/a; nuovo/a → nuevo/a; vecchio/a → viejo/a; caro/a → caro/a; economico/a → económico/a / barato/a; difficile → difícil; facile → fácil; interessante → interesante; noioso/a → aburrido/a.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-06-describing.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-06-describing.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #132 | content | severity 5
**What:** Open `content/cards/a1-unit-07-likes.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Likes, Dislikes & Hobbies. Key equivalents: mi piace → me gusta; non mi piace → no me gusta; mi piacciono → me gustan; adoro → adoro; odio → odio; preferisco → prefiero; sport → deporte; musica → música; film → película; libro → libro; viaggiare → viajar; cucinare → cocinar; leggere → leer; scrivere → escribir; cantare → cantar; ballare → bailar; giocare → jugar; nuotare → nadar; correre → correr.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-07-likes.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-07-likes.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #133 | content | severity 5
**What:** Open `content/cards/a1-unit-08-review.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — A1 Review (common verbs: essere, avere, fare, andare, venire, potere, volere, dovere). Key equivalents: essere → ser/estar; avere → tener; fare → hacer; andare → ir; venire → venir; potere → poder; volere → querer; dovere → deber; sapere → saber; stare → estar; dare → dar; dire → decir; mangiare → comer; bere → beber; dormire → dormir; lavorare → trabajar; abitare → vivir/habitar; parlare → hablar; capire → entender; guardare → mirar.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-08-review.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-08-review.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #134 | content | severity 5
**What:** Open `content/cards/a1-unit-09-colors.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Colors & Shapes. Key equivalents: rosso/a → rojo/a; blu → azul; verde → verde; giallo/a → amarillo/a; bianco/a → blanco/a; nero/a → negro/a; arancione → naranja; viola → morado/a / violeta; rosa → rosa; grigio/a → gris; marrone → marrón; beige → beige; cerchio → círculo; quadrato → cuadrado; triangolo → triángulo; rettangolo → rectángulo; chiaro/a → claro/a; scuro/a → oscuro/a; colorato/a → colorido/a.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-09-colors.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-09-colors.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #135 | content | severity 5
**What:** Open `content/cards/a1-unit-10-body.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — The Body & Health. Key equivalents: testa → cabeza; occhio/occhi → ojo/ojos; naso → nariz; bocca → boca; orecchio → oreja/oído; collo → cuello; spalla → hombro; braccio/braccia → brazo/brazos; mano/mani → mano/manos; dito/dita → dedo/dedos; petto → pecho; stomaco → estómago; schiena → espalda; gamba → pierna; ginocchio → rodilla; piede/piedi → pie/pies; mi fa male → me duele; ho mal di testa → tengo dolor de cabeza; febbre → fiebre; tosse → tos.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-10-body.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-10-body.ts` returns ≥ 50.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #136 | content | severity 5
**What:** Open `content/cards/a1-unit-11-food.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Food & Drinks. Key equivalents: pane → pan; pasta → pasta; riso → arroz; carne → carne; pesce → pescado; pollo → pollo; verdura → verdura/vegetal; frutta → fruta; formaggio → queso; uovo/uova → huevo/huevos; latte → leche; acqua → agua; vino → vino; caffè → café; tè → té; succo → jugo/zumo; colazione → desayuno; pranzo → almuerzo/comida; cena → cena; ristorante → restaurante; mangiare → comer; bere → beber; cucinare → cocinar; delizioso → delicioso; salato/a → salado/a; dolce → dulce.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-11-food.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-11-food.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #137 | content | severity 5
**What:** Open `content/cards/a1-unit-12-emotions.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Feelings & Emotions. Key equivalents: felice → feliz; triste → triste; arrabbiato/a → enojado/a; stanco/a → cansado/a; annoiato/a → aburrido/a; spaventato/a → asustado/a; sorpreso/a → sorprendido/a; nervoso/a → nervioso/a; contento/a → contento/a; preoccupato/a → preocupado/a; tranquillo/a → tranquilo/a; geloso/a → celoso/a; innamorato/a → enamorado/a; deluso/a → decepcionado/a; orgoglioso/a → orgulloso/a; imbarazzato/a → avergonzado/a; curioso/a → curioso/a; confuso/a → confundido/a; entusiasta → entusiasta; solo/a → solo/a; grato/a → agradecido/a; rilassato/a → relajado/a; stressato/a → estresado/a; bene → bien.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-12-emotions.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-12-emotions.ts` returns ≥ 60.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #138 | content | severity 5
**What:** Open `content/cards/a1-unit-13-household.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Home & Household. Key equivalents: casa → casa; appartamento → apartamento; stanza → habitación; cucina → cocina; bagno → baño; camera da letto → dormitorio; salotto → sala de estar; tavolo → mesa; sedia → silla; letto → cama; divano → sofá; finestra → ventana; porta → puerta; pavimento → suelo/piso; tetto → techo; muro → pared; armadio → armario; frigorifero → nevera/refrigerador; lavatrice → lavadora; lampada → lámpara; pulire → limpiar; cucinare → cocinar; abitare → vivir.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-13-household.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-13-household.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #139 | content | severity 5
**What:** Open `content/cards/a1-unit-14-animals.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Animals. Key equivalents: cane → perro; gatto → gato; cavallo → caballo; mucca → vaca; maiale → cerdo; pecora → oveja; pollo → pollo; pesce → pez; uccello → pájaro; coniglio → conejo; topo → ratón; elefante → elefante; leone → león; tigre → tigre; orso → oso; lupo → lobo; volpe → zorro; serpente → serpiente; scimmia → mono; delfino → delfín; animale → animal; selvaggio/a → salvaje; domestico/a → doméstico/a; grande → grande; piccolo/a → pequeño/a.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-14-animals.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-14-animals.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #140 | content | severity 5
**What:** Open `content/cards/a1-unit-15-numbers.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Numbers & Money. Key equivalents: zero → cero; uno → uno; due → dos; tre → tres; quattro → cuatro; cinque → cinco; sei → seis; sette → siete; otto → ocho; nove → nueve; dieci → diez; venti → veinte; cento → cien/ciento; mille → mil; euro → euro; centesimo → céntimo; soldi → dinero; prezzo → precio; quanto costa → cuánto cuesta; vorrei → quisiera; ho bisogno di → necesito; portafoglio → billetera/cartera; resto → cambio; sconto → descuento.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-15-numbers.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-15-numbers.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #141 | content | severity 5
**What:** Open `content/cards/a1-unit-16-shopping.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Shopping. Key equivalents: negozio → tienda; supermercato → supermercado; mercato → mercado; farmacia → farmacia; panetteria → panadería; libreria → librería; commesso/a → dependiente/a; cliente → cliente; cassa → caja; comprare → comprar; vendere → vender; cercare → buscar; pagare → pagar; scegliere → elegir; provare → probar; dov'è la cassa → dónde está la caja; c'è → hay; quanto costa → cuánto cuesta; vorrei → quisiera; in saldo → en oferta/rebaja; carta di credito → tarjeta de crédito.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-16-shopping.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-16-shopping.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #142 | content | severity 5
**What:** Open `content/cards/a1-unit-17-weather.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Weather & Seasons. Key equivalents: sole → sol; pioggia → lluvia; neve → nieve; vento → viento; nebbia → niebla; temporale → tormenta; caldo → calor; freddo → frío; nuvoloso → nublado; soleggiato → soleado; piovoso → lluvioso; nevoso → nevado; fa caldo → hace calor; fa freddo → hace frío; c'è il sole → hay sol; piove → llueve; nevica → nieva; primavera → primavera; estate → verano; autunno → otoño; inverno → invierno; che tempo fa → qué tiempo hace; temperatura → temperatura; grado → grado; ombrello → paraguas.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-17-weather.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-17-weather.ts` returns ≥ 60.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #143 | content | severity 5
**What:** Open `content/cards/a1-unit-18-routine.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Daily Routine & Reflexive Verbs. Key equivalents: svegliarsi → despertarse; alzarsi → levantarse; lavarsi → lavarse; vestirsi → vestirse; fare colazione → desayunar; andare al lavoro → ir al trabajo; tornare a casa → volver a casa; cenare → cenar; addormentarsi → dormirse; di mattina → por la mañana; di sera → por la noche; presto → temprano; tardi → tarde; prima → primero; poi → luego; dopo → después; sempre → siempre; spesso → a menudo; mai → nunca; a volte → a veces; ogni giorno → cada día.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-18-routine.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-18-routine.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #144 | content | severity 5
**What:** Open `content/cards/a1-unit-19-work.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Work & Professions. Key equivalents: lavoro → trabajo; ufficio → oficina; medico → médico; infermiere/a → enfermero/a; insegnante → profesor/a; avvocato → abogado/a; architetto → arquitecto/a; cuoco/a → cocinero/a; cameriere/a → camarero/a; impiegato/a → empleado/a; giornalista → periodista; ingegnere → ingeniero/a; stipendio → salario/sueldo; riunione → reunión; collega → colega; capo → jefe/a; lavorare → trabajar; assumere → contratar; licenziare → despedir; fare il/la → ser + profesión.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-19-work.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-19-work.ts` returns ≥ 50.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #145 | content | severity 5
**What:** Open `content/cards/a1-unit-20-clothes.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.

Unit theme — Clothes & Appearance. Key equivalents: camicia → camisa; pantaloni → pantalones; gonna → falda; vestito → vestido/traje; giacca → chaqueta; cappotto → abrigo; maglione → suéter/jersey; scarpe → zapatos; stivali → botas; calzini → calcetines; sciarpa → bufanda; guanti → guantes; borsa → bolso; zaino → mochila; lungo/a → largo/a; stretto/a → estrecho/a; largo/a → ancho/a; elegante → elegante; comodo/a → cómodo/a; portare/indossare → llevar/usar; mettere → ponerse; togliere → quitarse; che taglia porti → qué talla usas; come mi sta → cómo me queda.
**Why:** See Task #126.
**File:** `content/cards/a1-unit-20-clothes.ts`
**Blocks:** Task #146
**Blocked by:** Nothing
**Risk:** Low — additive only.
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-20-clothes.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #146 | content | severity 5
**What:** Export and validate the Italian pack after all 20 Spanish translation tasks are complete. Run: `npx tsx scripts/exportPack.ts it` then `npx tsx scripts/validatePack.ts public/packs/it.json`. Verify the pack validates cleanly with no duplicate IDs or schema errors. Also spot-check 5 cards at random in the JSON output to confirm `prompts.es` and `translations.es` fields are present and contain plausible Spanish.
**Why:** The exportPack script regenerates `public/packs/it.json` and `public/packs/manifest.json` from the TypeScript source. Running this after all 20 translation tasks ensures the pack reflects every unit's new Spanish fields and that sha256 manifest is updated.
**File:** `public/packs/it.json`, `public/packs/manifest.json`
**Blocks:** Nothing
**Blocked by:** Tasks #126, #127, #128, #129, #130, #131, #132, #133, #134, #135, #136, #137, #138, #139, #140, #141, #142, #143, #144, #145
**Risk:** Low — export script is idempotent; validation catches any schema errors.
**Done when:** `npx tsx scripts/validatePack.ts public/packs/it.json` exits 0; `grep -c '"es"' public/packs/it.json` returns ≥ 1000.
**Complexity:** ⚡ Direct — 2 files, single-scope change, runs two deterministic scripts
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

## Batch 12 — Specialty Pack Architecture | 4 tasks | [TASKS COMPLETE — pending batch audit]
Dependency: Independent of Batch 10 and 11. No owner actions required. These tasks lay the groundwork for future paid add-on specialty packs (medical, business, cooking, etc.) without building any content or payments yet.
Theme: Extend the pack registry, entitlement model, pack loader, and UI to support the concept of sub-packs within a language — so adding a real specialty pack later requires only content and a pricing entry, not architectural changes.

### Task #147 | architecture | severity 6
**What:** Extend `lib/langRegistry.ts` to support specialty pack codes as a first-class concept. Add a `SpecialtyPack` interface with fields: `code` (e.g. `"it-medical"`), `baseLang` (`"it"`), `name`, `ready: false`. Add an empty `SPECIALTY_PACKS` registry array. Update `packLoader.ts` to accept specialty pack codes as valid (no-op for now since none are `ready: true`) without allowing path traversal. Add a `getSpecialtyPacks(lang)` helper that filters by baseLang.
**Why:** The pack loader currently validates codes against a flat `READY_PACK_CODES` allowlist. Specialty packs are sub-packs within a language — a concept the codebase doesn't have yet. This task introduces the type and registry so all future tasks can build on a concrete interface rather than strings.
**File:** `lib/langRegistry.ts`, `lib/packLoader.ts`
**Blocks:** Tasks #148, #149, #150
**Blocked by:** Nothing
**Done when:** `grep "SpecialtyPack" lib/langRegistry.ts` returns a type definition; `grep "SPECIALTY_PACKS" lib/langRegistry.ts` returns the registry array; `npx tsc --noEmit` passes; `npm test` passes.
**Complexity:** 🔧 Full — 2 files, introduces new type and registry
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

### Task #148 | architecture | severity 5
**What:** Extend `store/entitlementStore.ts` and `lib/entitlement.ts` to track purchased add-on pack codes separately from the Pro subscription. Add `purchasedAddOns: string[]` to the persisted entitlement state (default `[]`). Add `hasAddOn(code: string): boolean` selector. Add a `purchaseAddOn(code: string)` action (no-op implementation for now — real payment integration comes later). Increment `ENTITLEMENT_VERSION` and add the migration in `store/migrations.ts`.
**Why:** The current entitlement model is binary: free or Pro. Specialty packs are a third axis — a user might be free-tier but have purchased a specific add-on pack. The data shape must exist before any UI or payment work can reference it.
**File:** `store/entitlementStore.ts`, `lib/entitlement.ts`, `store/migrations.ts`
**Blocks:** Tasks #149, #150
**Blocked by:** Task #147
**Done when:** `grep "purchasedAddOns" store/entitlementStore.ts` returns the state field; `grep "hasAddOn" lib/entitlement.ts` returns the selector; `grep "ENTITLEMENT_VERSION" store/migrations.ts` is incremented and a migration entry exists; `npm test` passes.
**Complexity:** 🔧 Full — 3 files, schema migration required
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

### Task #149 | architecture | severity 5
**What:** Extend `lib/packLoader.ts` to support loading a specialty pack *alongside* the base language pack, not instead of it. A call to `loadPack("it-medical")` should: (1) verify `it` base pack is already loaded, (2) load and verify the specialty pack JSON, (3) merge its cards into the active session without replacing core Italian cards. Add a `loadedAddOns: string[]` field to the in-memory pack cache. For now, since no specialty packs exist, this path will always return a "not available" result — the structure just needs to be correct.
**Why:** The current loader assumes one active pack per language. Specialty packs are additive — a user studies core Italian AND medical vocabulary in the same session. Getting the merge logic right now prevents a painful refactor when real content arrives.
**File:** `lib/packLoader.ts`
**Blocks:** Task #150
**Blocked by:** Tasks #147, #148
**Done when:** `grep "loadedAddOns" lib/packLoader.ts` returns the cache field; `grep "it-medical\|baseLang" lib/packLoader.ts` shows the specialty code path exists; `npx tsc --noEmit` passes; `npm test` passes.
**Complexity:** 🔧 Full — 1 file, non-trivial logic change
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

### Task #150 | ui | severity 3
**What:** Add a "Specialty packs" section to `components/LanguageGrid.tsx` (or wherever the language/pack picker renders). For each language the user has unlocked, show a subsection listing `getSpecialtyPacks(lang)` entries. Since `SPECIALTY_PACKS` is empty, this renders nothing in production — but the component slot exists so adding a real pack later requires only a registry entry, not a UI change. Add a `hasAddOn` check from `entitlementStore` to gate the tile state (locked vs unlocked).
**Why:** The UI must be wired to the new registry and entitlement selector so the full data flow — registry → loader → entitlement → UI — is exercised end-to-end before any real content exists. An untested integration discovered at content-launch time is expensive.
**File:** `components/LanguageGrid.tsx`
**Blocks:** Nothing
**Blocked by:** Tasks #147, #148, #149
**Done when:** `grep "getSpecialtyPacks\|SPECIALTY_PACKS" components/LanguageGrid.tsx` returns a usage; `grep "hasAddOn" components/LanguageGrid.tsx` returns a usage; `npx tsc --noEmit` passes; `npm test` passes; specialty section renders (empty) without errors.
**Complexity:** 🔧 Full — 1 file, new UI section
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**

---

## Batch 13 — Quality Foundation | 3 tasks | [TASKS COMPLETE — pending batch audit]
Dependency: Independent. No owner actions required.
Theme: Three gaps identified in the world-class audit (2026-06-30) with no existing task coverage: content depth checkpoint, specialty pack merge path proof, and E2E seam test.

### Task #151 | audit | severity 5
**What:** Run `npx tsx scripts/exportPack.ts it && npx tsx scripts/validatePack.ts public/packs/it.json`. Record the exact `unitCount` and `cardCount` from the JSON output. Compare against the CURRICULUM.md A1 target (20 units, ~2,600 cards). If `unitCount < 20`, create specific content tasks for the missing units. If `unitCount >= 20`, document the milestone and note the gap to A2 (50 units total).
**Why:** No task forces a content depth checkpoint before M2 ships. The pack loader, scheduler, and UI all assume substantial content — but no CI gate or task verifies how much content actually exists. A beautiful system with 3 units cannot achieve B2 fluency.
**File:** `public/packs/it.json` (read-only), `content/cards/` (audit target)
**Severity:** 5 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — read-only audit, no code changes
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — read-only. May generate follow-on content tasks.
**Test required:** None — this task is an audit checkpoint.
**Done when:** A status note is added to this task recording the exact `unitCount` and `cardCount` from the validated pack. If below A1 target, at least one content task is created in a new batch.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-06-30**
**Audit result:** `unitCount=63, cardCount=3680` (exportPack + validatePack, 2026-06-30)
- A1 milestone (20 units, ~2,600 cards): **COMPLETE** ✓ — 63 ≥ 20 units, 3,680 ≥ 2,600 cards
- A2 milestone (50 units total): **COMPLETE on units** ✓ — 63 ≥ 50 units; card count (3,680) is below A2 total target (~8,300) — card depth lags unit count
- B1 progress: 63 of 85 units — **22 units remaining** to reach B1 milestone
- B2 target: 63 of 125 units — **62 units remaining** to full curriculum
- Carry-forward: 0 content tasks created (unitCount ≥ 20; B1/B2 gaps are curriculum build-out, not audit blockers)

---

### Task #152 | tests | severity 4
**What:** Write a unit test that exercises the `isReadySpecialtyPack` branch in `lib/packLoader.ts:loadPack`. The test must: (1) override `SPECIALTY_PACKS` via module mock to include `{ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true }`; (2) seed `memCache` with a base Italian pack via a prior `loadPack("it", ...)` call; (3) mock `fetch` to return a minimal valid pack JSON with a computed sha256 matching the mocked manifest; (4) call `loadPack("it-medical", null)` and assert `result.ok === true` and `result.pack.unitCount === base.unitCount + addon.unitCount`; (5) call `getLoadedAddOns()` and assert it includes `"it-medical"`.
**Why:** The merge path added in Task #149 is dead code while `SPECIALTY_PACKS = []` — removing the entire `isReadySpecialtyPack` block causes zero test failures. Dead code rots silently until the moment it matters (real specialty pack launch), which is the worst time to discover it was broken.
**File:** `tests/packLoader.test.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, test only
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test only. The mock approach for overriding `SPECIALTY_PACKS` must use `vi.mock` factory or `vi.spyOn` depending on how the module is structured.
**Test required:** This task IS the test.
**Done when:** A test exists under describe "specialty pack merge path" that fails if the merge logic in `lib/packLoader.ts` is removed, and passes in CI. `npm test -- tests/packLoader.test.ts` green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

### Task #153 | tests | severity 5
**What:** Add Playwright as a dev dependency and create `tests/e2e/study-session.spec.ts` with one smoke test covering the core user path: (1) navigate to `/` — assert the language picker renders; (2) click the Italian button — assert navigation to `/learn`; (3) click into the first unlocked unit — assert a StudyCard renders with a prompt; (4) advance the card (keypress or button click) — assert the session progresses. Run against the Next.js dev server (`next dev`). Add a `playwright.config.ts` pointing at `http://localhost:3000`.
**Why:** 888 unit tests cover individual pieces with mocked boundaries. No test exercises the path a real user takes through the full stack without mocks. A regression in the component-to-hook-to-store-to-renderer seam is invisible in CI until a user reports it.
**File:** `tests/e2e/study-session.spec.ts` (new), `playwright.config.ts` (new), `package.json` (devDep)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — new test infrastructure, 3 files, new devDep
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — Playwright installs ~200MB of browser binaries. Add `tests/e2e/` to `.gitignore` snapshots but commit the spec and config. Add a `test:e2e` script to `package.json` so E2E does not run as part of `npm test` (keep unit and E2E separate).
**Test required:** This task IS the test infrastructure.
**Done when:** `npx playwright test` passes with the smoke test against a running dev server. `playwright.config.ts` exists. The spec covers steps 1–4 above. The smoke test is NOT included in `npm test` (unit test suite unchanged).
**Owner:** QA Agent
**Status: COMPLETE — 2026-06-30**

---

## Batch 14 — M3 macOS OS Hooks [TASKS COMPLETE — pending batch audit]
Dependency: Batch 10 complete. Theme: Extend the Tauri desktop app to fire interrupts from real OS events — wake from sleep, unlock screen, and idle return — rather than the 30-second interval timer alone. Pre-req stop-the-line tasks (#173–#177) must close before OS hook tasks (#159–#164) begin.

### Task #173 | architecture | severity 7
**What:** Extract duplicated `sha256Hex()` and `packUrl()` helpers that exist identically in both `lib/packLoader.ts` and `lib/specialtyPackLoader.ts` into `lib/utils.ts`. The `sha256Hex(text: string): Promise<string>` implementation at `packLoader.ts:94-100` and `specialtyPackLoader.ts:21-27` is byte-for-byte identical. The `packUrl(lang: string): string` at `packLoader.ts:141-143` and `specialtyPackLoader.ts:17-19` is byte-for-byte identical. Remove both from both source files and add one canonical copy to `lib/utils.ts`. Update all callers to import from `lib/utils.ts`.
**Why:** SCTS Poka-Yoke — a security-critical sha256 hash function with two independent copies is a stop-the-line violation. Task #156 extracted the specialty pack logic but copied these helpers instead of consolidating them. Any future divergence between the two copies would be undetectable.
**File:** `lib/utils.ts`, `lib/packLoader.ts`, `lib/specialtyPackLoader.ts`
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files, extraction refactor
**Blocked by:** Nothing | **Blocks:** #175
**Test required:** Yes — `tests/packLoader.test.ts` must still pass (no behavior change). Add one test to `tests/utils.test.ts` or equivalent pinning that `sha256Hex("abc")` returns `"ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f490f9e673c3eca08"` (known-answer test vector) so the Web Crypto stub alignment is verified.
**Done when:** `grep -n "sha256Hex\|packUrl" lib/packLoader.ts lib/specialtyPackLoader.ts` shows only import statements, not implementations. Both functions implemented exactly once in `lib/utils.ts`. All 897 tests pass. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #174 | architecture | severity 6
**What:** `app/stats/page.tsx` is 158 lines — 8 lines over the ≤150 app route limit. Task #155 (analytics Pro gate) added an early-return block (lines 17–24) that pushed the file over the limit. Extract the "not Pro" fallback UI to a new component `components/StatsProGate.tsx` and render it from `app/stats/page.tsx` in place of the inline block.
**Why:** Rule 1 — app routes must stay ≤150 lines. Stop-the-line. The stats page is the only app route currently over the limit.
**File:** `app/stats/page.tsx`, `components/StatsProGate.tsx` (new)
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, component extraction
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — `app/stats/page.test.tsx` must still pass. Add a co-located `components/StatsProGate.test.tsx` with ≥1 test confirming the upgrade prompt renders when Pro is not active.
**Done when:** `wc -l app/stats/page.tsx` ≤ 150. `components/StatsProGate.tsx` exists with a Rule 2 header. `components/StatsProGate.test.tsx` exists with ≥1 test. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #175 | architecture | severity 5
**What:** Break the circular type dependency between `lib/packLoader.ts` and `lib/specialtyPackLoader.ts`. Currently `specialtyPackLoader.ts:9` does `import type { Pack, LoadPackResult, Manifest } from "@/lib/packLoader"` while `packLoader.ts:32` does `import { loadSpecialtyPack, clearSpecialtyCache } from "@/lib/specialtyPackLoader"`. Extract the shared type definitions (`Pack`, `PackMeta`, `Manifest`, `LoadPackResult`, `CachedPackMeta`) to a new `lib/packTypes.ts` module. Update both files to import types from `lib/packTypes.ts` instead.
**Why:** `import type` prevents a runtime cycle but the design is fragile — any refactor of the shared types requires coordinating both files. Extracting to `lib/packTypes.ts` eliminates the cycle completely and makes the type contract explicit.
**File:** `lib/packTypes.ts` (new), `lib/packLoader.ts`, `lib/specialtyPackLoader.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files, type extraction
**Blocked by:** #173 | **Blocks:** Nothing
**Test required:** No new tests needed — type extraction is structural. All 897 existing tests pass (no behavior change).
**Done when:** `lib/packTypes.ts` exists with all 5 shared type definitions and a Rule 2 header. Neither `packLoader.ts` nor `specialtyPackLoader.ts` imports types from each other. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #176 | docs | severity 3
**What:** Update CLAUDE.md and STATUS.md with run 9 findings. CLAUDE.md: (1) `lib/checkout.ts` entry — already updated inline. (2) `components/BuyModal.tsx` — already updated inline. (3) §6 specialty pack merge path — already updated inline. (4) `lib/specialtyPackLoader.ts` notable module entry — already added inline. STATUS.md: (1) auto-updater wired entry — already updated. (2) M2 planned description — already updated. Remaining: update `lib/packLoader.ts` §6 description to reflect that the Pack interface is now defined in `lib/packTypes.ts` (after Task #175 ships).
**Why:** SCTS Kaizen — docs must stay current after every batch.
**File:** `CLAUDE.md`, `STATUS.md`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 2 files, doc edits only
**Blocked by:** #175 | **Blocks:** Nothing
**Test required:** No.
**Done when:** `grep "packTypes" CLAUDE.md` returns ≥1 hit. No stale pricing references in docs. Verification gate green.
**Owner:** Docs Agent
**Status: COMPLETE — 2026-07-04**

---

### Task #177 | tests | severity 2
**What:** Remove stale monthly pricing mock references from 3 page test files. `app/page.test.tsx`, `app/settings/page.test.tsx`, and `app/study/page.test.tsx` still mock `CHECKOUT_URLS.monthly` and `PRICING.monthly` in their vi.mock setup blocks. These mocks are no longer needed since monthly was removed in Task #120. Clean them up to prevent future developer confusion.
**Why:** Poka-Yoke — stale mocks assert that `monthly` exists as a key, which contradicts the annual-only checkout enforced in `tests/entitlement.test.ts` and `tests/checkout.test.ts`. A developer reading the mock would incorrectly assume monthly pricing still exists.
**File:** `app/page.test.tsx`, `app/settings/page.test.tsx`, `app/study/page.test.tsx`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 3 files, mock cleanup
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** No — removal of stale mocks. Existing tests must still pass.
**Done when:** `grep -r "monthly" app/page.test.tsx app/settings/page.test.tsx app/study/page.test.tsx` returns zero hits. All 897 tests pass. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-01**

---

### Task #159 | docs | severity 3
**What:** Add Rule 2 plain English comment headers to 3 Rust source files currently missing them: `src-tauri/src/lib.rs` (main Tauri entry point — registers all plugins, sets up tray, wires IPC handlers), `src-tauri/src/interrupt.rs` (InterruptState struct + 30-second poll thread + 4 IPC commands: update_interrupt_config, snooze_interrupt, enter_mandatory_mode, exit_mandatory_mode), `src-tauri/src/license.rs` (Lemon Squeezy IPC commands: activate_license, deactivate_license, validate_license, open_url). Each header: 2–3 sentences describing what the file owns, its responsibilities, and what depends on it.
**Why:** Rule 2 — every file starts with a plain English explanation. Rust files are not exempt. Batch 14 adds more Rust code; headers must be in place first.
**File:** `src-tauri/src/lib.rs`, `src-tauri/src/interrupt.rs`, `src-tauri/src/license.rs`
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 3 files, comment headers
**Blocked by:** #173, #174 | **Blocks:** #160, #161
**Test required:** No — Rule 2 is structural, not behavioral.
**Done when:** Each of the 3 files starts with a `//` comment block (≥2 sentences). No code changed. `cargo build` still compiles.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #160 | architecture | severity 5
**What:** Extract `setup_tray()` function (currently embedded in `src-tauri/src/lib.rs`, ~40 lines) into a new file `src-tauri/src/tray.rs`. Export `pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>>`. Import and call from `lib.rs`. Add Rule 2 header to `src-tauri/src/tray.rs`. No behavior change.
**Why:** `src-tauri/src/lib.rs` needs headroom for OS hook registration in Task #162 (~40 lines per trigger type). Pre-extract `setup_tray()` now so `lib.rs` stays under 150 lines after Batch 14 additions.
**File:** `src-tauri/src/lib.rs`, `src-tauri/src/tray.rs` (new)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files (1 new), Rust refactor
**Blocked by:** #159 | **Blocks:** #162
**Test required:** No behavior change — `cargo build` compiling is the test.
**Done when:** `src-tauri/src/tray.rs` exists with `pub fn setup_tray(...)` and Rule 2 header. `src-tauri/src/lib.rs` ≤ 120 lines (makes room for Task #162 additions). `cargo build` compiles. App launches normally.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #161 | architecture | severity 5
**What:** Extract the 5 interrupt-specific exports from `lib/tauri.ts` into a new `lib/tauriInterrupt.ts`: `updateInterruptConfig`, `snoozeInterrupt`, `enterMandatoryMode`, `exitMandatoryMode`, `updateTrayBadge`. Add Rule 2 header to `lib/tauriInterrupt.ts`. Update callers (`components/InterruptHandler.tsx`, `app/settings/page.tsx`) to import from `@/lib/tauriInterrupt`. Grep for any other callers: `grep -r "updateInterruptConfig\|snoozeInterrupt\|enterMandatoryMode\|exitMandatoryMode\|updateTrayBadge" --include="*.ts" --include="*.tsx" . | grep -v node_modules`. If `lib/tauri.ts` re-exports them for backwards compatibility, add a note that the re-exports will be removed in a future cleanup.
**Why:** `lib/tauri.ts` is at 151 lines. Task #162 will add OS-trigger IPC calls (enableWakeTrigger, enableUnlockTrigger, setIdleThreshold) — without extraction, `lib/tauri.ts` exceeds 200 lines. Extract interrupt IPC into its own module now.
**File:** `lib/tauri.ts`, `lib/tauriInterrupt.ts` (new), `components/InterruptHandler.tsx`, `app/settings/page.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (1 new), refactor
**Blocked by:** #159 | **Blocks:** #162
**Test required:** No behavior change — `npm test` passing is the test (all existing InterruptHandler + settings tests must pass).
**Done when:** `lib/tauriInterrupt.ts` exists with Rule 2 header and all 5 exports. `lib/tauri.ts` ≤ 145 lines. No interrupt-specific imports from `lib/tauri.ts` in callers (or clearly marked re-exports). `npm test` passes.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #162 | feature | severity 8
**What:** Create `src-tauri/src/os_events.rs` with `#[cfg(target_os = "macos")]` implementations of three macOS OS event listeners. All three emit `app.emit("interrupt:fire", payload)` — the same event the 30-second interval timer already emits. `InterruptHandler.tsx` handles it identically regardless of source.
1. **Wake detection:** Register `NSWorkspaceDidWakeNotification` via Objective-C bridge or `objc2` crate. On notification: check `InterruptState.enabled` and `active_hours` guards; if clear, emit `interrupt:fire`.
2. **Unlock/session-active detection:** Register `NSWorkspaceSessionDidBecomeActiveNotification`. Same guard check before emitting.
3. **Idle detection:** In the existing 30-second poll thread (or a dedicated thread), call `CGEventSourceSecondsSinceLastEventType()` or equivalent. Track idle→active transition: when idle time exceeded `idleThresholdMinutes` and then drops back below 10 seconds (user returned), emit `interrupt:fire`. Same guards.
Export `pub fn start_os_listeners(app_handle: tauri::AppHandle)`. Wire call in `src-tauri/src/lib.rs` after app setup. Add Rule 2 header to `os_events.rs`.
**Why:** This is the core Batch 14 deliverable. The interval timer fires regardless of whether the user is at their computer. OS hooks fire at the right moments: after a break, after a meeting, when returning from being away. Without OS hooks, plyglt is "open to review" not "proactively interrupting."
**File:** `src-tauri/src/os_events.rs` (new), `src-tauri/src/lib.rs`, `src-tauri/src/interrupt.rs`
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 3 files (1 new), new macOS Rust feature
**Blocked by:** #160, #161 | **Blocks:** #163
**Test required:** Manual verification (macOS system events are not unit-testable in CI). Document manual test steps in the task completion summary.
**Done when:** `src-tauri/src/os_events.rs` exists and compiles on macOS (`cargo build --target aarch64-apple-darwin`). `src-tauri/src/lib.rs` calls `os_events::start_os_listeners(app_handle)`. Manual test: put Mac to sleep → wake → interrupt fires within 5 seconds. Lock screen → unlock → interrupt fires. Leave idle 15+ minutes → return → interrupt fires.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #163 | feature | severity 5
**What:** Add OS trigger toggle controls to interrupt settings. Extend `InterruptConfig` in `store/settingsStore.ts` with 4 new fields: `wakeEnabled: boolean` (default true), `unlockEnabled: boolean` (default true), `idleEnabled: boolean` (default true), `idleThresholdMinutes: number` (default 15). Bump `SETTINGS_VERSION` and add migration. Wire all 4 through the `update_interrupt_config` IPC command (extend its payload type in `src-tauri/src/interrupt.rs` and `lib/tauriInterrupt.ts`). Add 3 toggle rows and an idle-threshold number input to the interrupt section in `app/settings/page.tsx`.
**Why:** Users need control over which triggers fire. Some may not want interruptions on every wake; others may prefer only scheduled interruptions. Without controls, all 3 new OS triggers fire permanently with no opt-out.
**File:** `store/settingsStore.ts`, `store/migrations.ts`, `app/settings/page.tsx`, `lib/tauriInterrupt.ts`, `src-tauri/src/interrupt.rs`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 5 files, new settings + migration
**Blocked by:** #162 | **Blocks:** #164
**Test required:** Yes — settings store migration test for new fields, component tests for new toggle rows.
**Done when:** `InterruptConfig` has 4 new fields with correct defaults. `SETTINGS_VERSION` bumped + migration adds them. Settings page renders 3 toggles + idle threshold input. `update_interrupt_config` payload includes new fields. `npm test` passes. `cargo build` compiles. `store/migrations.ts` tests cover v→v+1 migration for the new fields.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-04**

---

### Task #164 | tests | severity 5
**What:** Add tests for the Task #163 OS trigger settings. In `tests/migrations.test.ts`: add test for the SETTINGS_VERSION migration that adds `wakeEnabled`, `unlockEnabled`, `idleEnabled`, `idleThresholdMinutes` to existing state without those fields. In `app/settings/page.test.tsx`: add 3 test cases for the new toggle rows (wake toggle renders, unlock toggle renders, idle toggle renders + threshold input visible).
**Why:** Rule 5 + Kaizen — new store schema fields need migration tests (invariant: old data is not corrupted). New settings UI elements need Rule 14 component tests.
**File:** `tests/migrations.test.ts`, `app/settings/page.test.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, test additions only (no Full trigger keywords)
**Blocked by:** #163 | **Blocks:** Nothing
**Test required:** This task IS the tests.
**Done when:** `tests/migrations.test.ts` has a new test for the SETTINGS_VERSION migration adding OS trigger defaults. `app/settings/page.test.tsx` has ≥3 new test cases for OS trigger toggles. `npm test` passes. Coverage thresholds maintained.
**Owner:** QA Agent
**Audit findings — 2026-07-04** (39 issues pending fix, verdict FAIL, severity 9 — promoted to Batch 19 as Tasks #187-#225):
- [F001] functional-defect wake_enabled written but never read — severity 9 | src-tauri/src/os_events.rs:start_os_listeners (wake-detection branch):172
- [F002] functional-defect unlock_enabled written but never read — severity 9 | src-tauri/src/os_events.rs:start_os_listeners (unlock-detection branch):181
- [F003] functional-defect idle_enabled written but never read — severity 9 | src-tauri/src/os_events.rs:start_os_listeners (idle-detection branch):191
- [F004] functional-defect IDLE_THRESHOLD_SECS hardcoded to 900.0, ignores configurable value — severity 8 | src-tauri/src/os_events.rs:31
- [F005] process unresolved TODO proves the wiring gap was known at write time — severity 7 | src-tauri/src/os_events.rs:29
- [F006] test-quality zero Rust #[test] blocks exist in src-tauri/src/ — severity 7 | src-tauri/src/
- [F007] documentation-trust migrations.ts comment claims a functioning opt-out that doesn't exist — severity 9 | store/migrations.ts:158
- [F008] documentation-trust toggle descriptions claim control that isn't honored — severity 9 | app/settings/page.tsx:104
- [F009] documentation-trust JSDoc says "the Rust background thread" (singular), obscuring 2 threads — severity 8 | lib/tauriInterrupt.ts:21
- [F010] documentation-trust "Keep the Rust thread in sync" comment is false for the 4 new fields — severity 7 | components/InterruptHandler.tsx:30
- [F011] documentation interrupt.rs header not updated — severity 4 | src-tauri/src/interrupt.rs:1
- [F012] documentation os_events.rs header hides the gap — severity 4 | src-tauri/src/os_events.rs:4
- [F014] functional-defect OS Triggers UI has no platform gate (renders inertly on Win/Linux) — severity 8 | app/settings/page.tsx:102
- [F015] test-quality InterruptHandler.test.tsx not updated for 7-arg signature — severity 7 | components/InterruptHandler.test.tsx:188
- [F016] test-quality tauri.test.ts uses identical bools, masks swap bugs — severity 5 | tests/tauri.test.ts:81
- [F017] test-quality settingsStore.test.ts has zero coverage for 4 new setters — severity 6 | tests/settingsStore.test.ts
- [F018] test-quality banned .not.toBeNull() with no existence-check comment — severity 3 | app/settings/page.test.tsx:302
- [F019] test-quality 3 migration "no-op" tests pass even if version-guard deleted (pre-existing) — severity 4 | tests/migrations.test.ts:40
- [F020] test-quality web-mode updater test passes by coincidence (pre-existing) — severity 3 | tests/tauri.test.ts
- [F021] test-quality only entitlement store has a gap-free migration-chain guard test — severity 3 | tests/migrations.test.ts
- [F022] documentation test numbering out of order — severity 2 | app/settings/page.test.tsx
- [F023] documentation file header not updated for new tests — severity 3 | app/settings/page.test.tsx:1
- [F024] input-validation idle-threshold input has no clamp — severity 5 | app/settings/page.tsx:110
- [F025] reliability out-of-range value can fail IPC deserialization, dropping the whole config update — severity 6 | app/settings/page.tsx:110
- [F026] input-validation setIdleThresholdMinutes has no range validation — severity 4 | store/settingsStore.ts:38
- [F027] input-validation migration validates type only, not range — severity 6 | store/migrations.ts:167
- [F028] test-quality no test for out-of-range idleThresholdMinutes — severity 3 | tests/
- [F029] code-quality magic literals 5/120 not named constants — severity 2 | app/settings/page.tsx:110
- [F030] code-quality "15 minutes" default hardcoded in 4 places, no shared constant — severity 6 | multiple:31
- [F031] architecture 7-positional-param contract duplicated across 5 files — severity 6 | multiple
- [F032] reliability config-sync effect has no debounce, can race — severity 5 | components/InterruptHandler.tsx:31
- [F033] reliability update_interrupt_config silently no-ops on poisoned mutex — severity 5 | src-tauri/src/interrupt.rs:111
- [F034] accessibility idle-threshold label has no htmlFor/id — severity 2 | app/settings/page.tsx:109
- [F035] scope unrelated license/notification tests bled into this task (user-authorized) — severity 2 | app/settings/page.test.tsx
- [F036] reliability exitMandatoryMode has no try/catch, inconsistent handling (pre-existing) — severity 4 | lib/tauriInterrupt.ts:60
- [F037] architecture InterruptHandler.tsx imports directly from store/ (pre-existing) — severity 4 | components/InterruptHandler.tsx:1
- [F038] brand-voice tray tooltips use "!" and "due" (pre-existing) — severity 2 | src-tauri/src/lib.rs:59
- [F039] architecture app/learn/page.tsx calls localStorage directly (pre-existing) — severity 2 | app/learn/page.tsx:127
- [F040] test-quality new toggle tests create appearance of coverage for an inert feature — severity 5 | app/settings/page.test.tsx
- [SP001] process-systemic 7 independent auditors, 7 methodologies, zero disagreement on the central defect's existence — severity 9 | CROSS-CUTTING

**Audit resolution — 2026-07-06:** All 39 findings remediated via Batch 19 (Tasks #187–#225, 2 waves + 1 direct follow-up), all 39 confirmed COMPLETE. Task #164's own done-when (tests added, coverage maintained) was always satisfied; the FAIL verdict concerned the broader #163 feature, not this task's deliverable.
**Status: COMPLETE — 2026-07-06**

---

## Batch 15 — Windows + Linux Packaging
Dependency: Batch 14 complete (OS events architecture in place). Theme: Port OS hooks to Windows and Linux, and set up platform packaging and code signing for all three desktop platforms.

### Task #165 | build | severity 7
**What:** Windows code signing — choose between EV certificate and Azure Trusted Signing. Configure `src-tauri/tauri.conf.json` for Windows signing. Update `.github/workflows/release.yml` to sign and notarize the Windows installer (NSIS format). Document the signing choice in `docs/SIGNING.md` (new).
**Why:** Without Windows code signing, SmartScreen blocks the installer with "Windows protected your PC." Most users will not proceed past this dialog. Required for any meaningful Windows distribution.
**File:** `src-tauri/tauri.conf.json`, `.github/workflows/release.yml`, `docs/SIGNING.md` (new)
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files (1 new)
**Blocked by:** #123 | **Blocks:** #166
**Done when:** `tauri.conf.json` has Windows bundle signing config. `release.yml` signs Windows installer. NSIS `.exe` generated in release pipeline. SmartScreen does not block the signed installer.
**Owner:** Architecture Agent

---

### Task #166 | feature | severity 6
**What:** Windows OS event hooks — add a `#[cfg(target_os = "windows")]` block to `src-tauri/src/os_events.rs`. Implement: (1) Wake detection via `WM_POWERBROADCAST` / `PBT_APMRESUMEAUTOMATIC` Windows message, (2) Unlock detection via `WM_WTSSESSION_CHANGE` / `WTS_SESSION_UNLOCK`, (3) Idle detection via `GetLastInputInfo()` in the poll thread. All three emit `interrupt:fire` with the same guard checks as macOS. Requires `windows-sys` or `winapi` crate dependency in `Cargo.toml`.
**Why:** macOS OS hooks ship in Batch 14. Batch 15 ports them to Windows. The IPC interface and JS handler are identical — only the Rust platform code differs. Same user experience across platforms.
**File:** `src-tauri/src/os_events.rs`, `src-tauri/Cargo.toml`
**Severity:** 6 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 2 files, platform Rust
**Blocked by:** #162, #165 | **Blocks:** #167
**Done when:** `os_events.rs` compiles on Windows (`cargo build --target x86_64-pc-windows-msvc`). Manual test on Windows 11: wake from sleep → interrupt fires; lock screen → unlock → interrupt fires.
**Owner:** Architecture Agent

---

### Task #167 | build | severity 5
**What:** Linux packaging — configure Tauri bundler for AppImage output in `src-tauri/tauri.conf.json`. Add `.github/workflows/release.yml` Linux runner (Ubuntu 22.04) producing AppImage. Implement Linux OS event hooks in `src-tauri/src/os_events.rs` under `#[cfg(target_os = "linux")]`: (1) Wake/unlock via systemd-logind D-Bus (`PrepareForSleep` signal + `Session.Lock`/`Unlock` signals), (2) Idle detection via `XScreenSaverQueryInfo` or `/proc/uptime` comparison.
**Why:** Linux desktop users over-index in plyglt's target demographic (productivity professionals). AppImage requires no installation and works on all major distros. Linux OS hooks complete the cross-platform interrupt engine.
**File:** `src-tauri/src/os_events.rs`, `src-tauri/tauri.conf.json`, `.github/workflows/release.yml`
**Severity:** 5 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 3 files, Linux packaging + Rust
**Blocked by:** #166 | **Blocks:** Nothing (Batch 15 complete)
**Done when:** AppImage generated in release pipeline. `cargo build --target x86_64-unknown-linux-gnu` compiles. Manual test on Ubuntu 22.04: suspend → resume → interrupt fires.
**Owner:** Architecture Agent

---

## Batch 16 — Sync Backend
Dependency: Batch 15 complete (all desktop platforms shipping). Theme: Add a cloud sync backend and auth layer so user progress persists across devices — prerequisite for Batch 17 (mobile).

### Task #168 | architecture | severity 9
**What:** Write sync backend architecture decision doc at `docs/SYNC_ARCHITECTURE.md`. Must cover: (1) platform choice (Supabase vs Firebase vs custom server — choose one, justify), (2) what syncs: SRS card state (cardId, stability, difficulty, dueDate, lastReview, reviewCount, lapses), settings (interrupt config), entitlement (licenseKey, licenseType, purchasedAddOns), (3) offline-first model: all writes local-first, sync on open + periodic, (4) conflict resolution strategy for SRS data — last-write-wins is wrong for concurrent reviews on multiple devices; specify merge strategy (e.g., per-card timestamp, version vector), (5) auth providers: Apple Sign In + Google Sign In minimum (Apple Sign In required for App Store), (6) push notification infrastructure: APNs (iOS) + FCM (Android), (7) estimated monthly cost at 1,000 / 10,000 / 100,000 users.
**Why:** The platform choice constrains all of Batches 16-17. A wrong choice is expensive to reverse. Apple Sign In is required by App Store guidelines for any app that offers social login. Push notification server design must be decided before mobile starts. Conflict resolution for SRS data is subtle — cannot be deferred.
**File:** `docs/SYNC_ARCHITECTURE.md` (new)
**Severity:** 9 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 1 file, architecture doc
**Blocked by:** Nothing (but requires owner decision on platform and auth) | **Blocks:** #169
**Done when:** `docs/SYNC_ARCHITECTURE.md` exists. Platform chosen (not TBD). Auth providers listed. Conflict resolution strategy named specifically. Push notification stack defined. Cost estimate table present.
**Owner:** Architecture Agent

---

### Task #169 | feature | severity 9
**What:** Implement sync backend using the platform chosen in Task #168. Schema and API per `docs/SYNC_ARCHITECTURE.md`. Offline-first: Zustand stores continue operating as before; add a sync layer that pushes local state to backend on connect and merges incoming changes. Conflict resolution: per-card timestamp merge for SRS data (latest review timestamp wins per card, not per sync session). Auth: Apple Sign In + Google Sign In flows in the app and backend. Data encrypted in transit (TLS) and at rest.
**Why:** Sync is the feature that makes Pro worth $4.99/mo for multi-device users. Required for mobile (Batch 17 depends on this).
**File:** Multiple — new sync layer, backend config, auth integration, Zustand store modifications
**Severity:** 9 | **DoD Tier:** 3
**Complexity:** 🔧 Full — multiple files, new backend
**Blocked by:** #168 | **Blocks:** #170
**Done when:** SRS state syncs bidirectionally between two desktop instances with no data loss. Conflict resolution works for concurrent reviews on two devices. Auth flow works end-to-end on macOS.
**Owner:** Architecture Agent

---

### Task #170 | feature | severity 8
**What:** Push notification server — component of the sync backend (Task #169) that stores per-user device push tokens and sends APNs (iOS) and FCM (Android) notifications on each user's interrupt schedule. Desktop app registers push token on Pro activation. Server fires notifications on schedule. Notification payload: card count + session type. iOS/Android clients handle tap → in-app session.
**Why:** Mobile interruption (Batch 17) cannot use the client-side timer mechanic — apps are suspended on mobile. Server-sent push notifications are the only viable mobile interrupt mechanism. Must exist before mobile (Batch 17) begins.
**File:** Multiple — server push notification service, desktop app token registration
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — new service
**Blocked by:** #169 | **Blocks:** #171
**Done when:** Push server sends APNs and FCM notifications. Desktop app registers token. Notifications fire within 60 seconds of scheduled time in test environment.
**Owner:** Architecture Agent

---

## Batch 17 — Mobile (iOS + Android)
Dependency: Batch 16 complete (sync backend and push notification server live). Theme: Launch plyglt on iOS and Android using Tauri 2 mobile targets, with push-interrupt sessions and seamless SRS sync with desktop.

### Task #171 | build | severity 8
**What:** iOS app — Tauri 2 iOS build pipeline. Configure Xcode project, bundle identifier (`com.plyglt.app`), push notification entitlement. Set up TestFlight distribution and App Store submission. Implement APNs push notification client: register device token on launch, send to sync backend (Task #170), handle notification tap → immediate in-app StudyCard session (bypasses main menu, presents a 3-card session directly). Requires Apple Developer Program membership (same account as macOS signing, Task #122).
**Why:** iOS is the highest-value Pro tier opportunity. Push-interrupted mobile study sessions during commute/breaks are the flagship use case for plyglt's Pro tier.
**File:** Multiple — Tauri iOS config, push notification client, session-from-notification flow
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — multiple files, iOS build
**Blocked by:** #170 | **Blocks:** #172
**Done when:** App installable via TestFlight. APNs push notification fires on schedule (manual test). Notification tap opens app directly into a 3-card session. SRS state syncs with desktop automatically after the session.
**Owner:** Architecture Agent

---

### Task #172 | build | severity 7
**What:** Android app — Tauri 2 Android build pipeline. Configure Gradle, Play Console account, Play Store submission pipeline. Implement FCM push notification client (parallel to APNs in Task #171): register FCM token on launch, send to sync backend, handle notification tap → immediate in-app session. Target: API level 26+ (Android 8.0).
**Why:** Android completes the mobile platform coverage. FCM is the Android equivalent of APNs. Same interrupt experience as iOS.
**File:** Multiple — Tauri Android config, FCM client, session-from-notification flow
**Severity:** 7 | **DoD Tier:** 3
**Complexity:** 🔧 Full — multiple files, Android build
**Blocked by:** #171 | **Blocks:** Nothing (Batch 17 complete)
**Done when:** App installable from Play Store (or internal testing track). FCM notifications fire on schedule. Tap → in-app session works. SRS state syncs with desktop.
**Owner:** Architecture Agent

---

## Batch 18 — Introduction Engine Remediation + Correctness Hardening | 9 tasks | [CURRENT SPRINT]
Dependency: None (standalone remediation batch). Theme: Fix the 24 findings from the Batch 5 standalone audit (VERDICT: FAIL, 2026-07-02). Three sev ≥ 7 findings are stop-the-line. Tasks must run in order: #178 (schema) → #179 (lib) → #180 (store) → #181 (tests).

### Task #178 | architecture | severity 9
**What:** Add `phaseStartDate: string` to `IntroductionRecord` in `content/types.ts`. Update `lib/introduction.ts:getDayOfPhase` to compute from `phaseStartDate` instead of `introducedDate` (introducedDate becomes calendar metadata only). Update `recordResult` triple-wrong path to set `phaseStartDate: today` instead of the dead-write `dayOfPhase: 1`. Remove the redundant `getDayOfPhase(record.introducedDate, today)` recomputation from both store callers in `store/srsStore.ts` (`recordIntroductionResult:230` and `getIntroductionDueCardIds:239`) — the stored phaseStartDate is now authoritative. Bump `SRS_VERSION`, add migration populating `phaseStartDate = introducedDate` for existing records.
**Why:** F01 (sev:9) — the triple-wrong Day 1 reset has never worked. Both store callers always recompute dayOfPhase from `introducedDate`, discarding whatever recordResult writes. BRAND.md "Wrong 3× → resets to Day 1" is dead code. This is the root architectural cause; all other scheduling fixes depend on it being correct first.
**File:** `content/types.ts`, `lib/introduction.ts`, `store/srsStore.ts`, `store/migrations.ts`
**Severity:** 9 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 4 files, schema change + migration
**Blocked by:** Nothing | **Blocks:** #179, #180, #181
**Test required:** Yes — seam test in `tests/srsStore.test.ts` tracing the full path: `introduceCard → recordIntroductionResult (3 consecutive wrong answers) → getIntroductionDueCardIds` must return the card with `dayOfPhase = 1` (not whatever calendar-computed value would come from introducedDate).
**Done when:** `grep -n "getDayOfPhase.*introducedDate" store/srsStore.ts` returns no lines. `phaseStartDate` field present in `IntroductionRecord`. Migration exists for SRS_VERSION bump. Seam test passes. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-02**

---

### Task #179 | correctness | severity 6
**What:** Fix remaining behavior bugs and code quality gaps in `lib/introduction.ts`:
- ~~F02: `shouldAppearToday` 0.5 branch~~ — DONE in Task #178 Cycle 2 (CF-12 fix)
- ~~F09: `recordResult` cross-day consecutiveWrongToday reset~~ — DONE in Task #178 Cycle 2 (CF-02 fix)
- F11: `getDayOfPhase`: validate date string format (`/^\d{4}-\d{2}-\d{2}$/`) before calling `new Date(str)`, throw with ref ID on invalid input — NaN propagation currently causes silent card disappearance (migration has DATE_RE guard at persistence boundary but getDayOfPhase itself is still unguarded)
- F07: `export const MAX_APPEARANCES_BY_PHASE_DAY = Object.freeze({...})` with `Readonly<Record<number, number>>` type — currently exported unfrozen, mutable by any importer
- F06: Extract `export const GRADUATION_THRESHOLD = 15` and `export const CONSECUTIVE_WRONG_RESET = 3` as named constants; replace all magic literals in `recordResult` and `shouldGraduate`
- F18: Add Rule 2 header to `lib/introduction.ts` (DEPENDS ON / USED BY missing)
- F19: Add ref ID to `throw new Error("getNextCardType: available must not be empty")` (currently no Error Reference System ID)
**Why:** F07 (sev:6) — unfrozen scheduling table corruptible by injected card content in Tauri webview. F11 — getDayOfPhase produces NaN silently on invalid input. F06 prevents silent divergence if thresholds change.
**File:** `lib/introduction.ts`, `tests/introduction.test.ts`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, multiple behavior fixes
**Blocked by:** #178 | **Blocks:** #181
**Test required:** Yes — add test for `getDayOfPhase` with malformed date string (must throw). Tests for F02/F09 cross-day behavior were added in Task #178.
**Done when:** `grep -n "Object.freeze" lib/introduction.ts` shows `MAX_APPEARANCES_BY_PHASE_DAY`. `grep -n "GRADUATION_THRESHOLD\|CONSECUTIVE_WRONG_RESET" lib/introduction.ts` shows constant declarations. Rule 2 header present. All new tests pass. Verification gate green.
**Owner:** Architecture Agent

---

### Task #180 | correctness | severity 7
**What:** Wire variety rule, close spec gaps, and add rescue path in `store/srsStore.ts`:
- F03: Import `getNextCardType` from `@/lib/introduction`. Call it at the end of `recordIntroductionResult`, passing `record.lastSeenType` and the available card types for this card. Write the returned CardType back to `record.lastSeenType` before persisting. This wires the variety rule (BRAND.md: "each encounter uses a different retrieval angle") which currently has zero runtime enforcement.
- F10: `canIntroduceNewCard`: add cross-day failure check — if any `IntroductionRecord` has `consecutiveWrongToday >= CONSECUTIVE_WRONG_RESET` and `lastSeenDate !== today`, return false. This implements the BRAND.md spec "wrong across multiple days → pause new card introductions until this one stabilizes" which is currently absent.
- F12: `getIntroductionDueCardIds`: add rescue branch — if `getDayOfPhase(record.phaseStartDate, today) >= 22` and `!record.graduated`, include the card with `shouldAppearToday` returning true (1 appearance/day). Without this, cards reaching day 22 without 15 consecutive correct answers disappear from both queues permanently.
- F13: `introduceCard`: change guard from `if (existing && !existing.graduated) return` to `if (existing) return` — a graduated card must not be silently re-introduced with reset history.
**Why:** F10 (sev:7) and F12 (sev:7) are stop-the-line spec gaps. F03 (sev:5) — variety rule is fully implemented in lib but has zero runtime callers. F13 (sev:6) — graduated card re-introduction destroys all historical progress silently.
**File:** `store/srsStore.ts`, `tests/srsStore.test.ts`
**Severity:** 7 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 2 files, 4 behavior fixes
**Blocked by:** #178 | **Blocks:** #181
**Test required:** Yes — one test per fix: (1) `lastSeenType` updates after `recordIntroductionResult`; (2) `canIntroduceNewCard` returns false when cross-day wrong streak exists; (3) `getIntroductionDueCardIds` includes a day-22+ non-graduated card; (4) `introduceCard` does not overwrite a graduated card.
**Done when:** `grep -n "getNextCardType" store/srsStore.ts` shows an import and a call site. All 4 new tests pass and assert specific values. Verification gate green.
**Owner:** Architecture Agent

---

### Task #181 | tests | severity 4
**What:** Pin test assertions and close coverage gaps in `tests/introduction.test.ts`:
- F15: Change `expect(["recognize", "produce"]).toContain(result)` at line 278 to `expect(result).toBe("recognize")` — the function is deterministic and the current assertion passes with any broken implementation
- F16: Replace the partial `MAX_APPEARANCES_BY_PHASE_DAY` test with a parameterized test covering all 22 entries explicitly — currently only 7 of 22 phase days are asserted
- F21: Add a full 10-field assertion test for a `recordResult` correct-path return — currently no test asserts more than 5 of 10 fields
- F22: Add `consecutiveCorrect=0` (should return false) and `consecutiveCorrect=16` (should return true) cases to the `shouldGraduate` suite — currently only boundary values 14 and 15 are tested
- F14: Add a seam test tracing the end-to-end triple-wrong path through the store, confirming Task #178's fix is observable (`getIntroductionDueCardIds` must schedule the card at day 1 after 3 consecutive wrong answers)
- If file exceeds 250 lines after additions: split into `tests/introduction.test.ts` (lib unit tests) and `tests/seam_introduction.test.ts` (cross-module seam tests)
**Why:** F16 (sev:3) — 15 untested phase-day entries means the scheduling table can silently corrupt without a test failing. F14 (sev:4) — the dead-write bug that caused audit FAIL was invisible to all unit tests because none trace the recordResult → store → scheduling path. Rule 16: enumerate every member before asserting.
**File:** `tests/introduction.test.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — test file only, assertion fixes and new test cases
**Blocked by:** #178, #179, #180 | **Blocks:** Nothing
**Test required:** The task IS tests — all 22 phase-day entries individually asserted, seam test passes, green gate.
**Done when:** `grep -c "phaseDay\|phase_day\|phase day" tests/introduction.test.ts` ≥ 22 (or equivalent parameterized coverage). 10-field assertion test exists. `toBe("recognize")` replaces `toContain`. File ≤ 250 lines (or split into two files each ≤ 250). Verification gate green.
**Owner:** QA Agent

---

### Task #182 | code-quality | severity 3
**What:** Remove all misleading "lifetime" product references from comments and test descriptions. Zero logic changes.
- `lib/entitlement.ts` lines 41-44: remove backward-compat comment block; replace with `// Unrecognised variant names return subscription licenseType and free pack access only.`
- `lib/entitlement.ts` line 95 (JSDoc): remove "All Languages Lifetime" from example variant name list
- `tests/entitlement.test.ts` line 63: replace `"Italian Lifetime"` / `"All Languages Lifetime"` in variantNames array with `"Unrecognised Single"` / `"Unrecognised All"`
- `tests/entitlement.test.ts` lines 587-590: update comment to "Unrecognised variant names from historical Lemon Squeezy webhook payloads."; rename it() descriptions to remove product-tier naming
- `tests/entitlement.test.ts` lines 252/264: change mock `variant_name: "Italian Lifetime"` to `"Unknown Variant"`
- `tests/entitlement.test.ts` line 593: change input to `"Legacy Single Language"` (any unrecognised string)
- `tests/entitlement.test.ts` line 603: change input to `"All Languages Extended"` (preserves "all languages" substring for correct code-path testing)
- `tests/migrations.test.ts` line 279-280: rename description from "lifetime → subscription" to "unrecognised → subscription"
BuyModal.test.tsx negative regression guard and store/migrations.ts stay unchanged.
**Why:** F052 Batch 1 audit — no lifetime plan exists (BRAND.md). Comments and test names document non-existent intent.
**File:** `lib/entitlement.ts`, `tests/entitlement.test.ts`, `tests/migrations.test.ts`
**Severity:** 3 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** No new tests — behavior unchanged, descriptions renamed.
**Done when:** `grep -rE "Italian Lifetime|All Languages Lifetime|backward.compat.*lifetime|lifetime.*backward" lib/ tests/ --include="*.ts"` returns zero hits. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-03**

---

### Task #183 | tests | severity 5
**What:** Harden 50 existence-only test assertions to specific-value assertions across 11 test files, eliminating pseudocode coverage. This activates the hard assertion-quality gate in the Verification Gate (AGENTS.md). Extended by Batch 1 re-audit (2026-07-03) to absorb 12 additional test quality findings (F001, F003, F004, F007, F008, F010, F011, F015, F017, F019, F020).

Mandatory rewrites — suppression comment NOT permitted (reason: deterministic outputs):
- `tests/introduction.test.ts:64` — `expect(MAX_APPEARANCES_BY_PHASE_DAY).not.toBeNull()` → rewrite to assert specific phase/day values (day 1 → Infinity appearances, day 22 → 0).
- `tests/packLoader.test.ts:118-119` — localStorage key not-null → parse stored JSON, assert `sha256` or `version` field matches manifest.
- `tests/importBackup.test.ts:74` — card existence after import → assert `dueDate`, `stability`, `state` fields.
- `tests/seam_importRestore.test.ts:85-86,159` — card existence in seam tests → same field-level assertions.
- `tests/exportBackup.test.ts:49-50` — `parsed.srs` / `parsed.srs.cards` exist → assert card count or specific field values.
- `tests/entitlement.test.ts:453` — `result.validUntil` not-null with deterministic `expires_at: '2027-01-01T00:00:00Z'` input → assert exact timestamp: `toBe(new Date("2027-01-01T00:00:00Z").getTime())`. (F004)
- `tests/entitlement.test.ts:344-345` — activateLicense ok:true path: `toEqual(expect.any(Number))` and `toBeGreaterThan(Date.now())` are banned pseudocode forms; same expires_at makes validUntil deterministic → assert exact timestamp. (F003)
- `tests/entitlement.test.ts:602` — test name "unrecognised all-languages variant" is factually wrong: input "All Languages Extended" contains "all languages" and exercises the RECOGNISED branch returning ALL_PACK_CODES. Change input to a genuinely unrecognised string (e.g. "Omnilinguistic Bundle") and add a separate named test for the recognised all-languages path. Fix describe-block comment at lines 587-589 which says "free pack access only" — that only describes the first test, not the block. (F001, F015)
- `tests/entitlement.test.ts:617` — Annual variant test: 3-field output (licenseType, unlockedPacks, validUntil); only 2 asserted. Input expiresAt is deterministic; assert validUntil exact value. (F011)
- `tests/entitlement.test.ts` — Add test for `activateLicense` when Lemon Squeezy returns `instance: { id: '' }` — assert `ok: false` with `error: ERR_ACTIVATE_NO_INSTANCE`. This path is unguarded until Task #185 closes; write the failing test first (red-green). (F010)
- `tests/migrations.test.ts:116` — v2→v3 migration test: spread is `{ ...record, phaseStartDate }` producing 11 output fields; test asserts 2. Extend to assert all 11 fields including dayOfPhase, consecutiveCorrect, and graduated. Same gap at line 143. (F007)
- `tests/migrations.test.ts:179` — Corrupt-record test: add `vi.spyOn(console, 'error')` assertion verifying the log fires matching `/migration v3: corrupt record card-corrupt/`. Add `// existence-check: localDateStr() returns today's date at test execution time — genuinely non-deterministic` comments to the three assertions at lines 205-208. (F008)
- `tests/migrations.test.ts:319` — v0→v3 full-chain test: asserts 1 of 7 output fields; add a comment citing line 215 where the other 6 are covered, or extend the assertions here. (F017)
- `tests/migrations.test.ts` — Add a multi-card v2→v3 migration test: one record with valid introducedDate and one corrupt record (missing both date fields) in the same introductions map. Verifies the for-loop processes cards independently and corrupt fallback doesn't contaminate valid neighbours. (F019)
- `tests/commitSession.test.ts:27,41-42` — card/activeSession existence → assert specific post-commit state fields.
- `tests/srsStore.test.ts:363,383` — card existence → assert specific fields.

Suppression permitted (non-deterministic only — document the specific reason):
- `tests/langRegistry.test.ts:37`, `tests/language.test.ts:173,239`, `tests/session.test.ts:70,93` — first try rewriting to specific values; only use suppression if the value is genuinely non-deterministic.

Anti-gaming rule: `// existence-check: this is fine` without a specific non-deterministic reason is a Stop-the-Line violation.

After this task COMPLETES: remove the `# Hard gate — activates after Task #183 completes` comment from the Verification Gate code block in `AGENTS.md`.
**Why:** 50+ existence-only assertions = pseudocode coverage that passes even when behavior is broken. Systemic finding across Batch 1 audits. AGENTS.md Test Assertion Quality Gate and Rule 16 both require specific-value assertions for deterministic outputs.
**File:** Multiple — `tests/introduction.test.ts`, `tests/packLoader.test.ts`, `tests/importBackup.test.ts`, `tests/seam_importRestore.test.ts`, `tests/exportBackup.test.ts`, `tests/entitlement.test.ts`, `tests/migrations.test.ts`, `tests/commitSession.test.ts`, `tests/srsStore.test.ts`, `tests/langRegistry.test.ts`, `tests/language.test.ts`, `tests/session.test.ts` + `AGENTS.md` (remove TODO comment)
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** #184, #185 (some tests reference production code fixed there — write them red first, they turn green when those tasks close) | **Blocks:** Batch 1 audit PASS
**Test required:** The task IS tests — assertions become more specific; a small number of new it() blocks added.
**Done when:** `grep -rn "\.toBeDefined()\|\.toBeTruthy()\|\.not\.toBeNull()" tests/ --include="*.test.*" | grep -v "existence-check:"` returns zero output. `grep "activates after Task #183" AGENTS.md` returns zero hits. Verification gate green.
**Owner:** QA Agent

---

### Task #184 | data-loss | severity 5
**What:** Fix two safety gaps in the SRS v3 migration introduced by Task #178. (1) `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` accepts calendar-invalid strings like `"2026-13-45"`; these pass the regex, become `phaseStartDate`, and produce `NaN` in `getDayOfPhase` — silently hiding the card forever. The migration comment explicitly warns about this risk for empty strings but does not address it for invalid dates. Fix: add `&& !isNaN(new Date(v).getTime())` after each `DATE_RE.test()` call. (2) The for-loop at line 58 iterates over `Object.entries(introductions)` but does not guard against a stored null value (e.g. `{ "card-1": null }`); accessing `record.phaseStartDate` throws `TypeError`, which Zustand's persist middleware catches and resolves by resetting to default empty state — silently wiping all SRS card history.

Add two tests: (a) introductions map containing a null record — must not throw and must produce a valid phaseStartDate; (b) record with `introducedDate: "2026-13-45"` (calendar-invalid) — must fall back to today's date, not preserve the invalid string.
**Why:** Both bugs can silently corrupt or destroy user SRS progress. The NaN risk is the same failure mode the migration comment already warns about; the null-record risk causes silent data loss via the Zustand fallback path.
**File:** `store/migrations.ts`, `tests/migrations.test.ts`
**Severity:** 5 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** #183 (F007/F008 tests reference the corrected migration behaviour)
**Test required:** Two new it() blocks as described above.
**Done when:** New tests pass. `node -e "console.log(/^\d{4}-\d{2}-\d{2}$/.test('2026-13-45') && !isNaN(new Date('2026-13-45').getTime()))"` prints `false`. Verification gate green.
**Owner:** Architecture Agent

---

### Task #185 | security | severity 7
**What:** Guard `activateLicense` against an empty `instanceId`. The current guard `if (!res.instance)` at `lib/entitlement.ts:139` is falsy only for `null` and `undefined`. A Lemon Squeezy API response with `instance: { id: '' }` is truthy; the guard passes, and `instanceId: ''` is persisted to the entitlement store. Every subsequent `validateLicense(key, '')` and `deactivateLicense(key, '')` call sends an empty instance ID, producing API errors that surface to users as generic network failures with no indication of root cause.

Fix: change line 139 to `if (!res.instance?.id)`. This is a one-character change — the existing `console.error` and return statement stay unchanged.

Note: the corresponding test (`instance: { id: '' }` → ok:false) lives in Task #183. This task is the production code fix only.
**Why:** Users who activate on a degraded Lemon Squeezy response end up stuck — license appears active but every subsequent validation fails — with no recovery path other than re-entering their license key. Open as F011 across two consecutive audits with no task.
**File:** `lib/entitlement.ts`
**Severity:** 7 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** #183 (the F010 test turns green once this fix is in place)
**Test required:** Covered by Task #183 (F010). Run the full test suite to confirm no regressions.
**Done when:** `grep "instance?.id" lib/entitlement.ts` has a hit at line 139. Verification gate green.
**Owner:** Security Agent

---

### Task #186 | security | severity 4
**What:** Wrap two mutable exported objects in `Object.freeze()`. (1) `LANG_CONFIG_MAP` in `lib/langRegistry.ts` is created via `Object.fromEntries()` but not frozen; any importer can write `LANG_CONFIG_MAP['it'] = maliciousConfig` without a TypeError, silently replacing a security-relevant language configuration. The existing frozen arrays (`ALL_PACK_CODES`, `READY_PACK_CODES`, `FREE_PACK_CODES`) all have a comment explaining why they are frozen — the asymmetric treatment of `LANG_CONFIG_MAP` is unexplained. (2) `MAX_APPEARANCES_BY_PHASE_DAY` in `lib/introduction.ts` is the introduction engine's central scheduling table; any importer can write `MAX_APPEARANCES_BY_PHASE_DAY[1] = 0` to suppress day-1 flooding without a TypeError.

Fix: `Object.freeze(LANG_CONFIG_MAP)` at point of declaration; `Object.freeze(MAX_APPEARANCES_BY_PHASE_DAY)` at point of declaration.
**Why:** Both are known-open findings across two consecutive Batch 1 audits. They are latent rather than immediately exploitable (no live callers mutate these today), but the correct time to close a latent mutable-export gap is before the code ships to users, not after.
**File:** `lib/langRegistry.ts`, `lib/introduction.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** TypeScript compiler enforces freeze at compile time for typed callers; no new test needed beyond verifying tsc passes.
**Done when:** `grep "Object.freeze(LANG_CONFIG_MAP)" lib/langRegistry.ts` and `grep "Object.freeze(MAX_APPEARANCES_BY_PHASE_DAY)" lib/introduction.ts` both return hits. `npx tsc --noEmit` clean. Verification gate green.
**Owner:** Security Agent

---

## Batch 19 — OS Trigger Settings Remediation (Audit #164 findings) | 39 tasks | [TASKS COMPLETE — pending batch audit]
Dependency: None (standalone remediation batch). Theme: /audit #164 (2026-07-04, verdict FAIL, severity 9, 39 findings) found that Task #163's OS trigger toggle controls (wake/unlock/idle + idle threshold) are entirely non-functional — `os_events.rs` never reads the settings it was built to expose. F001-F006 are the stop-the-line core; everything else is downstream test/doc/hardening debt discovered in the same audit. Fix order: F001-F004 (wiring) → F006 (Rust test coverage) → F015-F017/F040 (JS test hardening) → remainder.

### Task #187: Fix functional-defect: wake_enabled is written by update_interrupt_config but never read anywhere else in the crate.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
wake_enabled is written by update_interrupt_config (interrupt.rs:115-118) but never read anywhere else in the crate. The wake-detection branch fires on `elapsed>WAKE_THRESHOLD_SECS && enabled && now>=snooze_until` — it omits the wake_enabled check entirely, so toggling 'Wake' off in Settings has zero runtime effect at src-tauri/src/os_events.rs:start_os_listeners (wake-detection branch):172.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (wake-detection branch):172
- [ ] Add `wake_enabled` to the guard-state destructure at os_events.rs:165-168 and gate the wake-detection branch on it
- [ ] Add a regression test tracing update_interrupt_config(wake_enabled: false) → no interrupt:fire on simulated wake

**Source:** Audit finding F001 — severity 9 — functional-defect

---

### Task #188: Fix functional-defect: unlock_enabled is written but never read.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
unlock_enabled is written but never read. The unlock-detection branch fires on `prev_locked && !is_locked && enabled && now>=snooze_until`, omitting unlock_enabled at src-tauri/src/os_events.rs:start_os_listeners (unlock-detection branch):181.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (unlock-detection branch):181
- [ ] Gate the unlock-detection branch on unlock_enabled
- [ ] Add a regression test tracing update_interrupt_config(unlock_enabled: false) → no interrupt:fire on simulated unlock

**Source:** Audit finding F002 — severity 9 — functional-defect

---

### Task #189: Fix functional-defect: idle_enabled is written but never read.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
idle_enabled is written but never read. The idle-detection branch fires on `prev_idle && !is_idle && enabled && now>=snooze_until`, omitting idle_enabled at src-tauri/src/os_events.rs:start_os_listeners (idle-detection branch):191.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:start_os_listeners (idle-detection branch):191
- [ ] Gate the idle-detection branch on idle_enabled
- [ ] Add a regression test tracing update_interrupt_config(idle_enabled: false) → no interrupt:fire on simulated idle-return

**Source:** Audit finding F003 — severity 9 — functional-defect

---

### Task #190: Fix functional-defect: IDLE_THRESHOLD_SECS is hardcoded to 900.0 instead of the configurable st.idle_threshold_secs.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
IDLE_THRESHOLD_SECS is hardcoded to 900.0 (line 31) and used at line 160 instead of the configurable st.idle_threshold_secs field. Changing the idle-threshold UI input in Settings has zero effect on runtime behavior at src-tauri/src/os_events.rs:module const IDLE_THRESHOLD_SECS / start_os_listeners:31.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at src-tauri/src/os_events.rs:module const IDLE_THRESHOLD_SECS / start_os_listeners:31
- [ ] Read st.idle_threshold_secs from the guard-state destructure and use it in place of the hardcoded constant
- [ ] Add a test asserting a custom idle_threshold_secs value changes the actual idle-detection wait time

**Source:** Audit finding F004 — severity 8 — functional-defect

---

### Task #191: Fix process: unresolved TODO proves the team knew the wake/unlock/idle wiring was incomplete when Task #163 was marked COMPLETE.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
A self-authored, unresolved TODO reads: "TODO #163: replace IDLE_THRESHOLD_SECS with st.idle_threshold_secs once the configurable field is added to InterruptState. The state lock block already reads the guard fields; just add idle_threshold_secs to that destructure." Its stated precondition has since been satisfied but the follow-up was never done. Remove the TODO once #187-#190 close it out, at src-tauri/src/os_events.rs:start_os_listeners (TODO comment):29.
NEW

**Acceptance Criteria:**
- [ ] Fix process issue at src-tauri/src/os_events.rs:start_os_listeners (TODO comment):29
- [ ] Remove the stale TODO comment once the wiring lands

**Source:** Audit finding F005 — severity 7 — process

---

### Task #192: Fix test-quality: zero Rust #[test] blocks exist anywhere in src-tauri/src/*.rs.

**File:** src-tauri/src/
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
Zero Rust #[test] blocks exist anywhere in src-tauri/src/*.rs. The exact layer containing the critical defect (F001-F004) has no test harness at all, so Task #164's added tests — which all stop at the JS/IPC-call boundary — had no way to catch it, at src-tauri/src/:n/a — entire crate:0.
NEW

**Acceptance Criteria:**
- [ ] Add a #[cfg(test)] module to os_events.rs and/or interrupt.rs covering the wake/unlock/idle gating logic
- [ ] Audit passes: bash scripts/deep-audit.sh src-tauri/src/os_events.rs

**Source:** Audit finding F006 — severity 7 — test-quality

---

### Task #193: Fix documentation-trust: store/migrations.ts comment claims a functioning OS-trigger opt-out that does not exist at runtime.

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P1
**Status:** COMPLETE — 2026-07-06

**What:**
Comment at lines 158-159 claims a functioning opt-out for OS triggers that does not exist at runtime (per F001-F004), at store/migrations.ts:comment above SETTINGS_MIGRATIONS entry:158.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/migrations.ts:comment above SETTINGS_MIGRATIONS entry:158
- [ ] Update the comment once #187-#190 make the opt-out real, or soften the claim until then

**Source:** Audit finding F007 — severity 9 — documentation-trust

---

### Task #194: Fix documentation-trust: Wake/Unlock/Idle toggle descriptions claim independent control that runtime code never honors.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P1
**Status:** COMPLETE — 2026-07-06

**What:**
The Wake/Unlock/Idle toggle descriptions (lines 104-111) claim these triggers can be independently disabled; runtime code never honors any of the three (F001-F003). Conflicts with BRAND.md's stress-free/trust principle, at app/settings/page.tsx:OS Triggers section JSX:104.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at app/settings/page.tsx:OS Triggers section JSX:104
- [ ] Verify UI copy matches real behavior once #187-#190 land

**Source:** Audit finding F008 — severity 9 — documentation-trust

---

### Task #195: Fix documentation-trust: updateInterruptConfig JSDoc says "the Rust background thread" (singular), obscuring two threads exist.

**File:** lib/tauriInterrupt.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
JSDoc states 'the Rust background thread' (singular), obscuring that there are two independent Rust threads (interrupt.rs's own loop and os_events.rs) and that neither of them consumes wake_enabled/unlock_enabled/idle_enabled/idle_threshold_secs as the singular-thread framing implies, at lib/tauriInterrupt.ts:JSDoc above updateInterruptConfig:21.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/tauriInterrupt.ts:JSDoc above updateInterruptConfig:21
- [ ] Rewrite JSDoc to name both threads and their actual field consumption

**Source:** Audit finding F009 — severity 8 — documentation-trust

---

### Task #196: Fix documentation-trust: InterruptHandler.tsx comment "Keep the Rust thread in sync" is false for the 4 new fields.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
Comment 'Keep the Rust thread in sync' is false with respect to the 4 new fields — nothing keeps os_events.rs in sync with them (F001-F004), at components/InterruptHandler.tsx:config-sync effect comment:30.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at components/InterruptHandler.tsx:config-sync effect comment:30
- [ ] Update comment once #187-#190 land

**Source:** Audit finding F010 — severity 7 — documentation-trust

---

### Task #197: Fix documentation: interrupt.rs file header not updated to list the 4 new InterruptState fields.

**File:** src-tauri/src/interrupt.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
File header (lines 1-6) describing InterruptState has not been updated to list the 4 new fields (wake_enabled, unlock_enabled, idle_enabled, idle_threshold_secs), at src-tauri/src/interrupt.rs:file header:1.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at src-tauri/src/interrupt.rs:file header:1

**Source:** Audit finding F011 — severity 4 — documentation

---

### Task #198: Fix documentation: os_events.rs file header documents current behavior as complete rather than disclosing the unread/hardcoded fields.

**File:** src-tauri/src/os_events.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P3
**Status:** COMPLETE — 2026-07-06

**What:**
File header (lines 4-6) documents current listener behavior as normal/complete rather than disclosing that 3 of 4 new settings fields are currently unread and one is hardcoded-overridden, at src-tauri/src/os_events.rs:file header:4.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at src-tauri/src/os_events.rs:file header:4

**Source:** Audit finding F012 — severity 4 — documentation

---

### Task #199: Fix functional-defect: OS Triggers UI section has no platform gate — renders non-functionally on Windows/Linux.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-05

**What:**
The OS Triggers section (lines 102-114) is gated only on interruptEnabled && isTauri, with no platform check. It renders (non-functionally) on Windows/Linux Tauri builds where os_events.rs is a documented total no-op for these fields, compounding F001-F004, at app/settings/page.tsx:OS Triggers section:102.
NEW

**Acceptance Criteria:**
- [ ] Fix functional-defect issue at app/settings/page.tsx:OS Triggers section:102
- [ ] Gate the section on a platform capability check (e.g. macOS-only) until Batch 15 Windows/Linux support lands

**Source:** Audit finding F014 — severity 8 — functional-defect

---

### Task #200: Fix test-quality: InterruptHandler.test.tsx not updated for the 3-to-7-arg updateInterruptConfig signature change.

**File:** components/InterruptHandler.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-05

**What:**
Not updated by Task #164 despite InterruptHandler.tsx's call signature changing from 3 to 7 arguments (lines 27, 32). Only asserts calls[1]![0] (enabled); args 4-7 (wakeEnabled, unlockEnabled, idleEnabled, idleThresholdMinutes) are never inspected, at components/InterruptHandler.test.tsx:config-sync test block:188.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at components/InterruptHandler.test.tsx:config-sync test block:188
- [ ] Assert the full 7-argument call, including all 4 new fields, with distinct values per field to catch a swap bug

**Source:** Audit finding F015 — severity 7 — test-quality

---

### Task #201: Fix test-quality: tests/tauri.test.ts uses identical boolean values for wakeEnabled/unlockEnabled/idleEnabled, masking swap bugs.

**File:** tests/tauri.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Lines 81, 92, 98 all use identical true values for wakeEnabled/unlockEnabled/idleEnabled, and none assert the exact object shape passed to invoke('update_interrupt_config', ...). An argument-order swap or mis-cased key would silently break Rust deserialization undetected, at tests/tauri.test.ts:update_interrupt_config test cases:81.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/tauri.test.ts:update_interrupt_config test cases:81
- [ ] Use distinct values per field and assert invoke's exact call argument object shape

**Source:** Audit finding F016 — severity 5 — test-quality

---

### Task #202: Fix test-quality: tests/settingsStore.test.ts has zero coverage for the 4 new OS-trigger setters.

**File:** tests/settingsStore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-05

**What:**
Zero tests exist for setWakeEnabled/setUnlockEnabled/setIdleEnabled/setIdleThresholdMinutes or their defaults, unlike every sibling setter in this file, at tests/settingsStore.test.ts:n/a — missing coverage:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/settingsStore.test.ts:n/a — missing coverage:0
- [ ] Add defaults test + one setter test per new field, matching the existing sibling pattern

**Source:** Audit finding F017 — severity 6 — test-quality

---

### Task #203: Fix test-quality: banned .not.toBeNull() assertion with no existence-check comment.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
expect(queryIdleThresholdInput()).not.toBeNull() is a banned assertion form per AGENTS.md's Stop-the-Line list, with no inline `// existence-check: [reason]` comment. The value under test is not non-deterministic, so the documented exception does not apply, at app/settings/page.test.tsx:idle-threshold input presence test:302.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at app/settings/page.test.tsx:idle-threshold input presence test:302
- [ ] Either add a specific-value assertion in place of .not.toBeNull(), or justify with an inline existence-check comment

**Source:** Audit finding F018 — severity 3 — test-quality

---

### Task #204: Fix test-quality: three "no-op at current version" migration tests would pass even if the version-guard were deleted.

**File:** tests/migrations.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Three tests (migrateSrsStore:40, migrateEntitlementStore:256, migrateSettingsStore:355) would still pass if the version-guard were deleted, because they only assert a narrow subset of fields that happen to survive an unconditional re-run of the migration chain. Predates the #163/#164 diff — background debt, at tests/migrations.test.ts:'is a no-op when already at current version' tests (srsStore, entitlementStore, settingsStore):40.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/migrations.test.ts:'is a no-op when already at current version' tests:40
- [ ] Broaden assertions to a field set that would fail if the version-guard were removed

**Source:** Audit finding F019 — severity 4 — test-quality

---

### Task #205: Fix test-quality: web-mode updater test passes by coincidence with no spy on the plugin's check().

**File:** tests/tauri.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
The "returns available:false in web mode without consulting the updater plugin" test passes by coincidence — there is no spy on the updater plugin's check(), so it would also pass via the catch-block side effect alone. Pre-existing test, not part of the #163/#164 diff, at tests/tauri.test.ts:'returns available:false in web mode...' test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/tauri.test.ts:'returns available:false in web mode...' test:0
- [ ] Add a spy asserting the plugin's check() is never called in web mode

**Source:** Audit finding F020 — severity 3 — test-quality

---

### Task #206: Fix test-quality: only the entitlement store has an explicit gap-free migration-chain guard test.

**File:** tests/migrations.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Only the entitlement store has an explicit gap-free migration-chain guard test; srsStore and settingsStore lack an equivalent test, at tests/migrations.test.ts:n/a — inconsistent coverage across stores:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/migrations.test.ts:n/a — inconsistent coverage across stores:0
- [ ] Add an equivalent "migrating from v0 does not throw" guard test for migrateSrsStore and migrateSettingsStore

**Source:** Audit finding F021 — severity 3 — test-quality

---

### Task #207: Fix documentation: new Task #164 tests inserted out of numeric order in page.test.tsx.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
New Task #164 tests were inserted labeled 'Test 4'/'Test 5' ahead of the pre-existing 'Test 3' comment block, producing non-sequential numbering, at app/settings/page.test.tsx:n/a — test ordering:0.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at app/settings/page.test.tsx:n/a — test ordering:0
- [ ] Renumber the "Test N" comments to match file order

**Source:** Audit finding F022 — severity 2 — documentation

---

### Task #208: Fix documentation: page.test.tsx file header not updated for new OS-trigger test coverage.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
File header comment was not updated to reflect the newly added OS-trigger test coverage, at app/settings/page.test.tsx:file header comment:1.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation issue at app/settings/page.test.tsx:file header comment:1

**Source:** Audit finding F023 — severity 3 — documentation

---

### Task #209: Fix input-validation: idle-threshold number input has no clamp/validation logic.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
The idle-threshold number input's onChange has no clamp/validation logic; native min/max HTML attributes are UI-only and not enforced by any JS or Rust code path, at app/settings/page.tsx:idle-threshold number input onChange:110.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at app/settings/page.tsx:idle-threshold number input onChange:110
- [ ] Clamp to [5,120] in the onChange handler

**Source:** Audit finding F024 — severity 5 — input-validation

---

### Task #210: Fix reliability: out-of-range idleThresholdMinutes can fail Rust u32 deserialization and silently drop the entire bundled IPC call.

**File:** app/settings/page.test.tsx (verification only — root cause is fixed by #209's clamp; see note)
**Complexity:** ⚡ Direct — 1 file, regression test only, no Full trigger keywords
**Owner:** Architecture Agent
**Blocked by:** #209
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
A NaN or fractional idleThresholdMinutes value would fail Rust's u32 deserialization and reject the entire bundled 7-parameter update_interrupt_config IPC call, silently dropping other unrelated valid changes (e.g. wakeEnabled) submitted in the same call, at onChange handler → updateInterruptConfig → update_interrupt_config:110. Root cause is closed by #209's input clamp (app/settings/page.tsx) — this task is the regression-test verification that the clamp actually prevents the blast-radius failure, not a separate 3-file implementation.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at onChange handler → updateInterruptConfig → update_interrupt_config:110
- [ ] Add a regression test proving a NaN/negative typed value never reaches updateInterruptConfig/invoke once #209 lands

**Source:** Audit finding F025 — severity 6 — reliability

---

### Task #211: Fix input-validation: setIdleThresholdMinutes has no range validation unlike sibling bounded setters.

**File:** store/settingsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
setIdleThresholdMinutes has no range validation, unlike intervalHours/snoozeMinutes in the same store, which use literal-union bounded types, at store/settingsStore.ts:setIdleThresholdMinutes:38.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at store/settingsStore.ts:setIdleThresholdMinutes:38
- [ ] Consider a bounded type or runtime clamp consistent with sibling setters

**Source:** Audit finding F026 — severity 4 — input-validation

---

### Task #212: Fix input-validation: settings migration validates idleThresholdMinutes type only, not range.

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-05

**What:**
Validates type only, not range, for idleThresholdMinutes. A corrupted persisted value of -50 or 99999 passes through migration unchanged, tracing an unprotected chain end-to-end, at store/migrations.ts:SETTINGS_MIGRATIONS[2]:167.
NEW

**Acceptance Criteria:**
- [ ] Fix input-validation issue at store/migrations.ts:SETTINGS_MIGRATIONS[2]:167
- [ ] Clamp to [5,120] during migration, matching the UI-declared range

**Source:** Audit finding F027 — severity 6 — input-validation

---

### Task #213: Fix test-quality: no test exercises an out-of-range or invalid idleThresholdMinutes value.

**File:** tests/
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** #209, #211, #212
**Priority:** P3
**Status:** COMPLETE — 2026-07-06

**What:**
No test anywhere in the diff exercises an out-of-range or invalid idleThresholdMinutes value (e.g. negative, fractional, or > 120), at tests/:n/a — missing test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/:n/a — missing test:0
- [ ] Add tests covering negative, fractional, and >120 idleThresholdMinutes inputs once #209/#211/#212 land

**Source:** Audit finding F028 — severity 3 — test-quality

---

### Task #214: Fix code-quality: idle-threshold min/max are inlined magic literals instead of named constants.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Magic literals 5 and 120 are inlined as min/max rather than named constants. AGENTS.md: "any hardcoded string that belongs in a named constant" is a Stop-the-Line violation, at app/settings/page.tsx:idle-threshold number input:110.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/settings/page.tsx:idle-threshold number input:110
- [ ] Extract IDLE_THRESHOLD_MIN_MINUTES / IDLE_THRESHOLD_MAX_MINUTES constants (e.g. in settingsStore.ts, matching INTERVAL_OPTIONS/SNOOZE_OPTIONS convention)

**Source:** Audit finding F029 — severity 2 — code-quality

---

### Task #215: Fix code-quality: "15 minutes" idle default hardcoded independently in four places with no shared constant.

**File:** src-tauri/src/os_events.rs, src-tauri/src/interrupt.rs, store/settingsStore.ts, store/migrations.ts
**Complexity:** 🔧 Full — 4 files, cross-cutting constant extraction
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
The '15 minutes' idle default is hardcoded independently in four places (os_events.rs:31, interrupt.rs:52, settingsStore.ts:54, migrations.ts:167) with no shared constant. One copy is already permanently out of sync since it is the unread hardcoded override (F004), at idle-default constants:31.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at idle-default constants:31
- [ ] Extract a single shared default-minutes constant consumed by all four sites (via a shared TS/Rust boundary or documented single source of truth)

**Source:** Audit finding F030 — severity 6 — code-quality

---

### Task #216: Fix architecture: 7-positional-parameter interrupt-config contract duplicated identically across 5 files with no shared schema.

**File:** app/settings/page.tsx, lib/tauriInterrupt.ts, components/InterruptHandler.tsx, store/settingsStore.ts, src-tauri/src/interrupt.rs
**Complexity:** 🔧 Full — 5 files, contract redesign
**Owner:** Architecture Agent
**Blocked by:** #187, #188, #189, #190
**Priority:** P2
**Status:** COMPLETE — 2026-07-06

**What:**
The 7-positional-parameter interrupt-config contract is duplicated identically across 5 files with no shared type/schema forcing sync. This exact coupling is the structural root cause that let os_events.rs silently fall out of sync with the other 4 files' understanding of the config shape (F001-F004), at update_interrupt_config parameter contract.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at update_interrupt_config parameter contract
- [ ] Consider a shared config object/struct (TS interface + matching Rust struct) instead of positional params, so adding a field forces every consumer to acknowledge it

**Source:** Audit finding F031 — severity 6 — architecture

---

### Task #217: Fix reliability: config-sync effect has no debounce, allowing rapid toggles to race and silently revert.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
The config-sync effect (lines 31-35) has no debounce or request sequencing. Rapid toggle clicks can race — an older in-flight update_interrupt_config call resolving after a newer one could silently revert a toggle in Rust-side state with no user-visible indication, at components/InterruptHandler.tsx:config-sync effect:31.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at components/InterruptHandler.tsx:config-sync effect:31
- [ ] Add a debounce or sequence-number guard so only the latest config write wins

**Source:** Audit finding F032 — severity 5 — reliability

---

### Task #218: Fix reliability: update_interrupt_config silently no-ops on a poisoned mutex with no error surfaced.

**File:** src-tauri/src/interrupt.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Silently no-ops on a poisoned mutex (lines 111-119); the JS caller receives a resolved promise and believes the config was applied even though nothing was written, at src-tauri/src/interrupt.rs:update_interrupt_config:111.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at src-tauri/src/interrupt.rs:update_interrupt_config:111
- [ ] Log or surface an error when the lock cannot be acquired, per Rule 8 (Log Everything)

**Source:** Audit finding F033 — severity 5 — reliability

---

### Task #219: Fix accessibility: idle-threshold label has no htmlFor/id association with its input.

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
The idle-threshold label has no htmlFor/id association. Task #164 worked around this in tests via DOM traversal instead of fixing the markup. Pre-existing pattern elsewhere in the file, but a missed opportunity to fix while touching this exact markup, at app/settings/page.tsx:idle-threshold label/input:109.
NEW

**Acceptance Criteria:**
- [ ] Fix accessibility issue at app/settings/page.tsx:idle-threshold label/input:109
- [ ] Add htmlFor/id association; simplify the test's queryIdleThresholdInput() helper to use getByLabelText once fixed

**Source:** Audit finding F034 — severity 2 — accessibility

---

### Task #220: Fix scope: license/notification/mandatory-mode tests in page.test.tsx are unrelated to Task #163's OS-trigger feature.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
License/notification/mandatory-mode tests (12-25) are unrelated to Task #163's OS-trigger feature — scope bleed into Task #164, though separately authorized by the user mid-task to close a coverage gap, at app/settings/page.test.tsx:tests 12-25:0.
NEW

**Acceptance Criteria:**
- [ ] Review whether these tests should be documented as their own coverage initiative rather than attributed to Task #164's scope

**Source:** Audit finding F035 — severity 2 — scope

---

### Task #221: Fix reliability: exitMandatoryMode has no try/catch and its call sites handle failure inconsistently.

**File:** lib/tauriInterrupt.ts, app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
exitMandatoryMode() (tauriInterrupt.ts:60-63) has no try/catch, unlike sibling updateInterruptConfig/snoozeInterrupt in the same file. app/study/page.tsx:73 has zero error handling around its call (unhandled-rejection risk, user could be stuck in a locked window); app/study/page.tsx:121 uses try/finally but no catch. Predates the #163/#164 diff — pre-existing debt, at exitMandatoryMode and call sites:60.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at exitMandatoryMode and call sites:60
- [ ] Add try/catch with an ERR-* ref log matching the sibling pattern in the same file

**Source:** Audit finding F036 — severity 4 — reliability

---

### Task #222: Fix architecture: InterruptHandler.tsx imports directly from store/, violating the components/ layer rule.

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Imports directly from store/ (settingsStore, srsStore), contradicting CLAUDE.md's layer rule: "components/ — Import from hooks/ and lib/ only." Pre-existing pattern, not introduced by this task, at components/InterruptHandler.tsx:module imports:1.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at components/InterruptHandler.tsx:module imports:1
- [ ] Consider a hook wrapper (e.g. useInterruptConfig) to restore the documented layer boundary

**Source:** Audit finding F037 — severity 4 — architecture

---

### Task #223: Fix brand-voice: tray tooltip strings use a forbidden exclamation mark and non-canonical "due" terminology.

**File:** src-tauri/src/lib.rs
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Docs Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Tray tooltips at lines 59 and 61 violate BRAND.md voice rules: "all caught up!" uses a forbidden exclamation mark, and "due" is used instead of the canonical terminology "ready". Pre-existing code, not touched by the #163/#164 diff, at src-tauri/src/lib.rs:tray tooltip strings:59.
NEW

**Acceptance Criteria:**
- [ ] Fix brand-voice issue at src-tauri/src/lib.rs:tray tooltip strings:59
- [ ] Rewrite tooltip strings to match BRAND.md voice and terminology

**Source:** Audit finding F038 — severity 2 — brand-voice

---

### Task #224: Fix architecture: app/learn/page.tsx calls localStorage directly, bypassing the storage abstraction.

**File:** app/learn/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-05

**What:**
Direct localStorage call at line 127, bypassing the lib/storage.ts platform-storage abstraction required by CLAUDE.md ("Never call localStorage directly from any file outside lib/storage.ts"). Pre-existing/systemic issue, not introduced by this task, at app/learn/page.tsx:n/a:127.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at app/learn/page.tsx:n/a:127
- [ ] Route through lib/storage.ts or a dedicated helper

**Source:** Audit finding F039 — severity 2 — architecture

---

### Task #225: Fix test-quality: 6 new OS-trigger toggle tests create an appearance of coverage for a feature whose backing implementation is inert.

**File:** app/settings/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** #187, #188, #189, #190, #192
**Priority:** P3
**Status:** COMPLETE — 2026-07-06

**What:**
The 6 new OS-trigger toggle tests create an appearance of solid test coverage for a feature whose backing Rust implementation never consumes the settings at all (F001-F004). The tests prove only Zustand state updates and IPC-call invocation, never the actual OS-trigger behavior the toggles name, at app/settings/page.test.tsx:OS-trigger toggle tests (6 new tests):0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at app/settings/page.test.tsx:OS-trigger toggle tests (6 new tests):0
- [ ] Once #187-#190/#192 land, add an integration-style note or seam test cross-referencing the new Rust test coverage so the JS tests' scope is honestly documented

**Source:** Audit finding F040 — severity 5 — test-quality

---

## Escalation Queue
| Issue | Why it needs a decision | Options |
|-------|------------------------|---------|
| ALL_PACK_CODES vs READY_PACK_CODES decision (Task #068) | Should loadPack validate against all registered pack codes (including es with ready:false) or only packs that are actually ready to download? With es.json now in the CDN but hidden, this question is active again. | (A) Validate against READY_PACK_CODES only — es.json inaccessible until ready:true; (B) Validate against all registered codes — allows direct pack URL access even when hidden from UI |
| Sentence generator go/no-go | BRAND.md flags this as "under evaluation." No task created. | (A) Greenlight — add BUILD task to Batch 10/11; (B) Hold — revisit at B2 content milestone |
| Spanish pack quality gate | es.json (245KB, v0.9.0) exists but Max confirmed "not yet ready" on 2026-06-29. When is it ready? | Owner sets criteria: word count target, unit count, QA pass |
| LS store creation (Task #120) | Owner action: create LS store before Task #120 can close. | Max creates store at dashboard.lemonsqueezy.com; confirms slug |
| Apple Developer Program membership | Required for Task #122. Do you have an Apple Developer ID Application certificate? | (A) Yes, have certificate → Task #122 ready to start; (B) No — enroll at developer.apple.com ($99/yr); (C) Use ad-hoc signing for internal testing only |
