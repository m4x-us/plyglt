---
# Task List — plyglt
Generated: 2026-06-24 | Method: /meet
Last updated: 2026-08-14 (Batch 22 COMPLETE — Task #533, the interrupt content-supply floor: 6-10 interrupts/day is now a hard guarantee, never skipped for lack of "due" content. Live-verified working on the Windows VM same session. Task #522 (iOS) made real, substantial progress — Xcode installed, Simulator build compiles/launches/runs without crashing, blank-screen issue root-caused precisely to a known WebKit mixed-content limitation with a scoped, not-yet-built fix (HTTPS dev server). Task #166 (Windows) found one new open finding: idle-trigger foreground-forcing works, unlock-trigger's doesn't (1 occurrence each, unconfirmed as reproducible) — wake-from-sleep still never tested. Also closed 3 small debt items (timing-safe cron-secret compare, notification-permission hook extraction, devtools dropped from release builds) and fixed a live production gap (the `interrupt_gate_events` cross-device gate table existed in the repo's migration but was never applied to the real Supabase project). Mac and Windows now both running the same `v0.1.0-beta.12` build.)

## Summary
Batches 1–14, 16, 18, 19, 20, 21, 22 COMPLETE; Batch 15 IN PROGRESS (Task #166: unlock trigger confirmed working, but a new foreground-forcing discrepancy vs. the idle trigger needs reproduction — see debt.md; wake-from-sleep still never tested; #167 Linux still not manually tested at all; #165 Windows code-signing still separately blocked on Max's Azure Portal setup); Batch 16 fully COMPLETE (#168/#169/#170/#520/#521 all done); Batch 17 (Mobile) has #171 COMPLETE (rescoped) — #522 (iOS) now has Xcode installed and a working, non-crashing Simulator build; the one remaining blocker (live-dev blank screen, WebKit mixed-content) is root-caused with a scoped fix (HTTPS dev server) not yet built; #172 (Android, blocked on #522) remains open; Batch 21 COMPLETE (2026-08-13) — the interrupt trigger/cross-device scheduling redesign; **Batch 22 COMPLETE (2026-08-14)** — the interrupt content-supply floor (Task #533), BRAND.md's "6-10 interrupts every day" is now a real, tested, live-verified guarantee.
Current Sprint: none currently marked. Remaining open work, roughly in order of what's closest to done: (1) Task #522 — iOS live dev with HMR now FULLY WORKING (2026-08-14; `dev:https` + `tauri.ios.conf.json` devUrl `https://plyglt.localhost:3050` — see the task's dated log); what remains is the Max-owned Apple infrastructure: push capability + APNs registration, APNs key, TestFlight, App Store submission; (2) Task #166 — reproduce or rule out the idle-vs-unlock foreground-forcing gap (a few more lock/unlock cycles on the Windows VM), then test wake-from-sleep (a VM suspend/resume, never done); (3) Batch 17 mobile work (#172 Android) blocked on #522. Run `/tasks debt` to review the full debt register, or `/meet`/`/team-health` to plan the next sprint.

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

## Batch 10 — M2 macOS Shipping Infrastructure | 13 tasks | [COMPLETE — 2026-07-29 — core shipping pipeline verified end-to-end via real test release v0.1.0-beta.1; #507/#508 are follow-up hardening, not shipping blockers]
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
**Status: COMPLETE — 2026-07-28 (discovered already done during Batch 10 review; lib/checkout.ts:12 has a real LS product URL, not a placeholder — live-verified via curl, HTTP 302 through LS's checkout redirect flow. The task list was never updated when this actually shipped. Note: current pricing is annual-only ($34.99/yr) per lib/checkout.ts:18-20 — no monthly product exists, consistent with BRAND.md's "Pro is monthly or annual only" language and Task #120's own original wording being superseded by the later monthly-removal decision documented elsewhere in project memory.)**

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
**Blocked by:** Nothing (owner action — Apple Developer Program membership approved 2026-07-08; still need to generate + export the Developer ID Application certificate and wire GitHub Actions secrets before this can close)
**Risk:** High — certificate mismatch or wrong signing identity silently produces an unsigned binary. Validate with `codesign --verify --verbose` on the built .app.
**Completion gates:** Security Agent sign-off
**Done when:** `grep "signingIdentity" src-tauri/tauri.conf.json` returns a non-null string value; a test macOS build on CI produces a notarized .dmg that opens without Gatekeeper warning on a clean macOS install.
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope change
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-29 (Developer ID Application certificate generated, installed, and exported; all 6 GitHub Actions secrets confirmed set via `gh secret list`; `src-tauri/tauri.conf.json:signingIdentity` updated from `null` to the real cert name. The second half of Done When — a CI build actually producing a notarized, Gatekeeper-clean .dmg — can only be verified once Task #123's release workflow exists and runs; that's the next task.)**

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
**Status: COMPLETE — 2026-07-29 (core deliverable verified end-to-end via a real test release, tag v0.1.0-beta.1: both aarch64-apple-darwin and x86_64-apple-darwin builds compiled, were code-signed with the real Developer ID certificate, successfully notarized by Apple — confirmed via `xcrun notarytool history` — and published as release assets, `plyglt_0.1.0_aarch64.dmg` and `plyglt_0.1.0_x64.dmg`, both downloadable/installable. `REPLACE_WITH_REPO` placeholder confirmed gone. The `latest.json` auto-updater manifest did NOT generate — tauri-action logged "Signature not found for the updater JSON. Skipping upload" despite the `.sig` file being present on disk, a known category of issue with per-architecture matrix builds generating a single combined updater manifest. This affects only the in-app auto-update check, not the initial install/download path. Tracked separately as Task #508 rather than blocking this task, since the core shipping capability this task exists to deliver is confirmed working.)**

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
**Status: COMPLETE — 2026-07-28 (discovered the feature itself — components/NotificationPermissionGate.tsx, wired into app/settings/page.tsx:68 — was already built and matches the task spec word-for-word; the task list was never updated. The one real gap was a missing co-located test file, a Rule 14 violation. Added components/NotificationPermissionGate.test.tsx covering all 4 permission states, spot-check verified PASS.)**

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

---

### Task #507 | security | severity 5
**What:** Upgrade ESLint from `^9` to `10.8.0` (and update `eslint-config-next` / plugin versions as needed for compatibility). Verify flat-config (`eslint.config.*`) and all existing lint rules still apply correctly — ESLint 9→10 is a major version bump and may change plugin compatibility or rule defaults. Re-run `npm run lint` and confirm 0 new errors/warnings beyond the 3 pre-existing ones.
**Why:** Discovered 2026-07-29 when CI ran for the first time against the newly-created GitHub repo (`m4x-us/plyglt`) — `npm audit --audit-level=high` flagged `eslint`, `minimatch`, `brace-expansion`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `@eslint/config-array`, `@eslint/eslintrc` as high-severity, all only fixable via this major ESLint upgrade. Deferred as its own task rather than rushed alongside the Batch 10 shipping-infrastructure work; documented as an accepted, tracked baseline in `STATUS.md § Known Issues` and allowlisted in `.github/workflows/ci.yml`'s Audit step in the meantime.
**File:** `package.json`, possibly `eslint.config.mjs` (or equivalent flat-config file)
**Blocks:** Nothing (CI's audit allowlist covers this in the meantime)
**Blocked by:** Nothing
**Risk:** Medium — major version bump could change lint behavior; test thoroughly before merging.
**Completion gates:** Security Agent sign-off (audit clean) + QA Agent sign-off (lint clean)
**Done when:** `npm audit --audit-level=high` reports 0 vulnerabilities for `eslint`/`minimatch`/`brace-expansion`/`eslint-config-next`/its plugins; `.github/workflows/ci.yml`'s audit allowlist and `STATUS.md`'s corresponding Known Issues entry are both updated/removed to match; `npm run lint` passes with only the 3 pre-existing unrelated warnings.
**Complexity:** 🔧 Full — major version migration, needs compatibility verification
**Owner:** Security Agent
**Status (2026-08-04): security motivation RESOLVED without the major-version migration — task re-scoped, not closed.** Re-checked before starting the planned ESLint 9→10 upgrade: `eslint`, `eslint-config-next`, and its plugins are no longer flagged high-severity at all — resolved on their own via ordinary upstream dependency updates over the week since this task was logged. The one remaining live finding, `brace-expansion` (pulled in transitively by both `eslint`'s and `eslint-config-next`'s own `minimatch` dependencies, at two different unrelated version lines — 1.1.17 and 5.0.8), was fixed with two narrow, dependency-path-scoped `overrides` entries in `package.json` (pinning each instance to its own patched version, `^1.1.18` and `^5.0.9`), not the ESLint major upgrade — matching the same "surgical pin over risky major bump" pattern used the same session for the `undici` CVE (see the CI-fix commit). `.github/workflows/ci.yml`'s allowlist shrunk to just `next`/`postcss`/`sharp` (the only ones still genuinely unfixable from our side) and `STATUS.md`'s Known Issues entry updated to match. Verified: `npm audit --audit-level=high` clean against the new allowlist, tsc clean, 1510/1510 tests, lint clean (3 pre-existing unrelated warnings only). **The literal ESLint 9→10 major-version migration itself is still open** — no longer urgent since its security justification is gone, but tracked separately as a lower-priority modernization; left for Max to decide whether/when it's worth the flat-config migration risk with no live security driver behind it.

**Attempted the same day, genuinely blocked upstream — not a config problem on our side.** Max asked to go ahead with the migration anyway. Bumping `eslint` to `^10.8.0` installs, but `npm run lint` hard-crashes (not just a peer-dependency warning): `TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`, thrown from inside `eslint-plugin-react@7.37.5` (bundled by `eslint-config-next`, both at their latest published versions as of 2026-08-04). Root cause: ESLint 10 changed its rule-context API in a way `eslint-plugin-react`'s currently-published version doesn't yet handle — confirmed by checking the actual published peer-dependency ranges directly (`npm view eslint-plugin-react@latest peerDependencies.eslint` → `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7`; same story for `eslint-plugin-jsx-a11y` and `eslint-plugin-import`), not assumed from the crash alone. This is the identical "unfixable from our side, waiting on an upstream release" situation as the `next`/`postcss`/`sharp` entries in STATUS.md — Next.js's own ESLint plugin ecosystem has not yet shipped ESLint 10 support. Reverted cleanly: `eslint` back to `^9`, `package-lock.json` restored via `git checkout` + a lockfile-respecting `npm install` (not a fresh `rm -rf node_modules` reinstall, which had non-deterministically drifted `next` and `eslint-config-next` to newer minor versions as an unintended side effect mid-investigation — caught before committing anything, reverted to the exact prior state). Re-verified clean: tsc, 1510/1510 tests, lint (exactly the 3 pre-existing warnings, nothing new). **Batch closed for now** — retry once `eslint-plugin-react`/`eslint-config-next` publish ESLint 10 support; no action item for us until then.

### Task #508 | build | severity 5
**What:** Fix `latest.json` auto-updater manifest generation in `.github/workflows/release.yml`. The current per-architecture matrix strategy (`aarch64-apple-darwin`, `x86_64-apple-darwin` as separate parallel jobs) causes `tauri-action` to log "Signature not found for the updater JSON. Skipping upload..." for both jobs, even though each job's own `.sig` file is confirmed present on disk (e.g. `.../release/bundle/macos/plyglt.app.tar.gz.sig`). Investigate whether this needs: (a) building both targets within a single job/invocation instead of a matrix, (b) a `--target universal-apple-darwin` universal binary build instead of two separate architecture builds, or (c) explicit `updaterJsonKeepUniversal`/artifact-path configuration so tauri-action can find both architectures' signatures when assembling one combined manifest.
**Why:** Confirmed via a real test release (tag `v0.1.0-beta.1`, 2026-07-29) during Task #123 — the core build/sign/notarize/publish pipeline works end-to-end (both `.dmg` installers present and correctly signed/notarized), but `latest.json` never appeared in the release assets, meaning the in-app auto-updater (`checkForUpdates()` in `lib/tauri.ts`) has nothing to check against once this ships. Auto-update is a Pro-tier differentiator per BRAND.md's "Software updates and new features" row — this needs to work before relying on it for real users.
**File:** `.github/workflows/release.yml`
**Blocks:** Nothing (initial install/download path already works without this)
**Blocked by:** Nothing
**Risk:** Medium — may require restructuring the build matrix, which changes how long CI takes and which artifacts get produced per job.
**Completion gates:** Security Agent sign-off (verify the manifest's ed25519 signature is valid) + Architecture Agent sign-off
**Done when:** A test release tag produces a GitHub Release containing `latest.json` alongside both `.dmg` files; `curl [the tauri.conf.json updater endpoint URL]` returns the manifest; the manifest's signature validates against the public key in `tauri.conf.json`.
**Complexity:** 🔧 Full — CI workflow restructuring, needs a real test release to verify
**Owner:** Security Agent
**Status: COMPLETE — 2026-08-04, verified end-to-end via a real test release (tag `v0.1.0-beta.2`).** Investigated by reading tauri-action's actual source directly (`src/upload-version-json.ts`, `src/build.ts`, `src/index.ts` on its `dev` branch, via `gh api`) rather than assuming from memory, plus cross-checking Tauri's official v2 docs. Findings:
- The matrix-race theory in this task's own original "(a)/(b)/(c)" options turned out to be wrong — `tauri-action` is explicitly designed to run as parallel matrix jobs publishing to one shared release (this is Tauri's own officially documented pattern, confirmed at `v2.tauri.app/distribute/pipelines/github/`), and each job's `uploadVersionJSON` call fetches the release's existing `latest.json`, merges in its own platform's entry, and re-uploads — with a built-in retry specifically because "all jobs try to upload this file [and it] tends to conflict often" (a comment in the tool's own source, not speculation).
- The actual "Signature not found for the updater JSON. Skipping upload" trigger is simpler: it fires when a job's own local build produced zero artifacts with a `.sig`-ending extension — which happens before any cross-job merge logic even runs, so it's a per-job local-build problem, not a matrix/race problem.
- Root cause: `src-tauri/tauri.conf.json`'s `bundle` section was missing `createUpdaterArtifacts`. Per Tauri's official v2 updater docs (`v2.tauri.app/plugin/updater/`), this flag is required for `tauri build` to generate the updater-specific artifacts (the `.tar.gz` + `.sig` pair) at all — without it, the bundler still produces normal installers (which is why the `.dmg`s worked fine and were correctly signed/notarized) but not the separate updater artifact tauri-action looks for.
- **Fix applied:** added `"createUpdaterArtifacts": true` to `src-tauri/tauri.conf.json`'s `bundle` section (not `"v1Compatible"` — this app was never on Tauri v1, so the modern `true` value is correct per the docs).
- **Verified end-to-end 2026-08-04 via a real tagged test release (`v0.1.0-beta.2`, commit `6fd91b0`):** `latest.json` appeared in the release assets for the first time ever, alongside `plyglt_aarch64.app.tar.gz(.sig)`, `plyglt_x64.app.tar.gz(.sig)`, and `plyglt_0.1.0_amd64.AppImage(.sig)`. Downloaded and inspected the actual manifest content (not just its presence): valid JSON, `platforms` object populated with real entries for `darwin-aarch64`, `darwin-aarch64-app`, `darwin-x86_64`, `darwin-x86_64-app`, `linux-x86_64`, `linux-x86_64-appimage`, each with a real signature string and a working GitHub release-asset download URL. Cross-checked the signature's embedded minisign key ID against `tauri.conf.json`'s configured public key (`43A2FCD915CCBF32`) — they match, confirming the manifest was signed with the correct key, not just structurally present. The Windows job failed as expected (still blocked on Task #165's Azure secrets, unrelated to this fix) — no Windows entry in the manifest, which is the correct behavior for a platform whose build never completed, not a regression.
- macOS jobs (`macos-latest, x86_64-apple-darwin` / `aarch64-apple-darwin`) and the Linux job (`ubuntu-22.04`) all succeeded outright in this test run — same signing/notarization pipeline as the 2026-07-29 `v0.1.0-beta.1` test release, unaffected by this change.

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

## Batch 12 — Specialty Pack Architecture | 164 tasks | [COMPLETE — 2026-07-28 — 12 findings accepted as debt]
Dependency: Independent of Batch 10 and 11. No owner actions required. These tasks lay the groundwork for future paid add-on specialty packs (medical, business, cooking, etc.) without building any content or payments yet.
Sixth re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 9 (critical) — 22 findings (F1-F22) merged/scored by Agent C; 11 findings (severity ≥4) promoted as Task #455-#465 below; 11 findings (severity ≤3) logged to debt.md. Critical finding: Task #450's widened Verification Gate is currently red by its own literal wording (29 pre-existing hits) and the batch was carried to zero open tasks without an updated cycle-6 verdict — see Task #455. Task #466 added per Max's explicit direction (2026-07-28) to close this mechanically via CI, not rely on the audit process to catch it again next time. Wave 20 (4 streams: Adam/Barry/Charles/Derek) closed all 12 tasks (#455-466) 2026-07-28, independently re-verified against actual source: tsc clean, 1403/1403 tests pass, lint clean (3 pre-existing warnings), Verification Gate grep clean (genuinely zero hits — the critical finding is resolved), CI now mechanically enforces the gate on every push/PR. Per BATCH_REMEDIATION_GATE, task completion alone doesn't close the gate — a fresh "/audit batch 12" run must PASS next.
Seventh re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 6 — cycle-6's critical process failure (the gate silently red) is confirmed genuinely fixed, but 2 new LIVE bugs surfaced via execution-based testing (a backup-restore version-check bypass, and an uncaught-crash bug in the CI pack validator itself), plus the batch's own recurring "fix the instance, miss the sibling" pattern struck again inside this wave's own fixes (4 of 7 promoted findings are the fix-that-recreates-its-own-defect-class shape). 7 findings (severity ≥4) promoted as Task #467-473 below; 13 findings (severity ≤3) logged to debt.md. Wave 21 (4 streams: Adam/Barry/Charles/Derek) closed all 7 tasks 2026-07-28, independently re-verified: tsc clean, 1424/1424 tests pass, lint clean (3 pre-existing warnings), Verification Gate grep clean, scripts/validatePack.ts now genuinely counted in coverage (67.76%/76.85%/100%/66.66%), aggregate thresholds still exceeded. Per BATCH_REMEDIATION_GATE, a fresh "/audit batch 12" run must PASS next.
Eighth re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 6 — no critical bugs this time, but 4 converged findings each trip an explicit stop-the-line rule, and 3 of them are the same shape recurring inside the very fixes meant to close it (a fix/test handling one of two near-identical branches, leaving its twin unaddressed). Security posture confirmed genuinely clean this cycle. 5 findings (severity ≥4) promoted as Task #474-478 below; 6 findings (severity ≤3) logged to debt.md. Wave 22 (4 streams: Adam/Barry/Charles/Derek) closed all 5 tasks 2026-07-28, independently re-verified: tsc clean, 1428/1428 tests pass, lint clean (3 pre-existing warnings), Verification Gate grep clean. Per BATCH_REMEDIATION_GATE, a fresh "/audit batch 12" run must PASS next.
Ninth re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 6 — no critical bugs, but two live bugs with the strongest convergence recorded yet in this batch's history (up to 6 of 8 reviewers independently, several via direct execution), plus a uniquely deep single-reviewer finding: Security Agent S traced the actual Zustand library source and found that last cycle's error-logging fix (Task #474) logs a code path that can never actually fire in production under this store's real configuration. 6 findings promoted as Task #479-484 below (5 open — F002/F010 combined into Task #480, #484 merged/closed as a duplicate of #480's own third acceptance criterion); F003 folded into #480's context rather than separately promoted (same code region, low separate-actionability per the auditors' own note that validateCard's independent check already mitigates it); 4 findings (severity ≤3) logged to debt.md. Wave 23 (3 streams: Adam/Barry/Charles) closed all 5 open tasks (#479-483) 2026-07-28, independently re-verified against actual source: tsc clean, full suite passes with coverage well above thresholds (89.81%/85.83%/90.36%/92.02% stmts/branches/funcs/lines vs 84/81/79/82 floors), lint clean (3 pre-existing warnings), Verification Gate grep clean (zero hits). Adam correctly judged isFinite() alone insufficient for the string branch (hex strings are technically finite) and used a strict digits-only pattern first; Charles did genuine investigation rather than deleting the "dead" branch, tracing zustand@5.0.14's actual source and adding a test against the real (non-mocked) persist/createJSONStorage behavior. Per BATCH_REMEDIATION_GATE, a fresh "/audit batch 12" run must PASS next.
Tenth re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 7 (critical) — the strongest single-finding convergence recorded in this batch's entire 10-cycle history: 6 of 8 reviewers (A, B, N, W, Red R via direct reasoning, one via actual code execution with npx tsx; S independently assessed the same bug as present but non-security) independently found that Task #481's "symmetric acceptance" fix from Wave 23 is not actually symmetric — `_version:"0"` (string) is accepted while `_version:0` (number) is rejected, and conversely `_version:"-1"` is rejected while `_version:-1` (number) has always been silently accepted with no lower-bound check at all. This is a textbook Rule 23 violation (a fix recreating its own defect class) occurring inside the very Wave 23 tasks (#479, #481) meant to close cycle-9's F001. A second, independently significant finding: Agents B and W identified that Task #482's investigation into entitlementCrossTabSync's dead reject-branch only verified ONE of two realistic failure paths (a synthetic storage.getItem throw) — the real, designed-to-exist migrate()-throws path (store/migrations.ts throws on missing migrations; all 3 stores register migrate per CLAUDE.md §4) was never tested and still funnels into the same silently-resolved promise with zero failsafe, unlike the mount-time hydration path's explicit timeout. This directly resolved a live disagreement between Agent K (who judged Task #482 fully closed) and Agents B/W (who judged it incompletely verified) in favor of B/W. 8 findings (severity ≥4) promoted as Task #485-492 below; 10 findings (severity ≤3) logged to debt.md. Security posture assessed clean for a 3rd consecutive cycle — the 0/-1 asymmetry itself was independently judged to have no security impact (no code branches on _version's value after the check). Wave 24 (3 streams: Adam/Barry/Charles) closed all 4 open tasks (#485, #488, #491, #492) 2026-07-28, independently re-verified against actual source: tsc clean, 1446/1446 tests pass, lint clean (3 pre-existing warnings), Verification Gate grep clean, coverage above thresholds (89.81%/85.88%/90.4%/92.03%). Adam proved the fix's completeness with a symmetry-sweep test across 9 values rather than just the 4 named boundary cases; Barry proved the migrate()-throws gap live against the real zustand dependency and logged the unfixable-here-in-scope root cause as tracked debt rather than leaving it implicit; Charles made a genuine design decision (documented why folding blank ids into one aggregate would be worse, not just skipped the finding). Tasks #486, #487, #489, #490 remain deferred (each blocked on a task closed this wave) — will be picked up next wave. Wave 25 (2 streams: Adam/Barry) closed 3 of the 4 remaining tasks (#486, #489, #490) 2026-07-28, independently re-verified: tsc clean, 1449/1449 tests pass, lint clean (3 pre-existing warnings), Verification Gate grep clean, coverage above thresholds. Adam extended #485's shared predicate with Number.isInteger rather than adding a parallel check, and verified the string branch's symmetry explicitly rather than assuming it; Barry caught that Task #491's isThenable comment quoted the same disclaimed multi-caller justification #489 was fixing and corrected both, and for #490 correctly recognized Wave 24's #488 rewrite had already closed the core overclaim, adding only a genuinely new residual-gap note (merge()/setItem() re-persist paths) rather than redundant rework. Task #487 (strengthening the shallow #481 tests) is now unblocked (#485/#486 both complete) — the sole remaining open task in this batch. Task #487 closed directly (not a wave) 2026-07-28, independently re-verified: tsc clean, 1453/1453 tests pass, lint clean, coverage above thresholds; a spot-check-found comment overclaim was fixed in-cycle before commit. All Batch 12 tasks reached zero-open at this point.
Eleventh re-audit (2026-07-28, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 9 (critical) — a heavier cycle than 10, with 22 findings including a genuinely NEW Rule 23 recreation happening INSIDE cycle-10's own remediation: Task #488's own new "Accepted trade-off" paragraph (written specifically to fix cycle-10's overclaim) contains a fresh, empirically-false claim — Agent B verified via live script execution against the real zustand dependency that a "newer app version writing from another tab" scenario does NOT throw as the comment claims, it silently accepts unmigrated future-shaped state with zero signal, untested and undocumented as its own gap. Agent W independently found a completely missed, LIVE gap: validatePack.ts hardened duplicate-card-ID detection across 4 tasks but has zero duplicate-unit-ID detection, despite hooks/useLangPack.ts:291 collapsing units by id via Object.fromEntries — a duplicate unit id would silently delete an entire unit's cards with no CI signal, the exact Rule 23 pattern recurring one abstraction level up from every prior instance in this batch. Agent K found the Task #485 sweep test (added in the SAME wave as Task #487) recreates the exact ".ok-only" comparison pattern #487 was created to eliminate, a few lines later in the same file. Agents K and B also converged on a shared root finding — Task #488's debt-logging of the migrate-throw diagnosability gap was premature, since a real, low-blast-radius fix exists (B empirically confirmed store/entitlementStore.ts's onRehydrateStorage receives the raw error; K identified a complementary console.error fix in store/migrations.ts). Additional findings: a vacuous BigInt test assertion that never calls production code (K), a never-settling-thenable gap in isThenable with no timeout (V, Red R), and 3-way convergence (Auditor A, Agent W, Red Agent R) that entitlementCrossTabSync.ts's doc comment has grown into an unmaintainable self-correcting changelog across 8-9 tasks — the exact structure that let the cycle's own fresh overclaim accrete undetected. 13 findings (severity ≥4) promoted as Tasks #493-505 below; 9 findings (severity ≤3) logged to debt.md. Security posture assessed clean for a 4th consecutive cycle. Task #493 (the live unit-ID dedup gap) closed directly 2026-07-28, independently re-verified: tsc clean, 1461/1461 tests pass, coverage above thresholds; a spot check found the fix's blast-radius comment was incomplete and test coverage was missing 2 of 4 blank-id sub-cases — both fixed in-cycle. Per Max's explicit 2026-07-28 decision, Tasks #494-505 (12 findings — a fresh doc-comment overclaim, an unapplied diagnosability fix, a Rule 23 test recreation, a latent async gap, a vacuous test assertion, and several precision/architecture nits) were accepted as debt rather than chased further, given diminishing returns after 11 audit cycles on a small, low-risk area of the codebase. Batch 12's remediation cycle is now CLOSED — see debt.md for all 12 accepted entries.
Re-audit (2026-07-10) FAILed severity 8 — 33 findings (F001-F033) promoted as Task #295-#327 below; all 37 COMPLETE as of 2026-07-13 (Waves 11-12 + Task #326).
Second re-audit (2026-07-13, 8-agent: A/B/S/N/K/W/V/Red-R) FAILed severity 7 — 49 findings (F001-F049, new numbering) promoted as Task #328-#376 below. Wave 13 (4 streams: Adam/Barry/Charles/Derek) closed 45/46 assigned tasks 2026-07-14, independently re-verified against actual source (not agent say-so) on 2026-07-14: tsc clean, 1168/1168 tests pass, lint clean (2 pre-existing warnings), weak-assertion gate clean, coverage above threshold. Task #357 is DEFERRED, not complete — see its entry below. Tasks #345, #361, #368 were correctly deferred out of Wave 13 (blocked by tasks that are now complete) but their full task text did not persist to tasks.md before this reconciliation and needs regeneration before Wave 14 — see note after Task #376. A scope-drift issue was also found during verification: Derek (Stream W13D) populated the real production `SPECIALTY_PACKS` array in lib/langRegistry.ts with a live `it-medical` entry (previously `Object.freeze([])`) — this was not the literal scope of any assigned task (misattributed to #331 in his completion report; #331's actual scope was a doc-header fix, which is separately verified correct) and deviates from this codebase's long-documented "empty until real content ships" convention. The entry is functionally inert (`ready: false` keeps `isSpecialtyPackCode` returning false) but is a real, undiscussed production change flagged here for Max's awareness — not reverted, since reverting would break Task #335's new test coverage of the `&& sp.ready` guard.
Remediation gate CLOSED 2026-07-28 via explicit Max decision (accept-as-debt), not a clean re-audit — after 11 audit cycles the remaining findings were judged diminishing-returns nitpicks on a small, low-risk area rather than worth a 12th cycle. Batch 19 (paused since Wave 11) resumes as [CURRENT SPRINT].
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

### Task #295: Fix requirements: purchaseAddOn calls invoke('verify_addon_receipt', {code, receiptToken}); that Tauri comma

**File:** store/entitlementStore.ts
**Complexity:** 🔧 Full — needs an owner decision before any fix: either implement the real verify_addon_receipt Tauri command (new src-tauri Rust code + generate_handler! registration), or leave the backend unbuilt and instead wire a real frontend purchase path (BuyModal/LanguageGrid changes) so purchaseAddOn has an actual caller
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Adam: Option C — documented deliberate deferral (no Rust command, no frontend wiring); purchaseAddOn remains an intentionally unreachable stub until specialty content ships)

**What:**
purchaseAddOn calls invoke('verify_addon_receipt', {code, receiptToken}); that Tauri command does not exist anywhere in src-tauri's generate_handler! list or license.rs. No runtime can ever return {ok:true}. Also has zero callers outside tests/ -- LanguageGrid's locked specialty-tile CTA opens the generic BuyModal with no per-add-on code or receipt-delivery mechanism. Violates Rule 20. at store/entitlementStore.ts:purchaseAddOn:163.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:163
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F001 — severity 8 — requirements

---

### Task #296: Fix requirements: The early return for STATIC_PACKS[targetLang] means loadPack is never invoked for lang 'it

**File:** hooks/useLangPack.ts
**Complexity:** 🔧 Full — 3+ files and an architectural decision: either route Italian's static content through loadPack/memCache (touches hooks/useLangPack.ts, lib/packLoader.ts, and how content/index.ts's bundled data enters memCache), or redesign loadSpecialtyPack's precondition so it doesn't require the base pack to be in memCache for statically-bundled languages (lib/specialtyPackLoader.ts + lib/packLoader.ts) — not a single-file fix either way
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Adam: seedMemCache added to lib/packLoader.ts, called from hooks/useLangPack.ts static-pack path (Option A))

**What:**
The early return for STATIC_PACKS[targetLang] means loadPack is never invoked for lang 'it' in production because Italian is served from bundled content, so memCache is never populated with an 'it' entry via any real call path. loadSpecialtyPack's precondition can never be satisfied through the real useLangPack entry point, so any it-* specialty pack always returns base_pack_not_loaded for a real user. at hooks/useLangPack.ts:useLangPack effect:69.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:useLangPack effect:69
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F002 — severity 8 — requirements

---

### Task #297: Fix code-quality: The header states 'the structure is in place for when content arrives', without disclosing

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Barry: module header corrected to describe seedMemCache populating memCache["it"] for the specialty-pack precondition)

**What:**
The header states 'the structure is in place for when content arrives', without disclosing that the Italian early-return means loadPack('it',...) is never called in the running app, so the described structure cannot function for the base language every documented specialty-pack example targets. Violates Rule 2. at lib/packLoader.ts:module header:24.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:module header:24
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F003 — severity 6 — code-quality

---

### Task #298: Fix error-handling: 9 error log call sites omit Date.now() from their ref IDs, violating Rule 8's timestamp fo

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Barry: Date.now() timestamps added to 5 surviving error-log call sites post-#299 dedup)

**What:**
9 error log call sites omit Date.now() from their ref IDs, violating Rule 8's timestamp format. The sibling files lib/packCache.ts and lib/packLoader.ts both timestamp every equivalent error. at lib/specialtyPackLoader.ts:multiple error-log call sites:45.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/specialtyPackLoader.ts:multiple error-log call sites:45
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F004 — severity 3 — error-handling

---

### Task #299: Fix code-quality: Reimplements lib/packCache.ts's cache I/O layer nearly line-for-line with identical store 

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Barry: specialtyPackLoader.ts's duplicate cache I/O layer deleted, now imports from lib/packCache.ts)

**What:**
Reimplements lib/packCache.ts's cache I/O layer nearly line-for-line with identical store name and key prefixes, even though packCache.ts's functions are already generic and work unmodified for specialty codes. This is the duplication anti-pattern packCache.ts (Task #275) was extracted to eliminate. at lib/specialtyPackLoader.ts:getStorage/readCacheMeta/writeCacheMeta/readCacheData/writeCacheData:21.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:getStorage/readCacheMeta/writeCacheMeta/readCacheData/writeCacheData:21
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F005 — severity 7 — code-quality

---

### Task #300: Fix code-quality: lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than dupl

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Adam: hasAddOn now delegates to lib/entitlement.ts's libHasAddOn instead of reimplementing the check)

**What:**
lib/entitlement.ts's hasAddOn doc comment directs this action to delegate rather than duplicate; instead it independently reimplements the identical check. lib/entitlement.ts's own hasAddOn has zero callers outside tests/. at store/entitlementStore.ts:hasAddOn:157.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:hasAddOn:157
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F006 — severity 3 — code-quality

---

### Task #301: Fix requirements: Became orphaned after Task #278 rewrote LanguageGrid.tsx to filter SPECIALTY_PACKS directl

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Charles: orphaned getSpecialtyPacks removed from lib/langRegistry.ts)

**What:**
Became orphaned after Task #278 rewrote LanguageGrid.tsx to filter SPECIALTY_PACKS directly instead of calling this function; zero callers outside tests/. at lib/langRegistry.ts:getSpecialtyPacks:83.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/langRegistry.ts:getSpecialtyPacks:83
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F007 — severity 2 — requirements

---

### Task #302: Fix error-handling: Once a specialty code becomes the active target language, this logs a false-positive [ERR-

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Barry: getLanguageConfig now extracts the base-language portion before the first hyphen and returns that config silently for specialty codes)

**What:**
Once a specialty code becomes the active target language, this logs a false-positive [ERR-LANG-CONFIG-UNKNOWN] error on every render for a legitimately registered specialty pack code. at lib/language.ts:getLanguageConfig:117.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/language.ts:getLanguageConfig:117
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F008 — severity 3 — error-handling

---

### Task #303: Fix code-quality: The cross-tab race mitigation defends against two browser tabs both completing a purchase,

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Adam: cross-tab comment corrected to describe the actual current use case, cross-referencing #295's finding)

**What:**
The cross-tab race mitigation defends against two browser tabs both completing a purchase, a scenario that per F001 cannot occur today because purchaseAddOn cannot succeed in any runtime. at store/entitlementStore.ts:_handleCrossTabStorageEvent:199.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:199
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F009 — severity 2 — code-quality

---

### Task #304: Fix async: The cross-tab fix fires rehydrate() fire-and-forget with no lock or serialization against 

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Adam: _rehydrateInFlight flag added to _handleCrossTabStorageEvent, deduplicating concurrent rehydrate() calls)

**What:**
The cross-tab fix fires rehydrate() fire-and-forget with no lock or serialization against a concurrent purchaseAddOn set() call, so the doc comment's guarantee against a lost-write race is not actually met. Tests only assert rehydrate is called, never that the race itself is closed. at store/entitlementStore.ts:_handleCrossTabStorageEvent:209.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:209
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F010 — severity 6 — async

---

### Task #305: Fix tests: The real production addEventListener('storage', ...) registration is never exercised by an

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Derek: tests/entitlementStoreEventWiring.test.ts (new) dispatches real StorageEvent on window)

**What:**
The real production addEventListener('storage', ...) registration is never exercised by any test; all tests call the handler directly as a plain function and never dispatch a real StorageEvent on window. Violates Rule 20a. at store/entitlementStore.ts:_handleCrossTabStorageEvent:216.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:216
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F011 — severity 4 — tests

---

### Task #306: Fix feature-flag: NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS bypasses the canonical lib/featureFlags.ts module: not a

**File:** Multiple — see What (lib/featureFlags.ts needs the new flag added to FeatureFlags/getFeatureFlags(); components/LanguageGrid.tsx needs to call the canonical parseFlag-based accessor instead of its ad hoc inline check)
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope flag-wiring fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Charles: specialtyPacks added to FeatureFlags/getFeatureFlags(); LanguageGrid.tsx now reads the canonical accessor instead of an inline env check)

**What:**
NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS bypasses the canonical lib/featureFlags.ts module: not added to FeatureFlags/getFeatureFlags(), and parses the raw env var inline instead of the shared parseFlag(), which treats 'false'/'0'/'off'/'no' as disabled. Setting this flag to 'off' or '0' silently does nothing. at components/LanguageGrid.tsx:specialtyPacksEnabled:29.
NEW

**Acceptance Criteria:**
- [ ] Fix feature-flag issue at components/LanguageGrid.tsx:specialtyPacksEnabled:29
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F012 — severity 6 — feature-flag

---

### Task #307: Fix code-quality: Comment claims a kill switch without requiring a deploy, but next.config.ts sets output:'e

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Charles: stale "kill switch without requiring a deploy" comment corrected — NEXT_PUBLIC_* vars are inlined at build time under output:'export')

**What:**
Comment claims a kill switch without requiring a deploy, but next.config.ts sets output:'export' (fully static build, no server); Next.js inlines NEXT_PUBLIC_* env vars at build time, so there is no running process whose env var can be flipped post-deploy. at components/LanguageGrid.tsx:specialtyPacksEnabled:33.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.tsx:specialtyPacksEnabled:33
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F013 — severity 6 — code-quality

---

### Task #308: Fix requirements: onUpgradeClick takes zero arguments; sp.code is in scope in the same closure and correctly

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Charles: onUpgradeClick now takes an optional code param; both LanguageGrid call sites updated to pass it (also resolved the cross-wave TS mismatch))

**What:**
onUpgradeClick takes zero arguments; sp.code is in scope in the same closure and correctly used for onSelect/hasAddOn, but the locked-tile handler discards it. Even if a future caller wires purchaseAddOn to this callback, the signature cannot identify which specialty pack triggered it. at components/LanguageGrid.tsx:LanguageGrid Props:23.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:LanguageGrid Props:23
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F014 — severity 6 — requirements

---

### Task #309: Fix security: _mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-writ

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Barry: _mergeFromJson now writes meta before data so a partial write leaves a safe meta-without-data state, not an unverified orphan)

**What:**
_mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-write failure can leave orphaned data-without-meta on disk. A later load with no manifest entry available merges the orphaned cachedData with zero hash verification anywhere in the call path. at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F015 — severity 7 — security

---

### Task #310: Fix async: A non-null assertion on memCache.get(baseLang) is reachable after multiple awaits inside _

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Barry: non-null assertion on memCache.get(baseLang) replaced with explicit null check in _mergeFromJson)

**What:**
A non-null assertion on memCache.get(baseLang) is reachable after multiple awaits inside _doLoad. Concurrent eviction during that window makes the assertion lie and throws a TypeError that propagates through the inFlight-chained promise, failing any other specialty load chained behind it. at lib/specialtyPackLoader.ts:_mergeFromJson:152.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/specialtyPackLoader.ts:_mergeFromJson:152
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F016 — severity 7 — async

---

### Task #311: Fix tests: Uses .toBeDefined()/.toBeGreaterThan(0) on deterministic mocked values with no existence-c

**File:** hooks/useLangPack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Derek: existence-only assertions in useLangPack.test.ts hardened to exact values; one non-deterministic assertion marked with existence-check comment)

**What:**
Uses .toBeDefined()/.toBeGreaterThan(0) on deterministic mocked values with no existence-check comment. AGENTS.md's Verification Gate greps only tests/, which does not reach co-located hooks/*.test.ts or components/*.test.tsx, so this batch's UI/hook test additions are exempt from the project's test-quality gate. at hooks/useLangPack.test.ts:test suite:83.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useLangPack.test.ts:test suite:83
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.test.ts

**Source:** Audit finding F017 — severity 6 — tests

---

### Task #312: Fix security: parseBackup validates unlockedPacks against isValidPackCode but filters purchasedAddOns on

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Derek: parseBackup now filters purchasedAddOns through isSpecialtyPackCode, not just string-typing)

**What:**
parseBackup validates unlockedPacks against isValidPackCode but filters purchasedAddOns only to string type, no isSpecialtyPackCode check. setEntitlement spreads every property in data including purchasedAddOns. A hand-edited backup JSON imported through the live Settings import UI can inject any string into purchasedAddOns with zero validation and zero receipt check. Violates Rule 17b. at lib/importBackup.ts:parseBackup:122.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/importBackup.ts:parseBackup:122
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F018 — severity 8 — security

---

### Task #313: Fix code-quality: Comment frames packLoader's inline check as a delegation not yet performed, but packLoader

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Charles: isReadySpecialtyPackCode doc comment corrected — delegation already performed (Task #266))

**What:**
Comment frames packLoader's inline check as a delegation not yet performed, but packLoader.ts already performed that delegation in this same diff under Task #266. at lib/langRegistry.ts:isReadySpecialtyPackCode:99.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isReadySpecialtyPackCode:99
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F019 — severity 2 — code-quality

---

### Task #314: Fix tests: This seam test's beforeEach unconditionally mocks invoke to return true; deleting the rece

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Derek: seam test now asserts invoke was called with the exact verify_addon_receipt args)

**What:**
This seam test's beforeEach unconditionally mocks invoke to return true; deleting the receipt-verification block inside purchaseAddOn does not change the test's outcome. The test's own name claims 'end-to-end' coverage, a specific falsifiable claim the assertions do not actually prove. at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F020 — severity 6 — tests

---

### Task #315: Fix tests: The same seam test's beforeEach also unconditionally mocks isSpecialtyPackCode to return t

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Derek: same seam test now asserts isSpecialtyPackCode was called with the exact code)

**What:**
The same seam test's beforeEach also unconditionally mocks isSpecialtyPackCode to return true; deleting the code-validation branch inside purchaseAddOn likewise does not change the outcome. at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:seam: purchaseAddOn to purchasedAddOns to hasAddOn (#284):1114
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F021 — severity 4 — tests

---

### Task #316: Fix edge-case: Validates only that units is an array, each unit is an object, unit.id is a string, and un

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Charles: hasValidUnitsArray now validates unit.name plus every card element's id/type/prompt/accepted/tags/tier shape)

**What:**
Validates only that units is an array, each unit is an object, unit.id is a string, and unit.cards is an array. Downstream code accesses many more fields never checked, and card array elements' shapes are never validated at all. at lib/packTypes.ts:hasValidUnitsArray:57.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:57
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F022 — severity 5 — edge-case

---

### Task #317: Fix edge-case: Validates registration only, not the .ready flag; purchaseAddOn uses this as its only code

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Charles: isSpecialtyPackCode now also checks .ready)

**What:**
Validates registration only, not the .ready flag; purchaseAddOn uses this as its only code-validity gate before persisting into purchasedAddOns, a field with no removal path. at lib/langRegistry.ts:isSpecialtyPackCode:91.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/langRegistry.ts:isSpecialtyPackCode:91
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F023 — severity 3 — edge-case

---

### Task #318: Fix code-quality: The USED BY list names three app pages that grep confirms do not import from lib/langRegis

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Charles: module header USED BY list corrected via real grep)

**What:**
The USED BY list names three app pages that grep confirms do not import from lib/langRegistry directly, and omits lib/specialtyPackLoader.ts which does directly import SPECIALTY_PACKS. at lib/langRegistry.ts:module header:1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:module header:1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F024 — severity 5 — code-quality

---

### Task #319: Fix edge-case: Doc comment claims an evicted base pack can never have its merge state left dangling; fals

**File:** Multiple — see What (lib/packCache.ts's clearPackCache needs to also clear each pruned specialty code's own persisted storage keys, which requires a new or extended export from lib/specialtyPackLoader.ts to enumerate specialty codes pruned by clearSpecialtyPacksForLang)
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Barry: clearSpecialtyPacksForLang now returns pruned codes; clearPackCache clears each pruned specialty code's own storage keys)

**What:**
Doc comment claims an evicted base pack can never have its merge state left dangling; false with respect to platform storage. Each specialty pack has its own persisted storage keys separate from the in-memory merge, and clearPackCache never clears them. at lib/packCache.ts:clearPackCache:129.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packCache.ts:clearPackCache:129
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F025 — severity 5 — edge-case

---

### Task #320: Fix code-quality: The header's Inputs list omits the purchasedAddOns parameter that loadSpecialtyPack actual

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Barry: module header Inputs list updated to include purchasedAddOns)

**What:**
The header's Inputs list omits the purchasedAddOns parameter that loadSpecialtyPack actually receives and depends on. at lib/specialtyPackLoader.ts:module header:3.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:module header:3
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F026 — severity 3 — code-quality

---

### Task #321: Fix tests: Deleting the same-code in-flight short-circuit does not fail this test, because the indepe

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Charles: same-code dedup test now asserts Promise reference equality (p1 === p2) via loadSpecialtyPack directly, distinguishing it from cross-code serialization)

**What:**
Deleting the same-code in-flight short-circuit does not fail this test, because the independently-present cross-code serialization mechanism produces the identical observable result even with the same-code check deleted. at tests/packLoader.test.ts:#264 same-code: two concurrent loads issue only one fetch:1019.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/packLoader.test.ts:#264 same-code: two concurrent loads issue only one fetch:1019
- [ ] Audit passes: bash scripts/deep-audit.sh tests/packLoader.test.ts

**Source:** Audit finding F027 — severity 6 — tests

---

### Task #322: Fix security: receiptToken is forwarded to invoke() with zero format, length, or non-empty validation be

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-13 (Wave 12 — Adam: !receiptToken.trim() guard added before IPC call, returns ERR_ADDON_RECEIPT_INVALID)

**What:**
receiptToken is forwarded to invoke() with zero format, length, or non-empty validation before the IPC call; there is no established input-sanitization boundary for it. at store/entitlementStore.ts:purchaseAddOn:163.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:purchaseAddOn:163
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F028 — severity 3 — security

---

### Task #323: Fix error-handling: getTargetLangCode can return an arbitrary hyphen-suffix string from a corrupted stored val

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Adam: corrupted rawTargetLang detected + repaired via setTargetLangCode("it") in useLangPack)

**What:**
getTargetLangCode can return an arbitrary hyphen-suffix string from a corrupted stored value; getLanguageConfig falls back to ITALIAN and logs on every render where targetLang changes, producing continuous console-error spam rather than a one-time repair. at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES usage / getLanguageConfig:16.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES usage / getLanguageConfig:16
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F029 — severity 5 — error-handling

---

### Task #324: Fix error-handling: invalid_lang is now returned for two semantically unrelated conditions: an unregistered/un

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Adam: invalid_lang disambiguated via isReadySpecialtyPackCode — "Add-on not purchased." message)

**What:**
invalid_lang is now returned for two semantically unrelated conditions: an unregistered/unready pack code, and a registered ready unpurchased specialty pack. Both surface identically as 'Pack not available'. at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES:16.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:LOAD_PACK_ERROR_MESSAGES:16
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F030 — severity 5 — error-handling

---

### Task #325: Fix error-handling: Silently accepts any specialty code as a no-op with only a console.warn; the function sign

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Adam: console.error added alongside console.warn in evictPack for specialty codes)

**What:**
Silently accepts any specialty code as a no-op with only a console.warn; the function signature implies eviction always occurs, but for a specialty code it never evicts anything and still resolves successfully. at lib/packLoader.ts:evictPack:249.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:249
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F031 — severity 3 — error-handling

---

### Task #326: Fix security: The claim that clearEntitlement clears in-memory specialty pack state after deactivation i

**File:** Multiple — see What (store/entitlementStore.ts's clearEntitlement needs to actually evict merged specialty content from memCache, which requires calling into lib/packLoader.ts's or lib/packCache.ts's eviction path rather than only resetting clearSpecialtyCache's bookkeeping arrays)
**Complexity:** 🔧 Full — re-classified 2026-07-13 by /task Gate 1: File field is "Multiple" and the fix is a functional security change (memCache eviction on deactivation), not cosmetic
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-13 (clearEntitlement now evicts affected base packs from memCache + their specialty storage keys via evictPack before the final clearSpecialtyCache() sweep; independent review caught and fixed a real ordering bug in the first draft that would have defeated #319's storage-key pruning; clearEntitlement is now () => Promise<void>, awaited by its one caller. 2 lower-severity findings logged to debt.md.)

**What:**
The claim that clearEntitlement clears in-memory specialty pack state after deactivation is false -- clearSpecialtyCache only resets bookkeeping arrays, never touches memCache. A deactivated user's session retains full access to previously-merged specialty content via loadPack's memory-cache-hit fast path, which never consults purchasedAddOns. at store/entitlementStore.ts:clearEntitlement:129.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:clearEntitlement:129
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F032 — severity 7 — security

---

### Task #327: Fix edge-case: The langPair restore regex was not updated for hyphenated specialty codes even though the 

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-10 (Wave 11 — Derek: importBackup.ts langPair regex fixed for hyphenated specialty codes + console.error added)

**What:**
The langPair restore regex was not updated for hyphenated specialty codes even though the sibling parser getTargetLangCode was specifically fixed for this same truncation bug in this batch. A backup restore for a user with an active specialty-pack selection silently resets to en-it with no console.error. at lib/importBackup.ts:parseBackup (langPair restore):128.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/importBackup.ts:parseBackup (langPair restore):128
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F033 — severity 6 — edge-case

---

### Task #328: Fix architecture: Genuine circular ES-module dependency between two lib/ files (packCache imports clearSpeci

**File:** lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21
**Complexity:** 🔧 Full — Multiple files/locations, see What
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: moved loadedAddOns + management functions from specialtyPackLoader.ts to packCache.ts; clearSpecialtyCache stays in specialtyPackLoader.ts since off-limits store/entitlementStore.ts imports it from there)

**What:**
Genuine circular ES-module dependency between two lib/ files (packCache imports clearSpecialtyPacksForLang from specialtyPackLoader; specialtyPackLoader imports 5 symbols from packCache). Violates Rule 3 (Layers Down Only) and Rule 6 (Extract Ready) -- neither module can be extracted independently. Neither file's header acknowledges the cycle. at lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21:module-level imports.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at lib/packCache.ts:18 + lib/specialtyPackLoader.ts:14-21:module-level imports
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F001 — severity 6 — architecture

---

### Task #329: Fix documentation-trust: Header claims '@internal Used by lib/packLoader.ts. Not part of the module's external publ

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry)

**What:**
Header claims '@internal Used by lib/packLoader.ts. Not part of the module's external public API' -- false as of this batch; lib/specialtyPackLoader.ts also imports readCacheMeta/writeCacheMeta/readCacheData/writeCacheData/clearPackCache directly. at lib/packCache.ts:module header:14.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/packCache.ts:module header:14
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F002 — severity 5 — documentation-trust

---

### Task #330: Fix documentation-trust: CLAUDE.md states lib/langRegistry.ts exports getSpecialtyPacks(lang); this export does not

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: removed stale getSpecialtyPacks reference, documented isSpecialtyPackCode as canonical, isReadySpecialtyPackCode as alias pending #361)

**What:**
CLAUDE.md states lib/langRegistry.ts exports getSpecialtyPacks(lang); this export does not exist in the current file (deleted this batch by Task #301). at CLAUDE.md:Section 6:0.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at CLAUDE.md:Section 6:0
- [ ] Audit passes: bash scripts/deep-audit.sh CLAUDE.md

**Source:** Audit finding F003 — severity 5 — documentation-trust

---

### Task #331: Fix documentation-trust: USED BY header omits hooks/useLangPack.ts, which imports isValidPackCode, SPECIALTY_PACKS,

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: hooks/useLangPack.ts added to USED BY header, verified present in current file. NOTE: Derek's own completion.md misattributes an unrelated, unauthorized change to this task number — see Batch 12 header note above re: SPECIALTY_PACKS production-array population)

**What:**
USED BY header omits hooks/useLangPack.ts, which imports isValidPackCode, SPECIALTY_PACKS, isReadySpecialtyPackCode directly. at lib/langRegistry.ts:module header:10.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/langRegistry.ts:module header:10
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F004 — severity 5 — documentation-trust

---

### Task #332: Fix code-quality: isSpecialtyPackCode and isReadySpecialtyPackCode are byte-identical implementations under

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: isReadySpecialtyPackCode made a const alias of isSpecialtyPackCode; both names still exported for off-limits callers)

**What:**
isSpecialtyPackCode and isReadySpecialtyPackCode are byte-identical implementations under two different names with different call sites -- duplicated logic that will silently diverge. Highest-convergence finding in the batch -- 5 independent auditors (A, K, N, Red R, V) flagged this identical issue. at lib/langRegistry.ts:isSpecialtyPackCode/isReadySpecialtyPackCode:88.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isSpecialtyPackCode/isReadySpecialtyPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F005 — severity 6 — code-quality

---

### Task #333: Fix code-quality: Mock still defines getSpecialtyPacks: () => [] though the real module no longer exports it

**File:** components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: removed stale getSpecialtyPacks mock)

**What:**
Mock still defines getSpecialtyPacks: () => [] though the real module no longer exports it -- stale mock left behind after removal. at components/LanguageGrid.test.tsx:vi.mock("@/lib/langRegistry"):49.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.test.tsx:vi.mock("@/lib/langRegistry"):49
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F006 — severity 4 — code-quality

---

### Task #334: Fix requirements: Task #308 widened onUpgradeClick to (code?: string) => void and LanguageGrid calls onUpgra

**File:** components/LanguageGrid.tsx:24,135 + app/page.tsx:79
**Complexity:** 🔧 Full — kept Full 2026-07-13 by /advance Complexity Audit despite only 2 files: this is a real product/architecture decision (does the code param wire to a real purchase flow via BuyModal, or get documented as an intentional no-op like #295?), not a mechanical fix — highest-severity (7), 5-auditor-convergence finding in this re-audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: Option B — app/page.tsx documents the intentional discard via underscore-prefixed `_code` param; wire-through deferred until specialty pricing exists, verified present in current code)

**What:**
Task #308 widened onUpgradeClick to (code?: string) => void and LanguageGrid calls onUpgradeClick(sp.code), but the only production caller (app/page.tsx:79) discards the argument entirely via a zero-arg closure -- Rule 20 violation (type-signature-only fix, no real caller wired). Five independent auditors (A, K, N, Red R, V) converged on this. at components/LanguageGrid.tsx:24,135 + app/page.tsx:79:onUpgradeClick.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:24,135 + app/page.tsx:79:onUpgradeClick
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F007 — severity 7 — requirements

---

### Task #335: Fix tests: Never mocks a SPECIALTY_PACKS entry with ready:false, so isSpecialtyPackCode's && sp.ready

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: added test exercising the && sp.ready clause via Deletion Test — deleting the clause makes isSpecialtyPackCode("it-medical") return true, failing the test)

**What:**
Never mocks a SPECIALTY_PACKS entry with ready:false, so isSpecialtyPackCode's && sp.ready clause is never exercised against a real conditional -- deleting it breaks no test (Rule 18 violation). at tests/langRegistry.test.ts:SpecialtyPack registry describe block:70.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:SpecialtyPack registry describe block:70
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F008 — severity 5 — tests

---

### Task #336: Fix tests: Task #322's empty-receiptToken rejection has zero test coverage anywhere in tests/entitlem

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
Task #322's empty-receiptToken rejection has zero test coverage anywhere in tests/entitlement.test.ts -- deleting the guard breaks nothing. at store/entitlementStore.ts:purchaseAddOn:228.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at store/entitlementStore.ts:purchaseAddOn:228
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F009 — severity 5 — tests

---

### Task #337: Fix code-quality: seedMemCache takes an unvalidated lang:string and writes directly to the memCache singleto

**File:** lib/packLoader.ts:250-266 + :270-275
**Complexity:** ⚡ Direct — 1 file (both locations are within lib/packLoader.ts), relabeled 2026-07-13 by /advance Complexity Audit — original label over-counted line-range citations as separate files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: guard added before memCache.has(lang) idempotency check — unregistered code rejected outright, not silently cached)

**What:**
seedMemCache takes an unvalidated lang:string and writes directly to the memCache singleton with no isValidPackCode/READY_PACK_CODES check, silently invalidating getInstalledPacks' documented invariant that memCache is only ever populated via validated writes. at lib/packLoader.ts:250-266 + :270-275:seedMemCache / getInstalledPacks.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:250-266 + :270-275:seedMemCache / getInstalledPacks
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F010 — severity 5 — code-quality

---

### Task #338: Fix documentation-trust: clearEntitlement's final-sweep comment claims clearSpecialtyCache() handles the case of a

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
clearEntitlement's final-sweep comment claims clearSpecialtyCache() handles the case of a specialty pack whose registry entry was removed between merge and deactivation -- false; that orphaned base language is also excluded from affectedBaseLangs (its SPECIALTY_PACKS.find() returns undefined), so evictPack never runs for it either. The memCache-eviction guarantee that is the entire point of Task #326 does not extend to this case, though the comment implies it does. at store/entitlementStore.ts:clearEntitlement:188.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:clearEntitlement:188
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F011 — severity 5 — documentation-trust

---

### Task #339: Fix code-quality: console.error and setTargetLangCode (a localStorage write) execute directly in the hook's

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
console.error and setTargetLangCode (a localStorage write) execute directly in the hook's render body rather than inside a useEffect -- impure render function; under double-invoked renders (StrictMode) this can fire more than once, contradicting the adjacent comment's claim of 'at most once per corrupt value.' at hooks/useLangPack.ts:useLangPack:58.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useLangPack.ts:useLangPack:58
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F012 — severity 4 — code-quality

---

### Task #340: Fix architecture: Repeated, still-unfixed violation of CLAUDE.md Section 3 (localStorage must route through

**File:** lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67
**Complexity:** ⚡ Direct — 2 files, no package boundary, mechanical fix following the existing createPlatformStorage pattern — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
Repeated, still-unfixed violation of CLAUDE.md Section 3 (localStorage must route through lib/storage.ts) -- first flagged in the original 2026-07-09 Batch 12 audit. A second, previously-undetected instance found this cycle in hooks/useExportImport.ts, indicating the violation is systemic rather than contained to one file. at lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67:getTargetLangCode/setTargetLangCode.
NEW

**Acceptance Criteria:**
- [ ] Fix architecture issue at lib/constants.ts:16-34 + hooks/useExportImport.ts:25,67:getTargetLangCode/setTargetLangCode
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F013 — severity 6 — architecture

---

### Task #341: Fix error-handling: A fully garbage/unregistered code (neither a valid base pack code nor a registered special

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles)

**What:**
A fully garbage/unregistered code (neither a valid base pack code nor a registered specialty pack) silently no-ops with zero console output -- no warn, no error -- violating Rule 8 (Log Everything). at lib/packLoader.ts:evictPack:294.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:294
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F014 — severity 4 — error-handling

---

### Task #342: Fix security: Restoring a backup calls setEntitlement({...result.entitlement, licenseKey, instanceId}),

**File:** hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope type-contract fix — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: setEntitlement's contract fixed to accept exactly 5 fields; purchasedAddOns intentionally absent — see #343)

**What:**
Restoring a backup calls setEntitlement({...result.entitlement, licenseKey, instanceId}), which includes purchasedAddOns; setEntitlement blindly spreads it into state with no purchaseAddOn/verify_addon_receipt call. Bounded by the honour-system entitlement model (CLAUDE.md Section 5) and purchaseAddOn's currently-dormant stub status (Task #295), but a real consistency gap worth closing before specialty content ships. at hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146:setEntitlement (backup restore path).
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at hooks/useExportImport.ts:78-81 + store/entitlementStore.ts:82-100,146:setEntitlement (backup restore path)
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useExportImport.ts

**Source:** Audit finding F015 — severity 5 — security

---

### Task #343: Fix code-quality: setEntitlement's declared parameter type omits purchasedAddOns entirely even though the on

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: setEntitlement accepts only { licenseKey, instanceId, licenseType, unlockedPacks, validUntil } — purchasedAddOns intentionally excluded; backup restore cannot restore add-on purchases, by design)

**What:**
setEntitlement's declared parameter type omits purchasedAddOns entirely even though the only call site (hooks/useExportImport.ts) passes it via object spread -- the declared contract is narrower than actual runtime behavior. at store/entitlementStore.ts:setEntitlement (type signature):82.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:setEntitlement (type signature):82
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F016 — severity 4 — code-quality

---

### Task #344: Fix security: The v2->v3 migration filters purchasedAddOns to string-typed elements only with no isSpeci

**File:** store/migrations.ts:159-163 vs lib/importBackup.ts:119-124
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: isSpecialtyPackCode check added alongside typeof === "string" in the v2→v3 migration filter)

**What:**
The v2->v3 migration filters purchasedAddOns to string-typed elements only with no isSpecialtyPackCode registration/ready check, while lib/importBackup.ts validates both type AND registration for the identical field -- a real enforcement asymmetry between two code paths writing the same security-sensitive field. at store/migrations.ts:159-163 vs lib/importBackup.ts:119-124:ENTITLEMENT_MIGRATIONS v2->v3 / parseBackup.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/migrations.ts:159-163 vs lib/importBackup.ts:119-124:ENTITLEMENT_MIGRATIONS v2->v3 / parseBackup
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F017 — severity 5 — security

---

### Task #346: Fix code-quality: write() prunes in-memory add-on tracking via clearSpecialtyPacksForLang but never removes

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: extracted _clearSpecialtyStorageKeys shared helper — fire-and-forget in write(), awaited in clearPackCache())

**What:**
write() prunes in-memory add-on tracking via clearSpecialtyPacksForLang but never removes that code's own persisted storage keys, unlike clearPackCache which pairs the identical prune with storage-key removal -- a 5th instance of the exact bug class clearPackCache's own doc comment says 4 prior tasks (#250, #251, #253, #259) already forgot. at lib/packCache.ts:PackMemCacheImpl.write:51.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packCache.ts:PackMemCacheImpl.write:51
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F019 — severity 6 — code-quality

---

### Task #347: Fix async: Drops any storage event arriving while a rehydrate is in flight and never re-triggers rehy

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: _pendingRehydrate module flag added; _triggerRehydrate re-fires after settling if a storage event landed mid-rehydrate. Also closes #363)

**What:**
Drops any storage event arriving while a rehydrate is in flight and never re-triggers rehydrate() once it settles -- a second cross-tab write mid-rehydrate is never picked up until an unrelated future set() call happens to observe fresh state. at store/entitlementStore.ts:_handleCrossTabStorageEvent:293.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:293
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F020 — severity 5 — async

---

### Task #348: Fix edge-case: hasValidUnitsArray never checks that pack.unitCount/cardCount are numbers; _mergeFromJson

**File:** lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122
**Complexity:** ⚡ Direct — 1 file (lib/packTypes.ts's hasValidUnitsArray; specialtyPackLoader.ts is cited only as the downstream consumer showing impact, needs no edit) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: typeof !== "number" guards added for unitCount/cardCount)

**What:**
hasValidUnitsArray never checks that pack.unitCount/cardCount are numbers; _mergeFromJson computes unitCount/cardCount sums directly from these unvalidated fields -- a non-numeric value passes shape validation and silently string-concatenates instead of summing. at lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122:hasValidUnitsArray / _mergeFromJson.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:58-81 + lib/specialtyPackLoader.ts:117-122:hasValidUnitsArray / _mergeFromJson
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F021 — severity 4 — edge-case

---

### Task #349: Fix error-handling: receiptToken is validated only via .trim() non-empty check -- no max length or charset all

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: length cap + charset regex added, mirroring useLicenseActivation.ts's license-key validation)

**What:**
receiptToken is validated only via .trim() non-empty check -- no max length or charset allowlist, unlike the structurally identical license-key input in hooks/useLicenseActivation.ts which caps length and enforces a regex before any IPC call. at store/entitlementStore.ts:purchaseAddOn:232.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:purchaseAddOn:232
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F022 — severity 3 — error-handling

---

### Task #350: Fix security: The base-pack branch of loadPack has no entitlement check at all -- isPackUnlocked is enfo

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: FREE_PACK_CODES.some(c => c === lang) / unlockedLangs gate added to loadPack's base-pack branch, verified present in current code)

**What:**
The base-pack branch of loadPack has no entitlement check at all -- isPackUnlocked is enforced only at the UI layer (LanguageGrid.tsx, app/page.tsx), unlike the specialty-pack branch which independently re-checks purchasedAddOns inside specialtyPackLoader.ts. Real asymmetric defense-in-depth between the two pack types. at lib/packLoader.ts:loadPack:92.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/packLoader.ts:loadPack:92
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F023 — severity 5 — security

---

### Task #351: Fix error-handling: evictPack(...).catch() swallows failure and clearEntitlement's returned Promise always res

**File:** store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
evictPack(...).catch() swallows failure and clearEntitlement's returned Promise always resolves; handleDeactivate awaits it then unconditionally reports successful deactivation even if the underlying memCache eviction failed. at store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85:clearEntitlement / handleDeactivate.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:clearEntitlement:182-193 + hooks/useLicenseActivation.ts:84-85:clearEntitlement / handleDeactivate
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F024 — severity 5 — error-handling

---

### Task #352: Fix edge-case: 'All languages unlocked' is derived from unlockedPacks.length >= ALL_KNOWN_PACKS.length --

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: .every(c => unlockedPacks.includes(c)) membership check replacing length comparison)

**What:**
'All languages unlocked' is derived from unlockedPacks.length >= ALL_KNOWN_PACKS.length -- a length comparison, not a membership check. A hand-edited or migrated state with duplicate entries could trigger this incorrectly with no test coverage. at app/settings/page.tsx:SettingsPage:130.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/settings/page.tsx:SettingsPage:130
- [ ] Audit passes: bash scripts/deep-audit.sh app/settings/page.tsx

**Source:** Audit finding F025 — severity 3 — edge-case

---

### Task #353: Fix tests: The banned-weak-assertion grep gate is hard-scoped to tests/ --include=*.test.* only, but

**File:** AGENTS.md Verification Gate + components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix (widen grep scope + fix the specific assertions it now catches) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: widening the grep gate to components/ was attempted then reverted — 30+ pre-existing violations exist in off-limits component test files that cannot be remediated in this wave. Gate stays scoped to tests/ where it is clean; documented as a known gap, not silently dropped)

**What:**
The banned-weak-assertion grep gate is hard-scoped to tests/ --include=*.test.* only, but Rule 14 mandates co-located component tests -- components/LanguageGrid.test.tsx contains 12+ banned-pattern assertions with no existence-check comments that are structurally invisible to the automated gate. at AGENTS.md Verification Gate + components/LanguageGrid.test.tsx:weak-assertion grep gate.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at AGENTS.md Verification Gate + components/LanguageGrid.test.tsx:weak-assertion grep gate
- [ ] Audit passes: bash scripts/deep-audit.sh AGENTS.md

**Source:** Audit finding F026 — severity 6 — tests

---

### Task #354: Fix data-loss: unlockedPacks/purchasedAddOns entries that fail validation are silently dropped via .filte

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: console.warn added with [IMPORT-SKIP-PACKS]/[IMPORT-SKIP-ADDONS] prefixes and specific dropped counts/values)

**What:**
unlockedPacks/purchasedAddOns entries that fail validation are silently dropped via .filter() with no log, no user-facing warning, and no counter analogous to validCardCount/skippedCardCount computed for cards two blocks above -- violates the stop-the-line rule against silently corrupting persisted user data. at lib/importBackup.ts:parseBackup:113.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/importBackup.ts:parseBackup:113
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F027 — severity 6 — data-loss

---

### Task #355: Fix tests: Every onUpgradeClick assertion checks only toHaveBeenCalled(), never toHaveBeenCalledWith(

**File:** components/LanguageGrid.test.tsx:129,143,159,203,232
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: rewrote for the licenseType prop added by Adam's #356; strengthened onUpgradeClick assertions to toHaveBeenCalledWith)

**What:**
Every onUpgradeClick assertion checks only toHaveBeenCalled(), never toHaveBeenCalledWith(...) -- including the specialty-tile test specifically covering Task #308's onUpgradeClick(sp.code) call. Proves the type change was never validated to actually matter (test-side half of F007). at components/LanguageGrid.test.tsx:129,143,159,203,232:onUpgradeClick assertions.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/LanguageGrid.test.tsx:129,143,159,203,232:onUpgradeClick assertions
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F028 — severity 6 — tests

---

### Task #356: Fix requirements: BRAND.md states specialty packs are sold as add-ons within the Pro tier, but the Add-ons s

**File:** components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix (add a licenseType/isProEnabled check to the existing visibility gate) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: licenseType prop added to LanguageGrid, isProEnabled(specialtyPacksEnabled, licenseType) gate added, verified present in current code)

**What:**
BRAND.md states specialty packs are sold as add-ons within the Pro tier, but the Add-ons section's visibility gate (isPackUnlocked(sp.baseLang) || hasAddOn(sp.code)) has no licenseType check at all -- once SPECIALTY_PACKS gains a ready entry, every it-* add-on becomes visible/purchasable to a user who has never held Pro. at components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110:specialtyPacks visibility gate / isPackUnlocked.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/LanguageGrid.tsx:29-42 + store/entitlementStore.ts:110:specialtyPacks visibility gate / isPackUnlocked
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F029 — severity 5 — requirements

---

### Task #357: Fix requirements: purchaseAddOn has no check that licenseType === "subscription" before persisting a purchas

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (Wave 14 — closed as a consequence of Barry's #388 fix, not by dedicated work under this number. #388's investigation found the Wave 13 deferral rationale above was stale — tests/entitlement.test.ts no longer calls purchaseAddOn with licenseType:"free" — and implemented the Pro gate at store/entitlementStore.ts:purchaseAddOn using isProEnabled(getFeatureFlags().specialtyPacks, get().licenseType). Independently verified 2026-07-17 by reading the current function body: the gate is real, correctly positioned before the receipt checks, and test-covered. See #388 and #395 for the same fix from two audit angles, and #381 for the ERR_ADDON_NOT_PRO branch this makes live.)

**What:**
purchaseAddOn has no check that licenseType === "subscription" before persisting a purchase, unlike app/stats/page.tsx (the other Pro-gated call site) which correctly routes through isProEnabled(flag, licenseType) as CLAUDE.md/AGENTS.md mandate for all Pro-gated features. at store/entitlementStore.ts:purchaseAddOn:221.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:221
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F030 — severity 5 — requirements

---

### Task #358: Fix async: clearPackCache awaits Promise.allSettled for storage removal BEFORE memCache.delete(lang);

**File:** lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192
**Complexity:** ⚡ Direct — 1 file (both cited functions are within lib/packCache.ts) — relabeled 2026-07-13 by /advance Complexity Audit
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: memCache.delete(lang) + clearSpecialtyPacksForLang(lang) moved before the Promise.allSettled await — both synchronous, complete atomically before async I/O begins)

**What:**
clearPackCache awaits Promise.allSettled for storage removal BEFORE memCache.delete(lang); a concurrent loadPack(lang) can complete its own memCache.write in that window and then have its freshly-loaded entry wiped -- no in-flight lock for base-pack loads analogous to specialtyPackLoader's inFlight Map. at lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192:clearPackCache.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/packCache.ts:clearPackCache:137-173 vs cacheAndReturn:189-192:clearPackCache
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F031 — severity 5 — async

---

### Task #359: Fix code-quality: The hyphen-split fallback is a third, weakest independent implementation of "is this a spe

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: console.warn added on the hyphen-fallback path — comment's "prevents silent masking" claim is now backed by an actual log statement)

**What:**
The hyphen-split fallback is a third, weakest independent implementation of "is this a specialty code" logic (alongside langRegistry.ts's two functions) -- accepts any hyphenated string with a matching registered base-language prefix regardless of whether the suffix is a real SPECIALTY_PACKS entry, and logs nothing on that path, contrary to the adjacent comment's claim of preventing silent masking. at lib/language.ts:getLanguageConfig:122.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/language.ts:getLanguageConfig:122
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F032 — severity 5 — code-quality

---

### Task #360: Fix code-quality: Zero callers outside its own export list and tests/packLoader.test.ts -- Rule 20b orphan-f

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: getInstalledPacks deleted entirely, along with its now-unused PackCode import — verified absent from current lib/packLoader.ts)

**What:**
Zero callers outside its own export list and tests/packLoader.test.ts -- Rule 20b orphan-function violation. at lib/packLoader.ts:getInstalledPacks:273.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:getInstalledPacks:273
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F033 — severity 3 — code-quality

---

### Task #362: Fix error-handling: useLangPack's useState initializer calls seedMemCache("it", ...) exactly once at mount wit

**File:** hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193
**Complexity:** 🔧 Full — kept Full 2026-07-13 by /advance Complexity Audit despite only 2 files: no clean fix pattern exists yet — either clearEntitlement must stop evicting the currently-active language's base memCache entry (no "unmerge specialty units only" primitive exists), or useLangPack needs a re-seed/recovery mechanism after eviction. Real architectural decision, not a mechanical fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: counter-based signal — non-persisted _cacheEvictionGeneration field on the store, incremented by clearEntitlement after eviction settles; useLangPack re-seeds via useEffect when the counter changes)

**What:**
useLangPack's useState initializer calls seedMemCache("it", ...) exactly once at mount with no re-seed mechanism; clearEntitlement's evictPack can wipe memCache["it"] out from under a still-mounted component. Any specialty-pack load attempted afterward in the same session permanently fails with base_pack_not_loaded until a full page reload, with nothing signaling why. at hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193:useLangPack useState initializer / clearEntitlement.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useLangPack.ts:73-84 + store/entitlementStore.ts:171-193:useLangPack useState initializer / clearEntitlement
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F035 — severity 6 — error-handling

---

### Task #363: Fix error-handling: useEntitlementStore.persist.rehydrate() is not wrapped in try/catch; a synchronous throw l

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam: _triggerRehydrate() wrapped in try/catch as part of the #347 fix — a synchronous throw no longer leaves _rehydrateInFlight stuck true forever)

**What:**
useEntitlementStore.persist.rehydrate() is not wrapped in try/catch; a synchronous throw leaves _rehydrateInFlight stuck true forever, permanently and silently disabling cross-tab sync for that tab. at store/entitlementStore.ts:_handleCrossTabStorageEvent:298.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at store/entitlementStore.ts:_handleCrossTabStorageEvent:298
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F036 — severity 5 — error-handling

---

### Task #364: Fix code-quality: clearEntitlement is a public store action reachable from anywhere; two concurrent invocati

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
clearEntitlement is a public store action reachable from anywhere; two concurrent invocations redundantly compute and evict the same base langs, relying on an undocumented idempotency assumption. at store/entitlementStore.ts:clearEntitlement:155.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:clearEntitlement:155
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F037 — severity 4 — code-quality

---

### Task #365: Fix documentation-trust: Doc comment claims p1===p2 holds via loadPack's return for concurrent same-code loads -- f

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: doc comment corrected — p1===p2 only holds for direct loadSpecialtyPack callers, not via async loadPack, which always wraps its return in a fresh Promise)

**What:**
Doc comment claims p1===p2 holds via loadPack's return for concurrent same-code loads -- false; loadPack is declared async and always wraps its return in a fresh Promise, so this is only true for direct loadSpecialtyPack calls. A contradicting comment in tests/packLoader.test.ts added in the same batch disagrees with this exact claim. at lib/specialtyPackLoader.ts:loadSpecialtyPack doc comment:269.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/specialtyPackLoader.ts:loadSpecialtyPack doc comment:269
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F038 — severity 5 — documentation-trust

---

### Task #366: Fix code-quality: if (!LANG_PAIR_RE.test(rawLangPair) && rawLangPair !== "en-it") -- since LANG_PAIR_RE matc

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles: dead conditional clause removed — verified LANG_PAIR_RE.test("en-it") already matches unconditionally)

**What:**
if (!LANG_PAIR_RE.test(rawLangPair) && rawLangPair !== "en-it") -- since LANG_PAIR_RE matches "en-it" unconditionally, the second clause can never be false when the first is true; dead/redundant conditional. at lib/importBackup.ts:parseBackup:130.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/importBackup.ts:parseBackup:130
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F039 — severity 3 — code-quality

---

### Task #367: Fix code-quality: The function's own doc comment documents 4 prior remediation tasks that each independently

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry: accretion-style doc comment replaced with a forward-looking design description of the _clearSpecialtyStorageKeys pattern)

**What:**
The function's own doc comment documents 4 prior remediation tasks that each independently forgot to pair cleanup logic; this batch's #319 extends the same function with a third bolted-on responsibility rather than a composable pattern, continuing the accretion its own history warns against. at lib/packCache.ts:clearPackCache:118.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packCache.ts:clearPackCache:118
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F040 — severity 3 — code-quality

---

### Task #369: Fix documentation-trust: USED BY header omits app/stats/page.tsx, which imports getFeatureFlags/isProEnabled direct

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: USED BY header updated to include components/LanguageGrid.tsx)

**What:**
USED BY header omits app/stats/page.tsx, which imports getFeatureFlags/isProEnabled directly. at lib/featureFlags.ts:module header:4.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/featureFlags.ts:module header:4
- [ ] Audit passes: bash scripts/deep-audit.sh lib/featureFlags.ts

**Source:** Audit finding F042 — severity 3 — documentation-trust

---

### Task #370: Fix documentation-trust: USED BY header is affirmatively false -- names app/learn/page.tsx and app/study/page.tsx a

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
USED BY header is affirmatively false -- names app/learn/page.tsx and app/study/page.tsx as importers though neither imports this module directly, while omitting six real direct importers (app/page.tsx, app/stats/page.tsx, hooks/useLangPack.ts, hooks/useExportImport.ts, hooks/useLicenseActivation.ts, components/EntitlementValidator.tsx). at store/entitlementStore.ts:module header:10.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:module header:10
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F043 — severity 5 — documentation-trust

---

### Task #371: Fix documentation-trust: DEPENDS ON header omits @/lib/specialtyPackLoader, @/lib/tauri, @/lib/licenseTypes despite

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Adam)

**What:**
DEPENDS ON header omits @/lib/specialtyPackLoader, @/lib/tauri, @/lib/licenseTypes despite all three being actually imported. at store/entitlementStore.ts:module header:8.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at store/entitlementStore.ts:module header:8
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F044 — severity 3 — documentation-trust

---

### Task #372: Fix documentation-trust: USED BY names app/settings/page.tsx, which does not import this module directly; the real

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles)

**What:**
USED BY names app/settings/page.tsx, which does not import this module directly; the real direct importer, hooks/useExportImport.ts, is not named anywhere. at lib/importBackup.ts:module header:9.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/importBackup.ts:module header:9
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F045 — severity 3 — documentation-trust

---

### Task #373: Fix documentation-trust: DEPENDS ON omits @/lib/specialtyPackLoader, @/lib/utils, @/lib/packTypes; USED BY omits st

**File:** lib/packLoader.ts:7-9,30
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Charles)

**What:**
DEPENDS ON omits @/lib/specialtyPackLoader, @/lib/utils, @/lib/packTypes; USED BY omits store/entitlementStore.ts, which imports evictPack and getLoadedAddOns from this module. at lib/packLoader.ts:7-9,30:module header.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/packLoader.ts:7-9,30:module header
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F046 — severity 3 — documentation-trust

---

### Task #374: Fix documentation-trust: "Called by" claim omits lib/packCache.ts (imports clearSpecialtyPacksForLang) and store/en

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry)

**What:**
"Called by" claim omits lib/packCache.ts (imports clearSpecialtyPacksForLang) and store/entitlementStore.ts (imports clearSpecialtyCache). at lib/specialtyPackLoader.ts:module header:5.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/specialtyPackLoader.ts:module header:5
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F047 — severity 3 — documentation-trust

---

### Task #375: Fix documentation-trust: "Imported by" claim omits lib/packCache.ts, which also imports hasValidUnitsArray, Pack, L

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Barry)

**What:**
"Imported by" claim omits lib/packCache.ts, which also imports hasValidUnitsArray, Pack, LoadPackResult, PackMemCache from this module. at lib/packTypes.ts:module header:5.
NEW

**Acceptance Criteria:**
- [ ] Fix documentation-trust issue at lib/packTypes.ts:module header:5
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F048 — severity 2 — documentation-trust

---

### Task #376: Fix tests: Every hasAddOn test checks only behavioral output (true/false), identical whether the stor

**File:** tests/entitlement.test.ts:1049,1060,1065,1324-1341
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-14 (Wave 13 — Derek: vi.spyOn(entitlementLib, "hasAddOn") delegation-proof test added, verified present in current tests/entitlement.test.ts)

**What:**
Every hasAddOn test checks only behavioral output (true/false), identical whether the store delegates to libHasAddOn or reverts to inline duplicated logic -- the Task #300 delegation itself is completely unproven by any test (Rule 18 violation). at tests/entitlement.test.ts:1049,1060,1065,1324-1341:hasAddOn tests.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:1049,1060,1065,1324-1341:hasAddOn tests
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F049 — severity 6 — tests

---

**Gap note (2026-07-14):** Findings F018 (#345), F034 (#361), and F041 (#368) from the 2026-07-13 re-audit were correctly identified as DEFERRED/blocked during Wave 13 planning (blocked respectively by #342/#343, #332, and #347 — all now complete) but their full verbatim task text was lost before this reconciliation and was not recovered from any surviving file (patterns.md and trends.md were also never updated with this audit's findings). These three findings are known to exist and are now unblocked, but must be re-derived — either by re-running a scoped audit pass over the affected files or by asking Max to accept the gap as debt — before Wave 14 planning treats this batch as fully accounted for.

**Third re-audit (2026-07-15, 7 scored agents: A/B/S/K/W/V/Red-R + unscored naive-reader lane N)** ran against Wave 13's committed state (commit 7a26598) FAILed severity 8 — 28 findings (F001-F028) promoted as Task #377-#404 below. Highest-convergence finding (severity 8, 6 of 7 scored auditors independently, plus naive-reader confirmation): `lib/packLoader.ts`'s Task #350 base-pack entitlement gate (`options.unlockedLangs`) has zero production callers — `hooks/useLangPack.ts`, the only real caller, never passes it, so the gate is a live no-op today only because the sole ready base pack ("it") is free. Second-highest (severity 7): selecting a specialty-pack tile never seeds its base pack into memCache, so `loadSpecialtyPack` would permanently fail with `base_pack_not_loaded` via that exact UI path once any specialty pack ships ready. Both are the same systemic pattern — a capability wired at the function-definition layer but never wired at its one real call site — that is this codebase's own historically highest-severity recurring class (Rule 20). Per BATCH_REMEDIATION_GATE, this batch remains `[CURRENT SPRINT]`.

### Task #377: Fix requirements: loadPack's non-free base-pack entitlement gate (unlockedLangs) has zero production callers

**File:** hooks/useLangPack.ts:111 + lib/packLoader.ts:126
**Complexity:** ⚡ Direct — 2 files, no package boundary, mechanical wire-through mirroring the already-correct purchasedAddOns pattern in the same call (thread useEntitlementStore's unlockedPacks into the existing loadPack call)
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit afae4f9)
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Rule 20b (orphan-caller) violation. loadPack's non-free base-pack entitlement gate at lib/packLoader.ts:126 checks `(options?.unlockedLangs ?? []).includes(lang)`, but the only production caller, hooks/useLangPack.ts:111, calls `loadPack(targetLang, manifest, { purchasedAddOns })` and never passes unlockedLangs. Dormant only because READY_PACK_CODES currently contains just "it", which is also free. The moment a second base pack ships ready:true, every legitimately-subscribed user hits invalid_lang forever. hooks/useLangPack.test.ts asserts against the broken call signature, so no test would fail if this gap persists. Independently found by 6 of 7 scored auditors plus the naive-reader lane — the strongest convergence in this audit. at hooks/useLangPack.ts:111 + lib/packLoader.ts:126:loadPack / useLangPack.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:111 + lib/packLoader.ts:126:loadPack / useLangPack
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F001 — severity 8 — requirements

---

### Task #378: Fix requirements: selecting a specialty pack never seeds its base pack, so loadSpecialtyPack permanently fails

**File:** hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37
**Complexity:** 🔧 Full — 3 files and a real design decision (does handleSelect/useLangPack detect a specialty code and seed+load its base pack first, or does useLangPack's STATIC_PACKS-keyed seeding logic need to resolve a specialty code to its baseLang before checking STATIC_PACKS) — not a mechanical fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit 8f6c634)
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The useState initializer in useLangPack only seeds memCache via STATIC_PACKS[targetLang], which has exactly one key ("it"). Selecting a specialty pack tile calls components/LanguageGrid.tsx:137's onSelect(sp.code), routed through app/page.tsx:33-37's handleSelect to a full-reload navigation with the specialty code as targetLang. The base pack is never seeded in that case, so loadSpecialtyPack's memCache.has(baseLang) precondition (lib/specialtyPackLoader.ts:269) permanently fails with base_pack_not_loaded. Dormant only because SPECIALTY_PACKS' one entry has ready:false; the UI path that triggers it (LanguageGrid's Add-ons section) already exists and is live. at hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37:useLangPack useState initializer / handleSelect.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useLangPack.ts:73 + components/LanguageGrid.tsx:137 + app/page.tsx:33-37:useLangPack useState initializer / handleSelect
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F002 — severity 7 — requirements

---

### Task #379: Fix security: fetchManifest's !res.ok branch has zero logging and the manifest has no shape validation

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit 97224ff)
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Rule 8 (Log Everything) violation. The `if (!res.ok) return null;` branch at fetchManifest:74 has zero logging, unlike the catch block below it which logs MANIFEST_FETCH_FAIL. Additionally the parsed manifest has no structural shape validation anywhere in the codebase. A CDN error envelope returned as HTTP 200 with a malformed JSON body would be treated as "no manifest available" and silently skip sha256 verification on every fresh pack download, with zero operator-visible log signal. at lib/packLoader.ts:fetchManifest:74.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/packLoader.ts:fetchManifest:74
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F003 — severity 6 — security

---

### Task #380: Fix code-quality: isReadySpecialtyPackCode/isSpecialtyPackCode naming split still unresolved (Task #361 never executed)

**File:** lib/langRegistry.ts + lib/packLoader.ts + hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: purely a rename-to-canonical + delete-alias, no design decision, all 3 call sites already identified above
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit 4713d33)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
isReadySpecialtyPackCode is a bare alias for isSpecialtyPackCode; its own doc comment calls for migration via Task #361, which was never executed. lib/packLoader.ts:38,105 and hooks/useLangPack.ts:9,123 still import and call the deprecated alias while store/entitlementStore.ts, lib/importBackup.ts, and store/migrations.ts use the canonical name. Two names for one function with no behavioral difference. at lib/langRegistry.ts:isReadySpecialtyPackCode:99.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:isReadySpecialtyPackCode:99
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F004 — severity 3 — code-quality

---

### Task #381: Fix code-quality: ERR_ADDON_NOT_PRO is a permanently-dead branch of PurchaseAddOnResult

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (Wave 14 — closed as a consequence of Barry's #388 fix. ERR_ADDON_NOT_PRO is no longer dead code: purchaseAddOn now returns it when isProEnabled(getFeatureFlags().specialtyPacks, get().licenseType) is false, and this branch is test-covered. Verified 2026-07-17 by reading the current function body — no deletion was needed since the constant became genuinely live.)

**What:**
ERR_ADDON_NOT_PRO is declared as one of two possible error discriminants in PurchaseAddOnResult's failure variant but is never constructed by purchaseAddOn's implementation and never covered by any test. The Task #357 comment explains it is reserved for a future call-site gate, but as currently shipped it is permanently dead code in the type's own error union. at store/entitlementStore.ts:PurchaseAddOnResult:48.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:PurchaseAddOnResult:48
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F005 — severity 3 — code-quality

---

### Task #382: Fix code-quality: "SPECIALTY_PACKS is currently empty" claim is stale in three remaining files

**File:** tests/purchaseAddOnGuards.test.ts + hooks/useLangPack.test.ts + .autocode/agents/security.md
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: identical one-line comment fix repeated verbatim at each site, no design decision
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Derek (W15D))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 2 (Human Headers) violation. Originally 4 files; lib/packLoader.ts's copy was independently corrected during Task #378's remediation (audit F008) and now explicitly cross-references this task for the rest — verified 2026-07-18, no longer in scope here. The stale claim ("SPECIALTY_PACKS is currently empty" / "is Object.freeze([])" — false; lib/langRegistry.ts registers one live entry, it-medical, ready:false) remains in tests/purchaseAddOnGuards.test.ts:12, hooks/useLangPack.test.ts:49, and .autocode/agents/security.md. at tests/purchaseAddOnGuards.test.ts:12 + hooks/useLangPack.test.ts:49 + .autocode/agents/security.md.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at tests/purchaseAddOnGuards.test.ts:12 + hooks/useLangPack.test.ts:49 + .autocode/agents/security.md
- [ ] Audit passes: bash scripts/deep-audit.sh tests/purchaseAddOnGuards.test.ts

**Source:** Audit finding F006 — severity 3 — code-quality

---

### Task #383: Fix data-loss: v0->v1 unlockedPacks migration lacks the registration check its v3 sibling has

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Barry (W15B))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The v0->v1 unlockedPacks migration filters elements to typeof==="string" only — it does not check pack-code registration. The sibling v2->v3 purchasedAddOns migration three entries later (Task #344) was explicitly hardened to also require isSpecialtyPackCode(item), and lib/importBackup.ts's equivalent unlockedPacks filter uses isValidPackCode. The v1 migration also logs nothing on drop, unlike importBackup.ts's IMPORT-SKIP-PACKS warning. Same "one call site hardened, sibling left exposed" pattern (Rule 19b) this team has previously logged as recurring. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1]:137.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1]:137
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F007 — severity 5 — data-loss

---

### Task #384: Fix data-loss: v2->v3 purchasedAddOns migration validates against a mutable live flag, not a purchase-time record

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The v2->v3 purchasedAddOns filter validates each stored code against the CURRENT, mutable isSpecialtyPackCode(item) result rather than a historical record of what was purchasable at the time of purchase. If a specialty pack ships ready:true, a user purchases it, and the pack later reverts to ready:false (deprecation or rollback), the next migration run for that user silently drops the paid purchase record with no warning logged anywhere. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[3]:164.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[3]:164
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F008 — severity 5 — data-loss

---

### Task #385: Fix code-quality: clearSpecialtyCache's name overpromises — never touches memCache, needs 3 compensating comments elsewhere

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 10 violation. clearSpecialtyCache's name implies it clears specialty-pack cache state, but its body only resets loadedAddOns bookkeeping and the inFlight map — it never touches memCache, where the actual merged pack data lives. This gap is significant enough that three separate call sites carry compensating disclaimer comments warning readers not to assume the name's full scope (lib/specialtyPackLoader.ts:44 itself, and store/entitlementStore.ts's clearEntitlement twice). A name requiring three separate compensating comments to prevent misuse is a Rule 10 failure. at lib/specialtyPackLoader.ts:clearSpecialtyCache:47.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:clearSpecialtyCache:47
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F009 — severity 4 — code-quality

---

### Task #386: Fix code-quality: isPackUnlocked has no explicit-else branch for an out-of-union licenseType value

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 17c (validators enforce what they claim) gap. isPackUnlocked checks licenseType==="free" and licenseType==="subscription" but has no explicit branch for a LicenseType value outside those two — a third value falls through to unlockedPacks.some(...) with no defined behavior documented for that case. Currently unreachable via any live writer, but the function is not structurally exhaustive against its own declared union. at store/entitlementStore.ts:isPackUnlocked:131.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:isPackUnlocked:131
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F010 — severity 3 — code-quality

---

### Task #387: Fix error-handling: readCacheMeta/readCacheData still omit lang from their error ref IDs despite this batch's rewrite

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Charles (W14C))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 8 violation, repeat/unfixed across a rewrite. readCacheMeta's and readCacheData's catch blocks still log ref IDs without the lang argument, even though this file was substantially rewritten and extracted from packLoader.ts in this batch (Task #275). A cache-read failure for Spanish vs Italian remains indistinguishable in production logs. at lib/packCache.ts:readCacheMeta:161.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packCache.ts:readCacheMeta:161
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F011 — severity 4 — error-handling

---

### Task #388: Fix code-quality: Task #357's deferral rationale no longer matches the test file it cites

**File:** store/entitlementStore.ts + tests/entitlement.test.ts
**Complexity:** 🔧 Full — 2 files, requires a product decision: since the stated blocking reason (tests calling purchaseAddOn with licenseType:"free") no longer holds, re-evaluate whether the Pro gate can now actually be implemented at the store layer, or fix the comment to state the real current blocker (if any) — not a mechanical doc edit
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B) — implemented the Pro gate; also substantively closes #357/#395/#381, see below)
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The Task #357 deferral comment states a store-level Pro gate "would break tests/entitlement.test.ts (off-limits) which calls purchaseAddOn with licenseType:'free'" — verified false against the current file: every purchaseAddOn call site now runs under a beforeEach setting licenseType:"subscription" (a Wave 13 change). A companion comment in the test file itself ("purchaseAddOn requires a Pro subscription (gate added by parallel stream)") is also factually wrong — no such gate exists. The deferral's own stated blocking reason no longer matches the file it cites, risking a future engineer accepting a stale rationale instead of re-evaluating whether the gate can now be implemented. at store/entitlementStore.ts:purchaseAddOn:278.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:purchaseAddOn:278
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F012 — severity 5 — code-quality

---

### Task #389: Fix code-quality: app/page.tsx calls window.localStorage directly, violating lib/constants.ts's sole-authorized-caller rule

**File:** app/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit 91c0b58)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Direct window.localStorage.getItem(LANG_PAIR_KEY) call instead of getLangPair(), violating lib/constants.ts's own documented invariant that it is "the SOLE AUTHORIZED CALLER of window.localStorage for LANG_PAIR_KEY." A live, non-dormant rule violation caught by the unprimed naive-reader lane, missed by all 7 scored auditors. at app/page.tsx:LanguagePicker:29.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/page.tsx:LanguagePicker:29
- [ ] Audit passes: bash scripts/deep-audit.sh app/page.tsx

**Source:** Audit finding F013 — severity 4 — code-quality

---

### Task #390: Fix error-handling: parseBackup checks data.entitlement only by truthiness, unlike the stricter data.srs check on the same line

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
data.entitlement is checked only by truthiness while data.srs on the same line gets a strict shape check (typeof, non-null, non-array). A backup with entitlement:"corrupted" or entitlement:5 passes this guard and silently defaults every entitlement field instead of the backup being rejected the way equally-malformed srs input would be. at lib/importBackup.ts:parseBackup:66.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/importBackup.ts:parseBackup:66
- [ ] Audit passes: bash scripts/deep-audit.sh lib/importBackup.ts

**Source:** Audit finding F014 — severity 5 — error-handling

---

### Task #391: Fix data-loss: useExportImport silently leaves entitlement state untouched when a backup lacks licenseKey/instanceId

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Charles (W14C))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
When a backup's entitlement fields are null/falsy, the import branch silently skips setEntitlement entirely — the current session's entitlement state is left completely untouched with no reset, merge, or flag — while the success message still reports "Restored N card(s) of progress" with no indication entitlement restoration did nothing. at hooks/useExportImport.ts:handleImport:82.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at hooks/useExportImport.ts:handleImport:82
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useExportImport.ts

**Source:** Audit finding F015 — severity 5 — data-loss

---

### Task #392: Fix edge-case: hasValidUnitsArray validates a narrower shape than what downstream UI code unconditionally dereferences

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Charles (W14C))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Validates unit id/name/cards and card id/type/prompt/accepted/tags/tier but not unit.level/theme/emoji/prerequisiteUnits, all non-optional on Unit. components/LevelSection.tsx:55 and app/study/page.tsx:43 unconditionally dereference unit.prerequisiteUnits.every(...) with no guard — a pack passing sha256 and this validator but missing prerequisiteUnits would crash the UI on first render rather than fail at load. The offline authoring-time validator (scripts/validatePack.ts) already checks this field; the runtime guard is strictly weaker than its own mirror. at lib/packTypes.ts:hasValidUnitsArray:61.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:61
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F016 — severity 6 — edge-case

---

### Task #393: Fix tests: seam_importRestore.test.ts's own stated scope (entitlement restore) has zero actual coverage

**File:** tests/seam_importRestore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Charles (W15C))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This file's own header states its purpose is covering the backup-restore path end-to-end, but grep for licenseKey/instanceId/purchasedAddOns/setEntitlement across the file returns nothing — the entitlement-restore branch has zero seam coverage despite being squarely within this test file's stated scope. at tests/seam_importRestore.test.ts:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/seam_importRestore.test.ts:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/seam_importRestore.test.ts

**Source:** Audit finding F017 — severity 4 — tests

---

### Task #394: Fix async: specialty-pack load in flight during deactivation can re-populate memCache with stale entitlement

**File:** store/entitlementStore.ts:clearEntitlement + lib/specialtyPackLoader.ts:loadSpecialtyPack
**Complexity:** 🔧 Full — 2 files, requires a real concurrency-control design (re-validate purchasedAddOns or a deactivation-generation counter inside _mergeFromJson immediately before merging, not just at loadSpecialtyPack's entry) — not a mechanical fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
A specialty-pack load in flight during deactivation takes purchasedAddOns as a one-time snapshot. If clearEntitlement's eviction completes and useLangPack's Task #362 re-seed effect re-populates memCache["it"] before the stale in-flight merge runs, the merge completes using pre-deactivation entitlement after purchasedAddOns has already been reset to []. Dormant only because the one registered specialty code has ready:false. at store/entitlementStore.ts:clearEntitlement:198.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:clearEntitlement:198
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F018 — severity 5 — async

---

### Task #395: Fix auth: purchaseAddOn's Pro gate is enforced only in the UI, not the store action itself

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-17 (Wave 14 — same underlying fix as #357 and #388, closed together. The devtools-bypass attack this finding describes is closed: purchaseAddOn now enforces the Pro gate at the store layer regardless of caller, verified 2026-07-17 against the current function body.)

**What:**
The Pro gate for specialty-pack purchases is enforced only in the UI (LanguageGrid hides the buy button for non-Pro users) — purchaseAddOn itself performs no licenseType check. Any free-tier user could call useEntitlementStore.getState().purchaseAddOn(code, receiptToken) directly from devtools and, given a receiptToken that passed IPC verification, purchase an add-on without holding Pro. Currently inert only because the Tauri command verify_addon_receipt does not exist yet, not because any gate exists in this function. at store/entitlementStore.ts:purchaseAddOn:268.
NEW

**Acceptance Criteria:**
- [ ] Fix auth issue at store/entitlementStore.ts:purchaseAddOn:268
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F019 — severity 3 — auth

---

### Task #396: Fix async: PackMemCacheImpl.write()'s fire-and-forget storage cleanup can delete a concurrent specialty merge's just-written keys

**File:** lib/packCache.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Charles (W14C))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
write() fires its specialty-storage-key cleanup fire-and-forget (not awaited). A base-pack replace racing a concurrent loadSpecialtyPack merge that is persisting its own storage keys can have its just-written keys silently deleted by the trailing cleanup, while loadedAddOns/memCache still report the add-on merged in memory — an unlocked, untested race. at lib/packCache.ts:PackMemCacheImpl.write:118.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/packCache.ts:PackMemCacheImpl.write:118
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F020 — severity 5 — async

---

### Task #397: Fix error-handling: clearEntitlement test call sites invoke a rejectable Promise without await/catch

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts's clearEntitlement returns a Promise that can reject on eviction failure. Several call sites in tests/entitlement.test.ts invoke it without await or .catch; if an eviction genuinely failed in one of those tests, it would surface as an unhandled rejection. Only hooks/useLicenseActivation.ts's handleDeactivate awaits/catches it in production. at tests/entitlement.test.ts:1.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at tests/entitlement.test.ts:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F021 — severity 3 — error-handling

---

### Task #398: Fix error-handling: evictPack's specialty/garbage-code no-op is indistinguishable from success at the call site

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit 1aae732)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
evictPack's doc comment accurately states the returned Promise for specialty/garbage-code inputs "ALWAYS resolves — no throw, no rejection" — but for those inputs the function is a no-op after logging, indistinguishable from a successful eviction at the call site unless the caller inspects console output. at lib/packLoader.ts:evictPack:299.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:299
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F022 — severity 3 — error-handling

---

### Task #399: Fix tests: articles-regex test only proves RegExp instance type, not the correct regex per language

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Derek (W14D) — commit 0a34c54)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 18 (B7) gap. "every ready language has an articles regex" only proves articles is a RegExp instance, not that it is the correct regex for that language — a swapped wrong regex (e.g. Italian's articles regex substituted for Spanish's) would still pass this assertion. at tests/langRegistry.test.ts:35.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:35
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F023 — severity 3 — tests

---

### Task #400: Fix tests: malformed-add-on-pack test doesn't prove delegation to the shared hasValidUnitsArray helper

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Adam (W15A))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Rule 18 (B7) gap, conceded by the test's own comment. "rejects malformed add-on pack" does not prove delegation to the shared hasValidUnitsArray helper specifically — a reverted inline duplicate shape-check would pass this test identically, defeating the single-source-of-truth guarantee the shared helper is meant to provide. at tests/packLoader.test.ts:1034.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/packLoader.test.ts:1034
- [ ] Audit passes: bash scripts/deep-audit.sh tests/packLoader.test.ts

**Source:** Audit finding F024 — severity 3 — tests

---

### Task #401: Fix code-quality: three module headers carry stale DEPENDS ON/USED BY claims

**File:** store/entitlementStore.ts + lib/importBackup.ts + store/migrations.ts
**Complexity:** ⚡ Direct — 3 files, no package boundary — kept Direct despite mechanically qualifying as Full (3 files) by /advance Complexity Audit: three independent one-line header edits, no shared logic or design decision
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Barry (W14B))
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts's DEPENDS ON header lists @/lib/featureFlags, which this file never imports. lib/importBackup.ts's USED BY header omits lib/exportBackup.ts, which imports CURRENT_BACKUP_VERSION, BackupSrs, and BackupEntitlement directly from it. store/migrations.ts's DEPENDS ON header omits isSpecialtyPackCode, which the file actually imports and uses. at store/entitlementStore.ts:module header:8.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at store/entitlementStore.ts:module header:8
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F025 — severity 3 — code-quality

---

### Task #402: Fix code-quality: evictPack double-logs (warn + error) for a single specialty-code event

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-18 (Wave 14 — closed as a verified consequence of Adam's #398 fix, not by dedicated work under this number. #398 changed evictPack's return type from void to a typed EvictPackResult; the doc comment at lib/packLoader.ts:312-321 explicitly documents this as also closing #402 — the escalated second console.error is gone, exactly one console.warn remains per rejected call, and the typed .evicted field is now the caller-facing signal instead of a log. Verified 2026-07-18 by reading the current evictPack body directly.)

**What:**
evictPack's specialty-code branch logs both console.warn and console.error for the same single event — a specialty code passed to evictPack — producing two log lines where one, correctly leveled, would suffice. at lib/packLoader.ts:evictPack:311.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:evictPack:311
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F026 — severity 2 — code-quality

---

### Task #403: Fix code-quality: LanguageGrid's Add-ons section visibility check redundantly re-verifies an already-folded flag

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Adam (W14A) — commit e43adea)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
`specialtyPacksEnabled && specialtyPacks.length > 0` re-checks a flag already folded into specialtyPacks' own filter: specialtyPacks filters by `hasAddOn(sp.code) || (isPro && isPackUnlocked(sp.baseLang))`, and isPro is itself `isProEnabled(specialtyPacksEnabled, licenseType)`. The redundant check is easy to misread as an independent gate. at components/LanguageGrid.tsx:128.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/LanguageGrid.tsx:128
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F027 — severity 2 — code-quality

---

### Task #404: Fix code-quality: app/settings/page.tsx still uses the deprecated ALL_KNOWN_PACKS export instead of ALL_PACK_CODES

**File:** app/settings/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-17 (Wave 14 — Derek (W14D) — commit 2e05d28)
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
store/entitlementStore.ts re-exports ALL_PACK_CODES as ALL_KNOWN_PACKS with an explicit @deprecated tag directing callers to use ALL_PACK_CODES from @/lib/langRegistry directly. app/settings/page.tsx still imports and uses the deprecated ALL_KNOWN_PACKS name instead — the deprecation notice is unenforced at its one call site. at app/settings/page.tsx:module:1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/settings/page.tsx:module:1
- [ ] Audit passes: bash scripts/deep-audit.sh app/settings/page.tsx

**Source:** Audit finding F028 — severity 2 — code-quality

---

### Task #405: Fix error-handling: unguarded sha256Hex in lib/specialtyPackLoader.ts

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, wrap two await sha256Hex sites in try/catch with ref-ID log + typed checksum_mismatch return
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Adam (W15A))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
sha256Hex calls at lib/specialtyPackLoader.ts:198 (cached-copy verify) and :252 (fresh add-on verify) are outside any try/catch — a crypto.subtle failure rejects the shared in-flight promise for every concurrent specialty requester instead of returning the typed { ok:false } contract every other branch honors. Exact sibling of the base-loader defect fixed in Task #378 cycle 2 (lib/basePackLoader.ts SHA_VERIFY_FAIL pattern) — copy that fix shape.

**Acceptance Criteria:**
- [ ] Both sha256Hex sites wrapped; failure logs a ref-ID and returns { ok:false, error:"checksum_mismatch" }
- [ ] Test proving a throwing crypto.subtle surfaces as a typed error, not a rejection

**Source:** Carry-forward from Task #378 (Wave 14, Stream W14A) — Audit finding F028 — severity 5 — error-handling

---

### Task #406: Fix async: useIsHydrated hydration-completion race + no-finish-on-failure hang (lib/storage.ts)

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file: re-check store.persist.hasHydrated() inside the effect before subscribing, and document/handle the zustand persist behavior where hydration NEVER finishes when storage.getItem rejects
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 15 — Barry (W15B))
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Two combined findings from Task #378 cycle 2 (a) useIsHydrated snapshots hasHydrated() at render and subscribes to onFinishHydration in an effect — hydration completing in that window strands hydrated=false forever (onFinishHydration does not fire for already-finished hydration); (b) zustand persist's failure path (storage.getItem rejection) never sets hasHydrated and never fires onFinishHydration, so useIsHydrated can NEVER become true after a hydration failure. hooks/useLangPack.ts now depends on this hook for its entitlement gate — it carries a 3s grace-timeout fallback (HYDRATION_GRACE_MS) as a local mitigation, but every OTHER useIsHydrated consumer (app/learn/page.tsx gating on useSRSStore, etc.) is exposed to a permanent false. Fix at root in useIsHydrated: re-check hasHydrated() inside the effect before subscribing; consider surfacing hydration failure explicitly.

**Acceptance Criteria:**
- [ ] Effect re-checks hasHydrated() before subscribing (closes the subscribe race)
- [ ] Behavior on hydration FAILURE is explicit and tested (documented terminal state, not a silent forever-false)
- [ ] Test that completes hydration between render and effect and asserts hydrated flips true

**Source:** Carry-forward from Task #378 (Wave 14, Stream W14A) — Audit findings N1 + F-C2-2/F-C2-3 — severity 5 — async

---

### Task #407: Fix code-quality: registered-specialty-pack-code check hand-rolled in 5 files with no shared function

**File:** lib/langRegistry.ts, lib/importBackup.ts, store/migrations.ts, store/entitlementStore.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 5 files (relabeled by /advance Complexity Audit: 3+ files mechanically qualifies as Full)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Adam (W17A))

**What:**
The registered-specialty-pack-code predicate (SPECIALTY_PACKS.some/find(sp => sp.code === X)) is independently reimplemented in lib/importBackup.ts:138, store/migrations.ts:181/186, store/entitlementStore.ts:200, and lib/packLoader.ts:328, each with a "keep in sync" comment instead of a shared import. Root cause is Task #74-class: isSpecialtyPackCode's name promises registration but checks registration+ready (see Task #421), which is why nothing already exports the registration-only predicate these 5 sites need. Add `isRegisteredSpecialtyCode(code)` to lib/langRegistry.ts and swap all 5 call sites to import it. at lib/langRegistry.ts:module-level:1.

**Acceptance Criteria:**
- [ ] `isRegisteredSpecialtyCode` exported from lib/langRegistry.ts, registration-only (no ready check)
- [ ] All 5 hand-rolled call sites replaced with the shared import
- [ ] Existing tests for each of the 5 call sites still pass unchanged in behavior

**Source:** Audit finding F001 — severity 5 — code-quality

---

### Task #408: Fix error-handling: getLangPair doesn't repair malformed values; getTargetLangCode's repair never persists

**File:** lib/constants.ts, hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Adam (W17A); also touched tests/srsStore.test.ts to fix a localStorage stub missing setItem, surfaced by getTargetLangCode's new persist-repair call)

**What:**
getLangPair() (lib/constants.ts:46-49) uses `??`, which only substitutes on null/undefined — a stored value of "" or hyphen-less garbage passes through unrepaired and unlogged, contradicting hasStoredLangPair's doc comment claiming "downstream getters repair malformed values with a logged fallback." Separately, getTargetLangCode()'s own repair is read-time-only and never persisted: Task #339's persist-repair effect in hooks/useLangPack.ts only fires when isKnownCode is false, but getTargetLangCode already silently substituted "it" by the time that effect reads it, so the repair never persists — console.error fires on every render forever for a tampered no-hyphen LANG_PAIR_KEY, and getLangPair() (consumed by hooks/useExportImport.ts) returns the raw corrupt string forever, permanently blocking backup restore. at lib/constants.ts:getLangPair:46.

**Acceptance Criteria:**
- [ ] getLangPair repairs a malformed stored value the same way getTargetLangCode does, with a logged fallback
- [ ] getTargetLangCode's repair is persisted (calls setTargetLangCode), not just returned
- [ ] Test: a no-hyphen corrupted LANG_PAIR_KEY is repaired once and does not re-log on every subsequent call

**Source:** Audit finding F002 — severity 5 — error-handling

---

### Task #409: Fix concurrency: specialtyPackLoader's hand-rolled generation guard is asymmetrically hardened vs basePackLoader's shared primitive

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, migrate to createGenerationGuard() and move the check to bracket the storage writes
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Adam (W16A))
**Blocked by:** Nothing
**Priority:** P2

**What:**
lib/specialtyPackLoader.ts:42-51 hand-rolls a generation counter instead of using lib/generationGuard.ts's createGenerationGuard(), already adopted by lib/basePackLoader.ts. Beyond style duplication, the hand-rolled check in _mergeFromJson (114-117) happens before memCache.merge and well before its own writeCacheMeta/writeCacheData awaits — an asymmetric hardening of the identical race class that lib/basePackLoader.ts:223-230 was specifically fixed to close (a second generation check bracketing the post-download storage writes). lib/generationGuard.ts:12-13 names this outright as a tracked, not-yet-closed carry-forward. at lib/specialtyPackLoader.ts:_mergeFromJson:114.

**Acceptance Criteria:**
- [ ] specialtyPackLoader.ts's deactivationGeneration replaced with createGenerationGuard()
- [ ] A second generation check brackets the post-write storage awaits, mirroring basePackLoader.ts:223-230
- [ ] Test: an eviction landing during the post-download storage writes is rejected, mirroring the existing basePackLoader regression test for the same race

**Source:** Audit finding F004 — severity 6 — concurrency (ESCALATE — ran 4 prior cycles unresolved as a duplication note before this cycle identified the live race)

---

### Task #410: Fix security: specialty pack offline/no-manifest fallback never re-verifies sha256 against the recorded cache hash

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, mirror basePackLoader's staleBytesMatchRecordedHash pattern
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Adam (W16A))
**Blocked by:** Nothing
**Priority:** P2

**What:**
lib/specialtyPackLoader.ts:_doLoad's four offline/no-manifest fallback branches (~lines 224, 237-239, 250, 256) call _mergeFromJson with manifestEntry=null and zero verification against the sha256 recorded in cachedMeta at cache time — asymmetric with lib/basePackLoader.ts's staleBytesMatchRecordedHash() fix, added specifically so the module's "verifies" promise holds on the offline path too. This is security.md's tracked S2 finding (security.md's stated reason was stale/inaccurate — add-on packs DO have their own storage keys since Task #269; the real gap is missing re-verification of an existing cache, not an absent one). Currently dormant (SPECIALTY_PACKS's sole entry is ready:false) but must close before any specialty pack ships ready:true. at lib/specialtyPackLoader.ts:_doLoad:224.

**Acceptance Criteria:**
- [ ] All four offline/no-manifest branches call a shared staleBytesMatchRecordedHash-equivalent before merging cached bytes
- [ ] Test: stale specialty-pack bytes that no longer match their recorded hash are refused, mirroring the base-pack regression test
- [ ] security.md's S2 entry corrected to name the actual gap and cite the fix

**Source:** Audit finding F007 — severity 6 — security

---

### Task #411: Fix code-quality: purchased-but-since-unready specialty pack shows a "buy" CTA instead of its owned state

**File:** components/LanguageGrid.tsx, components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Barry (W16B))
**Blocked by:** Nothing
**Priority:** P2

**What:**
components/LanguageGrid.tsx:141-142 decides which button to render via `purchased && sp.ready`: if a user owns a specialty pack that later becomes unready, they fall into the unowned branch — shown "Coming soon" plus a PRICING.annual buy CTA (wired to onUpgradeClick) despite already having paid. This contradicts the codebase's own stated "readiness gates purchasing/loading, not retention" policy (Task #384, encoded in store/migrations.ts and lib/importBackup.ts). The pack's visibility gate (line 62-64) already respects the policy; only the button/CTA selection doesn't. No test exercises purchased+unready. at components/LanguageGrid.tsx:render:141.

**Acceptance Criteria:**
- [ ] A purchased pack that has gone unready shows an owned/no-purchase-needed state, never the buy CTA
- [ ] Test: purchased+unready renders distinctly from unpurchased+unready
- [ ] Product decision on the exact copy/behavior for this state may be needed — flag to owner if ambiguous

**Source:** Audit finding F008 — severity 6 — code-quality

---

### Task #412: Fix code-quality: store/entitlementStore.ts is 431 lines, over Rule 1's 400-line service cap

**File:** store/entitlementStore.ts
**Complexity:** 🔧 Full — extract a cohesive slice (e.g. specialty/add-on actions) to a sibling module
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Barry (W18B); extracted purchaseAddOn + its constants/types to new store/entitlementAddOns.ts — entitlementStore.ts now 397 lines, entitlementAddOns.ts 157 lines)

**What:**
store/entitlementStore.ts is 431 lines, over Rule 1's 400-line service cap, and was not present in .autocode/debt.md as tracked debt — an untracked Rule 1 violation on the most security-relevant store in the codebase. at store/entitlementStore.ts:module:1.

**Acceptance Criteria:**
- [ ] File split so no resulting file exceeds 400 lines, following the same extraction pattern used for lib/packLoader.ts → lib/basePackLoader.ts
- [ ] All existing tests pass unchanged
- [ ] CLAUDE.md updated with the new module's role

**Source:** Audit finding F009 — severity 4 — code-quality

---

### Task #413: Fix tests: specialtyPackLoader's fresh-download hash-mismatch branch has no direct test

**File:** tests/specialtyPackLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Charles (W17C); also repaired this file's own fakeAddOnPack fixture, broken by #418's stricter cross-check landing concurrently)

**What:**
lib/specialtyPackLoader.ts lines 257, 272, 318, 359 are uncovered; line 272 (the fresh-download hash-mismatch branch itself) is untested, distinct from the cached-copy hash-mismatch test that does exist. Not gate-blocking (project coverage clears thresholds) but a checksum-mismatch branch is exactly the kind of security-relevant path expected to have direct coverage. at lib/specialtyPackLoader.ts:_doLoad:272.

**Acceptance Criteria:**
- [ ] A test forces the fresh-download sha256 to mismatch and asserts the checksum_mismatch result
- [ ] Lines 257, 318, 359 covered or explicitly justified as unreachable

**Source:** Audit finding F010 — severity 4 — tests

---

### Task #414: Fix requirements: loader-level base-pack entitlement gate is expiry-blind

**File:** lib/packLoader.ts, hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 2 files, thread isPackUnlocked's computed result instead of the raw unlockedPacks array
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Adam (W17A); fix lives entirely in hooks/useLangPack.ts, computing unlockedLangs via the canonical isPackUnlocked per-code rather than narrowing to the target language alone, since the specialty-pack resolver checks a different base language — lib/packLoader.ts itself unchanged, per the layer rule)

**What:**
lib/packLoader.ts:189-192's base-pack entitlement gate is a pure array-membership check on unlockedLangs; hooks/useLangPack.ts threads the raw persisted unlockedPacks array into it, not the computed isPackUnlocked() result (which applies validUntil+SUBSCRIPTION_GRACE_PERIOD_MS expiry logic). isPackUnlocked currently runs only inside components/LanguageGrid.tsx's render; app/page.tsx redirects returning users away from the picker once hasStoredLangPair() is true, so isPackUnlocked never runs again for them, and app/learn/page.tsx, app/study/page.tsx, hooks/useStatsData.ts never call it at all. unlockedPacks is never pruned on expiry. Currently fully unreachable (READY_PACK_CODES=[it], Italian is free) but code comments explicitly anticipate a second ready base pack. at lib/packLoader.ts:loadPack:189.

**Acceptance Criteria:**
- [ ] loadPack's entitlement gate for base packs is expiry-aware (routes through isPackUnlocked's logic, or unlockedPacks is pruned on lapse)
- [ ] Test: a lapsed-beyond-grace subscription is denied on the actual loader call path, not just in LanguageGrid's render
- [ ] No regression to the currently-passing free-pack path

**Source:** Audit finding F013 — severity 5 — requirements

---

### Task #415: Fix error-handling: evictPack can never reject; clearEntitlement's defensive catch and re-throw are dead code

**File:** lib/packCache.ts, lib/packLoader.ts, store/entitlementStore.ts
**Complexity:** 🔧 Full — 3 files, decide whether evictPack should genuinely reject on failure or the dead branches should be removed
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Barry (W16B))
**Blocked by:** Nothing
**Priority:** P2

**What:**
Every eviction failure path in lib/packCache.ts's clearPackCache and _clearSpecialtyStorageKeys is console.error-only and uses Promise.allSettled internally, so evictPack can never reject. lib/packLoader.ts's own doc comment (~lines 312-321) asserts clearEntitlement's defensive .catch "remains live, not dead code" while the same block claims the returned promise "ALWAYS resolves" — a direct self-contradiction. store/entitlementStore.ts:231-234's .catch around evictPack(baseLang) is therefore unreachable, evictionErrors can never populate, and the `if (evictionErrors.length > 0) throw` block (248-252, attributed to Task #351) is dead code; hooks/useLicenseActivation.ts:87-93's "Deactivated. Restart the app to clear cached content." message can never fire. Separately, the sole production caller never inspects the `.evicted` discriminant Task #398's EvictPackResult fix exists to provide. at lib/packCache.ts:clearPackCache:235.

**Acceptance Criteria:**
- [ ] Decide and implement: either evictPack genuinely surfaces a real eviction failure (making the existing catch/re-throw/user-message chain live), or the dead catch/re-throw/message chain is removed and the doc comment corrected
- [ ] clearEntitlement's caller inspects EvictPackResult's `.evicted` discriminant if the fix is to have any real consumer
- [ ] doc comment at lib/packLoader.ts:evictPack no longer makes a self-contradicting claim
- [ ] Test proving whichever behavior is chosen (a genuine failure path is now observable, or the dead code is gone and nothing regresses)

**Source:** Audit finding F015 — severity 6 — error-handling (4-way independent auditor convergence)

---

### Task #416: Fix tests: basePackLoader's second-generation-check race fix has no regression test

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A))

**What:**
lib/basePackLoader.ts:223-230's documented "second generation check" race fix (an eviction landing during the post-download writeCacheMeta/writeCacheData awaits) has no regression test — tests/packLoader.test.ts's #378 cycle-2 block covers the cache-hit race and offline-stale-fallback race but not this path. Deletion Test: delete lines 223-229, no test fails. at lib/basePackLoader.ts:loadBasePackFromStorageOrNetwork:223.

**Acceptance Criteria:**
- [ ] A test forces an eviction during the post-download storage-write window and asserts the write is rejected/discarded correctly
- [ ] Deleting lines 223-229 causes the new test to fail

**Source:** Audit finding F016 — severity 4 — tests

---

### Task #417: Fix tests: hasValidUnitsArray has no test constructing a malformed card

**File:** tests/packTypes.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Barry (W17B))

**What:**
Every test in tests/packTypes.test.ts uses `cards: []`; none constructs a malformed card (wrong-typed tier, non-array accepted, missing prompt). Deletion Test: replace the card-validation callback with `return true;` — no test fails. at lib/packTypes.ts:hasValidUnitsArray:92.

**Acceptance Criteria:**
- [ ] At least one test constructs a card with a malformed field (per validated field) and asserts hasValidUnitsArray returns false
- [ ] Deletion Test: the card-validation callback returning unconditional true now fails the new test(s)

**Source:** Audit finding F017 — severity 4 — tests

---

### Task #418: Fix data-integrity: hasValidUnitsArray never cross-checks unitCount/cardCount against actual array lengths

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Barry (W17B); the stricter check broke unitCount/cardCount-mismatched test fixtures in 3 other files owned by other streams — fixed directly by this orchestrator after independent verification found them, not by Barry, since they were outside Barry's file grant)

**What:**
hasValidUnitsArray validates unitCount/cardCount by type only, never cross-checking them against the actual units/cards array lengths, despite lib/specialtyPackLoader.ts's _mergeFromJson arithmetically summing exactly those two fields. A downloaded pack whose declared count doesn't match its real array length passes validation and produces an arithmetically wrong but type-safe merged total; no caller in the import graph checks this either. at lib/packTypes.ts:hasValidUnitsArray:75.

**Acceptance Criteria:**
- [ ] hasValidUnitsArray rejects a pack whose unitCount/cardCount doesn't match its actual units.length/summed cards.length
- [ ] Test: a pack with a mismatched declared count is rejected

**Source:** Audit finding F018 — severity 5 — data-integrity

---

### Task #419: Fix edge-case: isKnownCode has no recovery path for a ready-but-unpurchased specialty code

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Derek (W18D); render-body redirect to the specialty pack's own baseLang before attempting a doomed load, generalizing the existing #339 repair effect to persist it — also updated hooks/useLangPackSeam.test.ts, broken by this change and not owned by any other Wave 18 stream)

**What:**
isKnownCode (hooks/useLangPack.ts:78-80) treats any registered-and-ready specialty code as "known" regardless of purchase state; the #339 repair effect only fires for !isKnownCode. A user pinned (via persisted LANG_PAIR_KEY) to a ready-but-unpurchased specialty code gets a permanent "Add-on not purchased." state with no in-hook recovery path. Currently latent only because it-medical is ready:false. at hooks/useLangPack.ts:isKnownCode:78.

**Acceptance Criteria:**
- [ ] A ready-but-unpurchased specialty code stuck in LANG_PAIR_KEY gets an in-hook recovery path (e.g. falls back to the base language) rather than a permanent error state
- [ ] Test covering this scenario with a mocked ready specialty pack

**Source:** Audit finding F019 — severity 4 — edge-case

---

### Task #420: Fix security: isProEnabled never checks subscription expiry unlike its sibling isPackUnlocked

**File:** lib/featureFlags.ts, store/entitlementStore.ts, components/LanguageGrid.tsx, app/stats/page.tsx
**Complexity:** 🔧 Full — 4 files, all 3 real call sites need to move to an expiry-aware check
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Barry (W16B); also touched app/page.tsx to thread validUntil into LanguageGrid, its sole caller — outside the original file list but necessary and flagged in completion notes)
**Blocked by:** Nothing
**Priority:** P2

**What:**
isProEnabled (lib/featureFlags.ts:26) never checks subscription expiry, unlike its sibling store/entitlementStore.ts:126-151 isPackUnlocked, which enforces validUntil+grace. components/EntitlementValidator.tsx deliberately never resets licenseType on failed validation, relying entirely on isPackUnlocked's expiry check — but three real, live call sites use isProEnabled instead: store/entitlementStore.ts:302 (purchaseAddOn), components/LanguageGrid.tsx:50, and app/stats/page.tsx:17. A lapsed or cancelled subscriber who never manually deactivates stays Pro-gated-in indefinitely for add-on purchases and analytics, while correctly losing access to paid base packs. This gap is live TODAY, regardless of pack readiness (unlike Task #414/F013, which is currently dormant). at lib/featureFlags.ts:isProEnabled:26.

**Acceptance Criteria:**
- [ ] isProEnabled (or its 3 call sites) becomes expiry-aware, consistent with isPackUnlocked
- [ ] Test: a subscription past validUntil+grace is denied at all 3 call sites (purchaseAddOn, LanguageGrid, stats page)
- [ ] No regression to a currently-active subscription's Pro access

**Source:** Audit finding F020 — severity 6 — security

---

### Task #421: Fix code-quality: store/srsStore.ts bypasses lib/constants.ts's sole-authorized-caller rule for localStorage

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Barry (W17B))

**What:**
store/srsStore.ts:26 calls `window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it"` directly, bypassing lib/constants.ts's sole-authorized-caller rule and reimplementing getLangPair() inline, even though the file already imports LANG_PAIR_KEY from lib/constants.ts. app/page.tsx and hooks/useExportImport.ts were fixed for the identical violation under Task #340/#389 (commit 91c0b58); this call site was the missed sibling. Matches already-known tracked debt entry DSC-004. at store/srsStore.ts:module-level:26.

**Acceptance Criteria:**
- [ ] store/srsStore.ts:26 calls getLangPair() from lib/constants.ts instead of localStorage directly
- [ ] `grep -rn "localStorage" store/srsStore.ts` returns zero hits

**Source:** Audit finding F021 — severity 5 — code-quality

---

### Task #422: Fix code-quality: BackupEntitlement's purchasedAddOns validation is dead wiring — no production caller destructures it

**File:** lib/importBackup.ts, hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Charles (W18C); documented as intentionally validated-but-unused rather than removed, since removing would strip validation from a field BackupEntitlement still declares)

**What:**
lib/importBackup.ts validates and logs purchasedAddOns into BackupEntitlement, but the sole production caller, hooks/useExportImport.ts:81, never destructures it — 4 tests verify a value with no live effect on any real restore path. This is intentional by design (add-ons cannot be restored from an unsigned backup, see Task #422's sibling F069 below) but the validation logic itself is currently dead wiring. Either document this explicitly as intentional dead code with a comment at the validation site, or remove the unused validation. at lib/importBackup.ts:parseBackup:130.

**Acceptance Criteria:**
- [ ] A comment at lib/importBackup.ts's purchasedAddOns validation explicitly states it is validated-but-intentionally-unused (cross-referencing the security rationale), or the validation is removed
- [ ] No change to the actual restore behavior (purchasedAddOns still cannot be restored from a backup)

**Source:** Audit finding F023 — severity 4 — code-quality

---

### Task #423: Fix code-quality: license-key length check hardcoded instead of a named constant

**File:** hooks/useLicenseActivation.ts, store/entitlementStore.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Barry (W18B); added LICENSE_KEY_MAX_LENGTH/LICENSE_KEY_PATTERN, cross-referenced with entitlementAddOns.ts's RECEIPT_TOKEN_MAX_LENGTH rather than a shared import, since that would require lib/importBackup.ts to import from hooks/ — a layer violation. lib/importBackup.ts's own duplicated constant (from Task #424) still needs reconciling — logged as debt)

**What:**
hooks/useLicenseActivation.ts:25 hardcodes `key.length > 200` inline with a comment instead of a named constant, while store/entitlementStore.ts:78's RECEIPT_TOKEN_MAX_LENGTH=200 explicitly mirrors this same rule for the parallel receipt-token check — inconsistent application of the named-constant rule. AGENTS.md lists any hardcoded string/number that belongs in a named constant as a stop-the-line violation. at hooks/useLicenseActivation.ts:handleActivate:25.

**Acceptance Criteria:**
- [ ] A shared or mirrored named constant (e.g. LICENSE_KEY_MAX_LENGTH) replaces the inline 200
- [ ] Both constants live in one obvious place or explicitly cross-reference each other

**Source:** Audit finding F024 — severity 4 — code-quality

---

### Task #424: Fix security: restored licenseKey/instanceId validated only by typeof, no length or charset check

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Adam (W17A); duplicated the format constants locally rather than waiting on the still-deferred Task #423, per brief instruction — logged as debt to reconcile when #423 lands)

**What:**
lib/importBackup.ts:148 validates restored licenseKey/instanceId with only `typeof === "string"` — no length cap, no charset check — while hooks/useLicenseActivation.ts:25's format guard sits only in front of manual entry. A crafted backup JSON with an oversized or non-charset-conforming licenseKey bypasses the guard entirely via the restore path. at lib/importBackup.ts:parseBackup:148.

**Acceptance Criteria:**
- [ ] Restored licenseKey/instanceId are validated against the same format/length rule used at manual entry (shared constant/regex, see Task #423)
- [ ] Test: an oversized or invalid-charset licenseKey in a backup is rejected or sanitized on restore

**Source:** Audit finding F025 — severity 5 — security

---

### Task #425: Fix documentation-trust: getLanguageConfig's hyphenated-fallback signal is weaker than its own doc comment claims

**File:** lib/language.ts, tests/language.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Derek (W18D); corrected the doc comment to name both fallback branches' actual signal strength rather than strengthening the weak one, which would require resolving a documented circular-import constraint out of scope for a documentation-trust finding)

**What:**
getLanguageConfig's hyphenated-code fallback branch cannot check SPECIALTY_PACKS membership (documented circular-import constraint), so "it-typo" or any garbage suffix sharing a valid 2-letter prefix takes the identical silent-success path (console.warn + base config) as a genuinely registered code like "it-medical" — a weaker signal (warn, not error) than the no-hyphen branch despite the doc comment's claim that "the error signal prevents silent masking." No test covers "valid prefix, garbage suffix." at lib/language.ts:getLanguageConfig:842.

**Acceptance Criteria:**
- [ ] Doc comment corrected to accurately describe the hyphenated-fallback signal strength, or the signal is strengthened to match the claim
- [ ] Test: a garbage suffix on a valid prefix (e.g. "it-typo") is covered explicitly

**Source:** Audit finding F026 — severity 4 — documentation-trust

---

### Task #426: Fix tests: purchasedAddOns-preservation-on-restore is only tested from an empty starting state

**File:** tests/seam_importRestore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Derek (W17D))

**What:**
tests/seam_importRestore.test.ts:212-239,255-286's purchasedAddOns-preservation-on-restore guarantee is asserted only from an empty starting state restoring to []. No test seeds a non-empty purchasedAddOns before restoring a backup that includes a license. Deletion Test: change setEntitlement to a full-replace instead of shallow merge — every existing test still passes. at tests/seam_importRestore.test.ts:255.

**Acceptance Criteria:**
- [ ] A test seeds a non-empty purchasedAddOns, restores a backup with a license, and asserts purchasedAddOns is unchanged
- [ ] Deletion Test: a full-replace setEntitlement now fails this new test

**Source:** Audit finding F027 — severity 4 — tests

---

### Task #427: Fix code-quality: parseFlag defaults to enabled, inverting the safe-off default for an unfinished feature

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Charles (W17C); switched parseFlag to a per-flag default parameter rather than a blanket change, keeping interruptEngine/vacationMode/analytics default-on and specialtyPacks default-off. Broke purchaseAddOn's Pro-gate tests in 2 files outside Charles's grant (tests/entitlement.test.ts, tests/purchaseAddOnGuards.test.ts) — fixed directly by this orchestrator, plus corrected a stale comment in store/entitlementStore.ts Charles flagged but couldn't edit)

**What:**
parseFlag (lib/featureFlags.ts:18-21) defaults to TRUE unless the env var is explicitly "false"/"0"/"off"/"no". For a flag whose stated purpose is to be "the ONE place" gating an unfinished, dormant feature (specialty packs), this inverts the safe default — omitting the env var anywhere ships the feature live. Currently masked only by SPECIALTY_PACKS's single entry being ready:false. at lib/featureFlags.ts:parseFlag:18.

**Acceptance Criteria:**
- [ ] The specialty-packs feature flag defaults to off/false when unset, not on
- [ ] Test: an unset env var yields the flag disabled
- [ ] Confirm no other consumer of parseFlag relies on the current default-true behavior before changing it globally (may need a per-flag default parameter instead of a global default change)

**Source:** Audit finding F028 — severity 5 — code-quality

---

### Task #428: Fix documentation-trust: basePackLoader's "USED BY: packLoader.ts ONLY" header is false, and its own enforcement test contradicts its name

**File:** lib/basePackLoader.ts, tests/packLoader.test.ts, CLAUDE.md
**Complexity:** ⚡ Direct — 3 files, no package boundary — mechanical header/test-name correction
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A); corrected to the final post-#436 two-importer state, not the state the finding was originally written against)

**What:**
lib/basePackLoader.ts's header and CLAUDE.md Section 1 both claim "USED BY: lib/packLoader.ts ONLY" — false, since lib/packResolver.ts:23 also imports LoadPackOptions from it. The poka-yoke test at tests/packLoader.test.ts:1879-1900 is itself named "imported ONLY by lib/packLoader.ts" but its assertion expects exactly TWO importers — the test's own body contradicts its own name and the header it exists to enforce. Also, bumpEvictionGeneration is called from 3 sites in packLoader.ts, not just evictPack, per the same stale header. at lib/basePackLoader.ts:module-header:15.

**Acceptance Criteria:**
- [ ] Header and CLAUDE.md corrected to name both real importers (packLoader.ts, packResolver.ts)
- [ ] Test renamed to match its actual assertion (two legal importers), or the invariant is tightened to genuinely mean one importer if that was the real intent
- [ ] bumpEvictionGeneration's caller list in the header corrected

**Source:** Audit finding F029 — severity 4 — documentation-trust

---

### Task #429: Fix tests: path-traversal/invalid-lang tests are shadowed by a later entitlement gate, not proving the allowlist guard works

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A))

**What:**
tests/packLoader.test.ts:441,450,470,479,488,739,750,953 (path-traversal and invalid-lang tests) would still pass because a separate, later entitlement gate independently produces the identical invalid_lang result regardless of whether the allowlist guard under test exists (entitlement-gate shadowing) — meaning the security-relevant path-traversal allowlist guard itself has no test proving it specifically works. at tests/packLoader.test.ts:441.

**Acceptance Criteria:**
- [ ] At least one test isolates the allowlist/path-traversal guard from the entitlement gate (e.g. a free, ready, non-existent code that clears entitlement but should still fail the allowlist)
- [ ] Deletion Test: removing the allowlist guard specifically (not the entitlement gate) now fails the new test

**Source:** Audit finding F041 — severity 4 — tests

---

### Task #430: Fix security: hand-crafted unsigned backup import grants paid access without contacting the license server

**File:** hooks/useExportImport.ts, lib/importBackup.ts, store/entitlementStore.ts
**Complexity:** 🔧 Full — 3 files, cross-cutting import/entitlement boundary
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Barry (W16B); the specific "closes the free grace-period window" ask is fully closed — setEntitlement now requires callers to state lastValidated explicitly, and a restored backup passes 0 to force immediate re-validation. The deeper "validUntil:null means no expiry forever" policy is unchanged by design and is covered by the existing 2026-06-24 owner honour-system decision, not a new sign-off — see completion notes)
**Blocked by:** Nothing
**Priority:** P2

**What:**
A hand-crafted, unsigned backup JSON with arbitrary non-empty licenseKey/instanceId, licenseType:"subscription", unlockedPacks:["it","es"], validUntil:null passes parseBackup and is fed straight into setEntitlement, which never contacts the real license server. setEntitlement also stamps lastValidated:Date.now(), so needsValidation() returns false for the full 7-day SUBSCRIPTION_GRACE_PERIOD_MS, and validUntil:null is treated as "no expiry." Weighed explicitly against the owner-confirmed honour-system baseline (2026-06-24): a technically-savvy user can already grant themselves identical or greater access by editing their own persisted entitlement store directly, so this is not a new access ceiling — but it packages the exploit behind a legitimate, zero-skill in-app affordance (Settings > Import Backup) rather than requiring devtools access, dropping the skill floor to near zero and making the exploit a shareable file. at hooks/useExportImport.ts:readFile:81.

**Acceptance Criteria:**
- [ ] A restored backup's entitlement fields trigger re-validation against the real license server on next app foreground, rather than stamping lastValidated at import time (closing the free grace-period window)
- [ ] Test: importing a backup with an arbitrary licenseKey does not grant a full grace period before the next validation check
- [ ] Explicit product/owner sign-off recorded if the decision is to accept this as within the honour-system model rather than fix it (given entitlement is intentionally client-only by design)

**Source:** Audit finding F057 — severity 6 — security

---

### Task #431: Fix security: isValidManifestShape never validates sha256 is a well-formed hex digest

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A))

**What:**
isValidManifestShape (lib/packLoader.ts:81-96) only checks version/sha256 are typeof string; never validates that sha256 is a well-formed 64-char hex digest. A manifest entry with sha256:"" or "x" passes shape validation, degrading to "checksum never matches" instead of a clear rejection at the validation boundary. at lib/packLoader.ts:isValidManifestShape:81.

**Acceptance Criteria:**
- [ ] isValidManifestShape validates sha256 as a 64-char hex string, not just typeof string
- [ ] Test: a malformed sha256 value in a manifest entry is rejected at shape-validation time, with a distinct error/log from a checksum mismatch

**Source:** Audit finding F058 — severity 3 — security (promoted despite sub-4 severity: direct validator-hardening fix, cheap to bundle with Task #430/#410's related work)

---

### Task #432: Fix requirements: loadPack never threads forceRedownload into loadSpecialtyPack

**File:** lib/packLoader.ts, lib/specialtyPackLoader.ts, lib/basePackLoader.ts
**Complexity:** 🔧 Full — 3 files, extend loadSpecialtyPack's signature
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A); chose the documented-no-op path over a real forced reload, since specialty merges are additive and a forced reload would need an unsafe "unmerge" step — the no-op is now logged (FORCE_REDOWNLOAD_NOOP) instead of silent)

**What:**
loadPack never threads options?.forceRedownload into loadSpecialtyPack, whose signature has no force parameter at all — a caller believing it forced a fresh specialty download silently gets the cached/merged copy with no error and no way to detect the no-op. LoadPackOptions.forceRedownload is documented as applying "to BASE packs only" yet is declared once and threaded as a single flat option bag for both base and specialty lang values, with no signal to a reader that it's a no-op for specialty codes. at lib/packLoader.ts:loadPack:158.

**Acceptance Criteria:**
- [ ] loadSpecialtyPack accepts and honors a forceRedownload option, or LoadPackOptions' doc comment/type makes the specialty no-op impossible to miss (e.g. a distinct options type per branch)
- [ ] Test: forceRedownload:true on a specialty code either forces a fresh fetch or is provably documented/typed as a no-op

**Source:** Audit finding F059 — severity 4 — requirements

---

### Task #433: Fix data-loss: SRS migration validates only phaseStartDate, leaving 9 other IntroductionRecord fields unchecked

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Charles (W16C); also validated introducedDate as a deliberate scope extension beyond the original 9 named fields, judged to be the same class of bug — see completion notes)
**Blocked by:** Nothing
**Priority:** P2

**What:**
store/migrations.ts's SRS_MIGRATIONS[3] (lines 88-99) only validates phaseStartDate (a calendar-format check); the other 9 fields of a persisted IntroductionRecord (dayOfPhase, consecutiveCorrect, totalEncounters, lastSeenDate, appearancesToday, consecutiveWrongToday, lastSeenType, graduated) pass through via `{...record, phaseStartDate}` with zero type checking. A record with consecutiveCorrect:"many" or totalEncounters:null survives migration untouched and reaches production arithmetic on those fields. AGENTS.md explicitly names "any function that can silently corrupt persisted user data" as a stop-the-line violation. at store/migrations.ts:SRS_MIGRATIONS[3]:88.

**Acceptance Criteria:**
- [ ] All 9 remaining IntroductionRecord fields are type/shape-validated during migration, with a logged fallback for invalid values (matching the existing phaseStartDate pattern)
- [ ] Test: a record with a malformed field (e.g. consecutiveCorrect as a string) is repaired, not passed through, during migration

**Source:** Audit finding F060 — severity 6 — data-loss

---

### Task #434: Fix error-handling: lib/constants.ts has zero try/catch around any localStorage call

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Derek (W16D))

**What:**
getTargetLangCode, setTargetLangCode, getLangPair, and hasStoredLangPair (lib/constants.ts:15-60) all call window.localStorage directly with no try/catch anywhere in the file. If localStorage throws (private-browsing quota errors, disabled storage in a locked-down webview), the throw propagates uncaught into callers (app/page.tsx's mount effect, hooks/useExportImport.ts's handleExport/readFile) with no ErrorBoundary anywhere in the codebase, crashing the page instead of degrading the way lib/storage.ts's createPlatformStorage does for the Zustand stores. at lib/constants.ts:module:15.

**Acceptance Criteria:**
- [ ] All 4 functions wrap their localStorage calls in try/catch, degrading gracefully (logged, with a sane fallback) rather than throwing
- [ ] Test: a throwing localStorage does not crash any of the 4 functions

**Source:** Audit finding F061 — severity 6 — error-handling

---

### Task #435: Fix data-loss: useIsHydrated's failsafe timeout can silently overwrite live user state

**File:** lib/storage.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix — may require surfacing a distinct return value/signal
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-27 (Wave 16 — Derek (W16D); kept useIsHydrated's boolean return type unchanged — reconciles late-hydration clobbering internally via a store subscription rather than pushing a new signal onto every call site)

**What:**
HYDRATION_FAILSAFE_MS (3000ms, lib/storage.ts:useIsHydrated:114-144) cannot distinguish "stuck forever" from "merely slow." If real hydration completes AFTER the failsafe already flipped hydrated to true and the app acted on default/partial state, Zustand persist's rehydrate later shallow-merges the newly-loaded persisted data via set(), silently overwriting any user state changes (card ratings, entitlement writes) made in the failsafe-to-real-hydration window. The function's name/doc promises "true once persist has finished reading," but its actual meaning is "storage read done OR we stopped waiting," with no way for callers to distinguish which. at lib/storage.ts:useIsHydrated:114.

**Acceptance Criteria:**
- [ ] useIsHydrated (or a sibling signal) distinguishes a genuine hydration completion from a failsafe timeout, so consumers can avoid acting on writes that a late real-hydration merge would clobber
- [ ] Test: a state change made during the failsafe-to-real-hydration window is not silently lost when real hydration eventually completes

**Source:** Audit finding F062 — severity 6 — data-loss

---

### Task #436: Fix concurrency: basePackLoader's eviction-generation guard is a single global counter, not per-language

**File:** lib/basePackLoader.ts
**Complexity:** ⚡ Direct — 1 file, key the guard by language
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Adam (W18A); single evictionGuard replaced with a Map<string, GenerationGuard> keyed per language)

**What:**
lib/basePackLoader.ts:52-64's evictionGuard is a single global generation counter, not per-language: evictPack("es") bumps the generation and causes an unrelated, already in-flight loadPack("it") (a second concurrently-mounted useLangPack instance) to skip its own cache write — "it" still returns correct data this call but is silently forced to re-download on every subsequent load until the next successful write. at lib/basePackLoader.ts:evictionGuard:52.

**Acceptance Criteria:**
- [ ] The eviction guard is keyed per-language, so evicting one language's cache doesn't invalidate an unrelated in-flight load for a different language
- [ ] Test: concurrent loads for two different languages, one evicted mid-flight, only the evicted language's write is skipped

**Source:** Audit finding F063 — severity 4 — concurrency

---

### Task #437: Fix async: no guard against concurrent backup imports

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Charles (W18C); rejects a concurrent import immediately with a clear message rather than queuing)

**What:**
hooks/useExportImport.ts:readFile:48-106 has no guard against concurrent imports — two rapid handleImportFile/readFile calls run independent FileReader instances with no in-flight lock; final SRS/entitlement state is whichever FileReader resolves last, and the displayed dataStatus can describe the wrong import. at hooks/useExportImport.ts:readFile:48.

**Acceptance Criteria:**
- [ ] A second import call while one is in flight is either queued, rejected with a clear message, or otherwise made safe
- [ ] Test: two rapid concurrent import calls produce a deterministic, correctly-attributed final state

**Source:** Audit finding F064 — severity 4 — async

---

### Task #438: Fix async: clearEntitlement flips entitlement state before specialty-content eviction completes

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Barry (W18B); the state-reset now runs inside the same .then() as the eviction settling, not before it starts)

**What:**
store/entitlementStore.ts:clearEntitlement:203-234's synchronous set({...}) flips licenseType to "free" and clears purchasedAddOns/unlockedPacks BEFORE the specialty-content eviction (Promise.all(...evictPack...), resetSpecialtyLoadState()) has run. Any code reading memCache directly during that window still serves previously-merged specialty content — entitlement state and cached data are observably inconsistent for the eviction's I/O duration. at store/entitlementStore.ts:clearEntitlement:203.

**Acceptance Criteria:**
- [ ] Entitlement state and memCache eviction complete atomically from any external observer's perspective (e.g. eviction awaited before the state flip, or a documented/tested acceptable window)
- [ ] Test: a read of memCache during clearEntitlement's in-flight eviction does not return already-cleared-should-be-inaccessible specialty content

**Source:** Audit finding F065 — severity 4 — async

---

### Task #439: Fix code-quality: PackMemCache.write is typed synchronous/void but performs hidden async storage I/O

**File:** lib/packCache.ts, lib/packTypes.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Charles (W18C); doc comment only on the PackMemCache interface, no type/signature change — the async I/O is genuinely fire-and-forget, so Promise<void> would be dishonest too)

**What:**
write(lang, pack):void (lib/packTypes.ts's PackMemCache interface, implemented at lib/packCache.ts:113-122) is typed as synchronous/void, but the concrete implementation also fires _clearSpecialtyStorageKeys, an async function performing platform-storage removeItem I/O — a caller relying on the interface contract has no signal that write() triggers disk/Tauri-store mutations as a side effect. at lib/packCache.ts:PackMemCacheImpl.write:113.

**Acceptance Criteria:**
- [ ] write()'s type signature or doc comment makes the hidden async I/O side effect visible to callers
- [ ] No behavior change required — this is a contract-honesty fix, not a functional one

**Source:** Audit finding F068 — severity 4 — code-quality

---

### Task #440: Fix security: purchasedAddOns-excluded-from-restore guarantee is enforced only by one call site's convention, not a mechanism

**File:** hooks/useExportImport.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-27 (Wave 17 — Derek (W17D); added RestorableEntitlement = Omit<BackupEntitlement, "purchasedAddOns"> and excludePurchasedAddOns() so the exclusion is structural, not just which fields readFile happens to destructure)

**What:**
The promise "purchased add-ons cannot be restored from an unsigned backup" is enforced only by hooks/useExportImport.ts:readFile:81's manual destructuring choice (deliberately omitting purchasedAddOns), not by any type-level or runtime guard — a future caller writing `setEntitlement({...result.entitlement, licenseKey, instanceId})` would silently reintroduce unauthenticated add-on restoration. This is not hypothetical: a stray abandoned worktree found during this audit already demonstrates exactly this regression happening in a copy of the code. at hooks/useExportImport.ts:readFile:81.

**Acceptance Criteria:**
- [ ] The exclusion of purchasedAddOns from a restored backup is enforced by a type (e.g. an Omit<> type on the restore payload) or a runtime guard, not solely by which fields a call site happens to destructure
- [ ] Test: a naive full-spread restore call is prevented at compile time or caught at runtime, not silently allowed

**Source:** Audit finding F069 — severity 5 — security

---

### Task #441: Fix code-quality: isSpecialtyPackCode's name promises registration but its implementation also checks readiness

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 18 — Derek (W18D); documentation over rename — isRegisteredSpecialtyCode (Wave 17's #407) already provides the registration-only half; added a doc-comment cross-reference on isSpecialtyPackCode instead of reviving the isReadySpecialtyPackCode name Task #380 deliberately deleted)

**What:**
isSpecialtyPackCode's name promises "is this a specialty pack code" (registration membership), but the implementation is `sp.code===s && sp.ready` — a registered-but-unshipped code returns false, indistinguishable from an unregistered/garbage code. store/migrations.ts and lib/importBackup.ts both had to hand-roll a separate check specifically to route around what the function's name implies it checks — this contract mismatch is the root cause driving Task #407/F001's 5-file duplication. at lib/langRegistry.ts:isSpecialtyPackCode:103.

**Acceptance Criteria:**
- [ ] Either rename isSpecialtyPackCode to reflect that it also checks readiness (e.g. isReadySpecialtyPackCode, noting the prior alias of that exact name was deleted under Task #380 for being redundant — a fresh naming decision is needed here, not a revival), or split it into a registration-only predicate plus a readiness check
- [ ] Task #407 (the 5-file duplication) should be sequenced together with or after this task, since this is its root cause

**Source:** Audit finding F074 — severity 4 — code-quality

---

### Task #442: Fix correctness: unpurchased-specialty redirect fires before entitlement-store hydration completes, permanently corrupting the persisted language selection

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, gate the render-body computation and repair effect on the same entitlementHydrated flag already used elsewhere in this file
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Barry (W19B); unpurchasedSpecialty now gated on entitlementHydrated||hydrationGraceExpired, staying undefined pre-hydration so a genuinely-owned code is never redirected before ownership is confirmed)

**What:**
`unpurchasedSpecialty` is computed in the render body from `purchasedAddOns` with no gate on `entitlementHydrated` — that flag only gates a separate dynamic-load effect. Before the entitlement store finishes async hydration, `purchasedAddOns` is the Zustand default `[]`. If the persisted `LANG_PAIR_KEY` is a genuinely-owned ready specialty code, this computes `unpurchasedSpecialty` as truthy, and the repair effect immediately calls `setTargetLangCode(targetLang)`, permanently overwriting the user's real paid selection in persistent storage — since the effect's own guard is `rawTargetLang===targetLang`, once the fallback is persisted the bug never self-corrects even after real hydration completes with the true ownership data. Currently dormant (no specialty pack is `ready:true` yet) but will hit real paying customers the moment one ships, especially on Tauri (async IPC store) or slow web hydration. This is the same "fix the named instance, miss the sibling" pattern as Task #414, which fixed the identical hydration-gating omission for a different piece of entitlement state in this same file. at hooks/useLangPack.ts:useLangPack:110.

**Acceptance Criteria:**
- [ ] The render-body `unpurchasedSpecialty` computation and its repair effect are gated on `entitlementHydrated` (or `hydrationGraceExpired`), mirroring the existing dynamic-load effect's gate
- [ ] Test: a genuinely-owned ready specialty code in `LANG_PAIR_KEY`, with the entitlement store not yet hydrated, is NOT redirected/persisted away from the owned pack — only redirected once hydration confirms non-ownership
- [ ] The repair effect's log message (line 191) no longer asserts a confident permanent diagnosis when the underlying read may be pre-hydration

**Source:** Audit finding F001 — severity 6 — correctness/data-integrity (2-way independent auditor convergence)

---

### Task #443: Fix validator-completeness: hasValidUnitsArray never validates card.prerequisites' shape, a live crash path

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Adam (W19A); card.prerequisites, when present, must be an array of strings — traced and closed the exact live TypeError shape (a non-empty string value passing the truthy-length check but lacking .every))

**What:**
hasValidUnitsArray validates unitCount/cardCount, units array shape, and per-unit/per-card fields including `Array.isArray` checks on `unit.prerequisiteUnits` and `card.tags` — but never examines `card.prerequisites` at all. `card.prerequisites` is read by `lib/srs.ts:206-207` (`card.prerequisites.every(...)`), reachable from both `store/srsStore.ts`'s `getNewCards` (the live FSRS new-card queue, used by the shipped Italian pack today) and the introduction engine. A malformed pack with a non-array-but-truthy `prerequisites` value would throw a TypeError in a live, currently-shipping code path — not gated behind specialty packs being unready, since this validates the base Italian pack too. Practical likelihood is tempered by packs coming from a sha256-verified, self-controlled CDN, but the validator's own stated purpose is unmet for this field. at lib/packTypes.ts:hasValidUnitsArray:79.

**Acceptance Criteria:**
- [ ] hasValidUnitsArray validates that card.prerequisites, when present, is an array of strings
- [ ] Test: a pack with a non-array-but-truthy card.prerequisites value is rejected by the validator, not left to crash lib/srs.ts downstream

**Source:** Audit finding F021 — severity 7 — validator-completeness/live-path

---

### Task #444: Fix test-coverage: app/stats/page.tsx's entire populated-dashboard render path has zero happy-path test coverage

**File:** app/stats/page.tsx, app/stats/page.test.tsx
**Complexity:** ⚡ Direct — 2 files, no package boundary — write tests against existing code, no production logic change expected
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Charles (W19C); coverage on app/stats/page.tsx rose from 40%/66.66% to 100%/100%/100%/93.75% funcs/stmts/lines/branches — the one remaining uncovered branch is a pre-existing, already-covered concern outside this task's scope)

**What:**
Every test in app/stats/page.test.tsx drives the page with EMPTY_STATS (hardest:[], weakestTags:[], levelStability:[]) or a Pro-gate-blocked state; even the one exception (seen:10) still zeroes those three arrays. Coverage confirms app/stats/page.tsx sits at 40% function / 66.66% statement coverage, with lines 86-126 — the DifficultyBar-rendering branch, the weakestTags block, and the levelStability retention-bars block (including stabilityColorClass and its width-percentage calculation) — never executing under test. This is the core value-delivery view of the paid Stats page shipping with zero happy-path test coverage — AGENTS.md's Stop-the-Line list explicitly names "any user-visible feature with zero tests covering its happy path." at app/stats/page.tsx:StatsPage:86.

**Acceptance Criteria:**
- [ ] At least one test populates hardest/weakestTags/levelStability with real data and asserts the DifficultyBar, weakestTags, and retention-bar rendering branches all execute and render expected content
- [ ] Coverage on app/stats/page.tsx rises to reflect lines 86-126 being exercised

**Source:** Audit finding F014 — severity 7 — test-coverage/stop-the-line

---

### Task #445: Fix resilience: no pack/manifest fetch call has a timeout, so a single hung connection permanently poisons the in-flight cache

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 3 files, same fix pattern applied at each fetch call site
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Adam (W19A); AbortController + 20s timeout at all 3 sites, timeout flows into each site's existing typed-failure catch path unchanged)

**What:**
None of the pack/manifest fetch() calls (lib/basePackLoader.ts's load path, lib/specialtyPackLoader.ts's _doLoad, lib/packLoader.ts's fetchManifest) have an AbortController or timeout. Each is guarded by an in-flight promise cache that only releases its map entry on settlement. A single hung TCP connection leaves that promise permanently pending — every concurrent and future caller for that language/manifest piggybacks on the dead promise for the rest of the process's life, with zero recovery path short of restarting the app. This affects the live base-pack load path already serving real users today. at lib/basePackLoader.ts:loadBasePackFromStorageOrNetwork:183.

**Acceptance Criteria:**
- [ ] All 3 fetch call sites use an AbortController with a reasonable timeout (e.g. 15-30s)
- [ ] A timed-out fetch releases its in-flight cache entry and returns a typed failure result, not a permanently-pending promise
- [ ] Test: a fetch that never resolves is timed out and a subsequent call for the same language/manifest succeeds normally afterward

**Source:** Audit finding F023 — severity 6 — resilience/live-path

---

### Task #446: Fix correctness: getLangPair's repair doesn't actually match getTargetLangCode's, risking a silently corrupted storage key

**File:** lib/constants.ts, tests/constants.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Barry (W19B); getLangPair now shares getTargetLangCode's exact malformed-value derivation, structurally impossible to drift apart again on this check)

**What:**
getLangPair's doc comment claims parity with getTargetLangCode's malformed-value repair, but getLangPair only checks `indexOf("-")===-1`, missing the empty-tail case — a stored "en-" has a hyphen so it skips repair and is returned unrepaired and unlogged. This feeds directly into store/srsStore.ts's persisted storage key (`srs-${_activeLangPair}`), producing a malformed key like "srs-en-" instead of "srs-en-it". tests/constants.test.ts has an "en-" case for getTargetLangCode but not for getLangPair — the same gap exists in both code and test. at lib/constants.ts:getLangPair:82.

**Acceptance Criteria:**
- [ ] getLangPair repairs an empty-tail value ("en-") the same way getTargetLangCode does, with a logged fallback
- [ ] Test: a stored "en-" value is repaired and logged, matching the existing getTargetLangCode test for the same shape of input

**Source:** Audit finding F008 — severity 6 — correctness/rule-22d-parity

---

### Task #447: Fix rule-violation: lib/specialtyPackLoader.ts is now over the 400-line service cap

**File:** lib/specialtyPackLoader.ts
**Complexity:** 🔧 Full — extract a cohesive slice, following the same pattern used for store/entitlementStore.ts → store/entitlementAddOns.ts
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Adam (W19A); extracted the parse-verify-merge-persist commit step into new lib/specialtyPackMerge.ts — 351/131 lines, both well under cap)

**What:**
lib/specialtyPackLoader.ts is 430 lines, 30 over the Rule 1 400-line services cap — a fresh, open violation arising in the same wave family that just fixed store/entitlementStore.ts's identical cap violation via a deliberate split (Task #412). at lib/specialtyPackLoader.ts:module:1.

**Acceptance Criteria:**
- [ ] File split so no resulting file exceeds 400 lines, following the entitlementStore.ts → entitlementAddOns.ts extraction pattern
- [ ] All existing tests pass unchanged
- [ ] CLAUDE.md updated with the new module's role

**Source:** Audit finding F007 — severity 5 — rule-violation/file-size

---

### Task #448: Fix correctness: parseFlag silently enables a safe-off flag when its env var is set to an empty string

**File:** lib/featureFlags.ts, tests/featureFlags.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Charles (W19C); empty-string env var now treated the same as unset for every flag, not just specialtyPacks)

**What:**
parseFlag(v, defaultEnabled) only returns defaultEnabled when v===undefined; an env var explicitly set to the empty string skips that branch and falls through to enabled=true regardless of the flag's intended safe-off default. No test covers the empty-string case. A deployment config that sets a flag var to an empty string (a realistic misconfiguration, e.g. an unset CI template variable) silently enables an unfinished feature meant to default off. at lib/featureFlags.ts:parseFlag:26.

**Acceptance Criteria:**
- [ ] parseFlag treats an empty-string env var the same as unset (falls through to defaultEnabled)
- [ ] Test: NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS="" yields the flag disabled, same as unset

**Source:** Audit finding F009 — severity 5 — correctness

---

### Task #449: Fix security: createPurchaseAddOn has no post-await deactivation-guard re-check

**File:** store/entitlementAddOns.ts
**Complexity:** ⚡ Direct — 1 file, mirror the existing deactivationGuard pattern from lib/specialtyPackLoader.ts
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Barry (W19B); new ERR_ADDON_DEACTIVATED discriminant, guard re-checked immediately before the purchasedAddOns append; clearEntitlement bumps it via a new exported trigger)

**What:**
The Pro/entitlement gate (isProEnabled) is checked once at function entry, then the function awaits a network round-trip (verify_addon_receipt IPC) before unconditionally appending code to purchasedAddOns via a functional set() — with no generation/deactivation-guard re-check after the await, unlike the sibling specialty-pack-load path (lib/specialtyPackLoader.ts's deactivationGuard, added specifically for this exact class of bug per Task #394/#409). If clearEntitlement() resolves while a purchaseAddOn IPC call is in flight, the functional set() reads the current (post-deactivation, reset-to-[]) state and re-adds code to it, silently resurrecting a purchase record after the license was cleared. Dormant since purchaseAddOn is an intentional stub (#295), but the gate gap is real and structurally asymmetric with an established pattern in this same codebase. at store/entitlementAddOns.ts:createPurchaseAddOn:120.

**Acceptance Criteria:**
- [ ] createPurchaseAddOn re-checks a deactivation/generation guard (mirroring lib/specialtyPackLoader.ts's pattern) immediately before the functional set() that appends the purchased code
- [ ] Test: a clearEntitlement() resolving while a purchaseAddOn IPC call is in flight does not resurrect the purchase record

**Source:** Audit finding F022 — severity 5 — security/rule-19b-symmetry

---

### Task #450: Fix test-quality: EntitlementValidator.test.tsx has a test that doesn't prove its own name, plus banned assertions that evade the project's grep gate

**File:** components/EntitlementValidator.test.tsx, AGENTS.md
**Complexity:** ⚡ Direct — 2 files, no package boundary — fix the test + widen the gate's scan scope
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Derek (W19D); AGENTS.md's grep gate now scans the whole repo, not just tests/ — this immediately surfaced ~29 pre-existing violations across 12 other files outside this task's scope, logged as a new debt item rather than silently expanded into a much larger task)

**What:**
The test claiming to prove "mounts UpdateChecker as its invisible child" (line 178) asserts only `expect(result).not.toBeNull()`, which would pass regardless of what the component actually returns. Separately, two `.toBeGreaterThan(0)` assertions on Date.now()-stamped fields (lines 128, 164) carry no inline `// existence-check:` justification as AGENTS.md mandates — and because this file lives under `components/`, the repo's Verification Gate grep command (scoped to `tests/` only) never catches it. This is a live instance of a gap already flagged as theoretical in a Batch 18 finding. at components/EntitlementValidator.test.tsx:128.

**Acceptance Criteria:**
- [ ] The "mounts UpdateChecker" test asserts the actual rendered output contains/is UpdateChecker, not just non-null
- [ ] Both `.toBeGreaterThan(0)` assertions get an inline `// existence-check:` justification comment, or are replaced with a value-specific assertion
- [ ] The Verification Gate's banned-assertion grep command in AGENTS.md is widened to scan every `*.test.*` file in the repo, not only files under `tests/`

**Source:** Audit finding F016 — severity 6 — test-quality/gate-blind-spot (compounds Audit finding F015)

---

### Task #451: Fix documentation: security.md's own tracked S1/S3 findings are stale — both already resolved

**File:** .autocode/agents/security.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Derek (W19D); S1/S3 moved to a new Resolved Findings section with corrected current file:line citations)

**What:**
security.md's "Open/Monitoring" section lists S1 (purchaseAddOn code validation) and S3 (deactivation-mid-load race) as open risks, but both are already resolved: S1 — store/entitlementAddOns.ts already validates via isSpecialtyPackCode as the first guard (Task #287); S3 — lib/specialtyPackLoader.ts's deactivationGuard already re-checks isStale twice (Task #394/#409). S2 in the same section was correctly updated to reflect its fix, but S1/S3 were not. S1's own cited location ("store/entitlementStore.ts:137") is additionally stale — that code moved to store/entitlementAddOns.ts under Task #412. at .autocode/agents/security.md:47.

**Acceptance Criteria:**
- [ ] S1 and S3 moved to "Resolved Findings" with the correct current file:line citations
- [ ] No behavior/code change — documentation only

**Source:** Audit finding F013 — severity 4 — documentation-staleness/audit-memory

---

### Task #452: Fix test-quality: a hollow #435 hydration test never advances timers far enough to invoke the code it claims to test

**File:** tests/storage.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Derek (W19D); test now asserts the finish-listener count grows when the failsafe timer fires, since a pure "nothing to reconcile" outcome can't otherwise distinguish real logic from its absence)

**What:**
The test "#435: does not reconcile when hydration finishes normally (no failsafe, no clobber risk)" would pass on deletion of the reconciliation code under test, because it never advances timers past HYDRATION_FAILSAFE_MS — the code under test is never actually invoked regardless of whether it exists. at tests/storage.test.ts:1.

**Acceptance Criteria:**
- [ ] The test advances fake timers to a point where the reconciliation logic would actually run if it existed, and the assertion demonstrably fails when that logic is deleted (Deletion Test)

**Source:** Audit finding F020 — severity 4 — test-quality/rule-18

---

### Task #453: Fix test-quality: useLicenseActivation.test.ts asserts lastValidated via expect.any(Number) instead of a value near Date.now()

**File:** hooks/useLicenseActivation.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 19 — Derek (W19D); replaced with a bounded before/after Date.now() range check, matching the existing sibling test's pattern)

**What:**
The "ok path..." test asserts lastValidated via expect.any(Number) instead of a value near Date.now() — a wrong implementation that passes the literal 0 (the value used by the unrelated backup-restore path) would still satisfy this assertion. Contrast with hooks/useExportImport.test.ts's sibling test, which correctly pins the exact literal. at hooks/useLicenseActivation.test.ts:47.

**Acceptance Criteria:**
- [ ] The assertion pins a value near Date.now() (fake timers or a bounded range check), not expect.any(Number)
- [ ] Deletion Test: passing a literal 0 for lastValidated now fails this test

**Source:** Audit finding F012 — severity 4 — test-quality/rule-18

---

### Task #454: Fix test-quality: EntitlementValidator.test.tsx's "mounts UpdateChecker" test doesn't prove its own name

**File:** components/EntitlementValidator.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (merged into Task #450 at consolidation time — #450's first acceptance criterion is this exact fix; not a separate piece of work. No code change attributable to this task number specifically.)

**What:**
Test name claims it "mounts UpdateChecker as its invisible child" but asserts only expect(result).not.toBeNull() — this would pass if the component returned any other truthy JSX. Fails the Deletion Test. at components/EntitlementValidator.test.tsx:178.

**Acceptance Criteria:**
- [x] Superseded — see Task #450's first acceptance criterion, which covers this exact fix

**Source:** Audit finding F015 — severity 4 — test-quality/rule-18 (duplicate of Audit finding F016's first criterion, promoted separately by mistake — see Task #450)

---

### Task #455: Fix Verification Gate: 29 pre-existing banned-assertion violations make the widened grep gate fail literally

**File:** components/Stat.test.tsx, components/StudyDoneScreen.test.tsx, components/BuyModal.test.tsx, components/InterruptHandler.test.tsx, components/DifficultyBar.test.tsx, components/UnitRow.test.tsx, components/StudyCard.test.tsx, components/StudyResumePrompt.test.tsx, components/LevelSection.test.tsx, components/settings/Section.test.tsx, components/settings/Toggle.test.tsx, hooks/useStudySession.test.ts
**Complexity:** 🔧 Full — 12 files, mechanical but repo-wide
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Adam (W20A); all 29 hits resolved — 21 stylistic swaps to .toBeInTheDocument(), 6 rewritten to genuine value-specific assertions after reading the real component logic, 0 existence-check exemptions needed; independently re-verified: gate command returns zero hits)

**What:**
Task #450 widened AGENTS.md's Verification Gate grep from `tests/`-only to the whole repo. Run exactly as written, it returns 29 hits across these 12 files — meaning the gate is currently RED by its own unconditional wording ("Run this before closing any batch of work. All four must be green"). Each hit is either a `.toBeDefined()`/`.toBeTruthy()`/`.not.toBeNull()`/`.toBeGreaterThan(0)` on a computed value with no `// existence-check:` justification. Most are `screen.getByText(...).toBeDefined()` (stylistically redundant since RTL's query already throws on absence — low risk) but a few (`StudyCard.test.tsx:118/128`, `UnitRow.test.tsx:51`) assert genuinely computed values and are higher-risk per the Deletion Test. at AGENTS.md:39 (the gate command that currently fails).

**Acceptance Criteria:**
- [ ] Every flagged assertion either replaced with a value-specific `.toBe()`/`.toEqual()`/`.toStrictEqual()`, or annotated with an inline `// existence-check: [reason]` only where the value is genuinely non-deterministic
- [ ] Running AGENTS.md's Verification Gate grep command exactly as written returns zero hits
- [ ] `.autocode/agents/cto.md`'s Batch Audit Log updated to reflect a verified-green gate, not just a closed task

**Source:** Cycle-6 audit finding F1 — severity 9 (CRITICAL) — convergence 1/8 (Agent K, contract verifier) — process/audit-trail integrity. Supersedes the 2026-07-28 debt.md row logged by Task #450/W19D.

---

### Task #456: Fix documentation: security.md S1/S3 citations and generationGuard.ts's header are stale again, broken by this same wave's #447 file split

**File:** .autocode/agents/security.md, lib/generationGuard.ts
**Complexity:** ⚡ Direct — 2 files, single-scope doc fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Charles (W20C); re-verified real current line numbers directly rather than trusting quoted ones; S1 corrected to entitlementAddOns.ts:127, S3 corrected to specialtyPackMerge.ts:64/119 post-#447 split; generationGuard.ts header now lists all 3 real consumers as complete)

**What:**
security.md's "Resolved Findings — S1/S3" note (added by Task #451, this same wave) cites `store/entitlementAddOns.ts:96` (actual: line 127) and `lib/specialtyPackLoader.ts:59/122/177` (actual: `createGenerationGuard()` at line 68; the two `isStale` checks moved entirely to `lib/specialtyPackMerge.ts:64` and `:119` via Task #447, landed in the identical wave). Separately, `lib/generationGuard.ts`'s own header doc comment still falsely claims `specialtyPackLoader.ts`'s adoption of the guard is "tracked as a carry-forward" — that adoption completed and was independently confirmed this cycle. Both are the same root failure: a same-wave sibling task (#447) silently invalidated a precise file:line claim in an unrelated doc. at .autocode/agents/security.md:60.

**Acceptance Criteria:**
- [ ] security.md's S1/S3 citations updated to their real current locations (post-#447 split)
- [ ] lib/generationGuard.ts's header updated to state specialtyPackLoader.ts's adoption is complete, not pending
- [ ] No behavior/code change — documentation only

**Source:** Cycle-6 audit finding F2 — severity 6 — convergence 5/8 (Agents A, B, S, V, K) plus F11 (Agent W, generationGuard.ts header) — documentation accuracy / stale citation.

---

### Task #457: Fix code-quality: getLangPair duplicates getTargetLangCode's derivation logic instead of sharing it

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope extraction
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Barry (W20B); extracted shared deriveLangTail(pair) helper; getTargetLangCode and getLangPair both call it instead of independent copies; overclaiming comment corrected)

**What:**
Task #446 fixed `getLangPair`'s "en-" bug by making its `sepIdx`/`slice` derivation byte-identical to `getTargetLangCode`'s — but as a copy-paste, not a shared function. This reproduces the exact defect class that caused #446 in the first place: two independent copies of the same derivation can silently drift apart again on a future edit. The code comment at lib/constants.ts:87-88 claims the two are "structurally impossible to drift apart again," which overclaims — duplication is not structural prevention. at lib/constants.ts:89-91.

**Acceptance Criteria:**
- [ ] getLangPair and getTargetLangCode share one extracted derivation function/constant, not two independent copies
- [ ] Existing tests for both functions continue to pass unmodified in behavior
- [ ] The misleading "structurally impossible to drift apart" comment is corrected or removed

**Source:** Cycle-6 audit finding F3 — severity 5 — convergence 1/8 (Agent K) — root-cause durability / DRY violation.

---

### Task #458: Fix race condition: useLangPack's hydration-timeout fallback can still permanently persist an unconfirmed redirect

**File:** hooks/useLangPack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Charles (W20C); unpurchasedSpecialty repair effect now only writes to storage when entitlementHydrated is a confirmed true; grace-expired fallback falls back to base language in-memory without persisting an unconfirmed redirect; new ERR-LANGPACK-ADDON-UNCONFIRMED ref-ID)

**What:**
Task #442 fixed the common case of `unpurchasedSpecialty` being computed before entitlement hydration completes, by gating on `(entitlementHydrated || hydrationGraceExpired)`. Two independent reviewers (Security Agent S and naive-reader Agent N, with no shared context) found a narrower residual: when hydration is genuinely stuck — not just slow — and `hydrationGraceExpired` fires as a timeout fallback, that branch can still write a redirect that was never actually confirmed against real entitlement data. The fix narrowed the bug's trigger window (slow hydration is now handled) but did not close it for the true-timeout path. at hooks/useLangPack.ts:140.

**Acceptance Criteria:**
- [ ] The `hydrationGraceExpired` branch does not permanently persist a redirect/localStorage write when it cannot confirm real entitlement state
- [ ] A test forces genuine hydration failure (not just slowness) and asserts no unconfirmed redirect is persisted
- [ ] Deletion Test: reverting the fix causes the new test to fail

**Source:** Cycle-6 audit finding F4 — severity 6 — convergence 2/8 (Agents S and N, independently) — race condition / correctness, LIVE.

---

### Task #459: Fix CI drift: scripts/validatePack.ts still not synced with lib/packTypes.ts's hasValidUnitsArray (two divergences, open across 2 audit cycles)

**File:** scripts/validatePack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope sync
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Charles (W20C); added the card.prerequisites array-of-strings check to validateCard and the unitCount/cardCount cross-check to validatePack, matching hasValidUnitsArray exactly; new tests/validatePack.test.ts, 14 tests; validated against both shipped packs unchanged)

**What:**
`lib/packTypes.ts`'s own doc comment mandates scripts/validatePack.ts's `validateUnit`/`validateCard` stay in sync with `hasValidUnitsArray`. Two concrete divergences confirmed by two independent reviewers across two consecutive audit cycles: (1) Task #443's `card.prerequisites` array-of-strings check has no counterpart in `validateCard` — a pack with `prerequisites: "c0"` (a truthy non-array) passes CI and only crashes at runtime via `lib/srs.ts:207`'s unguarded `.every()` against the live shipped Italian pack's FSRS queue. (2) Task #418's `unitCount`/`cardCount` cross-check (declared count must equal real array length) has no counterpart in `validatePack` — it only echoes `cardCount` in a log line, never validates it. A pack with internally inconsistent counts passes CI and silently corrupts `lib/specialtyPackMerge.ts`'s merge arithmetic downstream. at scripts/validatePack.ts:33.

**Acceptance Criteria:**
- [ ] validateCard rejects a present-but-non-array-of-strings `prerequisites` field, matching hasValidUnitsArray
- [ ] validatePack rejects a pack whose declared unitCount/cardCount doesn't match real array lengths, matching hasValidUnitsArray
- [ ] A regression test in the validator's own test coverage (or a new one) enumerates both gaps and fails without the fix

**Source:** Cycle-6 audit finding F5 — severity 6 — convergence 2/8 (Agent K originally; Agent W independently reconfirmed plus found the second divergence) — CI/tooling drift, recurring debt (also flagged in cycle 5). Supersedes the 2026-07-28 debt.md row logged by Task #443/W19A.

---

### Task #460: Fix data-integrity: importBackup.ts's normalizeCardProgress doesn't clamp difficulty/retrievability on restore

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Derek (W20D); difficulty clamped to [1,10], retrievability to [0,1], matching lib/srs.ts's own bounds; 4 new tests in tests/importBackup.test.ts)

**What:**
`normalizeCardProgress` restores backup data without range-clamping the FSRS `difficulty`/`retrievability` numeric fields. A crafted or corrupted backup file can inject out-of-range values that the scheduler was never designed to receive. This is a pre-existing gap, not introduced by Wave 19, found by an unbriefed naive-reader agent reading the restore path fresh. at lib/importBackup.ts:1.

**Acceptance Criteria:**
- [ ] difficulty and retrievability are clamped to their valid FSRS ranges during restore, matching whatever bounds lib/srs.ts already assumes elsewhere
- [ ] A test supplies an out-of-range value in a backup fixture and asserts the restored value is clamped, not passed through

**Source:** Cycle-6 audit finding F6 — severity 5 — convergence 1/8 (Agent N) — data integrity, LIVE.

---

### Task #461: Fix test-coverage: lib/specialtyPackMerge.ts has no dedicated test file

**File:** tests/specialtyPackMerge.test.ts (new)
**Complexity:** ⚡ Direct — 1 new file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Derek (W20D); new tests/specialtyPackMerge.test.ts, 11 tests calling mergeSpecialtyPackFromJson directly; covers meta-before-data ordering and both deactivation-guard isStale re-checks; 100% coverage on the module combined with existing specialtyPackLoader.test.ts)

**What:**
`lib/specialtyPackMerge.ts` — the highest-risk brand-new extraction this cycle (Task #447), owning the parse-verify-merge-persist "commit" step for specialty pack purchases — has no test file of its own. It is exercised only indirectly through `tests/specialtyPackLoader.test.ts`'s call chains into the shared `loadSpecialtyPack` entry point. Its own documented invariants (meta-written-before-data crash-safety ordering; the two independent `deactivationGuard.isStale()` re-checks bracketing storage writes) are proven only incidentally by whatever the caller's test suite happens to construct, not by tests scoped to the unit doing the risky work. at lib/specialtyPackMerge.ts:1.

**Acceptance Criteria:**
- [ ] tests/specialtyPackMerge.test.ts exists, directly calling mergeSpecialtyPackFromJson
- [ ] Covers the meta-before-data write ordering and both deactivation-guard isStale re-check points directly, not just via the caller
- [ ] Existing tests/specialtyPackLoader.test.ts coverage is not duplicated, only supplemented

**Source:** Cycle-6 audit finding F7 — severity 4 — convergence 1/8 (Agent W) — test coverage, DORMANT (specialty packs not yet ready:true).

---

### Task #462: Fix incomplete root-cause: parseFlag still resolves any non-conforming truthy env value to enabled=true

**File:** lib/featureFlags.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Derek (W20D); added TRUTHY_FLAG_VALUES allowlist so parseFlag only returns true for a recognized truthy value, false for a recognized falsy value, defaultEnabled for anything else; 2 new tests in tests/featureFlags.test.ts)

**What:**
Task #448 fixed `parseFlag` to fall through to `defaultEnabled` for `undefined` and `""` env values. Agent V found this only closes those two specific cases: any OTHER unrecognized-but-truthy value (e.g. a typo'd env var that isn't `"true"`/`"1"`/`""`/undefined) still resolves to `enabled=true` regardless of `defaultEnabled` — meaning a malformed env value could unintentionally enable a Pro-gated feature. Same shape as #446/#442: the reported repro case was fixed, a nearby variant of the same bug was not. at lib/featureFlags.ts:31.

**Acceptance Criteria:**
- [ ] parseFlag treats any value that isn't a recognized truthy signal ("true"/"1") as falling through to defaultEnabled, not defaulting to true
- [ ] A test supplies a garbage-but-non-empty env value against both a default-off and default-on flag and asserts defaultEnabled wins in both cases

**Source:** Cycle-6 audit finding F8 — severity 5 — convergence 1/8 (Agent V) — incomplete root-cause fix, LIVE (gates isProEnabled broadly, not specialty-pack-specific).

---

### Task #463: Fix Rule 1: store/entitlementStore.ts and lib/packLoader.ts have crept back over the 400-line cap

**File:** store/entitlementStore.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 2 files, extraction work
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Barry (W20B); extracted store/entitlementCrossTabSync.ts (cross-tab sync dedup/queue logic, 355 lines remaining in entitlementStore.ts) and lib/packManifest.ts (fetchManifest/isValidManifestShape, 310 lines remaining in packLoader.ts, re-exported for API compatibility); second extraction pass for both files — flagged for a possible different-seam split if either creeps over the cap a third time)

**What:**
Two independent reviewers (Agents A and B) confirmed store/entitlementStore.ts is now 403 lines and lib/packLoader.ts is now 402 lines — both over the Rule 1 400-line cap, after this wave's edits. This is the same extraction pattern already applied twice this batch (entitlementAddOns.ts split from entitlementStore.ts in Wave 18; specialtyPackMerge.ts split from specialtyPackLoader.ts in Wave 19) — both files need another narrow, non-circular extraction. at store/entitlementStore.ts:1.

**Acceptance Criteria:**
- [ ] Both files reduced to at or under 400 lines via a narrow extraction following the established pattern (parameter-typed interfaces, no circular imports)
- [ ] No behavior change; existing tests pass unmodified

**Source:** Cycle-6 audit finding F9 — severity 4 — convergence 2/8 (Agents A and B, independently) — Rule 1 cap regression, LIVE.

---

### Task #464: Fix defensive-depth gap: fetch timeout relies solely on AbortController with no independent backstop

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts
**Complexity:** 🔧 Full — 3 files, same pattern across all
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Barry (W20B); new lib/fetchWithTimeout.ts shared helper bounds fetch via BOTH AbortController and an independent Promise.race/setTimeout backstop with no dependency on the abort signal being honored; 6 new tests including a pathological non-conformant-fetch case; done together with #465)

**What:**
Task #445's fetch timeout fix relies entirely on `AbortController` and the assumption that `fetch()` honors the abort signal. Red Agent R (CHAOS lens) found no independent `Promise.race`/`setTimeout` backstop exists — a hypothetical non-conformant fetch implementation that ignores the abort signal would still hang forever, reproducing the original bug under a narrower trigger condition. at lib/basePackLoader.ts:194.

**Acceptance Criteria:**
- [ ] All 3 fetch call sites have an independent timeout backstop (e.g. Promise.race against a setTimeout) that does not rely solely on the fetch implementation honoring AbortController
- [ ] A test simulates a fetch that never settles and never honors abort, and asserts the call still resolves to a timeout error within bounded time

**Source:** Cycle-6 audit finding F18 — severity 4 — convergence 1/8 (Red Agent R, CHAOS lens) — defensive-depth gap, LIVE.

---

### Task #465: Fix Poka-Yoke violation: FETCH_TIMEOUT_MS declared independently in 3 files by this same wave's own fix

**File:** lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packLoader.ts, lib/constants.ts
**Complexity:** 🔧 Full — 4 files
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Barry (W20B); FETCH_TIMEOUT_MS now declared once in lib/constants.ts, imported by lib/fetchWithTimeout.ts's single shared implementation, replacing 3 independent copies; test pins the exact 20_000 value)

**What:**
Task #445 declared `FETCH_TIMEOUT_MS = 20_000` independently in 3 separate files rather than one shared constant — a fresh instance of the "parallel constant, not single source of truth" anti-pattern already tracked elsewhere in this codebase (the 200-char length constants across entitlementAddOns.ts/useLicenseActivation.ts/importBackup.ts). AGENTS.md explicitly Stop-the-Lines this exact pattern: "Any hardcoded string that belongs in a named constant" / "Any parallel list/array that should be derived from a single source of truth." Notable because it was introduced brand-new by this wave's own fix, not inherited debt. at lib/basePackLoader.ts:194.

**Acceptance Criteria:**
- [ ] FETCH_TIMEOUT_MS declared once (e.g. in lib/constants.ts) and imported by all 3 call sites
- [ ] A test asserts numeric equality can never drift (either by sharing the import directly, or an explicit cross-check test if a shared import isn't feasible)

**Source:** Cycle-6 audit finding F19 — severity 4 — convergence 1/8 (Red Agent R, DECAY lens) — Poka-Yoke / parallel-constant anti-pattern, freshly reproduced, LIVE.

---

### Task #466: Add mechanical CI enforcement of AGENTS.md's Verification Gate banned-assertion grep

**File:** .github/workflows/ci.yml
**Complexity:** ⚡ Direct — 1 file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 20 — Adam (W20A); new CI step runs AGENTS.md's exact grep command and exit-1s on any hit, placed after Tests/before Build with a comment linking the two files; verified by temporarily reintroducing one violation and confirming detection, then restoring)

**What:**
Task #455 (cycle-6 finding F1) exists because the Verification Gate's banned-assertion grep is prose-only in AGENTS.md — nothing mechanically runs it. `.github/workflows/ci.yml` currently runs `npm audit`, `tsc --noEmit`, lint, tests, build, and pack validation, but never AGENTS.md's own grep command. This is the actual root cause of how the gate went red without anyone noticing: the "all four gates must be green" rule has always relied on a human or an agent remembering to run it by hand. Root-cause fix per Max's explicit instruction: mechanical enforcement, not honor system. at .github/workflows/ci.yml:37.

**Acceptance Criteria:**
- [ ] A new CI step runs AGENTS.md's exact banned-assertion grep command (or an equivalent script) and fails the job (non-zero exit) if it finds any unjustified hit
- [ ] The step is added AFTER Task #455's fixes land (either same-wave same-commit, or explicitly sequenced) so CI does not immediately start failing on the pre-existing 29 hits this task didn't cause
- [ ] A comment in ci.yml notes this step is the mechanical enforcement of AGENTS.md's Verification Gate, so the two files don't drift apart again
- [ ] Verified by pushing/simulating a PR that reintroduces one banned assertion and confirming CI fails on it

**Source:** Cycle-6 audit finding F1 follow-up — severity 7 — owner-directed (Max, 2026-07-28): "We should be mechanically enforcing things instead of relying on the honor system." Companion to Task #455 — that task clears the existing debt, this task prevents it from silently recurring.

---

### Task #467: Fix data-integrity: parseBackup's newer-app-version compatibility gate is bypassed by a truthy non-number _version

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Adam (W21A); added typeof data._version !== "number" to the shape guard; verified via direct execution before and after the fix, plus by hand-reverting and confirming the new tests fail)

**What:**
parseBackup's early guard (`!data._version`) only rejects falsy values; the newer-version rejection only fires `if (typeof data._version === "number" && data._version > CURRENT_BACKUP_VERSION)`. A truthy non-number `_version` (e.g. the string `"999"`) passes both guards untouched, completely bypassing the "reject backups written by a newer app" check this function exists to enforce. Confirmed by direct execution: `parseBackup({_version: "999", srs:{...}, entitlement:{...}})` returns `{ok:true,...}` instead of the intended rejection. A hand-edited or corrupted backup (or a genuinely newer app version that ever serializes _version as a string) defeats the entire compatibility gate. at lib/importBackup.ts:94.

**Acceptance Criteria:**
- [ ] A non-number (but truthy) _version value is rejected the same way an out-of-range number is, with the same or an equally clear error message
- [ ] A test supplies a string _version like "999" and asserts the backup is rejected, not silently accepted

**Source:** Cycle-7 audit finding F01 — severity 7 — convergence 1/8 (Agent N, verified via direct execution) — LIVE, shipped backup-restore path.

---

### Task #468: Fix error-handling: validatePack's card-ID-uniqueness loop throws uncaught instead of returning errors

**File:** scripts/validatePack.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Adam (W21A); mirrored validateUnit's isObj/isArray guards before the duplicate-ID loop's unit/cards/card access; verified via direct execution that the crash is gone and duplicate detection still works)

**What:**
The duplicate-card-ID check (`for (const unit of (raw["units"] as Json[])) { for (const card of (unit["cards"] as Json[])) ... }`) casts without the same isArray() guard validateUnit already uses (line 118) before its own "cards must be an array" error. A unit with `cards: null` throws an uncaught TypeError ("... is not iterable") instead of returning the accumulated string[] of errors, breaking the function's own `(raw): string[]` contract and crashing the CI validator process (`npm run pack:validate:all`) on exactly the malformed input the validator exists to catch gracefully. Confirmed by direct execution. at scripts/validatePack.ts:181.

**Acceptance Criteria:**
- [ ] The duplicate-ID loop guards against a non-array cards field the same way validateUnit's own check does, and accumulates an error instead of throwing
- [ ] A test supplies a unit with cards:null (or any non-array) and asserts validatePack returns a normal error array, not an uncaught exception

**Source:** Cycle-7 audit finding F02 — severity 6 — convergence 1/8 (Agent N, verified via direct execution) — LIVE, this is the real CI pack-validation code path.

---

### Task #469: Fix test-coverage: store/entitlementCrossTabSync.ts has no dedicated test file for its concurrency-safety logic

**File:** tests/entitlementCrossTabSync.test.ts (new)
**Complexity:** ⚡ Direct — 1 new file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Barry (W21B); new 11-test file covering dedup, requeue (including multi-hop and burst-collapse), and synchronous-throw AND async-rejection recovery paths; 100% stmt/branch/func/line coverage on the module, up from 72.72%/62.5% incidental)

**What:**
No test file in the repo imports store/entitlementCrossTabSync.ts by name. Its 72.72%/62.5% stmt/branch coverage is 100% incidental fallout from entitlementStore's own tests. The dedup-in-flight path (Task #304), the requeue-after-in-flight-settles path (Task #347, lines ~68), and the synchronous-throw catch-recovery path (Task #363, lines ~79-83) — the exact concurrency-safety guarantees this module's own header comment claims — are never directly exercised by any test. The same wave's Task #461 gave a structurally identical sibling extraction (lib/specialtyPackMerge.ts) a full dedicated test file specifically because it was flagged "highest-risk"; this module, carrying comparable concurrency-safety logic, did not get the same treatment. This is the highest-convergence finding of cycle 7 — 5 of 8 independent reviewers found it via 5 different methods. at store/entitlementCrossTabSync.ts:1.

**Acceptance Criteria:**
- [ ] tests/entitlementCrossTabSync.test.ts exists, calling createCrossTabSync directly with a fake rehydrate function
- [ ] Covers: concurrent/rapid storage events while a rehydrate is in flight (the requeue path), and a rehydrate() that throws synchronously (the catch-recovery path that resets rehydrateInFlight rather than locking it true forever)
- [ ] Existing indirect coverage via tests/entitlement.test.ts / tests/entitlementStoreEventWiring.test.ts is not duplicated, only supplemented

**Source:** Cycle-7 audit finding F03 — severity 5 — convergence 5/8 (Agents A, B, K, W, Red R — highest convergence this cycle) — LIVE, this sync mechanism runs in production web builds today, not gated behind specialty-pack readiness.

---

### Task #470: Fix documentation: generationGuard.ts's corrected header now contradicts two sibling docs touched the same wave

**File:** lib/basePackLoader.ts, tests/generationGuard.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope doc fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Charles (W21C); both comments corrected to state the adoption is complete; grepped the whole repo for "carry-forward" post-fix to confirm no 4th code/test file makes the stale claim)

**What:**
Task #456 (Wave 20) corrected lib/generationGuard.ts's header to state all 3 GenerationGuard adoptions are complete ("none is a carry-forward"). But lib/basePackLoader.ts:78-79 — touched that SAME wave for the fetchWithTimeout swap — still says "that file's adoption is a tracked carry-forward," directly contradicting the just-corrected header. tests/generationGuard.test.ts:3 also still says "via carry-forward." Three files now disagree on the same fact. This is a direct recurrence, one file away, of the exact citation-staleness class Task #456 itself existed to close (Rule 23: a fix must not recreate its own defect class). at lib/basePackLoader.ts:79.

**Acceptance Criteria:**
- [ ] lib/basePackLoader.ts's comment updated to state specialtyPackLoader's adoption is complete, not a carry-forward
- [ ] tests/generationGuard.test.ts's comment updated to match
- [ ] No behavior change — documentation only

**Source:** Cycle-7 audit finding F04 — severity 4 — convergence 2/8 (Agents A, B) — Rule 23 direct hit (a fix reproducing its own defect class one hop away).

---

### Task #471: Fix test-quality: featureFlags.ts's TRUTHY_FLAG_VALUES second entry ("1") is never exercised by any test

**File:** tests/featureFlags.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Charles (W21C); 2 new tests for "1" on both a default-off and default-on flag; Deletion Test verified by hand-reverting TRUTHY_FLAG_VALUES and confirming the default-off test fails)

**What:**
Task #462 (Wave 20) made parseFlag symmetric via TRUTHY_FLAG_VALUES = ["true", "1"], mirroring the existing FALSY_FLAG_VALUES. tests/featureFlags.test.ts exhaustively enumerates the falsy side via it.each(["0","off","False","no","NO"]) per Rule 16, but never once sets a flag env var to "1" — only "true" is tested. Deletion Test fails: removing "1" from TRUTHY_FLAG_VALUES breaks zero existing tests. This is a Rule 16 (Enumerate Before You Assert) violation in the exact same wave that introduced the enumeration Rule 16 is named for. at tests/featureFlags.test.ts:1.

**Acceptance Criteria:**
- [ ] A test sets a flag env var to "1" and asserts it resolves to enabled=true, for both a default-off and default-on flag
- [ ] Deletion Test: removing "1" from TRUTHY_FLAG_VALUES now fails the new test

**Source:** Cycle-7 audit finding F05 — severity 4 — convergence 1/8 (Red Agent R) — Rule 16 violation, LIVE (gates isProEnabled broadly).

---

### Task #472: Fix test-quality: fetchWithTimeout.test.ts's "backstop does not fire" test is pseudocode

**File:** tests/fetchWithTimeout.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Derek (W21D); rewrote to spy on global setTimeout/clearTimeout and assert the backstop's specific timer id was cleared; Deletion Test verified by hand-reverting the finally block and confirming the rewritten test fails)

**What:**
The test "the backstop timer does not fire (no unhandled rejection) when fetch settles first" (line 76) claims to prove the backstop timer is inert after early settlement, but deleting the finally block's clearTimeout(backstopTimeoutId!) would NOT fail this test — Promise.race already attaches a rejection handler to the backstop promise at race-call time, so a later, uncleared rejection becomes an already-handled promise with no observable effect the test can detect. This is a Rule 18 (Test Falsifiability / B7) violation in a brand-new file authored this same wave specifically to close a prior test-quality gap. at tests/fetchWithTimeout.test.ts:76.

**Acceptance Criteria:**
- [ ] The test is rewritten to actually prove the timer was cleared — e.g. spy on clearTimeout, or use a mechanism that would observably fail if the timer fired uncleared
- [ ] Deletion Test: removing the finally block's clearTimeout(backstopTimeoutId!) now fails the rewritten test

**Source:** Cycle-7 audit finding F06 — severity 4 — convergence 2/8 (Agents K, V) — Rule 18 violation.

---

### Task #473: Fix CI structural gap: vitest.config.ts excludes scripts/ from coverage, hiding this batch's own validator logic from the Verification Gate

**File:** vitest.config.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 21 — Derek (W21D); narrowed the blanket "scripts" exclude to just scripts/exportPack.ts and scripts/checkCardIds.ts (the two files genuinely unsafe to import — unconditional process.exit()/file I/O with no guard); scripts/validatePack.ts now has real, non-zero coverage; aggregate thresholds still pass)

**What:**
vitest.config.ts's coverage.exclude list includes "scripts" — meaning scripts/validatePack.ts's substantial new logic this batch (Task #459's prerequisites and unitCount/cardCount cross-checks) cannot move the Verification Gate's coverage percentages at all. This is structurally the same shape as cycle 6's own headline finding ("the gate doesn't scan what it claims to guard"), just inverted (scope too narrow rather than newly-widened-and-ignored). Not currently exploitable — lib/packTypes.ts's hasValidUnitsArray runtime guard independently enforces the same invariants — but the gate's green status says nothing about this batch's own new validator code. at vitest.config.ts:26.

**Acceptance Criteria:**
- [ ] scripts/ is removed from coverage.exclude, or a documented, deliberate reason is written for why it stays excluded
- [ ] If included: coverage thresholds re-verified to still pass with scripts/ counted (tests/validatePack.test.ts already exists and should cover the bulk of it)

**Source:** Cycle-7 audit finding F07 — severity 4 — convergence 1/8 (Agent W) — structural CI/coverage-gate risk, echoes cycle 6's own root cause.

---

### Task #474: Fix error-handling: entitlementCrossTabSync's async rehydrate rejection is silently swallowed, unlike its sync-throw sibling

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 22 — Adam (W22A); rejection handler now logs [ERR-REHYDRATE-ASYNC-REJECT-...] with the reason before calling done(), matching the sync-throw sibling; existing test rewritten to assert the errorSpy call, not just call counts; Deletion Test verified by hand)

**What:**
triggerRehydrate's Promise branch does `result.then(done, done)` — done resets the in-flight flag and requeues but never logs. Its sibling, the synchronous-throw branch 8 lines below, correctly logs via `console.error("[ERR-REHYDRATE-SYNC-THROW-...]", err)` before calling done(). This wave's own new test for the async-reject scenario (tests/entitlementCrossTabSync.test.ts:178-200) sets up an errorSpy but never asserts on it — the test documents the swallow instead of catching it. Direct violation of AGENTS.md Rule 8 ("every catch block must surface the error... swallowing errors is a stop-the-line violation") — the `.then` rejection handler is functionally a catch block here. This gap sits inside the very task (#469) opened to close this module's error-handling gaps. at store/entitlementCrossTabSync.ts:77.

**Acceptance Criteria:**
- [ ] The async-rejection path logs the rejection reason with a ref ID, matching the sync-throw path's pattern
- [ ] The existing "a queued event during an in-flight rehydrate that later REJECTS..." test asserts the errorSpy was actually called, not just call counts

**Source:** Cycle-8 audit finding C8-F01 — severity 7 — convergence 1/8 (Agent B) — Rule 8 violation, LIVE (cross-tab sync runs in production web builds today).

---

### Task #475: Fix test-quality: fetchWithTimeout.test.ts's rewritten test proves only one of the two timers the finally block clears

**File:** tests/fetchWithTimeout.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 22 — Barry (W22B); test renamed and extended to assert clearTimeoutSpy was called with BOTH the abort timer's and backstop timer's ids; Deletion Test verified by hand-reverting lib/fetchWithTimeout.ts's finally block)

**What:**
Task #472's rewritten test captures `setTimeoutSpy.mock.results[1]!.value` (the backstop timer, the SECOND setTimeout call) and asserts clearTimeoutSpy was called with it — but never captures or asserts anything about `results[0]` (the abort timer, cleared by the same finally block one line above). Confirmed empirically: commenting out `clearTimeout(abortTimeoutId)` in lib/fetchWithTimeout.ts and running the full test file leaves all 6 tests green. Task #472 exists specifically because a prior test proved nothing — this rewrite fixes exactly one of the two timers it needed to prove and leaves the other unverified, the same defect class one line over, in the same task. at tests/fetchWithTimeout.test.ts:76.

**Acceptance Criteria:**
- [ ] The test also asserts `clearTimeoutSpy` was called with `setTimeoutSpy.mock.results[0]!.value` (the abort timer's id)
- [ ] Deletion Test: temporarily removing `clearTimeout(abortTimeoutId)` now fails the test, then restore

**Source:** Cycle-8 audit finding C8-F02 — severity 6 — convergence 2/8 (Agents A, W) — Rule 18 violation, LIVE.

---

### Task #476: Fix test-quality: 2 of validatePack.test.ts's new malformed-shape regression tests use non-discriminating string fixtures

**File:** tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 22 — Charles (W22C); replaced both string fixtures with a number (cards:42) and a plain object (units:{}), neither iterable without throwing; Deletion Test verified by hand — both updated tests now genuinely fail when their guard is removed)

**What:**
Two of the six new Task #468 regression tests use a JS string as their "non-array" fixture (`cards: "not-an-array"`, `units: "not-an-array"`). Strings are iterable via `for...of` (yielding characters) and never throw, so neither test exercises the crash the isArray guards exist to prevent. Confirmed by direct mutation testing: removing `isArray(unit["cards"])` at scripts/validatePack.ts:191 AND removing `isArray(raw["units"])` at line 189 leaves all 20 tests in the file green either way. Only the `cards: null` and `units: [null]` fixtures in the same suite are genuinely discriminating. Same defect class as cycle 7's F06 (a pseudocode test), recurring inside the very suite that fixed F02/#468. at tests/validatePack.test.ts:163.

**Acceptance Criteria:**
- [ ] The two string-fixture tests are replaced with genuinely non-array, non-null, non-iterable-without-throwing values (e.g. a number or a plain object) that actually trigger the guard's throw path when the guard is removed
- [ ] Deletion Test: temporarily removing each isArray guard now fails its corresponding test, then restore

**Source:** Cycle-8 audit finding C8-F03 — severity 5 — convergence 3/8 (Agent K, mutation-tested; Agent V; Red Agent R, implicit) — Rule 16/18 violation, LIVE.

---

### Task #477: Fix data-integrity: parseBackup's #467 fix gives a truthy non-number _version a worse error message than the scenario it was written to protect against

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 22 — Derek (W22D); a numeric-string _version greater than CURRENT_BACKUP_VERSION now gets the specific "newer version... update plyglt" message; non-numeric or not-actually-newer strings and all other malformed shapes still get the generic message; Deletion Test verified by hand)

**What:**
Task #467's own rationale explicitly cites "a genuinely newer app version that ever serializes _version as a string" as a scenario to guard against. But `parseBackup({_version:"999",...})` now returns the generic "Invalid backup file — missing required fields." instead of the specific, more helpful "This backup was created by a newer version of the app... Please update plyglt." message the sibling numeric out-of-range case correctly produces. Task #467's own acceptance criteria asked for "the same or an equally clear error message" — a generic fallback is measurably less clear for the exact user this task was meant to help. The new test at tests/importBackup.test.ts:429-432 locks this weaker message in as intended behavior. at lib/importBackup.ts:94.

**Acceptance Criteria:**
- [ ] A truthy but non-number _version that looks like a plausible future version (e.g. a numeric string) gets the specific "newer version... update plyglt" message where reasonable, or the tradeoff of using the generic message is explicitly documented and accepted in this task's resolution
- [ ] Existing tests for genuinely malformed (non-numeric, e.g. object/array/boolean) _version values continue to get the generic message

**Source:** Cycle-8 audit finding C8-F04 — severity 5 — convergence 1/8 (Agent W, execution-verified) — message-quality regression, LIVE.

---

### Task #478: Fix code-quality: validatePack's dedup loop uses an unchecked card id cast, producing garbled "Duplicate card IDs: " output for malformed cards

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 22 — Charles (W22C); dedup loop now skips any card whose id isn't a real string via isString(id), before using it as a dedup key; 2 new tests for missing/non-string ids; Deletion Test verified by hand)

**What:**
`const id = card["id"] as string;` (in the duplicate-card-ID loop added by Task #468) is unguarded. Two cards both missing/with non-string id collide as the same dedup key and produce a garbled `"Duplicate card IDs: "` (blank after the colon) — confirmed via direct execution against a crafted pack. Not a crash and no reporting is lost (validateCard's own check already reports the missing-id error elsewhere), but the output is confusing CI noise. The highest-convergence finding of cycle 8 — 4 of 8 reviewers independently found it, two via direct execution. at scripts/validatePack.ts:194.

**Acceptance Criteria:**
- [ ] The dedup loop skips (or otherwise safely handles) a card whose id is missing or non-string, rather than using it as a dedup key
- [ ] A test supplies two cards both missing/with non-string id and asserts no garbled "Duplicate card IDs:" line is produced

**Source:** Cycle-8 audit finding C8-F05 — severity 4 — convergence 4/8 (Agents A, B, W, Red R — highest convergence this cycle, 2 execution-verified) — code-quality, LIVE.

---

### Task #479: Fix data-integrity: parseBackup's _version handling uses isNaN instead of isFinite, accepting Infinity/hex/fractional strings as plausible versions — in both the new AND a pre-existing branch

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 23 — Adam (W23A); replaced isNaN with a strict digits-only pattern check before numeric coercion in the string branch, plus an isFinite() guard in both the string and the pre-existing numeric branch; verified independently — tsc clean, full suite/coverage/lint/banned-assertion gate all pass, diff spot-checked directly)

**What:**
The new string-`_version` branch (Task #477) uses `!isNaN(parsedVersion)` instead of `isFinite(parsedVersion)` — this file already documents elsewhere why that distinction matters ("typeof NaN === 'number' is true — isFinite() is required to reject NaN and Infinity", used correctly in normalizeCardProgress). `Number("Infinity")` = `Infinity`, `isNaN(Infinity)` is false, so `_version:"Infinity"` is accepted into the newer-version branch and produces the nonsensical message "backup vInfinity, app supports v2. Please update plyglt." Also confirmed live: hex strings ("0x10"→16) and fractional strings ("2.5", "999.5") are silently accepted as valid versions. CRITICAL: this same defect ALSO exists in the untouched sibling NUMERIC branch (shipped 2 waves ago in Task #467, not touched by this wave) — a raw `_version:1e400` in hand-edited JSON parses to `Infinity` (typeof number) via the same unguarded path. The defect class exists twice in one function, unaddressed both times. Reachable live via hooks/useExportImport.ts's user-facing backup-restore file picker. at lib/importBackup.ts:108.

**Acceptance Criteria:**
- [ ] Both the string-parsing branch and the numeric branch use `isFinite()` (not just truthy/isNaN checks) to reject Infinity/-Infinity in both string and number form
- [ ] Tests cover _version as "Infinity", a raw JSON Infinity-producing literal (e.g. 1e400), hex strings, and fractional strings — all should get the generic rejection message, not the "newer version" message

**Source:** Cycle-9 audit finding F001 — severity 6 — convergence 6/8 (Agents N, B, A, K, Red R, W) — Rule 23 violation, LIVE, reachable via the real backup-restore path.

---

### Task #480: Fix code-quality: validatePack's dedup loop still collides on empty/whitespace-only card ids after Task #478's partial fix

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 23 — Barry (W23B); dedup guard now mirrors validateCard's exact compound check (`!isString(id) || id.trim() === ""`); added empty-string and whitespace-only id tests, and upgraded all 4 related garbled-output tests to also assert validateCard's own per-card id errors are present, closing F010 too; verified independently)

**What:**
Task #478's fix (`if (!isString(id)) continue;`) closes the undefined/non-string dedup-key collision but does not replicate validateCard's compound check (`!isString(card["id"]) || card["id"].trim() === ""`). Two cards both with `id: ""` both pass `isString("")` (true), collide in the ids Set, and reproduce the exact garbled "Duplicate card IDs: " output Task #478 was supposed to eliminate. A whitespace-only id (" ") survives the same gap. Related, distinct angle (Red Agent R): the `continue` also silently drops ANY invalid-id card from this specific loop with zero record — a real duplicate pair sharing an invalid id shape produces no signal from this check specifically (though validateCard's separate check still reports the shape issue elsewhere). at scripts/validatePack.ts:201.

**Acceptance Criteria:**
- [ ] The dedup guard mirrors validateCard's exact compound check: `isString(id) && id.trim() !== ""`
- [ ] Tests cover two cards both with id:"" and both with id:" " (whitespace-only), asserting no garbled "Duplicate card IDs:" line
- [ ] The new/existing garbled-output tests also assert validateCard's own per-card id errors are still present in the result (not just the absence of the duplicate line), so the test can distinguish "correctly suppressed" from "dedup silently stopped running"

**Source:** Cycle-9 audit finding F002 + F010 — severity 5 — convergence 5/8 (Agents N, B, K, W, Red R) — Rule 23 violation, LIVE (CI validator path).

---

### Task #481: Fix requirements: parseBackup's string-_version branch has no acceptance path, rejecting a numeric string equal to the current version that its numeric equivalent would accept

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 23 — Adam (W23A); chose symmetric acceptance — a valid, non-newer numeric-looking string now succeeds identically to its numeric equivalent; updated the #477 boundary-equal test in place and added a strictly-lower test; verified independently)

**What:**
The string-`_version` branch added for Task #477 has no acceptance path at all: after the newer-version check fails, it unconditionally returns the generic "missing required fields" message. This means `_version:"2"` (string, exactly CURRENT_BACKUP_VERSION) is REJECTED, while the numerically identical `_version:2` (number) is ACCEPTED via the sibling branch. Two framings to weigh: (1) a real functional regression/inconsistency — Task #477 only fixed the genuinely-newer sub-case and left the equal-or-lower sub-case asymmetric with its numeric equivalent; (2) an intentional, tested design choice resting on the assumption that real backups never serialize _version as a string at all — true only for the CURRENT export path (lib/exportBackup.ts always writes a number), not structurally enforced against any future export path. at lib/importBackup.ts:106.

**Acceptance Criteria:**
- [ ] Decide and implement: either the string path accepts a valid, non-newer numeric-string version symmetrically with the numeric path, OR the design tradeoff (string _version is never valid) is explicitly enforced/documented as intentional with the assumption's fragility noted
- [ ] A test exists for a numeric string strictly LOWER than CURRENT_BACKUP_VERSION (not just the boundary-equal case), since the current test only covers "=" despite its name implying "≤"

**Source:** Cycle-9 audit finding F004 — severity 5 — convergence 3/8 (Agents K, Red R, W — with differing severity framings) — requirements, LIVE.

---

### Task #482: Fix error-handling: entitlementCrossTabSync's Task #474 fix logs a rejection branch that Zustand's real persist.rehydrate() can never actually trigger

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 23 — Charles (W23C); traced zustand@5.0.14's actual middleware.mjs source, confirmed rehydrate() cannot genuinely reject under this app's config, documented the branch as defensive-only in a header doc-comment, and kept it — added a new test against the REAL zustand persist/createJSONStorage (not a synthetic mock) with a genuinely-rejecting storage.getItem, asserting rehydrate() still resolves; verified independently)

**What:**
Task #474 added console.error logging to the rejection handler of `result.then(done, (err) => {...})`. But under this store's actual persist() configuration — no onRehydrateStorage callback is registered in store/entitlementStore.ts, store/srsStore.ts, or store/settingsStore.ts — Zustand's own hydrate() (verified by tracing node_modules/zustand/esm/middleware.mjs) terminates in a `.catch((e) => { postRehydrationCallback?.(void 0, e); })` that never rethrows or rejects when postRehydrationCallback is undefined. The promise persist.rehydrate() returns can therefore never reject in production — it always resolves. The new rejection branch and its regression test only exercise a path unreachable via the real Zustand dependency this module actually calls; the fix satisfies Rule 8 only against a mock, not against production. Not a security leak (the branch never runs), but the stated diagnosability goal isn't actually accomplished for real users. at store/entitlementCrossTabSync.ts:84.

**Acceptance Criteria:**
- [ ] Determine whether Zustand's persist.rehydrate() can ever genuinely reject under this app's configuration (check across all Zustand versions/configs in use, not just the current one) — if it truly cannot, document this explicitly in the module's header comment so the "async-reject" branch is understood as defensive-only, not a live diagnostic path
- [ ] If a genuine rejection path exists elsewhere (e.g. a future onRehydrateStorage callback, or a different persist config), verify the fix actually covers it; otherwise consider whether the test should mock a more faithful (non-rejecting) version of Zustand's real behavior instead of a synthetic always-controllable Promise

**Source:** Cycle-9 audit finding F009 — severity 6 — convergence 1/8 (Security Agent S, verified against actual Zustand source) — highest-confidence single-reviewer finding this cycle.

---

### Task #483: Fix code-quality: parseBackup's generic error message string is now triplicated, and the "newer version" template is duplicated across 2 branches

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 23 — Adam (W23A); extracted `GENERIC_BACKUP_ERROR` constant and `newerVersionError(version)` helper, used at every call site; no behavior change, existing tests pass unmodified; verified independently)

**What:**
The literal "Invalid backup file — missing required fields." now appears 3 times verbatim in parseBackup (Task #477 added a 3rd occurrence). AGENTS.md's Poka-Yoke stop-the-line rule explicitly bans "any hardcoded string that belongs in a named constant." Separately, the "This backup was created by a newer version...update plyglt" message template is now independently hand-constructed in two places (string branch, number branch) with different interpolated variables — a future wording change requires remembering to edit both. at lib/importBackup.ts:104.

**Acceptance Criteria:**
- [ ] Both message strings are extracted to named constants or a small helper function, used by all call sites (3 for the generic message, 2 for the newer-version message)
- [ ] No behavior change; existing tests pass unmodified

**Source:** Cycle-9 audit finding F006 — severity 4 — convergence 2/8 (Agent A, Red Agent R) — Poka-Yoke violation, LIVE.

---

### Task #484: Fix test-quality: validatePack.test.ts's garbled-output regression tests use absence-only assertions that could pass vacuously

**File:** tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (merged into Task #480 at consolidation time — #480's third acceptance criterion is this exact fix; not separate work, avoiding duplicate promotion of the same underlying finding)

**What:**
The two Task #478 regression tests (two cards both id:undefined; two cards both id:42) assert only `errors.some((e) => e.startsWith("Duplicate card IDs:")) === false`. This would pass vacuously if the entire dedup-detection loop were disabled or deleted for an unrelated reason, since a disabled loop also never emits that line. Neither test also asserts validateCard's own per-card id errors are still present, so the test can't distinguish "the garbled line was correctly suppressed" from "duplicate-detection silently stopped running altogether." at tests/validatePack.test.ts:207.

**Acceptance Criteria:**
- [x] Superseded — see Task #480's third acceptance criterion, which covers this exact fix

**Source:** Cycle-9 audit finding F010 — severity 4 — convergence 1/8 (Agent K) — test-quality (duplicate of Task #480's scope, merged).

---

### Task #485: Fix edge-case: parseBackup's Task #481 "symmetric acceptance" fix is asymmetric — string "0" is accepted, numeric 0 is rejected

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 24 — Adam (W24A); extracted a shared `isValidBackupVersionNumber(v)` predicate (`isFinite(v) && v > 0`) used by both branches, eliminating the two accidental implicit floors; added 4 boundary tests plus a symmetry-sweep test proving the general property across 9 values including -Infinity/Infinity; verified independently — tsc clean, 1446/1446 tests pass, lint clean, coverage above thresholds, diff spot-checked directly)

**What:**
Task #481's symmetric-acceptance fix in parseBackup (lines ~103-142) is not actually symmetric. Execution-verified by Agent W via npx tsx: `_version: "0"` (string) is ACCEPTED (regex matches, Number=0, isFinite, not>2, falls through to ok:true) while `_version: 0` (number) is REJECTED (`!data._version` is true for the falsy value 0). Conversely `_version: "-1"` (string) is REJECTED (the digit regex `/^\d+$/` doesn't match a minus sign) while `_version: -1` (number) is ACCEPTED (no lower-bound check in the numeric branch at all). The Task #481 comment's own claim — "a valid, non-newer numeric-looking string... must be accepted identically [to its numeric equivalent]" — is false for the input 0. Neither case is covered by any existing test. Live path, reachable via the real user-facing backup-restore file picker (hooks/useExportImport.ts). Rule 23 violation: this recreates the exact defect class (cycle-9's F001, isNaN/isFinite branch divergence) inside the very task meant to close it, one input value away. at lib/importBackup.ts:parseBackup:103-142.

**Acceptance Criteria:**
- [ ] The string and numeric `_version` branches agree on every input — in particular, both accept or both reject `0` identically, and both accept or both reject negative integers identically (recommend: reject `_version <= 0` in both branches explicitly, rather than relying on JS truthiness/regex quirks to imply a floor)
- [ ] Tests cover `_version: 0`, `_version: "0"`, `_version: -1`, `_version: "-1"` and assert both serializations of the same nominal value produce the SAME `ok` result

**Source:** Cycle-10 audit finding F001 — severity 7 — convergence 6/8 (Agents A, B, N, W, Red R via direct reasoning/execution; Security Agent S assessed present but non-security) — the strongest convergence recorded in this batch's 10-cycle history — Rule 23 violation, LIVE, ESCALATE.

---

### Task #486: Fix edge-case: parseBackup's numeric _version branch has no negative/fractional floor — Task #479 only ported the isFinite check, not the accompanying constraint

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Task #485 (same branch, same fix should land together)
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 25 — Adam (W25A); extended the shared `isValidBackupVersionNumber` predicate from Task #485 to `isFinite(v) && Number.isInteger(v) && v > 0`, one change in the one delegation point for both branches; verified the string branch was already symmetric (digits-only regex has no decimal point) with an explicit test rather than assuming it; verified independently — tsc clean, 1449/1449 tests pass, lint clean, coverage above thresholds)

**What:**
Task #479's numeric `_version` branch (line 133) only ported the `isFinite` check from the string branch's fix, not the accompanying no-negative/no-fractional constraint that makes the string branch's `/^\d+$/` pre-check meaningful. Agent W execution-verified: `parseBackup({_version:-1,...})`, `parseBackup({_version:1.5,...})`, and `parseBackup({_version:-0.0001,...})` all return `ok:true` — a fractional or negative numeric version is silently accepted as a valid backup version. This is the recurring "one of two structurally-identical branches fixed, twin left open" pattern named in every cycle since cycle 6, recreated inside Task #479 itself — its own inline comment claims "the sibling numeric branch had the identical isFinite gap" and states it closed it, when it only ported one of two necessary guards. at lib/importBackup.ts:parseBackup:103-142.

**Acceptance Criteria:**
- [ ] The numeric branch rejects negative and fractional `_version` values the same way the string branch's digits-only regex does (e.g. `Number.isInteger(data._version) && data._version > 0`)
- [ ] Tests cover `_version: -1`, `_version: 1.5`, `_version: -0.0001` on the numeric path, asserting rejection with the generic message

**Source:** Cycle-10 audit finding F002 — severity 7 — Rule 23a violation (fix did not generalize to every member of the class), LIVE, ESCALATE.

---

### Task #487: Fix tests: the two Task #481 tests only assert r.ok and never diff against the numeric-equivalent result the test names claim symmetry with

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Tasks #485, #486 (fix the underlying bug first, then strengthen the tests that should have caught it)
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Direct task; rewrote both #481 tests to deep-equal the string-_version result against its numeric equivalent — verified via a live Deletion Test that injected a shape-divergence bug and confirmed both tests catch what r.ok alone missed; bundled and closed 3 related debt items (F012 leading-zero strings, F016 precision loss, F017 message accuracy) per Max's debt-review selection; spot check found and fixed one comment-accuracy nit in-cycle; tsc clean, 1453/1453 tests pass, coverage above thresholds; committed a385379)

**What:**
"#481: a numeric-string _version EQUAL to CURRENT_BACKUP_VERSION is accepted..." and "#481: a numeric-string _version strictly LOWER..." (lines 437-450) both assert only `expect(r.ok).toBe(true)`. A stub returning `ok:true` unconditionally passes both tests (Rule 18 Deletion Test fails). Neither test exercises `_version:0`, `_version:"0"`, `_version:-1`, or `_version:1.5` (Rule 16 violation). Most notably, the test names claim symmetry with the numeric equivalent but neither test ever calls `parseBackup` with that numeric equivalent and diffs the two results — the one comparison that would have caught Task #485/#486's bugs is never made. Confirmed independently by Auditors A, B, K, V, and W. at tests/importBackup.test.ts:437-450.

**Acceptance Criteria:**
- [ ] Both tests assert full result-shape equality against the numeric-equivalent call (matching the file's own established convention, e.g. the "accepts a well-formed current backup" test), not just `r.ok`
- [ ] New tests added for the 0/negative/fractional boundary cases once Tasks #485/#486 land

**Debt review scope addition (2026-07-28, bundled from debt.md — same file, same `_version` validation block):**
- [ ] F012: `parseBackup`'s string-`_version` regex `/^\d+$/` doesn't reject leading-zero strings (`"007"` silently reinterpreted as version 7) — add a test documenting/confirming the current behavior; decide whether this is acceptable (a version is a version regardless of leading-zero padding) or should be rejected, and implement accordingly
- [ ] F016: `parseBackup`'s string-`_version` path loses precision above 2^53 for 17+ digit version strings — cosmetic only (still correctly rejected as newer than `CURRENT_BACKUP_VERSION`); add a test pinning this behavior
- [ ] F017: huge digit-string `_version` values are correctly `isFinite`-guarded with no crash, but the resulting error message text ("missing required fields") misdescribes the actual failure — decide whether a more accurate message is warranted or document why the generic message is acceptable here too

**Source:** Cycle-10 audit finding F003 — severity 6 — convergence 5/8 (Agents A, B, K, V, W) — Rule 16/18 violation.

---

### Task #488: Fix error-handling: entitlementCrossTabSync's Task #482 fix doesn't cover the real migrate()-throws failure path, only the synthetic getItem-throws case

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Wave 24 — Barry (W24B); added a live-regression test proving migrate()-throws is swallowed identically to getItem-throws against the real zustand dependency; chose the documentation path (out of scope to edit store/migrations.ts) and logged the gap as tracked debt.md (Task #488, severity 5) rather than leaving it implicit; rewrote the doc comment's "confirmed" claim to name both tested failure sources explicitly; verified independently)

**What:**
Task #482's fix (and its own new documentation) proves the reject-branch logging is unreachable for every real production failure, because zustand's `hydrate()` terminal `.catch` never rethrows when `postRehydrationCallback` is undefined (verified against `node_modules/zustand/esm/middleware.mjs` v5.0.14). Two realistic failure sources funnel into this same swallowed catch: `storage.getItem()` throwing (tested by Task #482's new test) and `migrate()` throwing (NOT tested). The latter is not hypothetical — `store/migrations.ts` throws `Missing...migration to version X` errors, and all three stores (`entitlementStore.ts`, `srsStore.ts`, `settingsStore.ts`) register a `migrate` function per CLAUDE.md §4's documented convention. Task #482's new test exercises only the `getItem`-throws case on a synthetic probe store with no `migrate` option configured. Unlike the initial-mount hydration path, which has an explicit failsafe (`lib/storage.ts`'s `useIsHydrated`, `HYDRATION_FAILSAFE_MS` timeout, Tasks #406/#435), this direct `window.addEventListener("storage", ...)` path has no equivalent timeout or log — a cross-tab rehydrate that silently fails via a `migrate()` throw (e.g. triggered by stale/corrupted data written by another tab) leaves the tab's in-memory state stale forever with zero signal anywhere in the app. Rule 8 violation (a real, designed-to-exist error path is silently swallowed) and Rule 23c violation (the untested twin path shipped without being filed as tracked debt, only implicitly noted in a doc comment). This resolves a genuine disagreement between Agent K (who argued Task #482's root cause — an unverified assumption — was fully verified and pinned) and Agents B/W (who argued the same reasoning proves a second, untested, real failure path also funnels into the same swallow) in favor of B/W: Task #482's own acceptance criteria required verifying the fix "actually covers" any genuine rejection path, and the migrate()-throws path was never exercised. at store/entitlementCrossTabSync.ts:createCrossTabSync:48-69,94-117.

**Acceptance Criteria:**
- [ ] Add a test exercising the `migrate()`-throws scenario specifically (a `persist` config with a `migrate` function that throws, mirroring this app's real stores) and confirm whether `persist.rehydrate()` resolves or rejects in that case
- [ ] If it resolves (swallowing the migrate error, per the same zustand behavior documented for `getItem`), decide and implement: either surface this failure some other way (e.g. the store's own `migrate` function should catch-and-log internally before rethrowing, so the error is diagnosable even though the rehydrate promise itself never rejects), or explicitly document this as an additional accepted trade-off with the same rigor as the `getItem` case — not left as an implicit gap
- [ ] Update the module's doc comment so its "confirmed with a live regression test" claim is scoped to what is actually tested (see Task #490)

**Source:** Cycle-10 audit finding F004 — severity 7 — Rule 8 + Rule 23c violation, ESCALATE.

---

### Task #489: Fix code-quality: entitlementCrossTabSync's Task #482 comment justifies keeping dead code via a generality the file's own header disclaims

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Task #488 (resolve the functional question first, then correct the comment accordingly)
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 25 — Barry (W25B); narrowed the doc comment's justification to apply entirely within the module's one real caller's own future (a future onRehydrateStorage callback throwing, or a future zustand behavior change) rather than a hypothetical second caller; also caught and fixed the identical disclaimed-generality claim duplicated in Task #491's isThenable comment; verified independently — no behavior change, 14/14 entitlementCrossTabSync tests pass)

**What:**
The module header states this module is "USED BY: store/entitlementStore.ts ONLY" and warns that calling it twice for the same store key duplicates listeners. The Task #482 comment justifies leaving the dead reject-branch in place by citing possible future reuse of this module "with a non-Zustand or differently-configured rehydrate function." A module whose own header discloses exactly one caller cannot justify unreachable code by invoking a generality its own header disclaims two paragraphs above. at store/entitlementCrossTabSync.ts (header block vs Task #482 inline comment).

**Acceptance Criteria:**
- [ ] Reconcile the header's single-caller claim with the doc comment's multi-caller justification — either the header's scope claim is updated to reflect genuine intended reuse, or the doc comment's justification is narrowed to something consistent with a single-caller module
- [ ] No behavior change required unless Task #488 also changes something here

**Source:** Cycle-10 audit finding F005 — severity 5 — Rule 20 violation.

---

### Task #490: Fix code-quality: entitlementCrossTabSync's "confirmed with a live regression test" claim overstates what the cited test actually proves

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Task #488
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 25 — Barry (W25B); confirmed Wave 24's Task #488 rewrite had already closed the core overclaim by naming both tested failure sources explicitly; identified a genuine residual gap (merge()/setItem() re-persist paths, verified against real zustand source, low-risk merge() vs realistic setItem() case) and added an explicit "Residual gap" paragraph plus a debt.md entry rather than either silently expanding scope or leaving the gap unstated; verified independently)

**What:**
The Task #482 doc comment states the dead-branch claim is "confirmed with a live regression test." The cited test exercises only one failure injection (`getItem` rejects, no `onRehydrateStorage`); zustand's actual catch-all also applies to `migrate()` throwing, `merge()` throwing, and `setItem()` re-persist rejecting, none of which the test triggers. The word "confirmed" attached to the full blanket claim rather than the narrower tested sub-case is not literally true. at store/entitlementCrossTabSync.ts (Task #482 comment block).

**Acceptance Criteria:**
- [ ] Narrow the doc comment's claim to name specifically which failure path the cited test covers, rather than implying full coverage of every path that funnels into zustand's swallowed catch
- [ ] Coordinate with Task #488 — if that task adds a migrate()-throws test, the comment can then honestly claim broader coverage

**Source:** Cycle-10 audit finding F006 — severity 4.

---

### Task #491: Fix async: triggerRehydrate's `instanceof Promise` check misclassifies non-native thenables, contradicting the module's own stated generality

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (Wave 24 — Barry (W24B); broadened the check via a new `isThenable()` structural/duck-typed helper replacing `instanceof Promise`, honoring the module's stated Zustand-independent generality; added a test with a genuinely non-native thenable proving the dedup/queue guarantee holds; verified independently)

**What:**
`if (result instanceof Promise)` (line 99) misclassifies any non-native thenable as synchronous: it calls `done()` immediately and resets `rehydrateInFlight = false` while real async work is still in flight, silently breaking the dedup/queue guarantee this module exists to provide. This directly contradicts the doc comment's stated generality (`rehydrate` typed as `() => unknown`, described as "not tied to Zustand specifically," intended for future reuse with "a non-Zustand or differently-configured rehydrate function"). Not exercised by any current caller since zustand returns a native Promise — latent gap, not an active bug today. at store/entitlementCrossTabSync.ts:triggerRehydrate:99.

**Acceptance Criteria:**
- [ ] Either broaden the check to detect any thenable (e.g. `result && typeof (result as any).then === "function"`) so the module's stated generality is genuinely honored, or narrow the doc comment's generality claim to match what the code actually supports (native Promises only)
- [ ] If broadened: add a test with a custom non-native thenable proving the dedup/queue guarantee still holds

**Source:** Cycle-10 audit finding F007 — severity 4.

---

### Task #492: Fix data-loss: validatePack's new blank-id dedup guard excludes blank-id cards from duplicate detection entirely

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (Wave 24 — Charles (W24C); decided and documented that relying on validateCard's separate per-card check is sufficient — folding N blank-id cards into one vague "Duplicate card IDs" aggregate would be strictly worse than the precise per-card errors already emitted; added a 3-cards-share-a-blank-id test plus a blank-id-alongside-a-real-duplicate regression guard; verified independently)

**What:**
The Task #480 `id.trim() === ""` guard excludes any card with `id: ""` or `id: "   "` from the `ids` Set before duplicate detection runs, so any number of cards sharing a blank id now produce ZERO errors from this specific loop — where previously two such cards would have been flagged as duplicates (as a blank-string entry in the "Duplicate card IDs" list). No check in this loop separately reports a missing/blank id as its own error (`validateCard` does, in a different function/loop, so the gap is not a total loss of signal, but this specific dedup check no longer flags blank-id collisions at all). at scripts/validatePack.ts (dedup loop).

**Acceptance Criteria:**
- [ ] Decide and implement: either track blank/invalid ids separately so N>=2 cards sharing a blank id are still flagged as a distinct "duplicate blank id" condition, or explicitly document why relying solely on validateCard's separate per-card check is sufficient
- [ ] Add a test with 3+ cards sharing a blank id, confirming the chosen behavior is intentional (either a specific error is emitted, or the design decision is asserted/documented)

**Source:** Cycle-10 audit finding F008 — severity 5.

---

### Task #493: Fix data-loss: validatePack has zero duplicate-unit-ID detection despite 4 tasks hardening card-ID dedup — live, reachable via hooks/useLangPack.ts

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (Direct task; added a unit-ID dedup loop mirroring the card-ID loop's structure and blank/whitespace handling exactly; verified via a live Deletion Test that the check genuinely catches duplicate unit ids; spot check found the blast-radius comment was incomplete — app/study/page.tsx also resolves UNIT_MAP[unitId] directly to decide which unit's cards populate a study session, a more severe consequence than the prerequisite-lookup case alone — and that test coverage was missing 2 of 4 blank-id sub-cases matching Task #492's precedent; both fixed in-cycle; tsc clean, 1461/1461 tests pass, coverage above thresholds)

**What:**
Duplicate card-ID detection was hardened across four tasks (#468, #478, #480, #492) in `validatePack`, but no duplicate-unit-ID detection exists anywhere in this file. `unit["id"]` (line 100) is validated for shape identically to `card["id"]` and is equally load-bearing: `hooks/useLangPack.ts:291` builds `Object.fromEntries(units.map((u) => [u.id, u]))`, so two units sharing an id silently collapse to one entry and an entire unit's cards vanish from the live app with zero CI signal. Rule 23 violation: the identical defect class (missing dedup validation on a required unique id field feeding a runtime map-by-id) was fixed exhaustively for cards and left completely untouched for units, one enumeration entry away, in the same file, across this batch's entire audit history. at scripts/validatePack.ts:187-229.

**Acceptance Criteria:**
- [ ] Add duplicate-unit-ID detection to `validatePack`, mirroring the card-ID dedup loop's structure and its blank/whitespace-id handling decision (Task #492)
- [ ] A test with 2+ units sharing the same id asserts the pack is flagged invalid
- [ ] Confirm `hooks/useLangPack.ts:291`'s `Object.fromEntries` collapse behavior is the reason this matters — cite it in the fix's comment so a future reader understands why unit-id uniqueness is load-bearing, not cosmetic

**Source:** Cycle-11 audit finding F001 — severity 8 — LIVE, Rule 23 violation recurring one abstraction level up from every prior instance in this batch, flagged by Agent W and confirmed by multiple reviewers.

---

### Task #494: Fix error-handling: entitlementCrossTabSync's own new "Accepted trade-off" paragraph contains a fresh, empirically-false claim about newer-app-version migrate() behavior

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
Task #488's own new paragraph (absent from the pre-cycle commit 8106ae3, written specifically to fix cycle-10's F004 overclaim) claims a migrate() throw "requires either a corrupted stored version OR a newer app version writing from another tab, both rare." Verified FALSE for the second disjunct via live script execution against the real zustand dependency and store/migrations.ts: when a newer tab writes a higher version than this tab's configured `*_VERSION`, `migrateEntitlementStore`/`migrateSrsStore`/`migrateSettingsStore`'s `while (v < *_VERSION)` loop never executes, so the function returns the future-shaped data UNMIGRATED, SILENTLY, WITH NO THROW (confirmed: migrateThrew=false, rehydrate rejected=false). Only a corrupted or fractional stored version actually throws. No test exercises the newer-version scenario, and silently accepting unmigrated future-shaped state into an older tab's live Zustand state is arguably WORSE than a throw, and is neither documented nor logged as debt anywhere. Rule 23(b) violation: the fix written to correct cycle-10's overclaim introduced a fresh, empirically false overclaim in its own new prose, discovered by Agent B via live script execution, not just static reading. at store/entitlementCrossTabSync.ts:121-124.

**Acceptance Criteria:**
- [ ] Correct the "Accepted trade-off" paragraph to accurately describe what happens when a newer app version writes a higher stored version number (silent, unmigrated acceptance — not a throw)
- [ ] Decide and implement: either add a genuine version-skew guard (e.g. reject/log when the stored version exceeds this tab's configured version), or explicitly document the silent-acceptance behavior as a second, separately-tracked accepted trade-off with the same rigor as the corrupted-version case
- [ ] Add a test exercising the actual newer-app-version scenario (not just the corrupted/fractional-version case Task #488's test covers), asserting the real observed behavior

**Source:** Cycle-11 audit finding F002 — severity 9 — ESCALATE — Rule 23(b) violation recreated inside the very fix meant to close a prior instance, discovered via live execution by Agent B.

---

### Task #495: Fix error-handling: the migrate-throw diagnosability gap was logged as debt twice without applying either of two concrete available fixes

**File:** store/entitlementStore.ts, store/migrations.ts
**Complexity:** 🔧 Full — 2 files, cross-module error-handling change
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
Task #488 logged the migrate-throw diagnosability gap as accepted debt, reasoning a root fix is out of `entitlementCrossTabSync.ts`'s scope because `triggerRehydrate` never receives the underlying error (zustand swallows it before `rehydrate()` returns) — that scope reasoning is correct, but the conclusion to defer rather than fix is not justified, because two concrete fixes exist at other layers. First, `store/entitlementStore.ts`'s `persist()` config can register `onRehydrateStorage(state, error)`, empirically confirmed by Agent B (via a live script) to receive the raw migrate-throw `Error` object on the exact terminal path this doc comment already cites. Second, as a complementary improvement, the three throw sites in `store/migrations.ts` have zero logging before throwing, unlike this same file's own `migrateDateField`/`migrateIntInRange`/`migrateBoolean`/`migrateStrandedAcrossDays` guards, which `console.error` before falling back; a two-line `console.error` before each throw requires no change to the throw-and-halt contract. Today a real missing-migration-step failure produces zero console output anywhere and silently reverts to defaults, masking previously-persisted data with no diagnostic trace. Rule 8 violation: never swallow errors, log with a traceable reference. at store/migrations.ts:191,280,329 and store/entitlementStore.ts's persist config.

**Acceptance Criteria:**
- [ ] Register an `onRehydrateStorage` callback in `store/entitlementStore.ts`'s (and, if applicable, srsStore.ts's/settingsStore.ts's) `persist()` config that logs the migrate-throw error with a ref ID, matching the file's Rule 8 convention elsewhere
- [ ] Add `console.error` with a ref ID immediately before each `throw new Error(...)` in `store/migrations.ts`'s `migrateSrsStore`/`migrateEntitlementStore`/`migrateSettingsStore`, mirroring the same file's own other migration guards
- [ ] Update `store/entitlementCrossTabSync.ts`'s doc comment and the `.autocode/debt.md` Task #488 entry to reflect that this gap is now fixed, not accepted debt
- [ ] A test confirms the new logging fires when a migrate function throws during a real rehydrate

**Source:** Cycle-11 audit finding F003 — severity 8 — ESCALATE — Rule 8 violation, converges Agent K's and Agent B's independent fix-location findings (B's onRehydrateStorage finding is the empirically-verified authoritative fix; K's migrations.ts console.error is a complementary improvement).

---

### Task #496: Fix tests: the Task #485 sweep test recreates the exact .ok-only comparison pattern Task #487 was created to eliminate, in the same wave

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
This sweep test, added in the same wave as Task #487, reproduces the exact ".ok-only" comparison pattern that Task #487's own comment (documented immediately above it in the same file) states it was created to eliminate: checking only `.ok` "would still pass if the string branch's fall-through path silently produced a different srs/entitlement/langPair shape" than the numeric branch. This sweep test does exactly that for a broader value set (0, -1, -2, 1, 2, 3, 999, -Infinity, Infinity) — a bug making the string branch return a DIFFERENT ERROR MESSAGE than the numeric branch for the same rejected value would not be caught, since both sides being `ok:false` satisfies the assertion regardless of message content. Rule 23 violation: the identical defect class was recreated a few lines later in the same file, same wave, as the fix meant to eliminate it. at tests/importBackup.test.ts:541-550.

**Acceptance Criteria:**
- [ ] Change `expect(strResult.ok, ...).toBe(numResult.ok)` to `expect(strResult).toEqual(numResult)`, matching Task #487's own established pattern
- [ ] Confirm the sweep still passes with the full-equality assertion (it should, since the underlying fix is correct — this is a test-rigor fix, not a production-code fix)

**Source:** Cycle-11 audit finding F004 — severity 6 — Rule 23 violation, flagged by Agent K.

---

### Task #497: Fix async: isThenable only verifies a callable .then exists, not that the thenable will ever settle — a hang permanently disables cross-tab sync with zero log

**File:** store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** 🔧 Full — investigation + design decision on timeout handling
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
`isThenable` only verifies that a value has a callable `.then` property, not that the thenable will eventually invoke one of its two callbacks. No timeout exists in `triggerRehydrate`: a `rehydrate()` thenable whose `.then` never invokes either callback leaves `rehydrateInFlight` permanently `true`, silently and permanently disabling cross-tab sync for the tab's remaining lifetime. Unlike the sync-throw and async-reject paths, which both log via `ERR-REHYDRATE-SYNC-THROW`/`ERR-REHYDRATE-ASYNC-REJECT`, a hang produces no log at all, and no test exercises this path. Confirmed by 2 independent reviewers (Agent V, Red Agent R). at store/entitlementCrossTabSync.ts:triggerRehydrate.

**Acceptance Criteria:**
- [ ] Decide and implement: either add a timeout to `triggerRehydrate` that logs and resets `rehydrateInFlight` if `rehydrate()`'s thenable doesn't settle within a bounded window, or explicitly document this as an accepted latent gap (no current caller can trigger it, since zustand's real Promise always settles) with the same rigor as the file's other accepted trade-offs
- [ ] If a timeout is added: a test with a never-settling thenable confirms the in-flight flag eventually resets and a log fires

**Source:** Cycle-11 audit finding F005 — severity 7 — latent (no current caller triggers it), 2-way convergence (Agent V, Red Agent R).

---

### Task #498: Fix tests: F016's BigInt precision-loss assertion never calls parseBackup and is vacuously true regardless of production code

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
`expect(BigInt(seventeenDigits)).not.toBe(BigInt(Number(seventeenDigits)))` never calls `parseBackup`; it is computed entirely from language primitives applied to a test-local literal string and is true unconditionally regardless of what `parseBackup` does. Rule 18 Deletion Test: if `parseBackup`'s version-parsing were rewritten to avoid precision loss entirely, this assertion would still pass since it doesn't exercise that code path at all. The comment's claim that this line "proves this test would fail if a future change made Number() coercion exact" is false — `Number()`'s precision behavior on a fixed string literal can never change. The preceding `toEqual` assertion in the same test is legitimate and anchored to `parseBackup`'s actual output. at tests/importBackup.test.ts:F016-test.

**Acceptance Criteria:**
- [ ] Remove the vacuous `BigInt` comparison line
- [ ] If the precision-loss behavior itself is worth pinning against a future implementation change, replace it with an assertion that actually inspects what `parseBackup` returned (e.g. asserting the exact numeric substring embedded in `r.error`, which the preceding `toEqual` already does — in which case the line is simply redundant and should be deleted, not replaced)

**Source:** Cycle-11 audit finding F006 — severity 6 — Rule 18 violation, flagged by Agent K.

---

### Task #499: Fix code-quality: entitlementCrossTabSync's doc comment has grown by paragraph accretion across 8-9 tasks into a self-correcting changelog rather than a specification

**File:** store/entitlementCrossTabSync.ts
**Complexity:** 🔧 Full — consolidation/rewrite of a large doc comment, judgment-heavy
**Owner:** —
**Blocked by:** Task #494, Task #495 (consolidate the comment only after this cycle's own fixes/corrections land, so the rewrite reflects final accurate state, not another mid-stream snapshot)
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
The doc comment has grown by literal paragraph-accretion across 8-9 tasks (#288, #303, #304, #363, #374, #482, #488, #489, #490, #491) to roughly 90-113 lines documenting a 20-55 line function; `isValidBackupVersionNumber`'s comment in `lib/importBackup.ts` shows the identical pattern relative to its 3-line predicate. Every individual claim checked this cycle is currently accurate, but one paragraph (Task #489) exists solely to explain why an earlier version of this same comment was wrong, meaning the comment accumulates as a self-correcting changelog of its own past inaccuracies rather than a specification of current behavior. This structure is what allowed cycles 9-10's overclaims to accrete undetected, and this cycle's own fresh overclaim (Task #494/F002) was introduced into the same growing block. Multi-agent convergence: Auditor A, Agent W, Red Agent R all independently flagged this. at store/entitlementCrossTabSync.ts (header doc comment).

**Acceptance Criteria:**
- [ ] Consolidate the doc comment into a specification of CURRENT behavior and CURRENT accepted trade-offs, removing the chronological "Task #N found X, Task #M corrected it" narrative structure
- [ ] Preserve every currently-accurate factual claim (verified this cycle) but state each once, not as a correction to a prior paragraph
- [ ] Consider whether task-number attribution belongs in a changelog/CHANGELOG.md-style location instead of the function's own doc comment, if this codebase has such a convention

**Source:** Cycle-11 audit finding F007 — severity 7 — 3-way convergence (Auditor A, Agent W, Red Agent R).

---

### Task #500: Fix error-handling: the merge()/setItem() re-persist gap has been deferred twice at low severity, understating a real, not-rare failure trigger

**File:** store/entitlementStore.ts, store/entitlementCrossTabSync.ts, tests/entitlementCrossTabSync.test.ts
**Complexity:** 🔧 Full — investigation + fix/test for a genuinely untested async path
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
The merge()/setItem() re-persist gap flagged as Task #490's residual debt remains untested, confirmed directly against zustand source by multiple reviewers this cycle. Its practical trigger — localStorage quota exceeded — is not a corner case for a desktop/browser app persisting three growing stores. Remediation was logged in debt.md a second time (first at #490, now again per this cycle's own finding) at low severity without a fix or test stub, understating the actual symptom: stale entitlement state after a real, not-rare failure, with zero signal, against AGENTS.md's zero-tolerance framing for silently swallowed errors. at store/entitlementStore.ts (persist config) / store/entitlementCrossTabSync.ts.

**Acceptance Criteria:**
- [ ] Add a live regression test exercising the setItem() re-persist-throws scenario (e.g. a storage mock whose setItem throws QuotaExceededError after a successful migrate), confirming whether persist.rehydrate() resolves or rejects
- [ ] Based on the test's result: either extend the same diagnosability fix from Task #495 (onRehydrateStorage logging) to cover this path too, or explicitly document why it's already covered
- [ ] Update the doc comment's residual-gap paragraph to reflect the now-tested state

**Source:** Cycle-11 audit finding F008 — severity 6 — ESCALATE — deferred twice, flagged by Agent W as understating a real user-facing symptom.

---

### Task #501: Fix tests: the Task #485 version sweep omits -0, a distinct value in the exact equivalence class under test

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
The sweep test enumerates `0, -1, -2, 1, 2, 3, 999, -Infinity, Infinity` but omits `-0`, a distinct JSON-parseable literal (`JSON.parse("-0") === -0`) in the exact zero/floor equivalence class this predicate exists to enforce. Current behavior handles `-0` correctly and symmetrically on both branches (verified this cycle — not a live bug), but the test's own claim of a complete representative sweep is not complete per Rule 16. Confirmed by 2 independent reviewers (Auditor B, Red Agent R). at tests/importBackup.test.ts:Task-#485-sweep-test.

**Acceptance Criteria:**
- [ ] Add `-0` to the sweep test's values array
- [ ] Confirm it passes with the existing symmetric-rejection behavior (no production code change expected)

**Source:** Cycle-11 audit finding F012 — severity 5 — Rule 16 completeness gap, 2-way convergence (Auditor B, Red Agent R).

---

### Task #502: Fix code-quality: isValidBackupVersionNumber's "both branches agree by construction, in one place" claim is architecturally false for the string branch

**File:** lib/importBackup.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix (comment correction)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
The claim that both branches reject non-integers uniformly "by construction, in one place" overclaims: the string branch's `/^\d+$/` regex already fully determines integer-ness before `isValidBackupVersionNumber` is ever called, since `Number()` on an all-digit string is always integer-valued or `Infinity`, and `isFinite` already rejects `Infinity` first. `Number.isInteger(v)` inside the shared predicate is dead code for every value the string branch can hand it. True for the outcome, false as an architectural description: the integer floor is constructed in two places, not one. at lib/importBackup.ts:isValidBackupVersionNumber.

**Acceptance Criteria:**
- [ ] Correct the comment to accurately describe that the string branch's integer-ness is enforced by the regex, and the predicate's `Number.isInteger` check is redundant-but-harmless defense-in-depth for that branch specifically, load-bearing only for the numeric branch
- [ ] No behavior change required

**Source:** Cycle-11 audit finding F013 — severity 4 — flagged by Agent V.

---

### Task #503: Fix edge-case: isValidBackupVersionNumber accepts huge finite doubles like 1e21 without the same overflow guard the string branch effectively gets

**File:** lib/importBackup.ts, tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
`Number.isInteger(1e21)` is `true`, since no fractional component is representable at that magnitude, so a raw numeric `_version: 1e21` passes the predicate cleanly and produces `newerVersionError` in exponential notation. Functionally correct (still rejected), but this is the same implausible-magnitude category F016/F017 (cycle 10) investigated and documented for the string branch, with no equivalent test or decision comment for a directly numeric huge value; `isFinite` does not stop this since `1e21` never becomes `Infinity`. at lib/importBackup.ts:isValidBackupVersionNumber.

**Acceptance Criteria:**
- [ ] Decide and implement: either add an upper bound to the numeric branch matching the same reasoning as F016/F017's acceptance of cosmetic imprecision, or document why this asymmetry with the string branch's overflow behavior is acceptable
- [ ] Add a test pinning the chosen behavior for a raw numeric `_version` like `1e21`

**Source:** Cycle-11 audit finding F015 — severity 4 — flagged by Agent K.

---

### Task #504: Fix async: Task #488's migrate() regression test only exercises a synchronous throw, not zustand's async migrate() Promise-rejection path

**File:** tests/entitlementCrossTabSync.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
Task #488's regression test exercises only a synchronous `migrate()` throw. zustand's `PersistOptions.migrate` type also permits `(state, version) => Promise<S>`, a distinct code path (verified in zustand source, branches on `instanceof Promise`) with no test. All three real `migrate*Store` functions are currently synchronous, so this is a forward-looking gap rather than a live defect today. at tests/entitlementCrossTabSync.test.ts (Task #488 describe block).

**Acceptance Criteria:**
- [ ] Add a test exercising an async `migrate()` function that returns a rejected Promise, confirming whether `persist.rehydrate()` resolves or rejects in that case too (expected: resolves, same swallow behavior)
- [ ] Note in the doc comment that this path is forward-looking (no real store currently uses an async migrate function) so a future async migration doesn't silently lose this coverage

**Source:** Cycle-11 audit finding F016 — severity 5 — forward-looking, not live today, flagged by Red Agent R.

---

### Task #505: Fix code-quality: scripts/validatePack.ts and lib/packTypes.ts's hasValidUnitsArray have no shared validation module, reconciled manually across 4 waves

**File:** scripts/validatePack.ts, lib/packTypes.ts
**Complexity:** 🔧 Full — architectural extraction, cross-file refactor
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-28 (accepted as debt, see debt.md)

**What:**
`scripts/validatePack.ts` and `lib/packTypes.ts`'s `hasValidUnitsArray` have been manually reconciled across four waves (#459, #478, #480, #492) whenever one side's validation logic diverged from the other, kept in sync only by comment cross-references and mirrored tests, not a shared validation module. Each reconciliation was correct individually, but the lack of a single source of truth leaves the next divergence with no structural guard against recurring. at scripts/validatePack.ts, lib/packTypes.ts.

**Acceptance Criteria:**
- [ ] Investigate whether a shared validation module (used by both the CI-time validator and the runtime shape guard) is feasible given their different environments (Node.js CLI vs. browser/Tauri runtime) — if feasible, extract one
- [ ] If not feasible (e.g. due to environment constraints), add a mechanical test that fails when the two files' field-validation lists diverge, so future drift is caught automatically rather than by manual audit

**Source:** Cycle-11 audit finding F019 — severity 5 — flagged by Red Agent R, architectural DRY gap.

---


## Batch 13 — Quality Foundation | 3 tasks | [COMPLETE — 2026-08-03, audited]

**2026-08-03 close-out audit:** this batch had sat at "tasks complete, pending batch audit" since 2026-06-30 — the individual tasks (#151/#152/#153) had each shown Status: COMPLETE for over a month, but the mandatory `/audit` pass required to close the batch (per AGENTS.md's Batch Completion Gate) was never run, a pure process gap rather than a code gap. Ran a right-sized version of the audit protocol (3 independent review agents — general/Toyota lens, dedicated security lens, and an unprimed red-team lens — rather than the full 9-agent machine, proportionate to this batch's small, low-risk, non-security-critical scope) against the CURRENT state of the code, not just the 2026-06-30 snapshot. Real findings, and what happened with each:
- **Fixed now:** Task #153's E2E suite was never wired into any CI workflow — its own stated purpose ("catch a regression invisible in CI until a user reports it") was unmet for the entire month it sat unaudited. Added a Playwright install + `npm run test:e2e` step to `.github/workflows/ci.yml`.
- **Fixed now (found via this same audit, unrelated to Task #152/#153's original scope):** `lib/specialtyPackLoader.ts`'s cross-code serialization chain used a single-argument `.then()` — a rejected prior specialty-pack load (for a *different* code sharing the same base language) would silently abort a fresh, unrelated attempt instead of letting it run independently. Mirrors a bug class `lib/packLoader.ts:159-167` already fixed and explicitly commented on; the sibling file had the identical pattern. Fixed via a shared `attemptLoad` callback passed to both branches of `prior.then(attemptLoad, attemptLoad)`. While building a regression test for this, the fix's own cleanup path surfaced a second, related real bug empirically (a genuine "Unhandled Rejection" thrown during the test run): the in-flight-map cleanup used `void promise.finally(...)`, the exact anti-pattern `lib/packLoader.ts`'s own comment already warns against for this identical scenario (a void'd `.finally()`'s returned promise still carries the original rejection with nothing to catch it). Fixed to `void promise.then(cleanup, cleanup)`, matching the sibling file. One new regression test added (`tests/packLoader.test.ts`), B7-verified by temporarily reverting the fix and confirming the test fails.
- **Logged as debt, not fixed:** a genuine CRITICAL-shaped race (evictPack vs. an in-flight specialty merge, found by the unprimed red-team agent) that can resurrect evicted content — capped to severity 5 per AGENTS.md's Audit Severity Calibration, since the entire specialty-pack path is dormant today (`SPECIALTY_PACKS`' only entry ships `ready:false`) and the fix needs its own dedicated review in code that's already been through 3+ prior hardening cycles. Also logged: a read-time (vs. merge-time) entitlement gap for merged specialty packs (severity 3 — same dormancy, plus the app's single-user/single-process/honor-system model makes it practically unreachable even once specialty packs ship), a few E2E test-robustness nitpicks, two stale doc comments, and two low-severity security-agent informational notes. See `.autocode/debt.md`'s 2026-08-03 "Batch 13 close-out audit" rows for the full list.
- **Task #494 (severity-9 accepted debt from Batch 12, unrelated to this batch but tackled the same session):** also closed — see debt.md, `store/migrations.ts`, and `store/entitlementCrossTabSync.ts`.

Verified before closing: `npx tsc --noEmit` clean, full test suite 1510/1510 (up from 1503 at session start — 6 migrations tests + 1 packLoader test), `npm run lint` clean (pre-existing unrelated warnings only). Batch marked COMPLETE with debt accepted for the dormant-scope findings, per this project's own accept-as-debt convention (AGENTS.md) — the two genuinely live, cheap, in-scope defects were fixed outright rather than deferred.
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

## Batch 14 — M3 macOS OS Hooks [COMPLETE — 2026-07-31 — audit obligation satisfied via Batch 19]
Dependency: Batch 10 complete. Theme: Extend the Tauri desktop app to fire interrupts from real OS events — wake from sleep, unlock screen, and idle return — rather than the 30-second interval timer alone. Pre-req stop-the-line tasks (#173–#177) must close before OS hook tasks (#159–#164) begin.

**Batch audit closure note (2026-07-31):** this batch's own audit (2026-07-04, 39 findings) was fully remediated via Batch 19 (confirmed COMPLETE 2026-07-06). Batch 19 then received its own first-ever full 8-agent `/audit` (2026-07-28) against this exact code — F1 (severity 7) was fixed via Task #506 and verified PASS; the remaining 17 findings (F2–F18) were logged to `debt.md` and accepted as debt with Max's explicit sign-off, closing Batch 19 as COMPLETE. Verified today: `git diff` from Task #506's commit to HEAD across every file in this batch's scope (`os_events.rs`, `interrupt.rs`, `lib.rs`, `tray.rs`, `InterruptHandler.tsx`, `app/settings/page.tsx`, `settingsStore.ts`, `migrations.ts`, `lib/tauriInterrupt.ts`, `hooks/useInterruptConfig.ts`) is empty — zero changes since that accepted-debt closure. A fresh independent read of all 10 files (this session) corroborates: no new issues found beyond what's already in `debt.md` (confirmed the F7 `isMacOS`-untested-branch gap is the same one already logged). Re-running a full fresh audit under the "Batch 14" name would be redundant — its deliverable already carries a closed audit trail under Batch 19. Batch 15 is unblocked.

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

## Batch 15 — Windows + Linux Packaging [PAUSED — blocked on Max, resumes when #165/#166/#167 unblock]
Dependency: Batch 14 complete (OS events architecture in place) — satisfied 2026-07-31. Theme: Port OS hooks to Windows and Linux, and set up platform packaging and code signing for all three desktop platforms.

**2026-07-31: all 3 tasks are code-complete but blocked on things only Max can do** — #165 needs Azure Portal setup + secrets, #166/#167 need real Windows/Linux hardware to compile and manually test (no cross-toolchain available in this environment). None of that is further coding work an agent can advance, so Max chose to skip ahead to Batch 16's architecture doc (Task #168) in the meantime rather than open terminal windows for work that would hit the same walls. Resume this batch once Max reports back on the Azure setup and/or hardware testing.

### Task #165 | build | severity 7
**What:** Windows code signing — choose between EV certificate and Azure Trusted Signing. Configure `src-tauri/tauri.conf.json` for Windows signing. Update `.github/workflows/release.yml` to sign and notarize the Windows installer (NSIS format). Document the signing choice in `docs/SIGNING.md` (new).
**Why:** Without Windows code signing, SmartScreen blocks the installer with "Windows protected your PC." Most users will not proceed past this dialog. Required for any meaningful Windows distribution.
**File:** `src-tauri/tauri.conf.json`, `.github/workflows/release.yml`, `docs/SIGNING.md` (new)
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files (1 new)
**Blocked by:** #123 | **Blocks:** Nothing (see 2026-07-31 correction below)
**Done when:** `tauri.conf.json` has Windows bundle signing config. `release.yml` signs Windows installer. NSIS `.exe` generated in release pipeline. SmartScreen does not block the signed installer.
**Owner:** Architecture Agent
**Status (2026-07-31): code-complete, decision made, NOT verified end-to-end.** Decision: Azure Trusted/Artifact Signing (owner choice over EV cert — see `docs/SIGNING.md`). `tauri.conf.json`'s `bundle.windows.signCommand`, `.github/workflows/release.yml`'s Windows signing step, and `docs/SIGNING.md` are all written. **Cannot be marked COMPLETE** — Max has not yet done the Azure Portal setup (account, identity validation, certificate profile, App Registration — see `docs/SIGNING.md`'s numbered checklist) and supplied the 6 required GitHub secrets, so the release pipeline's Windows signing step will fail if run today. **Correction to the original `Blocked by`/`Blocks` graph:** #166 was originally listed as blocked by this task; that was wrong — Windows OS-hook Rust code (#166) has no technical dependency on code signing (signing only affects whether the built artifact avoids a SmartScreen warning, not whether the feature code compiles or works), so #166 proceeded independently and is already done (see below).

---

### Task #166 | feature | severity 6
**What:** Windows OS event hooks — add a `#[cfg(target_os = "windows")]` block to `src-tauri/src/os_events.rs`. Implement: (1) Wake detection via `WM_POWERBROADCAST` / `PBT_APMRESUMEAUTOMATIC` Windows message, (2) Unlock detection via `WM_WTSSESSION_CHANGE` / `WTS_SESSION_UNLOCK`, (3) Idle detection via `GetLastInputInfo()` in the poll thread. All three emit `interrupt:fire` with the same guard checks as macOS. Requires `windows-sys` or `winapi` crate dependency in `Cargo.toml`.
**Why:** macOS OS hooks ship in Batch 14. Batch 15 ports them to Windows. The IPC interface and JS handler are identical — only the Rust platform code differs. Same user experience across platforms.
**File:** `src-tauri/src/os_events.rs`, `src-tauri/Cargo.toml`
**Severity:** 6 | **DoD Tier:** 3
**Complexity:** 🔧 Full — 2 files, platform Rust
**Blocked by:** #162 (corrected 2026-07-31 — was incorrectly also listed as blocked by #165; signing has no technical dependency relationship to this task, see #165's note) | **Blocks:** #167
**Done when:** `os_events.rs` compiles on Windows (`cargo build --target x86_64-pc-windows-msvc`). Manual test on Windows 11: wake from sleep → interrupt fires; lock screen → unlock → interrupt fires.
**Owner:** Architecture Agent
**Status (2026-07-31): code-complete, NOT verified end-to-end — same category of gap Task #162 (macOS) shipped under.** `windows_impl` module added to `os_events.rs` (message-only window + WNDPROC handling `WM_POWERBROADCAST`/`PBT_APMRESUMEAUTOMATIC`, `WM_WTSSESSION_CHANGE`/`WTS_SESSION_UNLOCK` via `WTSRegisterSessionNotification`, and a `WM_TIMER`-driven `GetLastInputInfo` idle poll). `windows-sys 0.61` added as a Windows-only Cargo dependency, constants/APIs verified against current docs.rs/Microsoft Learn documentation (not written from memory). `emit_interrupt` hoisted out of the macOS-only cfg gate to be shared across all three platforms. New unit tests added (`event_wake_*`, `windows_linux_unlock_*`, `windows_linux_idle_*` — 8 new cases) reusing the existing `unlock_fires`/`idle_fires` pure guard helpers directly since the edge-detection shape is identical across platforms. **Verified today:** `cargo check` and `cargo test` both pass clean on the macOS host target (19/19 os_events tests green, confirms the shared refactor didn't break the working macOS implementation) — this does NOT verify the Windows code itself compiles, since `cfg(target_os = "windows")` code isn't type-checked on a non-Windows host. **NOT verified — requires a real Windows machine or CI runner:** `cargo build --target x86_64-pc-windows-msvc` (the file's own header comment flags one specific highest-risk spot: whether `windows-sys` 0.61.2 represents null window handles as bare integers or as newtype structs like `HICON(0)` — a compile-time-checkable detail that couldn't be confirmed without a compiler on hand), and all manual on-device wake/unlock/idle testing.

**2026-08-07 — real compile failure found and fixed, discovered while researching Max's VM question, not from a dedicated Batch 15 session.** `.github/workflows/release.yml` already runs on real `windows-latest`/`ubuntu-22.04` GitHub Actions runners (triggered on a version-tag push) — its most recent run (`v0.1.0-beta.2`, 2026-08-04, `gh run view 30930122280`) had never been checked against this task's own "NOT verified" status above. It showed **Linux compiled successfully** (good news — Task #167's own compile-verification requirement is already met, see its entry below) but **Windows failed with 8 real compile errors**, none of which matched the one risk this file's header comment anticipated. Root cause: `windows-sys` 0.61.2 represents Win32 handles (`HWND`/`HICON`/`HCURSOR`/`HBRUSH`/`HINSTANCE`) as plain raw pointers (`*mut c_void`) — not bare integers (what the original code assumed) and not newtype structs (the only alternative the header comment's risk note considered) — verified directly against the crate's cached source, not assumed. Also, `GetTickCount` lives in `windows_sys::Win32::System::SystemInformation`, not `Win32::UI::WindowsAndMessaging` where it was imported from. Fixed every site rustc's own CI error output flagged, matching its suggested patches exactly: `WNDCLASSEXW`'s `hIcon`/`hCursor`/`hbrBackground`/`hIconSm` fields, `CreateWindowExW`'s `hmenu` argument, and `GetMessageW`'s `hwnd` argument all changed from a bare `0` to `std::ptr::null_mut()`; the `hwnd == 0` null check changed to `hwnd.is_null()`; the `GetTickCount` import moved to its real module. `cargo check`/`cargo test` (macOS host, unaffected by the `cfg(target_os = "windows")` block) still pass clean, 19/19 `os_events` tests. **Re-verified same day, with Max's explicit go-ahead: `v0.1.0-beta.3` tag pushed, `.github/workflows/release.yml` run `31254977265`.** Windows leg: `cargo build --target x86_64-pc-windows-msvc` now compiles clean — "Finished `release` profile ... in 7m 34s", `plyglt.exe` built successfully. The run still shows overall failure, but only at the artifact-signing step ("failed to run artifact-signing-cli") — the already-known, separate Task #165 blocker (Azure Trusted Signing credentials not yet provisioned), not a code problem. **Task #166's compile-verification requirement is now genuinely done.** Same run: both macOS legs and the Linux/AppImage leg all succeeded outright. Only real-device manual testing (does wake/unlock/idle actually fire a notification) remains open for both Windows and Linux — exactly the piece a VM is for.

**2026-08-10/11 — real-device manual verification on a Windows 11 VM (Parallels, Apple Silicon host), live with Max.** `.github/workflows/release.yml` gained an `if: always()` step uploading the raw unsigned `plyglt.exe` as a workflow artifact (not a release asset) specifically so this testing could happen before Task #165's signing is done — first attempt targeted the wrong build output path (assumed NSIS bundles before signing; verified in real CI logs that Windows signing actually runs on the raw exe *before* NSIS bundling, so the installer never gets created when signing fails) — fixed on the second attempt (`v0.1.0-beta.5`).

Testing surfaced two real, live, previously-undiscovered bugs, both found, root-caused, and fixed the same session — neither is specific to Windows or to this task's own OS-hook code, so both apply to every platform:
1. **[severity ~7, user-blocking]** The Settings "Enable review reminders" toggle checked the BROWSER Notification Web API's permission state, but the actual notification-send code (`components/InterruptHandler.tsx`) uses `@tauri-apps/plugin-notification`'s own, entirely separate native permission system. On this Windows VM the browser API read "denied" (plausible on any Tauri desktop platform whenever the embedded webview's own permission model differs from the native one) even though the real, relevant permission was grantable — permanently blocking the toggle for every Tauri desktop user, not just this test machine. Fixed (`v0.1.0-beta.6`): added `isNotificationPermissionGranted`/`requestNotificationPermission`/`sendNativeNotification` to `lib/tauri.ts` as the single gateway (per CLAUDE.md's Tauri pattern), routing both `InterruptHandler.tsx` (previously a direct plugin import, its own smaller violation of the same rule) and the Settings toggle through it.
2. **[severity ~7-8, confirmed unrecoverable]** `app/study/page.tsx`'s "Unit not found" guard rendered as bare text with zero navigation. Combined with `enter_mandatory_mode` (`src-tauri/src/interrupt.rs`) setting `window.set_closable(false)`/`set_minimizable(false)` on the main window while Mandatory Mode is active, a live tester who hit this state had a window whose OS-level close and minimize buttons were both disabled, with no in-app escape — a Task Manager force-kill was the only way out (confirmed live, not theoretical). Fixed (`v0.1.0-beta.7`): extracted `components/StudyUnitNotFound.tsx` (matching the existing `StudyEmptyQueue.tsx` pattern) with a Home button that unconditionally calls `exitMandatoryMode()` — not gated on `isInterrupt`, since that value is already false by construction at this render and can't be trusted to reflect whether the Rust-side window lock is still active — plus a `useEffect`-logged `[ERR-STUDY-UNIT-NOT-FOUND-...]` diagnostic (mode/unitId) for the next occurrence.

**2026-08-11/12 — continued same session: one clean CONFIRMED pass, then one clean FAILED-TO-FIRE pass, back to back, same VM, same build family.** After the two fixes above (`v0.1.0-beta.7`), Max ran a clean, deliberate test: studied a unit, answered one card wrong (confirmed via `lib/srs.ts:scheduleCard` — an "again" grade sets `interval = 0` → `dueDate = now`, i.e. immediately due, regardless of card state; this also corrects an earlier session note that guessed the delay was "a few minutes" — it isn't, it's instant), returned to the home screen, clicked a different window (not minimized), locked, waited a few seconds, unlocked. **Mandatory Mode fired correctly**: the plyglt window came to the front on its own. This is the first clean, unambiguous, positive confirmation of Task #166's literal Done-When ("lock screen → unlock → interrupt fires") — not inferred from circumstantial evidence, directly observed.

Mid-session, Max also hit a live, unprompted repro of finding #2's dead-end trigger: a WebView-native "This page couldn't load / Reload to try again, or go back" interstitial appeared ~3 cards into an interrupt-triggered session; clicking Reload landed on the (now-fixed) `StudyUnitNotFound` screen, which correctly offered a working Home escape this time — a live confirmation the `v0.1.0-beta.7` fix holds under a real, organic failure, not just the contrived reproduction. **Root cause of the WebView interstitial itself is still unknown** — an earlier in-session guess (VM/GPU/always-on-top renderer-crash theory) was raised without any actual evidence and was explicitly walked back after Max correctly pushed back asking for verification; no logs, devtools output, or crash dump exist to actually confirm it. `tauri`'s `devtools` Cargo feature was enabled (`v0.1.0-beta.8`, `src-tauri/Cargo.toml`) specifically so a future occurrence can be inspected for a real console/network error via right-click → Inspect Element, instead of guessing again. **Important limitation already identified:** DevTools only shows front-end JS activity — it will show nothing for the *second* failure mode below, which likely never reaches the JS layer at all.

**Immediately after, on `v0.1.0-beta.8` (the devtools build), a repeat of the exact same test procedure — wrong card, home screen, unfocus (not minimize), lock, unlock — did NOT fire anything.** Settings toggles reconfirmed on (`interruptEnabled`/`mandatory` both true, persisted correctly across the exe swap as expected — Tauri's app-data directory is keyed by the `tauri.conf.json` `identifier`, not the specific binary file). Plyglt was found unfocused, still on the home screen, exactly as left before locking — meaning the interrupt genuinely never fired at all this time, not a window-focus/restore issue like earlier suspected. Since interruptEnabled/mandatory/totalDue were all confirmed correct, and Rust's `snooze_until_secs` is in-memory-only (resets to 0 on every fresh process start, ruling out a stale snooze from a prior exe), the leading hypothesis is **intermittent unreliability of Windows session-lock-notification delivery specifically inside this Parallels VM** — a real, plausible, but *unverified* difference between virtualized and physical session-change event delivery. This is a hypothesis, not a confirmed finding — flagged as open below, not asserted as fact (the earlier over-claiming mistake should not be repeated here).

**Session paused here by Max's explicit choice, not a hard blocker** — real, substantial progress was made (two genuine bugs fixed and shipped, one clean positive Done-When confirmation obtained), but the intermittent-firing question is unresolved. **For whoever picks this up next:**
- Task #166's Done-When has now been positively, cleanly confirmed at least once for the unlock trigger specifically. Wake-from-sleep (a separate Windows message, `WM_POWERBROADCAST`/`PBT_APMRESUMEAUTOMATIC`, not exercised by lock/unlock at all) has NOT been tested yet in any form this session — genuinely still open.
- The intermittent non-firing needs several more repeat trials (ideally 5+ back-to-back) to determine if it's genuinely flaky (VM-specific reliability gap, likely not fixable in this codebase, would become a documented platform limitation) or if there's a reproducible triggering condition we haven't isolated yet (e.g., does it correlate with how long the lock persisted, whether the VM's own idle/screensaver kicked in during the lock, or some other timing factor).
- `v0.1.0-beta.8` (devtools-enabled) is the current build in Max's hands; a copy is downloadable from `gh run download 31540336229 -n plyglt-windows-unsigned-installer` if needed again, or trigger a fresh CI run.
- Do not re-litigate or re-fix the two bugs above (notification-permission gateway, study-page dead end) — both are genuinely fixed and shipped in `v0.1.0-beta.6`/`v0.1.0-beta.7` respectively, confirmed via passing test suites, not just manual claims.
- Open question logged, not decided: whether `devtools` should ship in the real signed production build or be feature-gated out once this investigation concludes.

See `.autocode/debt.md` for the tracked open items (WebView-interstitial root cause, intermittent-firing hypothesis, devtools ship-or-gate decision, wake-from-sleep never tested).

**2026-08-14 — session resumed on `v0.1.0-beta.12` (the same build carrying the new interrupt-floor guarantee, see Task #533 below). Real progress, one new open finding, wake-from-sleep still not tested.**

First, a real content-supply bug was found and fixed live: after 2 hours locked, an unlock produced no fire at all (not even a bounce) — traced to `components/InterruptHandler.tsx`'s `if (totalDue === 0) return;`, which treated "nothing FSRS-due" as "skip the interrupt entirely," contradicting BRAND.md's literal "6-10 interrupts every day" promise. Fixed same session as Task #533 (a real feature, not a Task #166-scoped fix, so tracked separately). Re-tested afterward on the same VM:

- **Unlock trigger, nothing due:** fired correctly this time — a notification bounced (confirmed via the shared `interrupt_gate_events` gate, and directly observed) — but the plyglt window did **not** come to the foreground, even though Mandatory Mode is confirmed ON in Settings on this VM.
- **Idle trigger, some time later:** fired AND correctly forced the window to the foreground on its own — Max found it already sitting in front, showing a review, without touching anything.

Both triggers call the exact same Rust function (`enter_mandatory_mode` — `set_always_on_top`/`show`/`set_focus`, no branching by trigger type), so this is not a code-path difference. Leading hypothesis: Windows' built-in "anti-focus-stealing" protection, which is timing-sensitive around exactly when a background process last received real user input — an unlock event's password entry goes to the OS shell, not to plyglt, right before plyglt's background thread tries to grab focus; an idle→active edge firing on the user's next genuine mouse/keyboard input may simply get luckier with that timing. **Not confirmed as a real, reproducible unlock-specific gap yet — only one occurrence of each.** A same-session retest was planned (wait for the 90-minute interval gate to clear, then lock/unlock again) but the session moved on to Mac parity and iOS work before that retest happened. Logged as an open debt item — see `.autocode/debt.md`.

**Wake-from-sleep (`WM_POWERBROADCAST`/`PBT_APMRESUMEAUTOMATIC`) is still, as of this session, never manually tested.** This remains the one literal, named Done-When condition ("wake from sleep → interrupt fires") that has never been exercised in any form. Whoever picks this up next: a VM suspend/resume cycle is all that's needed — same build, same VM, no setup required.

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
**Status (2026-07-31): code-complete, NOT verified end-to-end — same category of gap as #166.** `linux_impl` module added to `os_events.rs`, using `zbus`/`zbus_systemd` (pregenerated systemd D-Bus bindings, not hand-rolled proxies) for wake (`ManagerProxy::receive_prepare_for_sleep`) and unlock (`SessionProxy::receive_unlock`) as real D-Bus signals, plus `SessionProxy::idle_hint()` (polled every `OS_POLL_SECS`) for idle. **Deliberate deviation from this task's original idle-detection suggestion:** `XScreenSaverQueryInfo` was rejected (X11-only, inert under Wayland) and `/proc/uptime` was rejected (that's system boot time, not user input idle time — it cannot express an idle→active edge at all); logind's `IdleHint` is compositor-agnostic and was already available via the same D-Bus connection needed for wake/unlock. Documented tradeoff: logind's `IdleHint` doesn't accept a caller-supplied threshold, so `idle_threshold_minutes` does not tune Linux idle sensitivity the way it does on macOS/Windows (both poll a raw elapsed-seconds value) — a real platform API gap, not a bug, documented in-code. `zbus`, `zbus_systemd` (with the `login1` feature), `tokio` (a small dedicated single-thread runtime confined to this one background thread), and `futures-util` added as Linux-only Cargo dependencies. `tauri.conf.json`'s `bundle.targets: "all"` already covers AppImage by default (verified against Tauri docs — no config change needed); `.github/workflows/release.yml`'s `ubuntu-22.04` matrix leg passes `--bundles appimage` to scope the CI build to just AppImage (narrower than "all", avoiding an unneeded `rpmbuild` dependency for `.deb`/`.rpm`). **Verified today:** `cargo check`/`cargo test` pass on the macOS host (same caveat as #166 — does not compile-check `cfg(target_os = "linux")` code). **NOT verified — requires a real Linux machine or CI runner:** `cargo build --target x86_64-unknown-linux-gnu`, and all manual on-device suspend/resume/lock/unlock/idle testing.

**2026-08-07 — compile verification now satisfied, found via a real CI run neither task's status had been checked against.** `.github/workflows/release.yml`'s `v0.1.0-beta.2` run (2026-08-04, `gh run view 30930122280`) shows the `ubuntu-22.04, x86_64-unknown-linux-gnu, --bundles appimage` job **succeeded** — `cargo build --target x86_64-unknown-linux-gnu` compiles clean on real Linux CI hardware, and the AppImage bundle step completed. This task's compile-verification requirement is done; only real-device manual testing (suspend → resume → interrupt fires, lock → unlock → interrupt fires) remains, same as it always did — a VM is the practical way to do that without owning a physical Linux machine. See Task #166's log for the same run's Windows leg, which failed (now fixed, not yet re-verified).

---

## Batch 16 — Sync Backend [COMPLETE]
Dependency: Batch 15 complete (all desktop platforms shipping). Theme: Add a cloud sync backend and auth layer so user progress persists across devices — prerequisite for Batch 17 (mobile).

**2026-08-08 — extended live two-client testing found one real, confirmed-not-a-bug limitation and prompted two follow-up tasks.** Max continued exercising the two-client setup from Task #518's original verification and hit a real, sustained mastered-card-count mismatch between the desktop app and the browser client (36 vs 20 for one unit). Root-caused via direct inspection (local storage files + a live Supabase query, not guesswork): the desktop app — this project's main dev/test machine — had accumulated real local progress from before the sync event log existed (or before `enqueueReviewEvent` was wired into the production path), and that pre-existing progress was never retroactively captured as a `review_events` row, so it could never reach another device. The sync engine itself was proven working correctly for everything that happened after it went live. **Max's explicit decision: leave this as a known, accepted limitation for now** (real users starting fresh after sync ships won't hit it; a pre-existing user's historical progress not carrying over on first cross-device sign-in is an acceptable gap at this stage, revisit before a wider launch) — no backfill mechanism built. The 16 affected cards on the test machine were reconciled by having Max actually re-review them for real (after manually editing their local due-dates to make them reviewable again) rather than synthesizing data, since scripted writes using a locally-stored session token got (correctly) blocked by this session's safety tooling.

Two real gaps surfaced during this debugging session and logged as follow-ups below rather than fixed in the moment: no visible sync-status indicator anywhere in the app (**Task #520**) — the single biggest reason this took as long as it did to diagnose — and a shipped bug fix (making `syncNow()`'s silent `{ok:false}` failures actually log to the console) that went out without its own test (**Task #521**).

**2026-07-31: Dependency technically not yet satisfied (Batch 15 is paused, not complete) — Max explicitly chose to start Task #168 (architecture doc only, no infrastructure provisioned) ahead of Batch 15 fully closing, since the doc itself has no dependency on Windows/Linux shipping. Task #169 (actual sync implementation) should still wait for both Batch 15 to close AND Max's sign-off on #168's recommendation below — provisioning real cloud infrastructure and committing to a vendor is a bigger, harder-to-reverse step than drafting a recommendation doc.**

**2026-08-03: Max signed off on Task #168's platform recommendation (Supabase + FCM, approved as-is) while Batch 15 remains paused on hardware access — a deliberate choice to keep architecture/decision work moving in parallel with an externally-blocked batch, same reasoning as 2026-07-31's note above. Task #169 (real infrastructure — schema, auth flows, offline sync layer) is now unblocked on the decision side, but has NOT been started; still recommended to wait for Batch 15 to close (or for Max to explicitly re-prioritize) before provisioning real, billed cloud infrastructure, since that's a harder-to-reverse step than the doc itself.**

**2026-08-06: Max explicitly re-prioritized — during this session's `/meet` owner-questions pass, Max named "build sync backend / mobile" as the single most important thing for the next 90 days, superseding the 2026-08-03 note's "wait for Batch 15 to close" recommendation. Task #169 is now the active strategic priority, to begin once Batch 20 (this session's 5 quick-win tasks, #509–#513) is cleared. Batch 15 remains paused independently (still blocked on Max's own hardware/Azure access, unrelated to this decision) and is not being waited on.**

### Task #168 | architecture | severity 9
**What:** Write sync backend architecture decision doc at `docs/SYNC_ARCHITECTURE.md`. Must cover: (1) platform choice (Supabase vs Firebase vs custom server — choose one, justify), (2) what syncs: SRS card state (cardId, stability, difficulty, dueDate, lastReview, reviewCount, lapses), settings (interrupt config), entitlement (licenseKey, licenseType, purchasedAddOns), (3) offline-first model: all writes local-first, sync on open + periodic, (4) conflict resolution strategy for SRS data — last-write-wins is wrong for concurrent reviews on multiple devices; specify merge strategy (e.g., per-card timestamp, version vector), (5) auth providers: Apple Sign In + Google Sign In minimum (Apple Sign In required for App Store), (6) push notification infrastructure: APNs (iOS) + FCM (Android), (7) estimated monthly cost at 1,000 / 10,000 / 100,000 users.
**Why:** The platform choice constrains all of Batches 16-17. A wrong choice is expensive to reverse. Apple Sign In is required by App Store guidelines for any app that offers social login. Push notification server design must be decided before mobile starts. Conflict resolution for SRS data is subtle — cannot be deferred.
**File:** `docs/SYNC_ARCHITECTURE.md` (new)
**Severity:** 9 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 1 file, architecture doc
**Blocked by:** Nothing (but requires owner decision on platform and auth) | **Blocks:** #169
**Done when:** `docs/SYNC_ARCHITECTURE.md` exists. Platform chosen (not TBD). Auth providers listed. Conflict resolution strategy named specifically. Push notification stack defined. Cost estimate table present.
**Owner:** Architecture Agent
**Status: COMPLETE — signed off by Max 2026-08-03.** `docs/SYNC_ARCHITECTURE.md` written with a concrete recommendation: **Supabase (Postgres) for data + auth, Firebase Cloud Messaging (FCM) for push transport only** — a deliberate hybrid, not indecision (Postgres's relational model fits SRS review data naturally and bills predictably; FCM is free and gives one API for both iOS/Android push via its APNs bridge, so raw APNs integration is avoided entirely). **Deviation from this task's literal spec:** item (6) asked for "APNs (iOS) + FCM (Android)" as two separate services — the doc recommends FCM for both platforms instead, since FCM's APNs bridge (silently exchanging the real APNs device token for an FCM token) gives one send API and one token type, verified via current 2026 documentation before recommending it, not assumed. Conflict resolution (item 4) recommends an append-only `review_events` log rather than per-field merge logic on a mutable current-state row — sidesteps the "last-write-wins is wrong" problem structurally (two devices reviewing before syncing produce two real events, not a conflict to resolve) rather than requiring bespoke merge code. All 7 required items covered with real numbers (2026 Supabase/Firebase pricing researched, not estimated from memory). One question intentionally left open: whether sync should eventually make entitlement server-authoritative (a real change to CLAUDE.md §5's client-only model) — explicitly deferred by Max at sign-off time, not needed to unblock Task #169, flagged for before Batch 17 ships. **Max reviewed and signed off on the platform choice 2026-08-03 (approved as recommended, no changes requested) — Task #169 (real infrastructure) is now unblocked.**

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
**Status (2026-08-06): credential-free parts COMPLETE, real work started same session Max named this the 90-day priority; the auth/live-sync portion is NOT started — genuinely blocked on Max provisioning a real Supabase project and Apple/Google OAuth apps (`docs/SYNC_CREDENTIALS_CHECKLIST.md` has the exact steps, written non-technical-first). What's done and verified: `supabase/migrations/20260806000000_review_events.sql` (the append-only event-log schema + RLS policies from `docs/SYNC_ARCHITECTURE.md` §4); `lib/reviewEvent.ts` + `lib/conflictResolution.ts` (pure event construction + the "latest event per card" replay/merge algorithm — the whole conflict-resolution answer, unit-tested including the "two devices review before either syncs" scenario the task brief specifically calls out); `store/syncStore.ts` (new, `SYNC_VERSION` 1, local pending-events queue + deviceId, persisted via the existing platform storage factory). This is wired to the REAL production write path per Rule 20, not just unit-tested in isolation — `store/srsStore.ts`'s `commitSession` now returns the resulting `CardProgress` (was `void`), and `hooks/useStudySession.ts` → `app/study/page.tsx`'s real `commitSession` call site now also calls `enqueueReviewEvent` on every review, so real events are accumulating locally starting now, ready to upload once the live client exists. Two Rule 1 cleanups fell out of this pass: `lib/storeVersionGuard.ts` (extracted `assertNotFutureVersion` so the new `store/syncMigrations.ts`, itself split out of `store/migrations.ts` under the 400-line cap, could share it without a circular import) and `components/StudyEmptyQueue.tsx` (extracted `app/study/page.tsx`'s "Nothing ready" block — that file was already 5 lines over the 150-line route cap before this session touched it). Verified: `tsc` clean, 1581/1581 tests (was 1546, +35 new — reviewEvent/conflictResolution/syncStore/storeVersionGuard/syncMigrations all covered, plus StudyEmptyQueue's co-located test per Rule 14), lint 0 errors (3 pre-existing warnings), coverage all 4 thresholds clear, a real `next build` succeeds. Committed as `78fab47`. **Not started:** the live Supabase client, real Apple/Google sign-in screens, end-to-end two-device sync verification, and the settings/entitlement sync tables `docs/SYNC_ARCHITECTURE.md` §2 also names (scoped out of this pass — SRS review events are the schema's own "the interesting one," settings/entitlement sync is a smaller follow-on once the SRS path is proven live). Resume with `/task #169` once Max has completed the credentials checklist.**

**2026-08-06 (later same day): Max completed `docs/SYNC_CREDENTIALS_CHECKLIST.md`'s Stage 1 (Supabase project creation + the `review_events` migration).** Real Supabase project `plyglt-prod` is live at `https://ivtrndmqshlfobonxdmv.supabase.co`. The migration ran successfully in Supabase's SQL editor; independently re-verified (not just trusting the dashboard's own success message) via a live unauthenticated REST call — `GET /rest/v1/review_events?select=id&limit=1` returned `HTTP 200 []`, confirming the table exists, the Publishable key is valid, and Row Level Security is correctly filtering an anonymous request down to zero rows rather than erroring or leaking data. Credentials saved to `.env.local` (git-ignored, confirmed via `git check-ignore`) as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — never committed, never printed in full after the initial hand-off. **Still pending:** checklist Stage 2 (Apple Sign In) and Stage 3 (Google Sign In) — walking Max through these next, one at a time given his non-technical background. Once at least one provider is live, the actual Supabase client + auth screens can be built and tested end-to-end.

**2026-08-06 (later same day): Google Sign In is live.** Max created a Google Cloud project (`plyglt`), configured the OAuth consent screen (External user type), and created a Web application OAuth client (ID `181486318956-hbfjs9i5h4b3untobpcrrvu3lpdqt5p5.apps.googleusercontent.com`) with the Supabase callback URL registered as an authorized redirect URI. Client ID shared in chat (not a secret); Client Secret was pasted directly into Supabase by Max, never seen in chat, per this project's usual handling of real credentials. Independently verified via Supabase's own live Auth settings endpoint (`GET /auth/v1/settings`) — `"google": true` in the response, not just a self-reported "done" from the dashboard. Apple Sign In (the harder of the two providers) is next.

**2026-08-06 (later same day): Apple Sign In is live — `docs/SYNC_CREDENTIALS_CHECKLIST.md` is now 100% complete.** Real gap found and fixed mid-flow, not anticipated by the original checklist: Apple's Services ID web-auth config requires an existing **App ID** with "Sign In with Apple" enabled to group under, and this Apple Developer account had zero registered App IDs (the existing macOS code-signing setup uses Developer ID Application certificates, a different, App-ID-independent signing model) — worked around by registering a new App ID matching the app's real bundle identifier (`app.plyglt`, read directly from `src-tauri/tauri.conf.json` rather than guessed) and enabling the capability on it before the Services ID (`com.plyglt.app.signin`) would let Max select a Primary App ID.

Second real gap: Supabase's current Apple provider UI does not accept Team ID / Key ID / raw `.p8` key as three separate fields the way `docs/SYNC_CREDENTIALS_CHECKLIST.md` assumed — it wants one pre-built "Secret Key" value, which for Apple OAuth is a signed JWT (ES256, `kid`=Key ID, `iss`=Team ID, `sub`=Services ID, `aud`=https://appleid.apple.com, max 6-month expiry). Located the downloaded `.p8` file directly on Max's machine (`~/Downloads/apple/AuthKey_QKAX24L3U3.p8` — this session has local terminal access to the same Mac) and generated the JWT locally with a one-off Python script (`cryptography` library, manual ES256 JWT construction — DER-to-raw-R||S signature conversion, since `PyJWT` wasn't installed and this was faster than adding a dependency for a one-time token). The private key itself was never printed or sent anywhere — only the final signed JWT was output, and Max pasted that directly into Supabase.

**⚠️ Standing reminder for whoever picks this up next: the Apple secret JWT expires 2027-02-05 (Apple's 6-month max).** After that date, Apple Sign In will silently stop working until a new token is generated and re-pasted into Supabase. Regenerating is trivial (same script, same `.p8` file, ~5 seconds) — the risk is forgetting it's time-limited at all, since nothing will fail until the exact expiry moment. No automated reminder system exists in this project; whoever runs `/meet` or `/resume` after ~2027-01 should flag this proactively.

Verified via Supabase's live Auth settings endpoint: `"apple": true`. **Checklist status: Supabase project ✓, database schema ✓, Google Sign In ✓, Apple Sign In ✓ — all four Stage items from `docs/SYNC_CREDENTIALS_CHECKLIST.md` complete.** Next: build the actual Supabase client wiring, real sign-in screens, and end-to-end sync verification between two devices — the credential-gated work that's been blocked since this task started.

**2026-08-06 — Task #169 decomposed into #514–#518 below.** Now that credentials are live, the remaining scope is a strict dependency chain (client → auth → UI → real sync → verification), not independent parallelizable work — Max explicitly requested this go through the task harness (`/task`) rather than freeform building, one task at a time, no `/advance`. Task #169 itself stays open as the umbrella and closes when #518 verifies its original Done-When.

**Status: COMPLETE — 2026-08-07.** All of #514–#519 done; #518's live verification (see its own log) confirms this task's original Done-When directly: SRS state synced bidirectionally between two real desktop-class clients (a signed macOS `.app` and a signed-in browser session) with no data loss, conflict resolution correctly preserved both of two independent reviews of the same card recorded before either synced, and the Apple Sign In auth flow works end-to-end on a real macOS build. **Unblocks Task #170 (push notification server).**

---

### Task #514 | feature | severity 8
**What:** Add `@supabase/supabase-js` as a dependency. Create `lib/supabaseClient.ts` — the single gateway for all Supabase access, mirroring `lib/tauri.ts`'s established pattern (CLAUDE.md §2: one gateway file, nothing else imports the SDK directly). Initialize from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Critically: configure the client's `auth.storage` option to route through `lib/storage.ts`'s `createPlatformStorage`, NOT Supabase's own default (browser `localStorage`) — CLAUDE.md §3 requires all persistence to flow through the platform storage abstraction so desktop (Tauri Store) and web behave consistently and survive browser cache clears on desktop. Must degrade gracefully (return `null`/a clear not-configured signal, never throw) when env vars are absent, matching the Tauri gateway's own graceful-degradation pattern.
**Why:** Prerequisite for every other piece of real sync/auth work. Establishes the architectural pattern (single gateway + storage-abstraction compliance) the rest of the feature must follow — getting this wrong here means every downstream task inherits the mistake.
**File:** `lib/supabaseClient.ts` (new), `package.json`, `package-lock.json`
**Severity:** 8 | **DoD Tier:** 2
**Complexity:** 🔧 Full — new dependency, new architectural gateway module
**Blocked by:** Nothing (Task #169's credential prerequisite is complete) | **Blocks:** #515, #517
**Done when:** `grep -rn "@supabase/supabase-js" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v lib/supabaseClient.ts | grep -v '\.test\.'` returns nothing (single-gateway rule enforced). A test confirms the client degrades gracefully when env vars are absent. A test confirms `auth.storage` is wired to `createPlatformStorage`, not left at Supabase's default.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-06 (independently audited PASS, 2 non-blocking findings both resolved same-cycle. Single-gateway rule verified via grep by both the builder and the independent auditor. auth.storage wiring verified via identity check, not just presence. 1590/1590 tests, tsc/lint/build/npm-audit all clean. Committed as `9e0cc94`.)**

---

### Task #515 | feature | severity 8
**What:** New `store/authStore.ts` (Zustand) tracking the current Supabase auth session (signed-in/out, user id, email). Actions: `signInWithApple()`, `signInWithGoogle()` — both call Supabase's `signInWithOAuth()` via `lib/supabaseClient.ts` and open the resulting authorize URL via the existing `openExternalUrl`/browser-redirect path. `signOut()`. Subscribes to Supabase's `onAuthStateChange` so the store reflects the real session once one exists.
**Scope correction (2026-08-06, Max's explicit decision):** this task is deliberately scoped to what's verifiable WITHOUT Tauri deep-link plumbing, which doesn't exist anywhere in this app yet (confirmed: no `tauri-plugin-deep-link`, no custom URL scheme registered) and is real Rust/config work, not something that belongs inside a single TS store file. The real end-to-end desktop callback (the OS handing control back to the app after the browser sign-in completes) is split out to the new **Task #519**. This task's own Done-When is scoped to what it can actually prove: the store's state machine, the OAuth call construction, and a web-context sign-in flow (Supabase's standard same-window/tab redirect, which works today with zero additional Tauri plumbing) — not full desktop verification, which is Task #518's job once #519 lands.
**Why:** Nothing can sync until a real user is signed in — the `review_events` RLS policies require an actual `auth.uid()`.
**File:** `store/authStore.ts` (new)
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — new store, OAuth flow
**Blocked by:** #514 | **Blocks:** #516, #517
**Done when:** A real sign-in with Google (or Apple), verified in the web build (not yet the Tauri desktop build — that's #518/#519's job), completes and `authStore`'s state reflects a signed-in user with a real Supabase-issued user id. Sign-out clears it. Tests cover both provider entry points and the signed-out default state.
**Second scope correction (2026-08-07, Max's explicit decision, made during this task's own audit cycle):** an independent audit (fresh-eyes agent) correctly flagged that the original Done-When's "a real sign-in ... completes" clause was never actually verified against live infrastructure — the delivered tests mock `@/lib/supabaseClient` throughout, and unlike the #519 split (a genuine infrastructure gap), nothing here actually blocked a live check: real Supabase credentials exist, Google Sign In is confirmed enabled. In response: ran a live (non-mocked) verification — `client.auth.signInWithOAuth({ provider })` called against the real `plyglt-prod` Supabase project for both `google` and `apple` — both returned genuine authorize URLs with no error, proving the store's OAuth call construction genuinely works against live infrastructure, not just mocks. What remains unverified is the human-interactive completion (a real person clicking through Google/Apple's consent screen and confirming their real user id lands in `authStore`'s state) — this cannot be scripted without either a real person or fake credentials. Max was offered the choice to do that full interactive test right now vs. defer it; **chose to defer it to Task #516**, since that task provides the first real UI button and needs this exact same human-interactive test regardless — doing it twice (once headless against #515, again for real against #516's UI) would be redundant. Task #515 is COMPLETE against this corrected bar: OAuth call construction proven live, full state-machine unit-tested, human-interactive full-loop completion is Task #516's verification responsibility, not a re-opened gap here.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-07 (audit initially FAILed severity 6 on unverified live sign-in claim; resolved via a real, non-mocked `signInWithOAuth` check against the production `plyglt-prod` Supabase project for both providers, plus Max's explicit decision to defer full human-interactive completion to Task #516. 1605/1605 tests, tsc/lint/build all clean. Committed as `ae2cdf8`.)**

---

### Task #519 | feature | severity 7
**What:** Add `tauri-plugin-deep-link` (or equivalent) and register a custom URL scheme (e.g. `plyglt://auth-callback`) so the OS can hand control back to the desktop app after a user completes OAuth sign-in in their system browser. Wire the JS-side listener (in `store/authStore.ts` or a small dedicated handler) to catch the callback URL, extract the auth code/tokens, and complete the session via Supabase's `exchangeCodeForSession()` (PKCE flow, the modern default — do not use the older implicit/hash-fragment flow). Update `store/authStore.ts`'s `signInWithApple()`/`signInWithGoogle()` calls to pass `skipBrowserRedirect: true` and the custom-scheme `redirectTo`, matching the deep-link-based desktop OAuth pattern (Supabase's own docs cover this exact Tauri/desktop scenario).
**Why:** Task #515 built the store and web-verifiable OAuth logic but deliberately deferred real desktop callback handling, since it's genuine Rust/Tauri configuration work, not a TypeScript-only change. Without this, "Sign in with Apple/Google" on the actual shipped desktop app opens a browser tab that has nowhere to send the user back to.
**File:** `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs` (plugin registration), `store/authStore.ts` (callback handling)
**Severity:** 7 | **DoD Tier:** 3
**Complexity:** 🔧 Full — new Tauri plugin, Rust config, platform-specific URL scheme registration
**Blocked by:** #514, #515 | **Blocks:** #518 (full desktop verification needs this; #516/#517 do NOT need to wait — they can be built and tested against the web-context flow #515 already delivers)
**Done when:** A real sign-in with Google (or Apple) completed in the system browser on a real macOS build successfully hands control back to the running desktop app, and `authStore`'s state reflects the signed-in session — verified on an actual built `.app`, not just `next dev`.
**Owner:** Architecture Agent
**Code status: CODE COMPLETE — 2026-08-07** (independently audited PASS. One real, live-reachable finding logged to `.autocode/debt.md` rather than fixed this cycle: on Windows/Linux specifically — not macOS — a warm-start OAuth callback launches a new OS process instead of notifying the already-open window, needing `tauri-plugin-single-instance` as a separate feature addition; recoverable via restart, not data-losing, and outside this task's own macOS-scoped Done-When. Also fixed a real scope-crossing gap found mid-build: `tauri.conf.json`'s CSP didn't allow the Tauri webview to reach Supabase at all, which would have silently broken both this task's `exchangeCodeForSession` call and Task #517's sync fetches. 1661/1661 tests, tsc/lint/build/`cargo check` all clean. Committed as `aad8cec`.) **Status: COMPLETE — 2026-08-07.** Live human-interactive verification done via Task #518: a real macOS `.app` build, a real Apple sign-in click-through, and confirmed control handed back to the running app. (This surfaced a real bug in the process, fixed as part of #518: the OAuth response arrived in implicit-flow shape, not the PKCE shape this task's deep-link handler expects — see #518's log for the root cause and fix in `lib/supabaseClient.ts`.)

---

### Task #516 | feature | severity 6
**What:** Add a Sign In section to `app/settings/page.tsx` (or a new dedicated component if that file is near its 150-line cap — check first) with "Sign in with Apple" / "Sign in with Google" buttons wired to `authStore`'s actions, and a signed-in state showing the user's email plus a Sign Out button. Match this project's existing Pro-gating UI conventions for visual consistency.
**Why:** Users need an actual entry point to sign in — the first real user-facing surface for the whole sync feature.
**File:** `app/settings/page.tsx`, possibly a new `components/SyncSignIn.tsx`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — new UI, likely a new component
**Blocked by:** #515 | **Blocks:** #518
**Done when:** A co-located test (Rule 14) confirms both provider buttons render, clicking each calls the correct `authStore` action, and the signed-in state renders the user's email and a working sign-out button. **Additionally (inherited from Task #515, 2026-08-07):** a real, human-interactive sign-in test — Max actually clicks "Sign in with Google" (or Apple) in the running app and confirms his real email appears in the signed-in state — is this task's responsibility, not optional polish. Task #515 proved the OAuth call construction works against live infrastructure but deliberately deferred the full interactive completion here, since this is the first task with a real button to click.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-07** (Cycle 1: UI built, independently audited PASS, committed `d272d3f`. Cycle 2: Max's live human-interactive test caught a real bug — OAuth callback silently unprocessed when the redirect landed off `/settings`, root-caused to this being a Next.js static export with per-route JS bundles and `store/authStore.ts` only being imported by the settings-only sign-in component. Fixed via a globally-mounted `components/AuthSessionListener.tsx` plus an explicit `redirectTo` back to `/settings/`; independently re-audited PASS; committed `40b4f40`. Max then re-ran the live test and confirmed a real Apple sign-in completes end-to-end with the signed-in state rendering correctly. This also satisfies Task #515's deferred human-interactive verification. 1617/1617 tests, tsc/lint/build all clean.)

---

### Task #517 | feature | severity 9
**What:** Wire real sync when a user is signed in: (a) **upload** — push `store/syncStore.ts`'s `pendingEvents` to the `review_events` table (batch insert; clear the local queue only on confirmed success, never before — no silent data loss on a failed upload); (b) **download** — fetch a user's remote events and merge with local-only events via the already-built, already-tested `lib/conflictResolution.ts:replayLatestEventPerCard`; (c) **replay** the merged result into `store/srsStore.ts`'s `cards` map so the UI reflects true merged state. Sync triggers per `docs/SYNC_ARCHITECTURE.md` §3: on app open (if pending events exist and network is available) plus periodic background sync. A failed sync silently retries — never blocks the user (BRAND.md's "never makes you feel behind," applied to infrastructure).
**Why:** This is the actual point of the feature — SRS state genuinely syncing across devices. Everything in #514–#516 was prerequisite plumbing.
**File:** `store/syncStore.ts`, possibly a new `lib/syncClient.ts` for upload/download orchestration (kept separate from the pure `lib/conflictResolution.ts`, matching this project's small-single-purpose-module pattern)
**Severity:** 9 | **DoD Tier:** 3
**Complexity:** 🔧 Full — core feature logic, network + offline-first + merge orchestration
**Blocked by:** #514, #515 | **Blocks:** #518
**Done when:** A real review recorded while signed in on one client actually appears in Supabase's `review_events` table (verified via direct query, not just trusting the code path). A second client, on sync, receives and correctly merges that event with no data loss. Tests cover the upload path, the download+merge path, and silent-retry-on-failure.
**Scope note (2026-08-07):** the orchestration (upload → download → replay, composing `authStore`/`syncStore`/`srsStore`) landed in a new `hooks/useSync.ts` rather than inside `store/syncStore.ts` itself — CLAUDE.md's Layer Map assigns cross-store composition to hooks/, and no store in this codebase currently imports another feature store directly. A new `components/SyncTrigger.tsx` (globally mounted, matching the `EntitlementValidator`/`AuthSessionListener` precedent) implements the on-sign-in-and-periodic trigger requirement. Both were named as "possibly" in the original File: line's spirit even if not by exact filename.
**Owner:** Architecture Agent
**Code status: CODE COMPLETE — 2026-08-07** (Cycle 1 audit FAILed on two real bugs — a stale-snapshot race that could silently drop a review recorded mid-upload, and a CardState-inference bug that misclassified a card failing twice before ever graduating as "relearning" instead of "learning," corrupting the next FSRS scheduling call. Both fixed in Cycle 2 and independently re-audited PASS via an *executed* Deletion Test on each fix. Three lower-severity findings deferred to `.autocode/debt.md`. 1646/1646 tests, tsc/lint/build all clean. Committed as `b053246`.) **Status: COMPLETE — 2026-08-07.** Live human-interactive verification done via Task #518: a real review recorded on each of two independently signed-in clients, both confirmed via direct Supabase query as separate `review_events` rows for the same card — no data loss, correct append-only conflict handling.

---

### Task #518 | feature | severity 8
**What:** Verify Task #169's original Done-When directly: SRS state syncs bidirectionally between two separate signed-in sessions with no data loss, and conflict resolution works correctly when the "same card reviewed on both before either syncs" scenario happens live — not just in `lib/conflictResolution.ts`'s unit tests. Confirm the auth flow works end-to-end on macOS.
**Why:** Closes out Task #169 for real — proves the built pieces work together, not just individually.
**File:** None (verification task) — possibly a new `tests/e2e/sync.spec.ts` if a reliable automated two-client test can be built
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — cross-session verification
**Blocked by:** #516, #517, #519 (real desktop auth verification needs #519's deep-link callback handler, added 2026-08-06 — see #515's scope note) | **Blocks:** Task #169 marked COMPLETE (unblocks #170)
**Done when:** A documented, reproducible verification (an automated E2E test, or a manually-verified and logged walkthrough) shows two sessions genuinely syncing SRS review data bidirectionally with correct conflict resolution.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-07.** Max ran the live walkthrough (`docs/TASK_518_VERIFICATION.md`): a real signed-in macOS `.app` (Client 1) and a real signed-in browser session (Client 2, same account) each reviewed the same card (`u01-t1-010`) independently before either had synced with the other. Direct query of Supabase's `review_events` table confirmed both reviews persisted as separate rows (`reviewed_at` 23:26:32 and 23:28:20, distinct `device_id`s), both later than either client's `synced_at` — proving no data loss and correct append-only conflict handling, matching `lib/conflictResolution.ts`'s design (current card state is whichever event replays latest; nothing is ever overwritten or dropped).

**Two real, live-reachable bugs were found and fixed during this verification, not just the intended human-interactive check:**
1. **Stale local builds:** `src-tauri/tauri.conf.json` had no `beforeBuildCommand`, so `npm run tauri:build` silently repackaged whatever was already sitting in `out/` — a frontend build from hours earlier, missing that session's own changes. CI's `release.yml` always ran `npm run build` as an explicit separate step, masking this locally. Fixed by adding `"beforeBuildCommand": "npm run build"` so any future local or CI build always ships the current frontend.
2. **Desktop OAuth silently no-op'd on a real sign-in:** `lib/supabaseClient.ts`'s `createClient()` never set `flowType`, so `@supabase/auth-js` used its default (`"implicit"` — tokens returned directly in a URL fragment, `#access_token=...`). `store/authStore.ts`'s desktop deep-link handler (`handleDeepLinkCallback`) only ever parses a PKCE-style `?code=` query param and calls `exchangeCodeForSession` — it silently no-ops on anything else, by design (a malformed/foreign URL isn't an error). So a real Apple sign-in returned control to the running app (confirmed via a Rust-level `RunEvent::Opened` trace showing the exact fragment-style URL received) but never updated auth state, with zero visible errors anywhere. Root-caused by adding temporary debug tracing (Rust `eprintln!` on the OS-level open-url event, a `devtools` Cargo feature for the in-app inspector) — both fully removed after diagnosis. Fixed by explicitly setting `flowType: "pkce"` — also the correct OAuth flow for a public client like a desktop app regardless of this bug. Regression test added (`tests/supabaseClient.test.ts`) asserting `flowType` is passed through.

**Also found (infrastructure, not code):** the `plyglt://**` desktop redirect scheme was never added to Supabase's Authentication → URL Configuration → Redirect URLs allowlist — the exact manual step `store/authStore.ts`'s own doc comment and Task #519's audit both flagged as unverifiable by code alone. Max added it live during this session.

**Bonus fix (same session, found independently before the sync test): the desktop app had no discoverable Settings entry point at all** — no native macOS menu bar item, and the home/language-picker screen (before a language is picked) had no Settings link either; only `/learn` did. Added a proper native macOS app menu (`src-tauri/src/app_menu.rs`: About/Settings…(⌘,)/Services/Hide/Quit, plus standard Edit/Window submenus) wired to a new always-mounted `components/AppMenuListener.tsx` (deliberately NOT placed in `InterruptHandler.tsx` despite its existing `tray:study` precedent, since that component is gated behind the `interruptEngine` feature flag and would have made Settings unreachable for any build without it), plus a "Settings →" link added to `app/page.tsx`'s footer.

Verified: 1665/1665 tests, `tsc`/lint/`cargo check` all clean, full local rebuild cycle re-verified end to end on the actual signed `.app`.

**This closes Task #169 (real sync infrastructure) for real — the built pieces (client gateway #514, auth store #515, sign-in UI #516, sync engine #517, desktop deep-link #519) are now proven to work together, live, not just individually. Unblocks Task #170 (push notification server).**

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

**Implementation note (2026-08-08) — "Desktop app registers token" corrected, not implemented literally:** BRAND.md's Proactive Interruption Model already gives desktop its own working LOCAL client-side interrupt scheduler (schedule/unlock/idle-detection); this task's own "Why" section confirms server push exists specifically because a *suspended mobile OS process* can't run that mechanic — a gap that does not apply to desktop. There is also no real APNs/FCM-shaped credential a desktop OS produces. Building `lib/pushTokenClient.ts` to accept a `platform: "desktop"` row with a fabricated token would claim a push-delivery capability the code doesn't have — a direct violation of this project's honest-naming/true-state standard. Decision: `push_tokens.platform` is constrained to `'ios' | 'android'` only; `lib/pushTokenClient.ts` has zero production callers today and is written for the not-yet-built iOS/Android clients (Tasks #171/#172) to call once real device tokens exist. Nothing on desktop calls it. Architecture, done-when text, and rationale confirmed with Max before closing this task.

**Status: COMPLETE — 2026-08-08.** Built via two background-agent planning/pre-mortem passes, then implemented: `supabase/migrations/20260808000000_push_tokens.sql` (mutable, RLS-protected device-token table), `20260808000001_push_dispatch_cron.sql` (5-minute pg_cron trigger), and `supabase/functions/send-interrupt-notifications/` (a Deno Edge Function — the only viable server compute given `next.config.ts`'s `output:"export"` — with pure, Vitest-tested logic: atomic claim-before-send concurrency control, dead-token auto-deactivation on APNs 410/FCM UNREGISTERED, ES256/RS256 JWT signing via Web Crypto, env-gated no-op APNs/FCM clients). Plus `lib/pushTokenClient.ts` (client-side register/unregister, no production caller yet — see the implementation note above).

**Independent 5-agent audit (quality, security, unprimed adversarial, contract verifier, naive reader) found real issues, all fixed same-cycle:** an unvalidated `timezone` value could throw uncaught and abort the entire dispatch batch (fixed: caught, logged, treated as not-due; also added overnight-window wraparound handling); FCM's OAuth token-exchange path had no exception guard, same abort-the-batch failure mode (fixed, matching APNs' existing pattern); `supabaseAdmin.ts`'s raw network calls weren't guarded against actual rejections, only non-2xx responses (fixed across all 4 functions); the dispatch loop had no per-token fault isolation (added a try/catch backstop plus a new `erroredUnexpectedly` counter); `index.ts` ignored each token's own `app_env` and applied one global sandbox flag to the whole batch, risking valid tokens being wrongly permanently deactivated (fixed: now reads `token.app_env`); "provider not configured" and genuine failures were indistinguishable in `DispatchSummary` (added a `skippedNotConfigured` field); a discarded `deactivateToken` return value could misreport a failed deactivation as successful (fixed); a doc comment claimed a CI type-check that doesn't exist anywhere in this repo (corrected); added the Rule 4 kill-switch (`PUSH_DISPATCH_ENABLED`) this project's philosophy requires for every new feature. 5 lower-priority, non-live-reachable findings (an outage-vs-empty-result design question, a minor cron-secret timing leak, a self-limited RLS column-privilege gap, a JWT-signature-verification test gap, and real Deno CI tooling) logged to `debt.md` rather than chased further — none reachable by a real caller today since `lib/pushTokenClient.ts` has zero production callers until Tasks #171/#172 land. Max explicitly signed off on closing here rather than running a further re-audit round.

**Final verification:** `npx tsc --noEmit` clean, `npm test -- --coverage` 1761/1761 passing (94 test files, up from 93), coverage well above threshold, `npm run lint` 0 errors, existence-only-assertion grep gate clean. **Manual deploy steps still required before this runs in production (cannot be verified by code alone):** provision `CRON_SECRET`/`APNS_*`/`FCM_SERVICE_ACCOUNT_JSON` Supabase secrets and `app.cron_secret` Postgres setting (see the two migration files' own comments). **Unblocks Task #171 (iOS).**

---

### Task #520 | feature | severity 4
**What:** Add a visible sync status indicator to Settings → Sync (`components/SyncSignIn.tsx` or a new sibling component) — at minimum, a "last synced" relative timestamp and, if pending events exist, a pending-count. No manual "sync now" button required by this task (debounced auto-sync already covers that, per Task #518's follow-up fix), just visibility into current state.
**Why:** Found directly during Task #518's live two-client testing (2026-08-08) — a real, multi-hour-feeling debugging session where the two clients' progress counts genuinely disagreed, and there was no way for Max (or an agent debugging on his behalf) to tell from the UI whether sync had ever run, when it last succeeded, or whether anything was stuck. The eventual root cause (old pre-sync-era local progress that never generated an event) was only findable by directly inspecting local storage files and querying Supabase by hand — a real user hitting the same visible symptom would have no such option and no way to self-diagnose or even confirm "yes, sync is working, just slow" vs "sync is broken."
**File:** `components/SyncSignIn.tsx` (or new component), `hooks/useSync.ts` (may need to expose last-sync-result/timestamp state, not just the `syncNow`/`triggerSyncSoon` functions)
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — new UI state, wiring into existing sync hook (COMPLEXITY_EVAL: >20 words, no cosmetic keyword, touches multiple files)
**Blocked by:** Nothing (Task #169 already complete) | **Blocks:** Nothing
**Done when:** A co-located test (Rule 14) confirms the Sync section shows a last-synced time after a successful `syncNow()`, and reflects a pending/error state distinctly from a fully-synced state.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-09**

**Implementation:** Added `lastSyncedAt: number | null` and `lastSyncError: string | null` to `store/syncStore.ts`'s persisted `SyncState` (`SYNC_VERSION` 1→2, `store/syncMigrations.ts`'s migration 2 defaults both to `null` on any pre-existing blob and validates `lastSyncedAt` via `Number.isFinite(...) && >= 0`, not just `typeof === "number"`). `hooks/useSync.ts`'s `runSyncNow()` writes both fields at each of its three return points (upload failure, download failure, full success — success clears any prior error). `components/SyncSignIn.tsx`'s signed-in branch renders a status line (curated "Couldn't sync. Try again." on error / "Last synced Xm ago" via the new `lib/utils.ts:formatRelativeTime` / "Not yet synced") plus a pending-count line, gated behind `useIsHydrated(useSyncStore)` so a real persisted value never flashes as "Not yet synced" before hydration completes.

**Audit findings fixed same-cycle** (self-synthesized review — an unprimed adversarial-lens pass plus an independent quality-lens pass, both run as background agents, not the full 8-9-agent `/audit` machine, sized to this task's severity 4 per the Batch-13 small-task precedent):
1. **[CRITICAL, both agents independently converged]** `syncNow()` had no in-flight guard — `SyncTrigger.tsx`'s 5-minute timer and a debounced `triggerSyncSoon()` call are genuinely concurrent real callers against the same module-level Zustand singletons; whichever call's terminal `setState` landed last won regardless of which one represented current truth, so a fast failure's `lastSyncError` could be silently clobbered by a slower, stale success. Fixed via a module-scope `inFlightSyncPromise` — every concurrent caller now awaits the same execution instead of racing independent ones. Two new tests in `hooks/useSync.test.ts` prove only one download round-trip happens across two overlapping calls, and that the guard clears afterward so a later call starts fresh.
2. **[quality-lens]** `lastSyncError` (raw driver/network error text) was rendered verbatim in the UI — the first place in the app to do so, violating BRAND.md's "quiet expert" voice. Fixed: `SyncSignIn.tsx` now shows a curated "Couldn't sync. Try again." — the raw string stays console-only (already logged by `SyncTrigger.tsx`/`triggerSyncSoon`'s own catch paths).
3. **[adversarial-lens, HIGH]** No hydration gate on the new status block — a signed-in user with a real persisted `lastSyncedAt` would briefly see "Not yet synced" before `store/syncStore.ts` finished hydrating. Fixed via `useIsHydrated(useSyncStore)`, same pattern as `hooks/useLangPack.ts:130`.
4. **[quality-lens]** `triggerSyncSoon`'s `.then()` chain lacked the `.catch()` its sibling `SyncTrigger.tsx` has (commit `562834f`) — a genuine fetch rejection would become an unhandled promise rejection. Fixed to match.
5. **[quality-lens]** Migration 2's `typeof d.lastSyncedAt === "number"` check accepted `NaN`/`Infinity`/negative values (`typeof NaN === "number"` is `true`), which would have rendered "NaNd ago". Fixed with `Number.isFinite(...) && >= 0`; `lib/utils.ts:formatRelativeTime` also gained its own defensive `Number.isFinite` guard (returns "just now") as a second line of defense, since it's a shared utility callable from anywhere, not solely reliant on the upstream migration guard.
6. **[quality-lens]** CLAUDE.md's `lib/utils.ts` doc entry didn't mention `formatRelativeTime`. Updated.

**Deferred to `.autocode/debt.md`** (2026-08-09 row, severity 3, capped per AGENTS.md's Audit Severity Calibration — cosmetic-only, self-corrects, no data loss): `lastSyncedAt`/`lastSyncError` aren't cleared on sign-out, so a shared-device account switch can briefly show the new account a stale status line from the previous account. Real fix requires a new hook-level effect watching auth-status transitions (per Layer Map, `store/authStore.ts` must not reach into `store/syncStore.ts` directly) — a genuinely separate small feature, not a one-line patch, so deferred rather than expanding this task's scope.

**Verified:** `npx tsc --noEmit` clean; `npm test -- --coverage` → 1788/1788 passing (93 test files), coverage stmts 90.87%/branches 86.11%/funcs 91.47%/lines 92.68% (thresholds 82/81/79/84, all exceeded); `npm run lint` → 0 errors (7 pre-existing warnings unchanged); weak-assertion grep gate clean on every file this task touched (one unrelated pre-existing hit in `tests/syncStore.test.ts`, from Task #169, out of this task's scope).

---

### Task #521 | tests | severity 3
**What:** Add a co-located test for `components/SyncTrigger.tsx`'s error-visibility fix (2026-08-08): confirm that a `syncNow()` call resolving to `{ok: false, error}` produces a `console.error` call (both on the initial sign-in-triggered sync and the periodic interval sync), and that a resolved `{ok: true}` does NOT log anything. Also add the equivalent test for `hooks/useSync.ts`'s `triggerSyncSoon`'s own post-debounce logging of a failed result.
**Why:** Shipped without a test during live debugging of Task #518's follow-up (the fix itself: `syncNow()`'s resolved `{ok:false}` result was previously never logged anywhere, only a thrown/rejected promise was — meaning a real, persistent sync failure was completely invisible in the browser console, which is exactly what made that day's live-testing session hard to diagnose). A real behavior change shipped without its own test is a stop-the-line gap per this project's own Kaizen rule (AGENTS.md) — logged here rather than closed silently.
**File:** `components/SyncTrigger.tsx` (new test file), `hooks/useSync.test.ts` (extend existing `triggerSyncSoon` describe block)
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** 🔧 Small — test-only, following the existing `hooks/useSync.test.ts` mocking pattern for `useAuthStore`/`useSync`
**Blocked by:** Nothing | **Blocks:** Nothing
**Done when:** Both new/extended test cases pass; full verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-09**

**Implementation:** `components/SyncTrigger.test.tsx` gained 3 tests distinguishing the previously-untested "resolves to `{ok:false}`" path from the already-tested "rejects" path: logs on the initial sign-in-triggered sync, logs on a periodic interval sync (not just the first), and does NOT log on `{ok:true}`. `hooks/useSync.test.ts`'s `triggerSyncSoon` describe block gained the equivalent pair: logs the real error string on a resolved `{ok:false}`, stays silent on `{ok:true}`. All 5 assert the specific error string reaches `console.error` (`.toBe("network error")` etc.), not just that logging happened.

**Verified:** `npx tsc --noEmit` clean; `npm test -- --coverage` → 1793/1793 passing (up from 1788); coverage stmts 90.93%/branches 86.21%/funcs 91.47%/lines 92.75% (thresholds 82/81/79/84); `npm run lint` 0 errors; weak-assertion grep gate clean on both touched files.

---

## Batch 17 — Mobile (iOS + Android)
Dependency: Batch 16 complete (sync backend and push notification server live). Theme: Launch plyglt on iOS and Android using Tauri 2 mobile targets, with push-interrupt sessions and seamless SRS sync with desktop.

### Task #171 | build | severity 6
**What:** SCOPE-CORRECTED 2026-08-09 (see original scope preserved as spun-off Task #522 below). Build the app-level routing that a real push-notification tap will eventually trigger: a `plyglt://interrupt` deep-link URL, handled via the app's existing deep-link gateway (`lib/tauri.ts`'s `onDeepLinkUrl`/`getCurrentDeepLinkUrls` — currently used only for the OAuth sign-in callback), that navigates directly to `/study?mode=interrupt` — the exact page and query param `components/InterruptHandler.tsx` already uses for desktop's Rust-driven mandatory-interrupt flow (`router.push("/study?mode=interrupt")`, line 85). Cold-start (app launched fresh by the tap) and warm-start (app already running) both need to route correctly, mirroring the two-path pattern `lib/tauri.ts` already has for OAuth. Register `interrupt` alongside the existing `signin`-callback URL handling — do not invent a second deep-link mechanism.
**Why:** iOS is the highest-value Pro tier opportunity, and this is the one piece of "notification tap → immediate in-app session" (the original Task #171's Done-When) that is genuinely buildable and testable today, independent of Xcode. It also de-risks the native work in Task #522: once a real Xcode-generated iOS project exists, native APNs tap-handling only needs to open this already-built, already-tested `plyglt://interrupt` URL — it does not need to duplicate this app's session-launch logic.
**File:** `lib/tauri.ts` (extend the deep-link gateway), `components/InterruptHandler.tsx` (or a new co-located hook if adding this pushes the file past its size cap) — subscribe and route
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — touches the shared Tauri gateway plus the interrupt routing component, needs both cold-start and warm-start coverage
**Blocked by:** #170 (COMPLETE) | **Blocks:** Nothing (Task #522, not this task, is the real blocker for #172's Android equivalent and for live mobile verification)
**Done when:** A co-located test confirms that receiving a `plyglt://interrupt` deep-link URL (both via `getCurrentDeepLinkUrls` cold-start and `onDeepLinkUrl` warm-start) triggers `router.push("/study?mode=interrupt")`, and that an unrelated deep-link URL (e.g. the existing OAuth callback) does NOT.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-09**

**Implementation note — actual approach diverged from the File field above (harmlessly):** the shipped code never touches `lib/tauri.ts`. It reuses the existing generic `onDeepLinkUrl`/`getCurrentDeepLinkUrls` gateway functions as a second, fully independent subscriber — the exact same pattern `store/authStore.ts` already uses for the OAuth `plyglt://auth-callback` URL. Verified (against the real `@tauri-apps/plugin-deep-link` Rust/JS source, not assumed) that this is safe: `onOpenUrl` is a true broadcast (every `listen()` call gets its own registration), and `getCurrent()` is a read (`.lock().unwrap().clone()`), not a consume-once API — so `authStore.ts` and the new hook both see every URL, with no starvation risk. New file `hooks/useInterruptDeepLink.ts` (exports `isInterruptDeepLink` for direct testing, mirroring `authStore.ts`'s exported `handleDeepLinkCallback`), wired into `components/InterruptHandler.tsx` via one `useInterruptDeepLink()` call.

**Self-review (2 parallel background agents — adversarial + quality lens, proportional to this task's severity 6, same lightweight pattern as Tasks #520/#521) converged independently on the same real finding, plus one more:**
1. **[Both agents, independently]** `isInterruptDeepLink`'s catch block silently swallowed a malformed-URL parse failure with a comment falsely claiming parity with `store/authStore.ts`'s equivalent guard — that guard actually does log. A stop-the-line violation of AGENTS.md's "no silent catch" rule. Fixed: added a `console.error` call with a `[ERR-DEEPLINK-INTERRUPT-PARSE-...]` ref ID, genuinely matching `authStore.ts`'s pattern; new test asserts the exact log call, using a URL confirmed (in Node) to actually throw (`"plyglt://[invalid"` — the original test's `"plyglt://"` never threw at all, so it never really exercised this path; both agents caught this too).
2. **[Adversarial-lens]** Case-sensitive hostname matching: a custom (non-"special") URL scheme's host is an opaque string, not lowercased by the parser — verified `new URL("plyglt://INTERRUPT").hostname === "INTERRUPT"`, so a differently-cased payload would silently fail to match. Fixed with an explicit `.toLowerCase()`; new regression test covers both `INTERRUPT` and `Interrupt`.

Design questions the reviewers raised and ruled NOT bugs, after direct verification: gating this hook behind the `interruptEngine` feature flag (consistent with every other interrupt entry point in the same component, and BRAND.md scopes proactive interruption — desktop and mobile alike — as one Pro-gated bundle); multi-consumer deep-link starvation (ruled out by reading the actual plugin source); stale-closure/post-unmount navigation risk (ruled out — `router` is stable, cleanup correctly unlistens, a `router.push` after unmount is harmless).

**Verified:** `npx tsc --noEmit` clean; `npm test -- --coverage` → 1806/1806 passing (94 test files, up from 1793); coverage stmts 90.95%/branches 86.28%/funcs 91.29%/lines 92.74% (thresholds 82/81/79/84); `npm run lint` 0 errors (7 pre-existing warnings unchanged); weak-assertion grep gate clean on both touched files.

---

### Task #522 | infrastructure | severity 8
**What:** The real iOS build/release pipeline — everything the original Task #171 scoped that a coding agent cannot do without real Apple infrastructure Max must provision: (1) install full Xcode.app (this machine has only the Command Line Tools — confirmed 2026-08-09, `xcodebuild -version` fails with "requires Xcode, but active developer directory is a command line tools instance"); (2) enroll in the Apple Developer Program (same account used for macOS signing, Task #122) if not already active, and confirm it covers iOS distribution; (3) run `tauri ios init`, set the bundle identifier to `com.plyglt.app` (currently `app.plyglt` in `tauri.conf.json` — the task's original spec and the shipped config disagree, resolve during this task), and add the push notification entitlement/capability in the generated Xcode project; (4) implement the native APNs device-token registration (the OS handing the app a real push token on launch, wired to `lib/pushTokenClient.ts`'s already-built, already-tested `registerPushToken()`) — this genuinely requires the Xcode-generated iOS project from step 3, it cannot be written or tested without it; (5) wire native notification-tap handling to open the `plyglt://interrupt` deep link Task #171 already built and tested; (6) set up TestFlight distribution and submit to App Store review; (7) provision real APNs push credentials (referenced but never completed in Task #170's own audit note) and live-verify a scheduled push notification actually arrives and its tap opens a 3-card session.
**Why:** Spun off from the original Task #171 (2026-08-09) after confirming this machine has neither Xcode.app nor Apple Developer Program provisioning — genuine infrastructure/account work outside what an autonomous coding session can execute, distinct from Task #171's real-code portion (deep-link routing), which was rescoped down and built separately.
**File:** Multiple — Xcode project (generated, not yet existing), `tauri.conf.json`'s bundle identifier, native push registration glue
**Severity:** 8 | **DoD Tier:** 3
**Complexity:** 🔧 Full — requires interactive Apple Developer Portal / App Store Connect work only Max can do, plus native iOS code that can't be authored blind without Xcode present to compile against
**Blocked by:** #171 (COMPLETE — provides the `plyglt://interrupt` target this task's native tap-handling opens) | **Blocks:** #172 (Android's own Play Console/build-pipeline work is independent, but was originally sequenced after iOS; Task #172's "Blocked by" has been updated to point here)
**Done when:** App installable via TestFlight. APNs push notification fires on schedule (manual test, on a real device). Notification tap opens the app directly into a 3-card session via the `plyglt://interrupt` deep link. SRS state syncs with desktop automatically after the session.
**Owner:** Max (this task requires steps only the account owner can perform — installing Xcode, enrolling in the Apple Developer Program, App Store Connect submission; an agent can assist with the native code once Xcode exists, but cannot start this task unassisted)
**Added:** Spun off from Task #171's original scope — 2026-08-09 — real Xcode/Developer Program/TestFlight work confirmed blocked on this machine, not agent-executable as a normal /task cycle

**Status (2026-08-14): Xcode installed by Max, real iOS Simulator build now launching without crashing — blank screen in live dev mode root-caused to a known WebKit limitation, real fix scoped but not yet built.** Exactly the split anticipated in the Owner note above: Max did the owner-only step (installed full Xcode.app via the App Store, ~15GB), then an agent picked up the native-code portion.

**What got done this session, in order:**
1. **Xcode installed and verified** (`xcodebuild -version` → Xcode 26.6; license auto-accepted on first launch). `RV5FNNH8L4` (the same Team ID already in `tauri.conf.json`'s macOS `signingIdentity` from Task #122) reused for iOS rather than asking Max to look it up again.
2. **`tauri ios init` run successfully** — needed `cocoapods` installed via `brew` (the tool's own attempt to install it via `gem` failed, needing sudo; brew avoided that). Generated `src-tauri/gen/apple/` (the real Xcode project — committed to the repo, not gitignored, matching Tauri's convention since iOS/Android generated projects can carry manual capability/entitlement edits and CI needs them present).
3. **Bundle identifier resolved as `app.plyglt`** (not the `com.plyglt.app` this task's own original spec named) — kept consistent with the already-shipping macOS signing identity and Apple Sign In configuration rather than introducing a second, mismatched identifier; changing it would have risked breaking the already-configured Apple Sign In App ID for no benefit. Added `bundle.iOS.developmentTeam: "RV5FNNH8L4"` to `tauri.conf.json`.
4. **Automatic signing enabled in Xcode** (Signing & Capabilities → Automatically manage signing, Team = the account under "John Schmidt"). The "Communication with Apple failed / no devices registered" error this showed is expected and harmless — it only affects signing for a *physical* device; the iOS **Simulator** needs no code signing at all, so Simulator builds proceeded regardless.
5. **iOS Simulator platform downloaded** (`xcodebuild -downloadPlatform iOS`, 8.5GB) — `xrun simctl list devices` had shown zero simulators until this ran; afterward a full set of iPhone/iPad simulators existed automatically.
6. **Real compile errors found and fixed** on the first genuine `tauri ios dev` attempt — all genuinely desktop-only APIs the mobile build of the `tauri` crate simply doesn't expose, none related to this app's own logic: `tauri::tray`/`tauri::menu` (unresolved imports), `tauri_plugin_autostart::init`/`MacosLauncher` (no mobile equivalent — a mobile app can't register as a login item), and three window-chrome calls (`set_always_on_top`/`set_closable`/`set_minimizable` — a mobile app has no window stacking or minimize/close buttons to lock). Fixed via `#[cfg(desktop)]` gates in `src-tauri/src/lib.rs` and `src-tauri/src/interrupt.rs` — `update_tray_badge` kept as one function definition with a no-op mobile body so its `invoke_handler` registration never needs its own cfg conditional. Verified: `cargo build --target aarch64-apple-ios-sim` and `cargo check` (macOS) both clean, 35/35 desktop Rust tests still pass (confirms the cfg-gating didn't change desktop behavior).
7. **Real runtime crash found and fixed** — the app installed and launched on the Simulator but crashed instantly on every launch (confirmed via `~/Library/Logs/DiagnosticReports/plyglt-*.ips`, decoded directly rather than guessed at): `panicked ... No rustls crypto provider is configured`. Root cause: two different major versions of `reqwest` exist in the dependency graph (this crate's own `0.12` pin, and `0.13` pulled in transitively by `tauri-plugin-updater`), and nothing installs a default rustls crypto provider anywhere — the moment either construct an HTTP client (in this case, `tauri-plugin-updater`'s eager construction during `.plugin()` registration), the process aborts. Fixed by explicitly depending on `rustls` with the `ring` feature (matching the provider already resolved elsewhere in the tree, rather than adding a second crypto backend like `aws-lc-rs`) and calling `rustls::crypto::ring::default_provider().install_default()` as the literal first line of `run()`, before any plugin registration. This is a general fix, not iOS-specific — it protects every platform against the same latent ambiguity, though only iOS actually triggered it (desktop's plugin construction order apparently never hit the ambiguous path). Verified: real device crash gone, confirmed via a clean second launch and no new `.ips` file.
8. **`devtools` Cargo feature removed** — see debt.md; a separate decision (Max: must not ship in the real release) made and closed the same session, landed in the same commit as the fixes above since it touches the same `Cargo.toml` region.
9. **App now launches and runs on the iPhone 17 Pro Simulator without crashing** — confirmed via direct screenshot (`xcrun simctl io booted screenshot`), not just "no error in the log." This is real progress: Task #522's core infrastructure (Xcode, signing, generated project, a compiling and non-crashing binary) is in place.
10. **Blank white screen found and root-caused** (still open — this is the actual remaining blocker for live iOS development, not for the shippable build). Diagnosed without Safari Web Inspector (Accessibility/Screen Recording permissions aren't available in this environment) by injecting temporary raw-DOM/inline-`<script>` diagnostic probes directly into `app/layout.tsx` and reading them back via Simulator screenshots — confirmed: (a) the initial server-rendered HTML paints fine, (b) a raw inline `<script>` tag executes fine, proving the webview can run JS at all, but (c) React never hydrates — a component's `useEffect` never fires. The inline probe also revealed `window.location.href` is `tauri://localhost`, **not** the external dev server's `http://localhost:3050` — Tauri's iOS webview loads `devUrl` content through its own internal scheme handler rather than navigating the document itself to the external origin (desktop platforms navigate directly and never hit this). Relative-URL `<script src="/_next/static/...">` tags were resolving against the wrong origin — fixed via `next.config.ts`'s new dev-only `assetPrefix: "http://localhost:3050"` (Next.js's own documented mechanism for exactly this class of problem, including the HMR websocket — [vercel/next.js#30632](https://github.com/vercel/next.js/pull/30632)). Verified the fix is live (`curl http://localhost:3050/` now shows absolute-URL script tags) — but the screen **stayed blank** even after this fix, because a second, deeper issue exists underneath it: **WebKit blocks mixed content from a secure-treated origin to plain HTTP.** Tauri's `tauri://` custom scheme is treated by WKWebView as secure/HTTPS-equivalent, so *any* connection from it to the plain-HTTP dev server — script loads, the HMR websocket, everything — is blocked as mixed content, silently (no visible error without Web Inspector). This is a confirmed, longstanding, recurring WebKit/Tauri issue, not specific to this app (matches multiple long-standing upstream Tauri GitHub issues describing the identical symptom across different Tauri versions and platforms).
11. **`next.config.ts`'s `assetPrefix` fix committed regardless** — it's real, correct, and verified not to change desktop behavior (desktop's document origin already matches `devUrl`, so an absolute prefix pointing at the same origin is a no-op there); it's a necessary component of the real fix even though not sufficient alone.

**What's NOT done — the actual next step:** run the Next.js dev server over HTTPS with a local certificate, and update `devUrl` to `https://localhost:3050` to match. Matching schemes end-to-end is the standard, documented workaround for this exact WebKit mixed-content limitation. Needs: a local cert (e.g. via `mkcert`), a small `next dev` server config change to serve HTTPS, and confirming `tauri ios dev` still boots the Simulator correctly against an HTTPS `devUrl`. **This only affects the live hot-reload dev workflow** — `tauri ios build` (the real, shippable path) bundles static assets locally with no external dev server involved at all, so it was never exposed to this mixed-content situation in the first place and needs no fix for App Store submission to eventually proceed.

**Verification run at close of this session:** `npx tsc --noEmit` clean, full test suite 1914/1914 passing, `npm run lint` 0 errors, `cargo check` (macOS) and `cargo build --target aarch64-apple-ios-sim` both clean, 35/35 desktop Rust tests passing. Nothing left uncommitted except the `assetPrefix` change (committed same session, see git log "fix: iOS dev-server asset origin").

**Status (2026-08-14, next session): iOS live dev FULLY WORKING — blank screen resolved, HMR hot reload verified on the Simulator.** The HTTPS-dev-server plan above turned out to be necessary but not the whole story; the real unlock, found by reading the actual tauri 2.11.3 source, is that Tauri only routes a mobile webview through its internal `tauri://localhost` proxy when devUrl's host is literally `localhost` or an IP (`manager/webview.rs` `is_local_network_url`). The shipped fix avoids that proxy origin entirely instead of fighting its consequences: (1) `npm run dev:https` (new package.json script) serves Next via `--experimental-https` with mkcert-generated certs in gitignored `certs/`; (2) new `src-tauri/tauri.ios.conf.json` (Tauri's per-platform config merge) overrides `devUrl` to `https://plyglt.localhost:3050` — macOS resolves `*.localhost` to loopback natively, and the non-`localhost` hostname makes Tauri navigate the webview DIRECTLY to the dev server, exactly like desktop, so document origin = dev server origin and assets/HMR are all same-origin; (3) the earlier `assetPrefix` partial fix is deleted — unnecessary under direct navigation, and against HTTPS it would have re-broken on Next 16's cross-origin dev-resource block (403s absolute-URL asset fetches from a `tauri://` document; WKWebView sends no Referer from custom-scheme origins, so `allowedDevOrigins` can never match — verified by reading `block-cross-site-dev.js` in the installed Next). Verified live, not inferred: `[IOS-DIAG] href=https://plyglt.localhost:3050/` from inside the running app, full language-picker UI rendering on the iPhone 17 Pro Simulator (screenshot), and an HMR edit hot-applying to the running app with no relaunch. Two gotchas documented in CLAUDE.md: editing only `tauri.ios.conf.json` doesn't trigger a Rust rebuild (config baked in via `generate_context!`; `touch src-tauri/tauri.conf.json` after changing it), and Next's terminal forwarding of browser console output only carries `console.error`, not `console.log` — a `console.log`-based probe falsely looks like a dead app. New-machine cert setup recipe also in CLAUDE.md. One small new debt item logged (iOS `checkForUpdates` noise — gate to desktop before shipping). **Remaining for #522: the Max-owned Apple infrastructure steps** — push-notification capability + APNs registration in the Xcode project, APNs key provisioning, TestFlight, App Store submission (steps 4-7 of the original scope).

**Status (2026-08-14, same session, continued): steps 3-5 of the original scope are now BUILT and Simulator-verified end-to-end** — the entire agent-buildable portion of this task is done. What shipped: (a) `src-tauri/src/push.rs` — native APNs glue in Rust/objc2 (no Swift, no plugin): token-registration callbacks added to tao's runtime-declared `AppDelegate` class via `class_addMethod`, plus a `UNUserNotificationCenter` delegate proxy that routes push-triggered taps (event + cold-start pending flag) while forwarding local notifications to tauri-plugin-notification's own delegate untouched — necessary because that plugin's iOS Swift source explicitly ignores `UNPushNotificationTrigger` notifications in both delegate methods (read directly, not assumed); (b) `lib/tauriPush.ts` + `hooks/usePushRegistration.ts` + `hooks/usePushInterruptTap.ts`, wired into `components/InterruptHandler.tsx` — registration gated on signed-in + Pro + interrupts-enabled + permission-granted (prompting stays owned by the settings toggle), token uploaded via the already-built `lib/pushTokenClient.ts`; (c) `plyglt://` scheme registered on iOS (`CFBundleURLTypes` in Info.plist, mirrored in project.yml) and `aps-environment: development` entitlement (mirrored likewise). **Live-verified on the iPhone 17 Pro Simulator with Max doing the taps** (verified against the dev-server request log, not just the report): `plyglt://interrupt` deep link → OS confirm dialog → straight into `/study?mode=interrupt` (first-ever live proof of Task #171's routing on iOS); notification permission granted via the app's own settings toggle; `xcrun simctl push` payload (the exact `aps` shape `send-interrupt-notifications`' apnsClient.ts sends) → banner with correct brand copy ("plyglt / 3 cards ready") → tap → interrupt session, which served a card to a completely fresh profile (Batch 22's content-supply floor working on iOS). Full verification gate green: tsc, 1928/1928 JS tests (14 new), lint 0 errors, weak-assertion grep clean, cargo check/test clean on macOS + aarch64-apple-ios-sim (35/35 Rust tests). **Genuinely remaining — all Max-owned Apple-portal work:** (1) enable the Push Notifications capability on the `app.plyglt` App ID (portal or Xcode's Signing & Capabilities with automatic signing); (2) provision an APNs auth key and configure it in the `send-interrupt-notifications` function's secrets (step 7); (3) TestFlight/App Store Connect setup and a real-device test of true APNs delivery + the registration flow with a signed-in Pro account (the Simulator can't receive real APNs pushes); (4) App Store submission (step 6).

**Status (2026-08-14, evening session, Max driving the portals with step-by-step guidance): EVERYTHING except App Store submission is DONE and live-verified on a real iPhone.** The full production chain worked end to end: server dispatch (`sent: 1`) → Apple's production APNs → locked-iPhone banner → tap → straight into a review session — with real Apple Sign In, a real activated Lemon Squeezy license, review-event sync, and Batch 21's cross-device gate all participating (the gate correctly blocked the first dispatch attempt because the phone had just completed a session — working as designed). What got provisioned/fixed along the way, in order: Push capability confirmed on the App ID (the entitlement I'd added made Xcode treat it as present); APNs auth key created (Key ID 2TR2Y77C4G) + all 4 APNS_* secrets set on the Supabase function via CLI (key file read from disk, never through chat); device registered on the team (UDID gate — Apple refuses to sign an App Store archive for a team with zero devices); TestFlight app record + internal `team` group + install; **a live-found-and-fixed dead "Sign in with Apple" button** (license.rs `open_url` had no iOS branch — fell through all desktop cfg blocks returning Ok(()) silently; fixed with a UIApplication openURL branch + an explicit unreachable-platform error, verified via a Simulator probe opening Safari); **the first uploaded build shipped without the plyglt:// URL scheme** (Xcode's capability editor had silently rewritten Info.plist — caught by directly inspecting the IPA, re-shipped as build 2 after restoring the pbxproj from git when a hand-run `xcodegen generate` broke the project by sweeping built libapp.a artifacts into it — both traps documented in CLAUDE.md); a founder license minted through the real LS checkout (test mode, test card — the store is STILL IN TEST MODE, launch checklist item); **the entire server push backend provisioned live for the first time** (function deployed with --no-verify-jwt — now locked in via supabase/config.toml — CRON_SECRET generated+set, push_tokens table + pg_cron schedule applied via dashboard SQL after `alter database` permission errors forced inlining the cron credentials). Three new debt rows logged (server dispatch lacks Batch 22's content floor — promote before launch; deviceId-before-registration first-run gap; third occurrence of repo-vs-prod provisioning drift). **Remaining for #522: only App Store submission (step 6) — a launch decision, not engineering.** #172 (Android) is now unblocked.

---

### Task #172 | build | severity 7
**What:** Android app — Tauri 2 Android build pipeline. Configure Gradle, Play Console account, Play Store submission pipeline. Implement FCM push notification client (parallel to APNs in Task #522): register FCM token on launch, send to sync backend, handle notification tap → immediate in-app session (the `plyglt://interrupt` deep link Task #171 already built and tested — Tauri's deep-link plugin is cross-platform, so this reuses that same app-side routing rather than needing its own). Target: API level 26+ (Android 8.0).
**Why:** Android completes the mobile platform coverage. FCM is the Android equivalent of APNs. Same interrupt experience as iOS.
**File:** Multiple — Tauri Android config, FCM client, session-from-notification flow
**Severity:** 7 | **DoD Tier:** 3
**Complexity:** 🔧 Full — multiple files, Android build
**Blocked by:** #522 (2026-08-09: updated from #171 — #171 was rescoped to just the app-side deep-link routing and is COMPLETE; #522 carries the real native-build-pipeline dependency the original sequencing intended) | **Blocks:** Nothing (Batch 17 complete)
**Done when:** App installable from Play Store (or internal testing track). FCM notifications fire on schedule. Tap → in-app session works. SRS state syncs with desktop.
**Owner:** Architecture Agent

---

## Batch 18 — Introduction Engine Remediation + Correctness Hardening | 44 tasks | [COMPLETE — 2026-07-08]
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
**Status: COMPLETE — 2026-07-07**

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
**Status: COMPLETE — 2026-07-07**

---

### Task #181 | tests | severity 4
**What:** Pin test assertions and close coverage gaps in `tests/introduction.test.ts`:
- F15: Change `expect(["recognize", "produce"]).toContain(result)` at line 278 to `expect(result).toBe("recognize")` — the function is deterministic and the current assertion passes with any broken implementation
- F16: Replace the partial `MAX_APPEARANCES_BY_PHASE_DAY` test with a parameterized test covering all 22 entries explicitly — currently only 7 of 22 phase days are asserted
- F21: Add a full 10-field assertion test for a `recordResult` correct-path return — currently no test asserts more than 5 of 10 fields
- F22: Add `consecutiveCorrect=0` (should return false) and `consecutiveCorrect=16` (should return true) cases to the `shouldGraduate` suite — currently only boundary values 14 and 15 are tested
- F14: Add a seam test tracing the end-to-end triple-wrong path through the store, confirming Task #178's fix is observable (`getIntroductionDueCardIds` must schedule the card at day 1 after 3 consecutive wrong answers)
- If file exceeds 250 lines after additions: split into `tests/introduction.test.ts` (lib unit tests) and `tests/seam_introduction.test.ts` (cross-module seam tests)
- Debt item from Task #178 (batched in by owner approval): the `IntroductionRecord` shape test does not assert `record.phaseStartDate` despite the field being present in the constructed record — add a specific-value assertion for it.
**Why:** F16 (sev:3) — 15 untested phase-day entries means the scheduling table can silently corrupt without a test failing. F14 (sev:4) — the dead-write bug that caused audit FAIL was invisible to all unit tests because none trace the recordResult → store → scheduling path. Rule 16: enumerate every member before asserting.
**File:** `tests/introduction.test.ts`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — test file only, assertion fixes and new test cases
**Blocked by:** #178, #179, #180 | **Blocks:** Nothing
**Test required:** The task IS tests — all 22 phase-day entries individually asserted, seam test passes, green gate.
**Done when:** `grep -c "phaseDay\|phase_day\|phase day" tests/introduction.test.ts` ≥ 22 (or equivalent parameterized coverage). 10-field assertion test exists. `toBe("recognize")` replaces `toContain`. File ≤ 250 lines (or split into two files each ≤ 250). Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**

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
- ~~`tests/introduction.test.ts:64` — `expect(MAX_APPEARANCES_BY_PHASE_DAY).not.toBeNull()` → rewrite to assert specific phase/day values (day 1 → Infinity appearances, day 22 → 0).~~ — RESOLVED by Task #181 (F16): replaced with a full 22-entry parameterized test (`it.each` over every phase day) plus a `toHaveLength(22)` check. No `.not.toBeNull()` remains anywhere in the split files (`tests/introduction.test.ts`, `tests/introduction_behavior.test.ts`, `tests/seam_introduction.test.ts`).
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

After this task COMPLETES: remove the `# Hard gate — activates after Task #183 completes` comment from the Verification Gate code block in `AGENTS.md`. (This also resolves debt item F018 below — the misleading comment is deleted entirely, not reworded.)

Debt items batched in by owner approval (2026-07-07):
- (F018) AGENTS.md:46 — resolved as a side effect of this task's own done-when (the misleading comment is removed, not reworded).
- (F021) AGENTS.md — add a one-line documented-limitation note next to the grep gate: the suppression check only requires the literal text `existence-check:` to appear on the line: it enforces presence, not the validity of the justification. This is an accepted trade-off for a text-based gate, not a bug to fix.
- `tests/introduction_behavior.test.ts:239-243` — "avoids lastSeenType when multiple alternatives exist" getNextCardType test: tighten `expect(result).not.toBe("fill_blank"); expect([...]).toContain(result)` to `expect(result).toBe("recognize")` — the case is fully deterministic (pool[0] always resolves to "recognize" once "fill_blank" is filtered out), same reasoning as Task #181's F15 fix to its sibling test three lines above.
**Why:** 50+ existence-only assertions = pseudocode coverage that passes even when behavior is broken. Systemic finding across Batch 1 audits. AGENTS.md Test Assertion Quality Gate and Rule 16 both require specific-value assertions for deterministic outputs.
**File:** Multiple — `tests/packLoader.test.ts`, `tests/importBackup.test.ts`, `tests/seam_importRestore.test.ts`, `tests/exportBackup.test.ts`, `tests/entitlement.test.ts`, `tests/migrations.test.ts`, `tests/commitSession.test.ts`, `tests/srsStore.test.ts`, `tests/langRegistry.test.ts`, `tests/language.test.ts`, `tests/session.test.ts`, `tests/introduction_behavior.test.ts` + `AGENTS.md` (remove TODO comment, add F021 limitation note)
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 13 files (12 test files + AGENTS.md)
**Scope narrowed:** 2026-07-07 — `tests/introduction.test.ts` dropped from file list; its only listed item (F16-equivalent `.not.toBeNull()` rewrite) was resolved by Task #181, which also split the file into three (`introduction.test.ts`, `introduction_behavior.test.ts`, `seam_introduction.test.ts`), none of which contain any remaining banned assertion. `tests/introduction_behavior.test.ts` (one of the three split files) re-added to scope for the batched-in getNextCardType debt item above.
**Blocked by:** #184, #185 (some tests reference production code fixed there — write them red first, they turn green when those tasks close) | **Blocks:** Batch 1 audit PASS
**Test required:** The task IS tests — assertions become more specific; a small number of new it() blocks added.
**Done when:** `grep -rn "\.toBeDefined()\|\.toBeTruthy()\|\.not\.toBeNull()" tests/ --include="*.test.*" | grep -v "existence-check:"` returns zero output. `grep "activates after Task #183" AGENTS.md` returns zero hits. `tests/introduction_behavior.test.ts` getNextCardType test uses `toBe("recognize")`. Verification gate green.
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**

---

### Task #184 | data-loss | severity 5
**What:** Fix two safety gaps in the SRS v3 migration introduced by Task #178. (1) `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` accepts calendar-invalid strings like `"2026-13-45"`; these pass the regex, become `phaseStartDate`, and produce `NaN` in `getDayOfPhase` — silently hiding the card forever. The migration comment explicitly warns about this risk for empty strings but does not address it for invalid dates. Fix: add `&& !isNaN(new Date(v).getTime())` after each `DATE_RE.test()` call. (2) The for-loop at line 58 iterates over `Object.entries(introductions)` but does not guard against a stored null value (e.g. `{ "card-1": null }`); accessing `record.phaseStartDate` throws `TypeError`, which Zustand's persist middleware catches and resolves by resetting to default empty state — silently wiping all SRS card history.

Add two tests: (a) introductions map containing a null record — must not throw and must produce a valid phaseStartDate; (b) record with `introducedDate: "2026-13-45"` (calendar-invalid) — must fall back to today's date, not preserve the invalid string.
**Why:** Both bugs can silently corrupt or destroy user SRS progress. The NaN risk is the same failure mode the migration comment already warns about; the null-record risk causes silent data loss via the Zustand fallback path.
**File:** `store/migrations.ts`, `tests/migrations.test.ts`
**Severity:** 5 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** #183 (F007/F008 tests reference the corrected migration behaviour)
**Test required:** Two new it() blocks as described above.
**Done when:** New tests pass. `node -e "console.log(/^\d{4}-\d{2}-\d{2}$/.test('2026-13-45') && !isNaN(new Date('2026-13-45').getTime()))"` prints `false`. Verification gate green.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**

---

### Task #185 | security | severity 7
**What:** Guard `activateLicense` against an empty `instanceId`. The current guard `if (!res.instance)` at `lib/entitlement.ts:139` is falsy only for `null` and `undefined`. A Lemon Squeezy API response with `instance: { id: '' }` is truthy; the guard passes, and `instanceId: ''` is persisted to the entitlement store. Every subsequent `validateLicense(key, '')` and `deactivateLicense(key, '')` call sends an empty instance ID, producing API errors that surface to users as generic network failures with no indication of root cause.

Fix: change line 139 to `if (!res.instance?.id)`. This is a one-character change — the existing `console.error` and return statement stay unchanged.

Note: the corresponding test (`instance: { id: '' }` → ok:false) lives in Task #183. This task is the production code fix only.
**Why:** Users who activate on a degraded Lemon Squeezy response end up stuck — license appears active but every subsequent validation fails — with no recovery path other than re-entering their license key. Open as F011 across two consecutive audits with no task.
**File:** `lib/entitlement.ts`
**Severity:** 7 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** #183 (the F010 test turns green once this fix is in place)
**Test required:** Covered by Task #183 (F010). Run the full test suite to confirm no regressions.
**Done when:** `grep "instance?.id" lib/entitlement.ts` has a hit at line 139. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-07**

---

### Task #186 | security | severity 4
**What:** Wrap `LANG_CONFIG_MAP` in `Object.freeze()`. It is created via `Object.fromEntries()` in `lib/langRegistry.ts` but not frozen; any importer can write `LANG_CONFIG_MAP['it'] = maliciousConfig` without a TypeError, silently replacing a security-relevant language configuration. The existing frozen arrays (`ALL_PACK_CODES`, `READY_PACK_CODES`, `FREE_PACK_CODES`) all have a comment explaining why they are frozen — the asymmetric treatment of `LANG_CONFIG_MAP` is unexplained.

Fix: `Object.freeze(LANG_CONFIG_MAP)` at point of declaration.

Note: `MAX_APPEARANCES_BY_PHASE_DAY` in `lib/introduction.ts` was originally in this task's scope too (same underlying finding — a mutable exported scheduling table) but is dropped here to avoid two streams editing the same line: Task #179 (F07) already freezes it as part of its own scope.
**Why:** Known-open finding across two consecutive Batch 1 audits. Latent rather than immediately exploitable (no live callers mutate this today), but the correct time to close a latent mutable-export gap is before the code ships to users, not after.
**File:** `lib/langRegistry.ts`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** TypeScript compiler enforces freeze at compile time for typed callers; no new test needed beyond verifying tsc passes.
**Done when:** `grep "Object.freeze(LANG_CONFIG_MAP)" lib/langRegistry.ts` returns a hit. `npx tsc --noEmit` clean. Verification gate green.
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-07**

---

### Task #226: Fix code-quality: ITALIAN_ARTICLES regex has dead duplicate alternation branches masking missing curly-apostrophe support.

**File:** lib/answerCheck.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`ITALIAN_ARTICLES = /^(il|lo|la|l'|l'|gli|le|un'|un'|uno|una|un|i)\s*/i` at `lib/answerCheck.ts:12` contains two literal duplicate alternation branches — `l'|l'` and `un'|un'` — both using the identical ASCII straight apostrophe (U+0027, byte-verified). This reads as though curly-apostrophe support (U+2019, `l'`/`un'` as typed by iOS/macOS autocorrect) was intended but never implemented. Empirically verified: `checkAnswer("l'amico", ["amico"], {articles: ITALIAN_ARTICLES})` returns `"correct"`, but `checkAnswer("l'amico", ["amico"], {articles: ITALIAN_ARTICLES})` (typed with a curly apostrophe) returns `"wrong"`. A learner whose device autocorrects straight quotes to curly quotes (the OS default on iOS/macOS) gets marked wrong on a correct answer.

Discovered during Task #183's audit (test-assertion hardening): `tests/language.test.ts` now pins the exact (buggy) regex source as the expected value, which is correct test behavior (it captures current reality) but surfaces that the underlying regex itself needs the fix, not the test.

**Acceptance Criteria:**
- [ ] Add a curly-apostrophe alternative (U+2019) alongside each straight-apostrophe branch in `ITALIAN_ARTICLES`, or normalize the input string's apostrophe character before matching — whichever approach keeps the regex simplest.
- [ ] Add a test asserting `checkAnswer` treats a curly-apostrophe answer (e.g. `"l'amico"` with U+2019) identically to the straight-apostrophe form.
- [ ] Update `tests/language.test.ts`'s exact regex-source assertion (added by Task #183) to match the corrected pattern.

**Done when:** New curly-apostrophe test passes. `tests/language.test.ts`'s regex-source assertion reflects the corrected pattern. Verification gate green.
**Status: COMPLETE — 2026-07-07**

**Source:** Audit finding (Task #183 cycle) — severity 8 — code-quality — Agents W/N/R independently converged on this during Task #183's audit.

---

### Task #227: Fix tooling: AGENTS.md bans `.toBeGreaterThan(0)` as a primary assertion but the automated grep gate never checks for it.

**File:** AGENTS.md, tests/mastery.test.ts, tests/checkout.test.ts, tests/study_loop.test.ts, tests/seam_studyLoop.test.ts, tests/useLangPack.test.ts, tests/exportBackup.test.ts, tests/importBackup.test.ts, tests/entitlement.test.ts

**Complexity:** ⚡ Direct — 8 files, mechanical assertion tightening + one grep-pattern extension
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
AGENTS.md's "Test Assertion Quality Gate" section (prose) bans four patterns as primary assertions on non-trivial computed values: `.toBeDefined()`, `.toBeTruthy()`, `.not.toBeNull()`, and `.toBeGreaterThan(0)`. Task #183's automated grep gate (`grep -rn "\.toBeDefined()\|\.toBeTruthy()\|\.not\.toBeNull()" ...`) only mechanically enforces the first three — `.toBeGreaterThan(0)` was never added to the pattern, so the "permanent hard gate" passes green while 6 unjustified instances of the fourth banned pattern remain: `tests/mastery.test.ts:55`, `tests/checkout.test.ts:34`, `tests/study_loop.test.ts:34`, `tests/seam_studyLoop.test.ts:47,117`, `tests/useLangPack.test.ts:102`. (The 3 in-scope instances in `tests/entitlement.test.ts` were already fixed during Task #183's audit remediation.)

**Acceptance Criteria:**
- [ ] Extend the grep pattern in AGENTS.md's Verification Gate to also match `\.toBeGreaterThan\(0\)`
- [ ] For each of the 6 listed instances: either tighten to an exact-value assertion (preferred) or add a `// existence-check: [reason]` comment if the value is genuinely non-deterministic
- [ ] Re-run the extended gate and confirm zero unjustified hits

Debt items batched in by owner approval (2026-07-07):
- `tests/exportBackup.test.ts:47-54` and `tests/importBackup.test.ts:62-81` — extend the Task #183 field assertions to cover the remaining `CardProgress` fields (`difficulty`, `retrievability`, `lapses`, and `cardId` in importBackup) so a corruption confined to those fields is no longer silent.
- `tests/entitlement.test.ts` — the `validUntil` assertions added by Task #183 recompute `new Date(str).getTime()` on both sides rather than a hardcoded epoch integer. Replace with the literal computed epoch value (e.g. `1798761600000` for `"2027-01-01T00:00:00Z"`) so a Date-parsing regression that moved both sides of the assertion together would actually be caught.
- `tests/importBackup.test.ts:35-41` — "handles v0 backup (no activeSession field) via migration chain" test name/comment describes behavior that doesn't exist (`BackupSrs` has no `activeSession` field; `parseBackup()` has no migration chain). Rename to describe what it actually verifies (a duplicate of the basic valid-backup path), or fold its assertion into the "accepts a well-formed current backup" test above it and delete the duplicate.

**Done when:** `grep -rn "\.toBeDefined()\|\.toBeTruthy()\|\.not\.toBeNull()\|\.toBeGreaterThan(0)" tests/ --include="*.test.*" | grep -v "existence-check:"` returns zero output. Verification gate green.
**Status: COMPLETE — 2026-07-07**

**Source:** Audit finding (Task #183 cycle) — severity 4 — tooling — Agents B/N/V independently converged on this during Task #183's audit.

---

### Task #228: Fix requirements: canIntroduceNewCard's cross-day wrong-streak pause is dead code

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — architectural fix, requires a new persisted signal
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P1

**What:**
`canIntroduceNewCard` (store/srsStore.ts:272) gates on `r.consecutiveWrongToday >= CONSECUTIVE_WRONG_RESET && r.lastSeenDate !== today` to implement BRAND.md's "Wrong across multiple days → New card introductions pause until this one stabilizes." This is Task #180's own F10 acceptance criterion. It is dead code: `recordResult` (lib/introduction.ts:120-127) always resets `consecutiveWrongToday` to 0 in the exact same write that would ever push it to the threshold — no writer in the codebase can persist a value >= 3. The only test for this (`tests/srsStore.test.ts` "F10") injects the unreachable state directly via `setState`, bypassing the real write path entirely. 7 of 8 independent audit agents converged on this finding.

**Acceptance Criteria:**
- [ ] Introduce a signal that survives the same-day reset — e.g. a `strandedAcrossDays: boolean` set once when a card resets to Day 1 and only cleared once the card records a correct answer on a later day, or redefine the trigger around comparing `phaseStartDate` resets across distinct calendar days
- [ ] Replace the F10 unit test with a seam test (matching `tests/seam_introduction.test.ts`'s pattern) that drives the cross-day-pause condition through `introduceCard`/`recordIntroductionResult` end-to-end, not via direct `setState` injection
- [ ] Verify the fix actually blocks `canIntroduceNewCard` when a real multi-day-wrong sequence is played through the store API

**Done when:** A new seam test drives a card wrong across 2+ real calendar-day boundaries through `recordIntroductionResult` and asserts `canIntroduceNewCard` returns `false` as a result — without directly setting `consecutiveWrongToday` via `setState`. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 9 — requirements — converged independently by Agents A, B, N, W, K, Red R, V.

---

### Task #229: Fix requirements: the "variety rule" (Task #180) has zero effect on what the user is shown

**File:** store/srsStore.ts, lib/introduction.ts, app/study/page.tsx, content/types.ts
**Complexity:** 🔧 Full — requires either a content-model change or removing the dead mechanism
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P1

**What:**
BRAND.md requires "each encounter uses a different retrieval angle" during the intensive introduction phase. Task #180 added `getNextCardType`/`lastSeenType` machinery to implement this, but it is fully inert: `app/study/page.tsx:147` calls `recordIntroductionResult(currentCard.id, g !== "again", localDateStr())` — it never passes the actually-displayed card's type. `recordIntroductionResult` (store/srsStore.ts:246-247) computes `getNextCardType(record.lastSeenType, ALL_CARD_TYPES)` and writes the result back into `lastSeenType`, but nothing anywhere in the codebase reads `IntroductionRecord.lastSeenType` to select what's actually shown — `StudyCard.tsx` renders strictly from the content pack's fixed, immutable `card.type`. There is no "sibling card" concept in the content model to even vary the presented format for a given word. 3 independent auditors (A, B, W) confirmed this via full-repo grep of `lastSeenType`.

**Acceptance Criteria:**
- [x] Decide the actual mechanism: either (a) content packs need sibling cards per word/type so the queue can select an alternate-type card for the same word on each introduction encounter, or (b) if varying the retrieval angle is out of scope for now, remove the dead `lastSeenType`/`getNextCardType` wiring and its tests rather than leaving inert code that looks functional — resolved as (b); dead wiring removed from `recordIntroductionResult`
- [x] If implementing: add a seam test that drives two consecutive introduction encounters for the same card through the real queue-building path and asserts the actually-displayed card type differs — n/a, mechanism removed per (b) above
- [x] Update content/types.ts's `lastSeenType` doc comment to be accurate about what it does today — done (content/types.ts:58)

**Done when:** Either a real end-to-end seam test proves the displayed card type varies across encounters, or the dead mechanism is removed with an explicit documented decision. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 9 — requirements — converged independently by Agents A, B, W plus the orchestrating CTO's own full-repo grep.

---

### Task #230: Fix code-quality: getNextCardType can only ever produce 2 of 5 CardTypes

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file, algorithm fix
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Task #229 (fix depends on whether the mechanism is kept or removed)
**Priority:** P1

**What:**
`getNextCardType` (lib/introduction.ts:140-146) filters only the single `lastSeenType` out of the candidate pool and takes `pool[0]`. Given the fixed-order `ALL_CARD_TYPES = ["recognize","produce","conjugate","fill_blank","passage_cloze"]`, this means the function can only ever oscillate between `"recognize"` and `"produce"` — empirically confirmed via 10 sequential calls producing only 2 distinct outputs. `conjugate`, `fill_blank`, and `passage_cloze` are structurally unreachable no matter how many times the function is called. This defeats BRAND.md's stated premise ("varied retrieval across encounters produces durable memory") independent of the wiring gap in Task #229.

**Acceptance Criteria:**
- [x] If Task #229 keeps the mechanism: rewrite the selection algorithm to genuinely rotate/vary across all N available types (e.g. round-robin through a shuffled or rotating order, or track more than just the single last-seen type) — n/a, mechanism removed
- [x] Add a test that calls the function N times in sequence and asserts all 5 CardTypes appear across the sequence (not just 2) — n/a, mechanism removed, no live caller to test
- [x] If Task #229 removes the mechanism: this task is superseded — close as not-applicable with a cross-reference — done; superseded by Task #229's removal

**Done when:** A test drives `getNextCardType` through 10+ sequential calls and asserts at least 4 of the 5 CardTypes appear in the output sequence. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 8 — code-quality — confirmed empirically by the orchestrating CTO and independently by Agent W.

---

### Task #231: Fix requirements: getDayOfPhase's date validation misses calendar-invalid-but-shape-valid dates

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P1

**What:**
`getDayOfPhase` (lib/introduction.ts:51-62) validates only string shape via `DATE_RE = /^\d{4}-\d{2}-\d{2}$/`, not calendar validity. A shape-valid, calendar-invalid string like `"2026-13-45"` passes the guard; `new Date("2026-13-45").getTime()` is `NaN`, so the function silently returns `NaN` instead of throwing — directly contradicting its own docstring ("Throws on malformed input... NaN propagation would cause silent card disappearance"). This is the exact failure mode Task #179 was built to eliminate, reintroduced one validation layer down. 5 of 8 auditors converged on this (S, W, K, Red R, V), each independently verifying via `node`.

**Acceptance Criteria:**
- [ ] Add an `isNaN(new Date(...).getTime())` check to `getDayOfPhase` itself (matching what `store/migrations.ts`'s v3 migration already does at the persistence boundary), throwing the same `[ERR-INTRO-DATE]` error on failure
- [ ] Add a test asserting `getDayOfPhase("2026-13-45", "2026-07-01")` throws, not returns NaN
- [ ] Update the function's docstring only if its claim still doesn't fully hold after the fix (verify against Task #232's day-of-month rollover finding too)

**Done when:** `getDayOfPhase("2026-13-45", "2026-07-01")` throws `[ERR-INTRO-DATE]` instead of returning NaN, verified by a new test. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 7 — requirements — converged independently by Agents S, W, K, Red R, V plus the orchestrating CTO's own node verification.

---

### Task #232: Fix data-loss: migration v3's isNaN date guard misses day-of-month rollover

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
The v3 migration's date guard (store/migrations.ts:71-90, added by Task #184 specifically to reject calendar-invalid dates) does not catch day-of-month rollover: `"2026-02-30"` passes both `DATE_RE` and `!isNaN(new Date(...).getTime())` because JS's `Date` silently normalizes it to a valid timestamp (March 2nd), so the calendar-invalid string is preserved as-is into the migrated record instead of falling back to today. The guard's own comment overclaims "rejects calendar-invalid strings" as a general class when it only covers month-overflow (e.g. month 13). Converged independently by Agents K, Red R, V, confirmed via `node` by the orchestrating CTO.

**Acceptance Criteria:**
- [ ] Strengthen the date guard to also reject day-of-month rollover — e.g. re-format the parsed `Date` back to a `YYYY-MM-DD` string and compare it to the original input string; a mismatch means the input was calendar-invalid even though `getTime()` didn't return NaN
- [ ] Add a test asserting a v2 record with `phaseStartDate: "2026-02-30"` falls back to today's date after migration, not a silently-rolled-forward date
- [ ] Correct the guard's comment to accurately describe what it now covers

**Done when:** A migration test with `phaseStartDate: "2026-02-30"` asserts the migrated record's `phaseStartDate` equals the fallback (today), not `"2026-02-30"` or a rolled-forward value. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — data-loss — converged independently by Agents K, Red R, V.

---

### Task #233: Fix data-loss: migration's null-record recovery produces an incomplete IntroductionRecord

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
The v3 migration's null-record recovery path (store/migrations.ts:67-91, added by Task #184 to prevent a full-store-reset TypeError) produces `{ ...record, phaseStartDate }` where `record` is `{}` for a null/corrupt entry — only `phaseStartDate` is populated; the other 10 required `IntroductionRecord` fields are missing. The next `recordResult` call computes `record.totalEncounters + 1` and `record.consecutiveCorrect + 1` as `undefined + 1 = NaN`, permanently corrupting those counters — since `NaN >= GRADUATION_THRESHOLD` is always false, the card can never graduate again. A "recovery" path that itself introduces silent, permanent data corruption on the record it recovers. Found by Agent A, confirmed via code trace by the orchestrating CTO.

**Acceptance Criteria:**
- [ ] Build a complete default `IntroductionRecord` (all 11 fields, matching `introduceCard`'s initialization defaults) when a corrupt/null entry is recovered, not just `phaseStartDate`
- [ ] Add a test asserting that after migrating a `null` introduction record and then calling `recordResult` on it, `totalEncounters` and `consecutiveCorrect` are real numbers, not `NaN`
- [ ] Verify the recovered record can still graduate normally after 15 consecutive correct answers

**Done when:** A test migrates a null introduction record, calls `recordResult` on the migrated output, and asserts `totalEncounters` and `consecutiveCorrect` are `1` (not `NaN`). Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — data-loss — found by Agent A, confirmed by the orchestrating CTO's own code trace.

---

### Task #234: Fix error-handling: getDayOfPhase's throw is uncaught inside getIntroductionDueCardIds's filter loop

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Task #231 (getDayOfPhase's throw conditions are changing)
**Priority:** P2

**What:**
`getIntroductionDueCardIds` (store/srsStore.ts:250-264) calls `getDayOfPhase` inside a `.filter()` over ALL introduction records with no per-record try/catch anywhere in the call chain, and the app has zero `ErrorBoundary`/`componentDidCatch` components. One corrupted record now aborts due-card computation for every card, not just the offending one — a larger blast radius than the silent single-card disappearance the throw-on-invalid-input design was meant to replace. Found independently by Agents S and K.

**Acceptance Criteria:**
- [ ] Wrap the `getDayOfPhase` call inside the filter callback in a try/catch that logs a ref ID and excludes only that one record from the due-card set, rather than letting the exception propagate and abort the whole computation
- [ ] Add a test with one corrupt record and one valid record in `state.introductions`, asserting the valid record's card ID is still returned

**Done when:** A test with a mix of one corrupt and one valid introduction record asserts `getIntroductionDueCardIds` returns the valid record's card without throwing. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — error-handling — found independently by Agents S and K.

---

### Task #235: Fix security: LANG_CONFIG_MAP's Object.freeze is shallow

**File:** lib/langRegistry.ts, lib/language.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
`Object.freeze(LANG_CONFIG_MAP)` (lib/langRegistry.ts:48-50, Task #186) only freezes the outer map object. The nested `LanguageConfig` objects (`ITALIAN`/`SPANISH` from lib/language.ts) and their `uiStrings`/`cardLabels` sub-objects remain fully mutable at runtime despite the `Readonly<>` type annotation implying full tamper-proofing — e.g. `LANG_CONFIG_MAP.it.articles = null` compiles and succeeds. Same class as the already-known F07 shallow-freeze gap. 4 of 8 auditors converged on this (S, A, B, Red R).

**Acceptance Criteria:**
- [ ] Deep-freeze `LANG_CONFIG_MAP`'s values (recursively freeze `ITALIAN`/`SPANISH` and their nested objects), or document explicitly why shallow freeze is an accepted trade-off given current low exploitability
- [ ] Add a test asserting a nested-field mutation attempt (e.g. `LANG_CONFIG_MAP.it.articles = null`) either throws (strict mode) or has no effect

**Done when:** A test attempts to mutate a nested field of `LANG_CONFIG_MAP.it` and asserts the original value is unchanged afterward. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — security — converged independently by Agents S, A, B, Red R.

---

### Task #236: Fix security: activateLicense's instanceId guard checks truthiness, not type

**File:** lib/entitlement.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Security Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
`activateLicense`'s guard `if (!res.instance?.id)` (lib/entitlement.ts:139, Task #185) checks truthiness only, not type. `res` is an untyped `raw as LsActivateBody` cast with no runtime schema validation. A response shaped like `instance: { id: 123 }` (a number, not a string) passes this guard, then gets assigned to the `instanceId: string` field of the returned `ActivateResult`, violating the function's own return type contract, and is persisted into the entitlement store and later passed back to `deactivateLicense` as if it were a real string. Found by Red Agent R.

**Acceptance Criteria:**
- [ ] Change the guard to `if (!res.instance?.id || typeof res.instance.id !== "string")` (or equivalent runtime type check)
- [ ] Add a test asserting `activateLicense` rejects a response where `instance.id` is a number

**Done when:** A test with `instance: { id: 123 }` (number, not string) asserts `activateLicense` returns an error result, not a persisted numeric instanceId. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — security — found by Red Agent R.

---

### Task #237: Fix tests: commitSession's "atomicity" test doesn't test atomicity

**File:** tests/commitSession.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
"all three slices are consistent — no partial application" (tests/commitSession.test.ts:36-47) claims to prove `commitSession`'s atomic single-`set()`-call contract (documented in store/srsStore.ts:72-74) but only checks final-state values. It would pass identically if `commitSession` made three sequential `set()` calls instead of one. `tests/seam_studyLoop.test.ts:93-129` already has the correct pattern (subscribe + snapshot-count) for the sibling `rateCardAndSaveSession` function — the same pattern was not applied here. Found independently by Agents K and V.

**Acceptance Criteria:**
- [ ] Rewrite the test to subscribe to the store and assert exactly 1 snapshot fires for a single `commitSession` call, matching the pattern already used in `tests/seam_studyLoop.test.ts`

**Done when:** The rewritten test would fail if `commitSession` were changed to call `set()` more than once. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — converged independently by Agents K and V.

---

### Task #238: Fix tests: useLangPack.test.ts's error-message enumeration omits base_pack_not_loaded

**File:** tests/useLangPack.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
The `RAW_DISCRIMINANTS`/`EXPECTED_MESSAGES` enumeration added by Task #227 (tests/useLangPack.test.ts:84-103) omits `base_pack_not_loaded` — 1 of 5 `LoadPackResult` error discriminants (defined lib/packTypes.ts:41-46, copy in hooks/useLangPack.ts:18) is never tested. A Rule 16 enumeration gap in a fixture explicitly built to enumerate all discriminants. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add `base_pack_not_loaded` to `RAW_DISCRIMINANTS` and its exact expected copy to `EXPECTED_MESSAGES`

**Done when:** All 5 `LoadPackResult` error discriminants are covered by the enumeration test. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 6 — tests — found by Agent K.

---

### Task #239: Fix tests: packLoader stale-cache fallback has no semantic-corruption test

**File:** tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P2

**What:**
No test in tests/packLoader.test.ts exercises syntactically-valid-but-semantically-malformed cached JSON (e.g. non-array `units`) reaching the offline stale-cache-fallback path (lib/packLoader.ts:210-235). That path skips the shape validation the happy-path download branch performs, so a truncated/corrupted cache write (plausible per the file's own atomic-write comment) could leak an invalid `Pack` as `ok:true`. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test that seeds a cached pack with a non-array `units` field, forces the offline-fallback path, and asserts the result is either rejected or validated before being returned

**Done when:** A test with semantically-malformed cached JSON asserts the stale-cache fallback path does not silently return an invalid Pack as `ok:true`. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — tests — found by Agent K.

---

### Task #240: Fix code-quality: DATE_RE regex duplicated across two files

**File:** lib/introduction.ts, store/migrations.ts
**Complexity:** ⚡ Direct — 2 files, extract to shared module
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;` is independently defined in both lib/introduction.ts:9 and store/migrations.ts:60 — the exact duplicate-constant failure class this team already hit once this batch (`CONSECUTIVE_WRONG_RESET`, fixed in Batch 18 Wave 1). AGENTS.md explicitly bans "any parallel list/array that should be derived from a single source of truth." Found independently by Agents B and Red R.

**Acceptance Criteria:**
- [ ] Export `DATE_RE` once from a shared module (e.g. lib/utils.ts, already imported by both files) and import it in both places

**Done when:** `grep -rn "DATE_RE = " lib/ store/` returns exactly one definition. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — converged independently by Agents B and Red R.

---

### Task #241: Fix code-quality: phase-day boundary magic number 22 repeated in 3 places

**File:** lib/introduction.ts, store/srsStore.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
The phase-day graduation boundary `22` is a bare literal repeated in three places with no shared named constant: `MAX_APPEARANCES_BY_PHASE_DAY[22] = 0` and `getDayOfPhase`'s `Math.min(diffDays + 1, 22)` clamp (both lib/introduction.ts), and the day-22+ rescue-path check in store/srsStore.ts:257. Found by Agent B.

**Acceptance Criteria:**
- [ ] Extract a named constant (e.g. `MAX_PHASE_DAY = 22`) in lib/introduction.ts, export it, and use it at all three call sites

**Done when:** `grep -rn "\b22\b" lib/introduction.ts store/srsStore.ts` shows no remaining bare `22` literal tied to the phase-day boundary. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — found by Agent B.

---

### Task #242: Fix code-quality: shouldGraduate() exported but never called; duplicated inline

**File:** lib/introduction.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`shouldGraduate()` (lib/introduction.ts:88-91) is exported but never called from production code — only from tests. `recordResult` (line 116) re-implements the identical check inline (`graduated: consecutiveCorrect >= GRADUATION_THRESHOLD`) instead of calling `shouldGraduate(record)`. Two independent expressions of the same rule. Found by Agent B.

**Acceptance Criteria:**
- [ ] Change `recordResult` to call `shouldGraduate({ ...record, consecutiveCorrect })` instead of re-implementing the comparison inline

**Done when:** `recordResult`'s graduation check calls `shouldGraduate` rather than duplicating its comparison. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — found by Agent B.

---

### Task #243: Fix tests: study_loop.test.ts never asserts masteryPct

**File:** tests/study_loop.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
"getStats correctly counts due, learning, and mastered across a mixed unit" (tests/study_loop.test.ts:86-109) checks 4 of 5 `getStats` return fields; `masteryPct` (drives `MASTERY_GATE`, a BRAND.md-critical unlock threshold) is never asserted. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add an assertion on the exact expected `masteryPct` value for the test's mixed-unit fixture

**Done when:** The test asserts a specific `masteryPct` value, not just the other 4 fields. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #244: Fix tests: importBackup normalizeCardProgress fallback coverage incomplete

**File:** tests/importBackup.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`normalizeCardProgress` fallback coverage (tests/importBackup.test.ts:106-141) forces only 2 of 7 `CardProgress` fallback branches (`stability`, `lapses`); `difficulty`, `retrievability`, `dueDate`, and `reps` fallback paths (lib/importBackup.ts:52-56) are untested. Found by Agent K.

**Acceptance Criteria:**
- [ ] Add a test case per remaining fallback branch (`difficulty`, `retrievability`, `dueDate`, `reps`) with an invalid input value and an exact expected fallback assertion

**Done when:** All 7 `CardProgress` fallback branches have a dedicated test case with an exact expected value. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — tests — found by Agent K.

---

### Task #245: Fix code-quality: AGENTS.md's Stop-the-Line list omits .toBeGreaterThan(0)

**File:** AGENTS.md
**Complexity:** ⚡ Direct — 1 file, 1 line
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-07**
**Blocked by:** Nothing
**Priority:** P3

**What:**
AGENTS.md's Verification Gate grep (line ~39) bans 4 assertion patterns including `.toBeGreaterThan(0)`, but the adjacent Stop-the-Line Violations bullet list (line ~84) only mentions 3, omitting `.toBeGreaterThan(0)` — a parallel-list violation introduced by Task #227 itself, directly contradicting the rule stated one line above it in the same document ("Any parallel list/array that should be derived from a single source of truth"). Converged independently by Agents W and K.

**Acceptance Criteria:**
- [ ] Add `.toBeGreaterThan(0)` to the Stop-the-Line Violations bullet so it matches the Verification Gate grep pattern exactly

**Done when:** AGENTS.md's Stop-the-Line Violations bullet and Verification Gate grep pattern list the same 4 banned assertion patterns. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 4 — code-quality — converged independently by Agents W and K.

---

### Task #246: Fix requirements: canIntroduceNewCard's strandedAcrossDays pause is defeated by any same-day review, not just a correct one

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P1

**What:**
Task #228 fixed the cross-day pause from being fully dead code, but the guard in `canIntroduceNewCard` (store/srsStore.ts:274) is `r.strandedAcrossDays && r.lastSeenDate !== today`. Since `recordResult`'s wrong-but-not-triple branch (lib/introduction.ts:144) always writes `lastSeenDate: today` via `base` regardless of whether the answer was correct, reviewing the stranded card again on any later day — even with another WRONG answer that does not stabilize it — updates `lastSeenDate` to today and silently lifts the pause for the rest of that day. Confirmed via direct reproduction: triple-wrong on day 1 → blocked on day 2 (correct) → one more wrong answer on day 2 → `canIntroduceNewCard` incorrectly returns `true` later the same day. BRAND.md's "pause until this one stabilizes" is only honored on calendar days the card isn't reviewed at all, not until an actual correct answer. Given the proactive interruption model runs 6-10 sessions/day, this is reachable in ordinary use. Converged independently by Agents W and B, confirmed by the orchestrating CTO's own repro script.

**Acceptance Criteria:**
- [ ] Change the pause condition so it is lifted only by an actual correct answer (which already clears `strandedAcrossDays` to `false` per lib/introduction.ts:125-127), not merely by `lastSeenDate` advancing — e.g. drop the `lastSeenDate !== today` clause entirely from the `canIntroduceNewCard` guard (since `strandedAcrossDays` itself is already the authoritative signal and is correctly cleared only on a correct answer), while preserving the existing behavior that the pause does not block new intros on the very day the triple-wrong reset happens (verify the existing seam test for that scenario still passes)
- [ ] Add a test: triple-wrong on day 1 → blocked day 2 → WRONG answer again on day 2 → still blocked later that same day and on day 3
- [ ] Verify the existing "correct answer clears it" seam test still passes unmodified

**Done when:** A test drives a stranded card through a same-day WRONG (non-stabilizing) review and asserts `canIntroduceNewCard` still returns `false` afterward — only a real correct answer lifts the pause. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 6 — requirements — converged independently by Agents W, B, plus the orchestrating CTO's own reproduction.

---

### Task #247: Fix error-handling: recordIntroductionResult still has no try/catch around getDayOfPhase (Task #234's sibling call site)

**File:** store/srsStore.ts, tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #234 wrapped `getDayOfPhase` in a try/catch inside `getIntroductionDueCardIds` because an uncaught throw there aborted due-card computation for every card. `recordIntroductionResult` (store/srsStore.ts:239) calls the identical `getDayOfPhase(record.phaseStartDate, today)` with no try/catch — and this is the higher-traffic call site: it's invoked directly and uncaught from `app/study/page.tsx:147`'s `onRate` handler, hit on every single card rating. The app has zero `ErrorBoundary`/`componentDidCatch` anywhere, so a corrupted persisted record would crash the whole session on the user's next rating action, not just silently drop one card from a queue computation. Converged independently by Agents S, K, A, W (4 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Wrap the `getDayOfPhase` call in `recordIntroductionResult` in the same try/catch pattern used in `getIntroductionDueCardIds` — log a ref ID with the cardId and bad value, and decide a safe fallback (e.g. skip the update for that card) instead of letting the exception propagate into the click handler
- [ ] Add a test asserting `recordIntroductionResult` does not throw when called on a record with a corrupt `phaseStartDate`

**Done when:** A test calls `recordIntroductionResult` on a record with a calendar-invalid `phaseStartDate` and asserts no exception propagates. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 6 — error-handling — converged independently by Agents S, K, A, W.

---

### Task #248: Fix data-loss: packLoader's shape-validation guard covers only 3 of 5 JSON.parse(...) as Pack sites

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** 🔧 Full — extract shared validator
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #239 added an `Array.isArray(pack.units)` shape guard to 3 of 5 `JSON.parse(...) as Pack` sites in `lib/packLoader.ts:loadPack` (the two offline-fallback branches at lines 213/232, and the fresh-download branch at line 263). The two "cache hit" branches — the sha256-verified hit (line 187) and the fully-unverified no-manifest offline-serve-as-is path (line 193) — remain unguarded, violating the module's own documented invariant ("a mismatch is a hard error — no corrupted pack is ever cached or returned," CLAUDE.md §6). This is a pre-existing catalogued pattern (`.autocode/patterns.md`, 2026-06-26) that Task #239 only partially closed. Converged independently by Agents K, A, W, B (4 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Extract the shape-validation check into a single shared helper (e.g. `validatePackShape(pack): boolean`) and apply it uniformly at all 5 `JSON.parse(...) as Pack` sites in `loadPack`, not just the 3 currently guarded
- [ ] Add a test that seeds a cached pack with non-array `units` reaching the sha256-verified cache-hit path and asserts the result is rejected, not returned as `ok:true`
- [ ] Add a test for the no-manifest offline-serve-as-is path with the same malformed fixture

**Done when:** All 5 `JSON.parse(...) as Pack` sites in `loadPack` reject non-array `units` via the same shared validator, verified by tests covering each previously-unguarded path. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 5 — data-loss — converged independently by Agents K, A, W, B.

---

### Task #249: Fix tests: vacuous NaN-equality tautology in srsStore.test.ts

**File:** tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`expect(n + 1).toBe(n + 1)` (tests/srsStore.test.ts:647, commented "NaN + 1 !== NaN + 1 (NaN propagation check)") is a self-referential tautology: Vitest's `.toBe()` uses `Object.is()` semantics, and `Object.is(NaN, NaN)` is `true`, so this line passes for any value of `n` including `NaN` — it proves nothing and directly contradicts its own comment. The real check is the preceding `expect(isNaN(n)).toBe(false)` line, which is correct. Converged independently by Agents N, A, K, V, B (5 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Delete the vacuous `expect(n + 1).toBe(n + 1)` line, or replace it with a real assertion (e.g. `expect(n).toBe(<specific expected number>)`) if there's additional value to assert beyond the `isNaN` check

**Done when:** No vacuous self-referential `.toBe()` assertions remain in the affected test. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 4 — tests — converged independently by Agents N, A, K, V, B.

---

### Task #250: Fix code-quality: specialtyPackLoader.ts duplicates the shape-check Task #248 just centralized

**File:** lib/packLoader.ts, lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #248 extracted a shared `validatePackShape()` helper and applied it at all 5 `JSON.parse(...) as Pack` sites inside `lib/packLoader.ts:loadPack`. `lib/specialtyPackLoader.ts:90` has a structurally identical 6th site (`JSON.parse(addOnJson) as Pack` → `if (!Array.isArray(addOnPack.units))`) that still duplicates the check inline instead of importing the shared helper — `validatePackShape` isn't even exported, so reuse wasn't possible without a further edit. This file was untouched by all 3 remediation cycles on this batch. Currently inert since `SPECIALTY_PACKS` is empty, but a live landmine for the day specialty packs ship — the exact "fixed the named site, missed the sibling" pattern that has now recurred 4 times this batch. Converged independently by Agents A, B, W (3 of 8 cycle-3 audit agents).

**Acceptance Criteria:**
- [ ] Export `validatePackShape` from `lib/packLoader.ts` (or move it to `lib/packTypes.ts` alongside the `Pack` interface it validates)
- [ ] Replace `lib/specialtyPackLoader.ts:90`'s inline `!Array.isArray(addOnPack.units)` check with a call to the shared `validatePackShape()`
- [ ] Add a test in the specialty-pack-loading test coverage asserting malformed `units` is rejected via the shared validator (even though `SPECIALTY_PACKS` is currently empty, this exercises the merge path directly)

**Done when:** `grep -rn "Array.isArray(.*units)" lib/` shows exactly one definition (inside `validatePackShape` itself), with all call sites — including `lib/specialtyPackLoader.ts` — delegating to it. Verification gate green.

**Debt item batched in by owner approval (2026-07-08):**
- `lib/packLoader.ts:validatePackShape`'s name/comment overclaims what it checks (only `Array.isArray(pack.units)`, not the full `Pack` interface or unit/card element shapes — severity 4, matches an already-open unchecked `audit-checklist.md` item). While exporting/renaming this function for reuse in `specialtyPackLoader.ts`, either rename it to honestly describe its narrow scope (e.g. `hasValidUnitsArray`) or expand its doc comment to explicitly state it only checks the `units` array shape, not full Pack/Unit/Card structural validation.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 3, 2026-07-08) — severity 5 — code-quality — converged independently by Agents A, B, W.

---

### Task #251: Fix data-loss: packLoader's offline-fallback paths don't evict a shape-invalid cache entry

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
In `lib/packLoader.ts:loadPack`, the two "cache hit" shape-validation-failure branches (sha256-verified hit, no-manifest hit) call `clearPackCache(lang)` before returning `{ ok: false, error: "parse_error" }`. The two "offline-fallback" branches (fetch `!res.ok`, fetch throws) return the same error on shape-validation failure but never call `clearPackCache` first. A corrupted cache entry hit through either offline-fallback path is therefore never evicted — every subsequent offline load attempt hits the same corrupted cache and returns `parse_error` again, with no path to self-heal until network returns and a version bump happens, or someone manually calls `evictPack`. Confirmed via direct code read (lib/packLoader.ts:229-234, 248-253). Found by Red Agent R.

**Acceptance Criteria:**
- [ ] Add `await clearPackCache(lang)` before returning `parse_error` in both offline-fallback branches, matching the cache-hit branches' behavior
- [ ] Add a test: seed a shape-invalid cached pack, force the offline-fallback path (network error), assert the result is `parse_error` AND that the cache was evicted (a subsequent successful download is not blocked by stale corrupted data)

**Done when:** A test confirms the cache is evicted after a shape-validation failure on the offline-fallback path, not just on the cache-hit paths. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 3, 2026-07-08) — severity 5 — data-loss — found by Red Agent R, confirmed by the orchestrating CTO's own code read.

---

### Task #252: Fix data-loss: clearPackCache has no atomicity protection across its two storage removals

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
`clearPackCache(lang)` (lib/packLoader.ts:97-101) is three unguarded sequential statements: `await getStorage().removeItem(META_KEY)`, `await getStorage().removeItem(DATA_KEY)`, `memCache.delete(lang)`. If the second `removeItem` throws (platform storage I/O error, Tauri Store rejection, or a restrictive browser context), `memCache.delete(lang)` never runs, leaving a partially-evicted state: the meta key is gone but the data key and memCache entry remain. This function's own body is pre-existing (untouched by any wave of this batch), but Task #251 added 4 new call sites depending on its correctness, all inside catch blocks with no additional protection of their own. Confirmed blast radius is narrow: the sole caller (`hooks/useLangPack.ts`) has a terminal `.catch()` that logs and shows a friendly error rather than crashing — but the corrupted/stale cache entry silently fails to be fully cleared. Converged independently by Agents K, S, Red R (3 of 8 cycle-4 audit agents).

**Acceptance Criteria:**
- [ ] Wrap `clearPackCache`'s two `removeItem` calls (and the `memCache.delete`) so a failure in one step doesn't prevent the others — e.g. `Promise.allSettled` for the two storage removals, then always run `memCache.delete(lang)` regardless of their outcome, logging a ref ID if either removal failed
- [ ] Add a test simulating a storage `removeItem` throw on the second call and asserting `memCache.delete` still ran (or that the function logs the partial failure rather than leaving it silent)

**Done when:** A test proves `clearPackCache` still clears `memCache` even when one of the two storage `removeItem` calls throws. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — data-loss — converged independently by Agents K, S, Red R.

---

### Task #253: Fix code-quality: evictPack doesn't clear specialty-pack merge state

**File:** lib/packLoader.ts, lib/specialtyPackLoader.ts, tests/packLoader.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
`evictPack(lang)` clears `memCache` and platform storage for `lang`, but never calls `clearSpecialtyCache()` or prunes `loadedAddOns` (both in lib/specialtyPackLoader.ts). If a base pack with a merged specialty add-on is evicted, `loadedAddOns` still reports the specialty code as loaded — a later `loadPack(baseLang)` reload silently omits the specialty merge with no path to re-trigger it (only the test-only `clearCacheForTesting` clears both). This is the same "fixed the named site, missed a caller" class this batch spent 3 cycles closing, in a caller (`evictPack`) nobody re-checked. Currently dormant since `SPECIALTY_PACKS` is empty. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] `evictPack` should also prune any `loadedAddOns` entries whose `baseLang` matches the evicted `lang`, and call the equivalent of `clearSpecialtyCache()` scoped to those entries (or clear all of `loadedAddOns` if per-base-lang scoping isn't practical)
- [ ] Add a test: merge a specialty pack into a base pack, evict the base pack, assert the specialty code is no longer in `getLoadedAddOns()`

**Done when:** A test proves evicting a base pack with a merged specialty add-on also removes that add-on from `getLoadedAddOns()`. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — code-quality — found by Agent W.

---

### Task #254: Fix requirements: a stranded card with a corrupt phaseStartDate can never self-heal

**File:** store/srsStore.ts, lib/introduction.ts, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
A record that is both `strandedAcrossDays: true` and has a calendar-invalid `phaseStartDate` can never recover: `recordIntroductionResult`'s corrupt-date catch path (added by Task #247) returns before ever calling `recordResult`, and `recordResult` is the only code that clears `strandedAcrossDays` (on a correct answer). Once a record is in this combined state, `canIntroduceNewCard` stays permanently blocked for that user with no recovery except a manual store reset — narrow double-fault (requires both stranding AND date corruption on the same record), but a genuine permanent-block with zero test coverage in either direction. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Decide the recovery path: either (a) have the corrupt-date catch path in `recordIntroductionResult` still clear `strandedAcrossDays` on a correct answer even when `getDayOfPhase` throws (skip only the `dayOfPhase`-dependent parts of `recordResult`, not the whole update), or (b) have the migration/repair path that fixes a corrupt `phaseStartDate` also reset `strandedAcrossDays` to `false` so the card isn't permanently stuck once its date is repaired
- [ ] Add a test: a record with `strandedAcrossDays: true` and a corrupt `phaseStartDate`, call `recordIntroductionResult` with a correct answer, assert the record can eventually clear `strandedAcrossDays` and unblock `canIntroduceNewCard`

**Done when:** A test proves a stranded-and-corrupt-date record can recover, not stay permanently blocked. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — requirements — found by Agent W.

---

### Task #255: Fix documentation-trust: CLAUDE.md's Introduction Engine section was never synced across 4 remediation cycles

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, no package boundary, no implementation-scope keyword in What
**Owner:** Docs Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
CLAUDE.md §7 ("Introduction Engine") still states "Wrong 3× in a row resets `dayOfPhase` to 1" and describes `lib/introduction.ts` as having "Six exports" — neither is accurate after 4 remediation cycles on this exact subsystem. The actual mechanism (built across Tasks #178-186, #228, #246) advances `phaseStartDate` and sets `strandedAcrossDays`, not a direct `dayOfPhase` reset; `lib/introduction.ts` now has 10 exports (4 constants + 6 functions, including `MAX_PHASE_DAY` and `isCalendarValidDate`'s consumption). CLAUDE.md never mentions `phaseStartDate`, `strandedAcrossDays`, or the day-22+ rescue path in `getIntroductionDueCardIds`. This is the project's own canonical "override any default behavior" architecture doc, left unsynced through the entire batch. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Rewrite CLAUDE.md §7 to accurately describe the current mechanism: `phaseStartDate` as the authoritative reset anchor, `strandedAcrossDays` as the cross-day-pause signal (set on triple-wrong, cleared only on a correct answer), the day-22+ rescue path, and `MAX_PHASE_DAY`
- [ ] Update the exports list to match `lib/introduction.ts`'s actual current exports
- [ ] Cross-check the rest of CLAUDE.md (not just §7) for other stale references to the pre-Batch-18 introduction engine behavior

**Done when:** CLAUDE.md §7 accurately describes `phaseStartDate`/`strandedAcrossDays`/the rescue path, and the exports list matches `lib/introduction.ts`'s actual exports. No test — this is a documentation-only task; verify by re-reading the section against the current source.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 5 — documentation-trust — found by Agent W.

---

### Task #256: Fix documentation-trust: stale migration comment describes a NaN failure mode that no longer exists

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Docs Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`store/migrations.ts`'s v2→v3 migration comment (lines ~50-52) describes "an empty string or calendar-invalid date would produce NaN in getDayOfPhase and silently hide the card forever" — describing `getDayOfPhase`'s pre-hardening behavior. `lib/introduction.ts:getDayOfPhase` (changed in this same batch, Task #231) no longer returns NaN on invalid input — it throws `[ERR-INTRO-DATE]`. The comment documents a failure mode this same batch already eliminated at the source and was never updated to say so. Found by Red Agent R (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Update the migration's comment to describe the current guard (the migration's own `isCalendarValidDate` check exists as defense-in-depth at the persistence boundary, independent of `getDayOfPhase`'s now-throwing behavior at the runtime boundary) rather than describing the old NaN-propagation failure mode as if it's still what `getDayOfPhase` does

**Done when:** The comment accurately describes current behavior, not the pre-Task-#231 NaN-propagation failure mode. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — documentation-trust — found by Red Agent R.

---

### Task #257: Fix code-quality: dead-code assignment with a misleading copy-pasted comment

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`lib/packLoader.ts:191`'s `cachedData = null; // A003-style: prevent bytes from reaching stale-cache fallback` has zero effect — the function returns unconditionally on the very next line, so nothing ever reads `cachedData` again in this branch. The comment was copy-pasted from an earlier, genuinely load-bearing instance of this pattern (where the branch falls through to re-download rather than returning immediately). Introduced by Task #251's own edit this cycle, not inherited debt. Found by Agent B (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Remove the dead `cachedData = null` assignment and its misleading comment from this specific branch (the one that returns immediately after), leaving the pattern only where it's genuinely load-bearing

**Done when:** `lib/packLoader.ts:191`'s dead assignment is removed; the branch's behavior is unchanged (verified by the existing test suite still passing). Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — code-quality — found by Agent B.

---

### Task #258: Fix requirements: Task #254's self-heal clears strandedAcrossDays but never repairs the corrupt phaseStartDate, so the card permanently vanishes from the due queue

**File:** store/srsStore.ts, CLAUDE.md, tests/srsStore.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #254's fix (store/srsStore.ts:recordIntroductionResult's corrupt-date catch block) clears `strandedAcrossDays` on a correct answer, unblocking `canIntroduceNewCard` globally — but it never repairs the record's own `phaseStartDate`, which remains calendar-invalid. Every subsequent call for that same card re-throws in `getDayOfPhase`, so `getIntroductionDueCardIds`'s catch block (store/srsStore.ts) filters the card out of the due set on every calendar day, forever — its own catch-and-exclude runs before the day-22+ rescue check is ever reached, so the rescue path never applies to this state either. The card is "healed" in the sense that it no longer blocks other cards, but is itself permanently orphaned — unreachable for review or graduation. This directly contradicts CLAUDE.md's just-rewritten §7 claim (Task #255, same cycle) that a non-graduated card "can never permanently disappear from both queues." Converged independently by 6 of 8 cycle-5 audit agents (A, B, Red R, W, K, V).

**Acceptance Criteria:**
- [ ] Decide the repair path: either (a) have the corrupt-date catch path in `recordIntroductionResult` also reset `phaseStartDate` to `today` when clearing `strandedAcrossDays` (fully repairing the record, not just unblocking the global gate), or (b) extend `getIntroductionDueCardIds`'s rescue-path check to also apply to a record whose `getDayOfPhase` call throws, so a corrupt-but-healed record still surfaces at least once per day like the day-22+ case does
- [ ] Update CLAUDE.md §7 so its claim about the rescue path accurately reflects the chosen fix — the doc must not state an invariant the code doesn't actually enforce for this specific state
- [ ] Add a test: a record with a corrupt `phaseStartDate`, after being "healed" via a correct answer, must still be able to appear in `getIntroductionDueCardIds` (or the doc must be corrected to disclose this as a known, deliberate limitation instead of an invariant)
- [ ] Rename or extend the existing "#254: correct answer clears strandedAcrossDays... (self-heal path)" test so its name and assertions match what the fix actually delivers — don't let "self-heal" imply full recovery if only the block is lifted

**Done when:** Either the record can rejoin the due queue after being healed, or CLAUDE.md explicitly documents this as a known permanent-exclusion edge case rather than asserting an invariant the code doesn't hold. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 5, 2026-07-08) — severity 5 — requirements — converged independently by Agents A, B, Red R, W, K, V (6 of 8).

---

### Task #259: Fix data-loss: loadPack's forceRedownload path can silently overwrite a merged specialty pack without pruning loadedAddOns

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P2

**What:**
`loadPack(lang, manifest, { forceRedownload: true })` skips the memory-hit short-circuit and the `cacheValid` check purely because `forceRedownload` is true, falls through to the network-download block, and unconditionally does `memCache.set(lang, pack)` with the freshly-downloaded, unmerged base pack — overwriting whatever merged pack (base + specialty units) was previously there. `loadedAddOns` is never consulted or pruned in this path, so `getLoadedAddOns()` continues reporting a specialty code as loaded even though its units were just silently dropped from `memCache`. This is the same defect class Task #253 just fixed in `evictPack` (a caller that replaces a base pack's `memCache` entry without pruning `loadedAddOns`), in a different call site. Currently dormant: `SPECIALTY_PACKS` is empty in production and no production caller passes `forceRedownload` yet, but this is public API, already exercised by existing tests, and will silently corrupt user-facing content the moment either a specialty pack ships or a "force refresh" UI feature is wired to this option. Found by Agent A (cycle-5 audit).

**Acceptance Criteria:**
- [ ] `loadPack`'s forceRedownload/fresh-download path should call `clearSpecialtyPacksForLang(lang)` (or equivalent) before `memCache.set(lang, pack)` whenever the pack being replaced could have had a specialty merge applied — matching the same guarantee Task #253 added to `evictPack`
- [ ] Add a test: merge a specialty pack into a base pack, then call `loadPack(baseLang, manifest, { forceRedownload: true })`, and assert `getLoadedAddOns()` no longer reports the specialty code as loaded (consistent with the fresh unmerged pack now in memCache)

**Done when:** A test proves that force-redownloading a base pack with a merged specialty add-on also prunes that add-on from `getLoadedAddOns()`. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 5, 2026-07-08) — severity 5 — data-loss — found by Agent A.

---

### Task #260: Extract lib/packLoader.ts's 5 duplicated "parse → validate → evict-or-cache" blocks into one shared helper

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** 🔧 Full — 2 files, but a structural refactor (extract shared control flow), not a single-scope fix
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-07-08**
**Blocked by:** Nothing
**Priority:** P3

**What:**
`loadPack` hand-duplicates the same "parse cached/downloaded JSON as Pack → validate via `hasValidUnitsArray` → on failure evict via `clearPackCache` and return `parse_error`, on success prune via `clearSpecialtyPacksForLang` and `memCache.set`" sequence across 5 separate call sites: the cache-hit/manifest-present branch (lines ~190-206), the cache-hit/no-manifest branch (~207-216), the `!res.ok` offline-fallback branch (~230-251), the network-throw offline-fallback branch (~258-277), and the fresh-download success path (~291-322). Across 6 audit cycles on Batch 18, every task that touched this defect class (Tasks #250, #251, #253, #259) correctly patched only the specific sites its own finding named, leaving the others unexamined until the next audit cycle re-read the whole file and found another gap — most recently, Task #259 added `clearSpecialtyPacksForLang` to 3 success-path copies but missed 4 sibling failure-path copies in the exact same two blocks it was editing (cycle 6 finding, Agent A). This is not a carelessness problem — there is no single place to make the fix, so each task's patch is structurally isolated from the other 4 copies of the same logic.

**Acceptance Criteria:**
- [ ] Extract a single private helper (e.g. `parseValidateAndCache(lang: string, jsonText: string): Promise<LoadPackResult>`) that performs: `JSON.parse` (catch → log, `clearPackCache`, `clearSpecialtyPacksForLang`, return `parse_error`), `hasValidUnitsArray` check (fail → same evict-and-prune-and-return-error path), success → `clearSpecialtyPacksForLang(lang)` + `memCache.set(lang, pack)` + return `{ ok: true, pack }`
- [ ] Replace all 5 call sites in `loadPack` with calls to this helper
- [ ] Call `clearSpecialtyPacksForLang` unconditionally in the helper, including at the two cache-hit sites where it is currently a structural no-op (memCache cannot hold this lang at that point, per the `!options?.forceRedownload` guard at line 171 and `cacheValid`'s own `!options?.forceRedownload` clause) — consistency here is cheap and removes a landmine if that invariant ever changes
- [ ] Collapse the corresponding test coverage: the shared helper needs one set of parse-failure/shape-failure/success tests instead of duplicating them per call site; extend existing tests to cover all 5 original call sites through the one helper rather than leaving 2 of the 3 forceRedownload paths untested (closes the debt.md items about #259's 1-of-3 test coverage gap and the earlier catch-block JSON.parse-throw coverage gap)

**Done when:** `lib/packLoader.ts:loadPack` has exactly one implementation of the parse/validate/evict-or-cache sequence, called from all 5 sites. Verification gate green. All 5 original code paths remain individually testable and tested.

**Source:** Proactive architecture finding, identified while reviewing Batch 18's cycle-6 audit findings, 2026-07-08 — not itself an audit finding, a structural fix for the root cause behind 4 consecutive cycles' worth of "fixed here, missed the sibling" findings in this exact function.

**Folded in from debt.md (Debt Review, 2026-07-08) — 9 items, all in scope for this task:**
- [data-loss, sev 5] Task #259's fix missed 4 sibling `clearPackCache`+return sites in the same two offline-fallback blocks it edited — the exact defect this task's helper extraction eliminates structurally (all 5 sites route through one implementation, so this can't recur)
- [code-quality, sev 3] The 4 near-identical parse→validate→evict blocks (Task #251) — the finding that spawned this task
- [tests, sev 3] Task #259's test only exercises 1 of 3 fixed call sites — the consolidated test suite must cover all 5 original code paths through the shared helper
- [tests, sev 3] The two JSON.parse-throws catch blocks (within the offline-fallback branches) have no dedicated test distinct from the shape-check sub-case — must be covered once the helper is shared
- [code-quality, sev 3] `clearPackCache`'s new error logs use lang-keyed ref IDs (`ERR-CACHE-CLEAR-META-{lang}`) instead of the file's established `Date.now()`-based uniqueness pattern — align with the rest of the file while touching this code
- [code-quality, sev 3] `clearSpecialtyPacksForLang`/`clearPackCache` pairing fragility — no internal guard against a future caller invoking one without the other; the shared helper closes this by construction
- [tests, sev 3] Task #248's shape-validation tests assert only the data-key is null after eviction, not the meta-key — fix while consolidating eviction-path tests
- [tests, sev 3] Task #250's test comment overclaims "delegation" when it only proves rejection behavior — correct the comment/test name while touching this test file
- [tests, sev 2] Task #251's "network-throws" test has a redundant/misleading `forceRedownload` retry assertion that proves nothing about eviction — remove or fix while consolidating

---

## Batch 19 — OS Trigger Settings Remediation (Audit #164 findings) | 74 tasks | [COMPLETE — 2026-07-28 — audited clean, 17 findings accepted as debt]
Dependency: None (standalone remediation batch). Theme: /audit #164 (2026-07-04, verdict FAIL, severity 9, 39 findings) found that Task #163's OS trigger toggle controls (wake/unlock/idle + idle threshold) are entirely non-functional — `os_events.rs` never reads the settings it was built to expose. F001-F006 are the stop-the-line core; everything else is downstream test/doc/hardening debt discovered in the same audit. Fix order: F001-F004 (wiring) → F006 (Rust test coverage) → F015-F017/F040 (JS test hardening) → remainder.

Remediation gate CLOSED 2026-07-28: first-ever `/audit batch 19` (8-agent cycle 1) found 1 severity-7 finding (F1 — StudyDoneScreen's unguarded exit-mandatory-mode button) among 18 total; F1 was fixed directly as Task #506 and F2-F18 (severity 2-6) logged to `debt.md` per this project's Audit Severity Calibration rule. A 3-agent re-audit (cycle 2 — A, K, Red R) independently verified Task #506's fix at the root-cause level, including two agents performing a LIVE Deletion Test (reverting the fix, confirming the new tests fail, restoring and re-verifying byte-identical) rather than reasoning about it statically. Cycle 2 verdict: PASS — no other unprotected call site of the same defect class exists, no regression introduced, one new minor debt item logged (severity 3, pre-existing partial-IPC-failure masking, not introduced by this fix).

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

### Task #261: Fix auth: Entitlement is enforced nowhere in the data layer for specialty packs. lib/packLoader.ts:l

**File:** lib/specialtyPackLoader.ts
**Complexity:** 🔧 Full — 3 files (loadSpecialtyPack signature change in lib/specialtyPackLoader.ts requires coordinated updates to its caller lib/packLoader.ts:loadPack and the ultimate call site hooks/useLangPack.ts:68, which currently passes no entitlement argument at all)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-09

**What:**
Entitlement is enforced nowhere in the data layer for specialty packs. lib/packLoader.ts:loadPack and lib/specialtyPackLoader.ts:loadSpecialtyPack:67 never read purchasedAddOns or call hasAddOn; the only gate is the onClick wiring decision in components/LanguageGrid.tsx:109. hooks/useLangPack.ts:68 calls loadPack(targetLang, manifest) with no entitlement argument at all. Independently found by all 7 auditors. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix auth issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F001 — severity 8 — auth

---

### Task #262: Fix edge-case: setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1]

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-09

**What:**
setTargetLangCode('it-medical') stores 'en-it-medical'; getTargetLangCode's .split('-')[1] returns 'it', discarding '-medical'. The entire specialty-pack selection flow is unreachable from the real UI, deterministically, for any hyphenated code. Independently found by 5 of 7 auditors. Does NOT mitigate F001 -- fixing this alone exposes the entitlement gap through the primary UI with zero further code change. at lib/constants.ts:getTargetLangCode/setTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/constants.ts:getTargetLangCode/setTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F002 — severity 8 — edge-case

---

### Task #263: Fix security: clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearS

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearSpecialtyPacksForLang(). A license deactivation mid-session leaves already-merged specialty content fully accessible in memCache for the rest of the session; loadedAddOns never resyncs with the store. at store/entitlementStore.ts:clearEntitlement:111.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:clearEntitlement:111
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F003 — severity 7 — security

---

### Task #264: Fix async: Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before eit

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before either pushes (duplicate merge); cross-code concurrent loads sharing a base language each read the base pack independently after their own await, and whichever memCache.merge() resolves last silently discards the other's merge while getLoadedAddOns() reports both as loaded. No locking, mutex, or CAS exists anywhere in this module. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F004 — severity 7 — async

---

### Task #265: Fix security: sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.p

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-09

**What:**
sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.packs?.[lang] is absent for the requested specialty code. Arbitrary content is parsed and merged into the base pack's in-memory cache with zero integrity check. at lib/specialtyPackLoader.ts:loadSpecialtyPack:45.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:45
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F005 — severity 8 — security

---

### Task #266: Fix code-quality: isSpecialtyPackCode has zero production callers; lib/packLoader.ts:269 reimplements the sa

**File:** Multiple — see What (lib/langRegistry.ts is the anchor; the fix requires editing lib/packLoader.ts:269 to call the real function instead of reimplementing it inline — corrected during Wave 9 planning)
**Complexity:** ⚡ Direct — 2 files (lib/langRegistry.ts, lib/packLoader.ts), no package boundary, single call-site swap
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
isSpecialtyPackCode has zero production callers; lib/packLoader.ts:269 reimplements the same check inline instead of calling it. Independently found by 4 of 7 auditors. Rule 6 (duplication) and Rule 20b (zero callers outside tests) violation. at lib/langRegistry.ts:isSpecialtyPackCode:88.
Note (Wave 9 planning, 2026-07-09): Task #280 (Wave 8, complete) added `isReadySpecialtyPackCode`
to lib/langRegistry.ts specifically as the .ready-checking counterpart this call site needs —
lib/packLoader.ts:269's inline `SPECIALTY_PACKS.some(sp => sp.code === lang && sp.ready)` should
be replaced with a call to `isReadySpecialtyPackCode(lang)`, not `isSpecialtyPackCode(lang)` (which
does not check .ready and would silently change behavior for not-yet-ready specialty codes).
NEW

**Acceptance Criteria:**
- [ ] Replace the inline reimplementation at lib/packLoader.ts:269 with a call to isReadySpecialtyPackCode(lang) from lib/langRegistry.ts
- [ ] Fix code-quality issue at lib/langRegistry.ts:isSpecialtyPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts lib/packLoader.ts

**Source:** Audit finding F006 — severity 5 — code-quality

---

### Task #267: Fix code-quality: lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own modul

**File:** lib/entitlement.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
lib/entitlement.ts:208 hasAddOn (pure function) has zero production callers; its own module doc comment states it exists 'for use outside React' -- purpose-built specifically to close the F001 entitlement gap and never wired in. store/entitlementStore.ts:133 duplicates the same logic instead of delegating, breaking the in-file pattern the file's own Rule-15 comment documents. Independently found by 5 of 7 auditors. at lib/entitlement.ts:hasAddOn:208.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/entitlement.ts:hasAddOn:208
- [ ] Audit passes: bash scripts/deep-audit.sh lib/entitlement.ts

**Source:** Audit finding F007 — severity 6 — code-quality

---

### Task #268: Fix requirements: evictPack guards on isValidPackCode (PackCode = 'it'|'es', base-only) and cannot evict a s

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
evictPack guards on isValidPackCode (PackCode = 'it'|'es', base-only) and cannot evict a specialty code. Its doc comment 'any registered code can be evicted... e.g. after purchase reversal' is false for specialty packs. Independently found by 6 of 7 auditors. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F008 — severity 5 — requirements

---

### Task #269: Fix data-loss: Specialty packs are never given their own persisted storage key at all; loadSpecialtyPack

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-10

**What:**
Specialty packs are never given their own persisted storage key at all; loadSpecialtyPack never calls writeCacheData/writeCacheMeta for the specialty code itself, merging directly into the base pack's in-memory entry only. There is no separate cache entry to evict or independently re-verify even in principle, beyond the evictPack type-guard bug (F008). at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F009 — severity 6 — data-loss

---

### Task #270: Fix data-loss: evictPack never calls clearSpecialtyPacksForLang directly when evicting a base pack while

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
evictPack never calls clearSpecialtyPacksForLang directly when evicting a base pack while a specialty add-on for that language is loaded; only reached internally via clearPackCache. Evicting a base pack this way orphans the add-on's code in loadedAddOns; getLoadedAddOns() continues reporting it as active after the data it depends on has been wiped. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F010 — severity 6 — data-loss

---

### Task #271: Fix error-handling: evictPack's name implies universal pack eviction; when given a specialty code it silently

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
evictPack's name implies universal pack eviction; when given a specialty code it silently returns 'evicted nothing' with no error, log entry, or distinguishing return value to signal the no-op. Rule 8: Log Everything violation. at lib/packLoader.ts:evictPack:415.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/packLoader.ts:evictPack:415
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F011 — severity 5 — error-handling

---

### Task #272: Fix error-handling: An unchecked non-null assertion on .find()! is safe only because the sole caller pre-check

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
An unchecked non-null assertion on .find()! is safe only because the sole caller pre-checks; it would throw a raw TypeError if ever invoked without that pre-check, unlike every other path in the function, which returns typed LoadPackResult errors. Independently found by 3 of 7 auditors. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F012 — severity 4 — error-handling

---

### Task #273: Fix data-loss: The v2->v3 entitlement migration validates Array.isArray(purchasedAddOns) but not element

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
The v2->v3 entitlement migration validates Array.isArray(purchasedAddOns) but not element type or shape. Independently found by 3 of 7 auditors; exploitability currently low but flagged as a fix-before-load-bearing item. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[2] (v2->v3):153.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[2] (v2->v3):153
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F013 — severity 5 — data-loss

---

### Task #274: Fix data-loss: The same shallow Array.isArray-only validation gap identified in F013 recurs a third time

**File:** store/migrations.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
The same shallow Array.isArray-only validation gap identified in F013 recurs a third time at store/migrations.ts:133, the v1 unlockedPacks guard -- a repeating pattern within the same file, not a first occurrence. at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1] (v1 unlockedPacks guard):133.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at store/migrations.ts:ENTITLEMENT_MIGRATIONS[1] (v1 unlockedPacks guard):133
- [ ] Audit passes: bash scripts/deep-audit.sh store/migrations.ts

**Source:** Audit finding F014 — severity 4 — data-loss

---

### Task #275: Fix code-quality: lib/packLoader.ts is 428 lines, over the 400-line service cap (Rule 1), despite two prior

**File:** lib/packLoader.ts
**Complexity:** 🔧 Full — 3+ files (bringing the file under the 400-line cap requires extracting further logic into a new module and updating every caller's imports, not an in-place edit)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10

**What:**
lib/packLoader.ts is 428 lines, over the 400-line service cap (Rule 1), despite two prior extractions. at lib/packLoader.ts:N/A (file-level):428.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:N/A (file-level):428
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F015 — severity 3 — code-quality

---

### Task #276: Fix feature-flag: No feature flag gates the specialty-pack UI section in components/LanguageGrid.tsx or load

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
No feature flag gates the specialty-pack UI section in components/LanguageGrid.tsx or loadPack's specialty branch in lib/packLoader.ts. at components/LanguageGrid.tsx:LanguageGrid:109.
NEW

**Acceptance Criteria:**
- [ ] Fix feature-flag issue at components/LanguageGrid.tsx:LanguageGrid:109
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F016 — severity 4 — feature-flag

---

### Task #277: Fix tests: Tests mock getSpecialtyPacks/isSpecialtyPackCode/SPECIALTY_PACKS rather than exercising th

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
Tests mock getSpecialtyPacks/isSpecialtyPackCode/SPECIALTY_PACKS rather than exercising the real filter logic against a populated registry; the test file additionally reimplements a mock version rather than exercising the real export. at tests/langRegistry.test.ts:getSpecialtyPacks mocks:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/langRegistry.test.ts:getSpecialtyPacks mocks:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F017 — severity 4 — tests

---

### Task #278: Fix edge-case: components/LanguageGrid.tsx assumes, undocumented, that a user cannot own a specialty add-

**File:** components/LanguageGrid.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
components/LanguageGrid.tsx assumes, undocumented, that a user cannot own a specialty add-on without owning its base language; true only because Italian is always free/unlocked, not structurally enforced anywhere. at components/LanguageGrid.tsx:LanguageGrid:109.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at components/LanguageGrid.tsx:LanguageGrid:109
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.tsx

**Source:** Audit finding F018 — severity 4 — edge-case

---

### Task #279: Fix error-handling: LANGUAGE_MAP[code] ?? ITALIAN silently falls back to Italian's display config for any unre

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
LANGUAGE_MAP[code] ?? ITALIAN silently falls back to Italian's display config for any unrecognized code (e.g. a future 'es-cooking' specialty pack), with zero error signal. A second independent silent-fallback break beyond the F002 constants.ts bug, currently masked by it. Independently found by 2 auditors. at lib/language.ts:getLanguageConfig:111.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/language.ts:getLanguageConfig:111
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F019 — severity 6 — error-handling

---

### Task #280: Fix requirements: isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPac

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
isValidPackCode and isSpecialtyPackCode do not agree on what they validate: isSpecialtyPackCode does not check .ready, while packLoader.ts's inline reimplementation (F006) does. A future developer would reasonably assume isValidPackCode covers any loadable pack code; it does not, and nothing in naming or types signals this. at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/langRegistry.ts:isSpecialtyPackCode vs isValidPackCode:88
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F020 — severity 5 — requirements

---

### Task #281: Fix tests: All 4 isSpecialtyPackCode assertions run with mockSpecialtyPacks reset to length 0; Array.

**File:** tests/langRegistry.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09 (resolved as a side effect of Task #277)

**What:**
All 4 isSpecialtyPackCode assertions run with mockSpecialtyPacks reset to length 0; Array.prototype.some over an empty array returns false regardless of the predicate. The true/positive branch of isSpecialtyPackCode is never exercised anywhere in the suite. Rule 18: Test Falsifiability/B7 violation -- pseudocode test. at tests/langRegistry.test.ts:isSpecialtyPackCode assertions:1.
RESOLVED — Wave 8/Stream W8D's Task #277 fix removed the vi.mock/mockSpecialtyPacks scaffolding
entirely; tests/langRegistry.test.ts now calls the real isSpecialtyPackCode/getSpecialtyPacks/
SPECIALTY_PACKS exports directly (verified 2026-07-09: no vi.mock, no mockSpecialtyPacks anywhere
in the file). The pseudocode-mock defect this task named no longer exists. Residual gap (real
SPECIALTY_PACKS is empty in production, so the true/positive branch still can't be exercised) is
a different, narrower, currently-unavoidable limitation — not this task's defect — and is
already documented in Stream W8D's completion notes as deferred until real specialty pack data
exists.

**Acceptance Criteria:**
- [x] Fix tests issue at tests/langRegistry.test.ts:isSpecialtyPackCode assertions:1 — resolved via #277
- [x] Audit passes: bash scripts/deep-audit.sh tests/langRegistry.test.ts

**Source:** Audit finding F021 — severity 6 — tests

---

### Task #282: Fix tests: No test anywhere proves loadPack/loadSpecialtyPack itself refuses an unpurchased specialty

**File:** hooks/useLangPack.ts
**Complexity:** 🔧 Full — 3 files (same root cause and call chain as Task #261 — hooks/useLangPack.ts:68, lib/packLoader.ts, lib/specialtyPackLoader.ts — fixing the missing entitlement argument and proving it with a real test is one coordinated change, not an isolated test addition)
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09 (resolved as a side effect of Task #261)

**What:**
No test anywhere proves loadPack/loadSpecialtyPack itself refuses an unpurchased specialty pack. hooks/useLangPack.ts:68 calls loadPack(targetLang, manifest) with no entitlement argument, confirming this is unimplemented in production, not merely untested. Rule 20 violation. Independently found by 3 of 7 auditors. at hooks/useLangPack.ts:loadPack call site:68.
RESOLVED — Wave 9/Stream W9A's Task #261 implemented the entitlement gate AND added the exact
tests this finding demanded: tests/packLoader.test.ts:950 ("#261: returns invalid_lang without
fetching when specialty code is not in purchasedAddOns") and :971 ("#261: purchasedAddOns
defaults to [] when options omitted — specialty code is rejected"), both exercising the real
loadPack/loadSpecialtyPack functions directly (not mocks), each asserting the specific
"invalid_lang" error and zero additional fetch calls. Verified 2026-07-09 by reading both tests
in full. hooks/useLangPack.ts also now threads purchasedAddOns through (Task #261), so the
"unimplemented in production" half of this finding is resolved too.

**Acceptance Criteria:**
- [x] Fix tests issue at hooks/useLangPack.ts:loadPack call site:68 — resolved via #261
- [x] Audit passes: bash scripts/deep-audit.sh hooks/useLangPack.ts

**Source:** Audit finding F022 — severity 6 — tests

---

### Task #283: Fix tests: LanguageGrid.test.tsx's specialty-pack tests inject hasAddOn as a directly-controlled mock

**File:** components/LanguageGrid.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10

**What:**
LanguageGrid.test.tsx's specialty-pack tests inject hasAddOn as a directly-controlled mock prop; they never drive the real entitlementStore or the real loadPack chain. Would not catch a regression that deleted the UI lock entirely, nor the absence of data-layer enforcement. at components/LanguageGrid.test.tsx:specialty-pack test suite:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/LanguageGrid.test.tsx:specialty-pack test suite:1
- [ ] Audit passes: bash scripts/deep-audit.sh components/LanguageGrid.test.tsx

**Source:** Audit finding F023 — severity 5 — tests

---

### Task #284: Fix tests: The 'purchasedAddOns - add-on entitlement' describe block only tests bookkeeping in isolat

**File:** tests/entitlement.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-10

**What:**
The 'purchasedAddOns - add-on entitlement' describe block only tests bookkeeping in isolation, with no seam test analogous to the file's own existing 'seam: activateLicense to setEntitlement to isPackUnlocked' pattern. at tests/entitlement.test.ts:purchasedAddOns describe block:1.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/entitlement.test.ts:purchasedAddOns describe block:1
- [ ] Audit passes: bash scripts/deep-audit.sh tests/entitlement.test.ts

**Source:** Audit finding F024 — severity 4 — tests

---

### Task #285: Fix security: purchaseAddOn is an unconditional array-append with no payment, license, or receipt check

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
purchaseAddOn is an unconditional array-append with no payment, license, or receipt check of any kind, reachable by any code path since it is a plain exported store action. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F025 — severity 6 — security

---

### Task #286: Fix requirements: purchaseAddOn's name and its own comment imply a verified purchase-recording function; the

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
purchaseAddOn's name and its own comment imply a verified purchase-recording function; the implementation has no Promise return, no payment token, no verification, and has zero production callers anywhere, even as a stub. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F026 — severity 5 — requirements

---

### Task #287: Fix edge-case: purchaseAddOn never validates its code argument against isSpecialtyPackCode; unregistered

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
purchaseAddOn never validates its code argument against isSpecialtyPackCode; unregistered or malformed strings can be injected and persist forever in purchasedAddOns, and no removal path exists anywhere in the codebase. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F027 — severity 5 — edge-case

---

### Task #288: Fix async: Zustand's persist middleware writes localStorage from in-memory state at call time, not me

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
Zustand's persist middleware writes localStorage from in-memory state at call time, not merged against the on-disk value. Two browser tabs racing on purchaseAddOn for different specialty codes causes the second tab's write to silently overwrite and drop the first tab's purchase. at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F028 — severity 6 — async

---

### Task #289: Fix data-loss: Backup/restore has no purchasedAddOns field at all. Fails closed (a legitimate purchaser l

**File:** Multiple — see What (corrected during Wave 9 planning: lib/entitlement.ts does not contain the backup/restore path; the real serialization lives in lib/exportBackup.ts and lib/importBackup.ts, which defines BackupEntitlement)
**Complexity:** ⚡ Direct — 2 files (lib/exportBackup.ts, lib/importBackup.ts), no package boundary, single-scope field addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
Backup/restore has no purchasedAddOns field at all. Fails closed (a legitimate purchaser loses add-on entitlement on restore) rather than open -- not a security flaw but a real data-loss defect for a paying user. at lib/importBackup.ts:BackupEntitlement interface (line 25) and its construction at line 107; lib/exportBackup.ts:13/26-31 serializes entitlementState without a purchasedAddOns field.
NEW

**Acceptance Criteria:**
- [ ] Add `purchasedAddOns: string[]` to the `BackupEntitlement` interface in lib/importBackup.ts
- [ ] lib/exportBackup.ts includes `purchasedAddOns` in the serialized entitlement object
- [ ] lib/importBackup.ts validates/sanitizes restored purchasedAddOns using the same element-shape filter pattern Task #273 introduced in store/migrations.ts (Array.isArray check + per-element typeof === "string" filter)
- [ ] Audit passes: bash scripts/deep-audit.sh lib/exportBackup.ts lib/importBackup.ts

**Source:** Audit finding F029 — severity 4 — data-loss

---

### Task #290: Fix code-quality: The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack performs fetch() I/O, console.error() side effects, and mutates module-level loadedAddOns via push/splice/length-reset. at lib/specialtyPackLoader.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F030 — severity 3 — code-quality

---

### Task #291: Fix code-quality: The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGU

**File:** lib/langRegistry.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
The 'USED BY' header omits components/LanguageGrid.tsx despite it directly importing LANGUAGE_REGISTRY and getSpecialtyPacks. at lib/langRegistry.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/langRegistry.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/langRegistry.ts

**Source:** Audit finding F031 — severity 3 — code-quality

---

### Task #292: Fix code-quality: The header claims to be the 'single source of truth' for Pack, PackMeta, Manifest, and Loa

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
The header claims to be the 'single source of truth' for Pack, PackMeta, Manifest, and LoadPackResult, but the file also exports hasValidUnitsArray and PackMemCache, used by both packLoader.ts and specialtyPackLoader.ts. Rule 16: Enumerate Before You Assert, applied to documentation completeness. at lib/packTypes.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packTypes.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F032 — severity 3 — code-quality

---

### Task #293: Fix edge-case: hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitC

**File:** lib/packTypes.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** COMPLETE — 2026-07-09

**What:**
hasValidUnitsArray validates only Array.isArray(pack.units); it does not cross-check unitCount/cardCount against units.length, and does not validate individual unit or card element shapes. at lib/packTypes.ts:hasValidUnitsArray:1.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packTypes.ts:hasValidUnitsArray:1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packTypes.ts

**Source:** Audit finding F033 — severity 5 — edge-case

---

### Task #294: Fix requirements: getTargetLangCode's return type is declared string, implying round-trip fidelity with setT

**File:** lib/constants.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** COMPLETE — 2026-07-09

**What:**
getTargetLangCode's return type is declared string, implying round-trip fidelity with setTargetLangCode. For hyphenated codes it silently returns a truncated substring with no type-level or runtime failure signal -- a contract-lie framing distinct from F002's functional-bug framing. at lib/constants.ts:getTargetLangCode:19.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at lib/constants.ts:getTargetLangCode:19
- [ ] Audit passes: bash scripts/deep-audit.sh lib/constants.ts

**Source:** Audit finding F034 — severity 6 — requirements

---

### Task #506: Fix error-handling: StudyDoneScreen's exit-mandatory-mode button has no error handling and can permanently strand the user in a locked window

**File:** components/StudyDoneScreen.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** COMPLETE — 2026-07-28

**What:**
`components/StudyDoneScreen.tsx:37`'s onClick handler awaits `onExitInterrupt()` (bound to `exitMandatoryMode` at `app/study/page.tsx:111`) with no try/catch, unlike the two sibling call sites in `app/study/page.tsx` (lines 75 and 126), which both catch the error and unconditionally navigate regardless of outcome. This batch (Task #164-era work) formalized `exitMandatoryMode`'s throw-on-IPC-failure contract (`lib/tauriInterrupt.ts:81-90`) without auditing forward to this third consumer of the same function in the same feature area.

Concrete failure sequence (first-ever `/audit batch 19` run, Red Agent R, cycle 1): the Rust `exit_mandatory_mode` command (`src-tauri/src/interrupt.rs:183-203`) chains four `window.set_*()` calls with `?`-early-return and no rollback. An ordinary transient OS-level failure on any one call (e.g. `set_closable(true)` failing after `set_always_on_top(false)` already succeeded) causes the command to return `Err`, which `exitMandatoryMode()` turns into a thrown `Error`. Because `StudyDoneScreen.tsx:37` has no try/catch, `onHome()` never executes — the user is left on the "Review complete" screen with the mandatory-mode window lock (non-closable, non-minimizable, always-on-top) still engaged, with no visible error and no retry path. Only a force-quit recovers.

Reachable today via the ordinary post-session flow (finish a mandatory-mode review session → tap "Done") with no special setup or corrupted input required — this is why the audit scored it severity 7 despite this project's calibration rule capping most other findings in the same batch at 4-6.

**Acceptance Criteria:**
- [ ] Wrap `StudyDoneScreen.tsx:37`'s `onClick` handler in the same try/catch + unconditional-navigate pattern already used at `app/study/page.tsx:75` and `:126` (catch, log via a `console.error` ref-ID tag, then call `onHome()` regardless of outcome)
- [ ] Add a regression test to `components/StudyDoneScreen.test.tsx` that mocks `onExitInterrupt`/`exitMandatoryMode` to reject and asserts `onHome()` is still called — no test today covers this rejection path anywhere (confirmed by both Agent B and Red Agent R during the audit)
- [ ] Bundled debt item (F10, severity 3): add the same try/catch + `ERR-IPC-` ref-ID logging pattern to `enterMandatoryMode()` in `lib/tauriInterrupt.ts:74-78`, matching its 3 siblings (`updateInterruptConfig`, `snoozeInterrupt`, `exitMandatoryMode`) which already catch, log, and rethrow. Add or extend a `tests/tauri.test.ts` case asserting `enterMandatoryMode()` rejects with an `IPC failed` message on a mocked `invoke` rejection, mirroring the existing `updateInterruptConfig`/`snoozeInterrupt` IPC-error-surfacing tests.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run lint` all clean

**Source:** `/audit batch 19` (2026-07-28, first-ever audit of this batch, 8-agent cycle 1) — Finding F1 — severity 7 — error-handling. Full findings list (F1-F18) merged/scored by Agent C; F2-F18 (severity ≤6) logged to `debt.md` per this project's Audit Severity Calibration rule (AGENTS.md) rather than blocking further. F10 bundled into this task's scope per Max's decision at the Debt Review gate, 2026-07-28.

---

## Batch 20 — /meet 2026-08-06 Findings Remediation + Release Publish [COMPLETE — 2026-08-06, all 5 tasks executed same session]
Dependency: None. Generated from a full `/meet` re-examination (5 parallel agents: Architecture, Security, QA, Docs, Product). Max explicitly greenlit all 5 tasks below during the Phase 2 owner-questions pass (2026-08-06) — this batch is pre-approved, not proposed.
Theme: Cheap, high-value fixes that surfaced during this /meet run, executed before the strategic Batch 16 (Sync Backend) push begins.

### Task #509 | build | severity 8
**What:** Publish the two existing GitHub releases (`v0.1.0-beta.1` and `v0.1.0-beta.2`), both currently `draft:true`, as real public releases. Verify the release assets are intact first: real signed+notarized `.dmg` for both `aarch64`/`x86_64` macOS targets, and the Linux `.AppImage` built during Batch 15's code-complete-but-unverified work. Decide with Max whether to publish only the latest (`v0.1.0-beta.2`, which includes the Task #508 auto-updater manifest fix) or both, and whether "beta" naming/pre-release flag should stay set given no real customers exist yet (owner confirmed 2026-08-06: "no real customers yet — pre-launch").
**Why:** Product agent finding (2026-08-06 /meet): the macOS signing/notarization pipeline is fully verified working end-to-end (Task #122/#123/#508 all COMPLETE), but both releases sit as GitHub drafts — a real customer visiting the repo's release page today cannot download plyglt through any normal channel. BRAND.md's pricing table promises "Desktop app (Mac, Windows, Linux)" to Free-tier users; this is the one remaining step between a working build pipeline and an actual downloadable product.
**File:** GitHub Releases (no repo file changes expected unless `.github/workflows/release.yml`'s `draft:` setting needs flipping for future releases)
**Blocks:** Nothing | **Blocked by:** Nothing
**Risk:** Low — the artifacts are already built and independently verified (notarization confirmed via `xcrun notarytool history` per Task #123's closure). Publishing does not re-run the pipeline.
**Done when:** `gh release view v0.1.0-beta.2` (or whichever tag is chosen) shows `"isDraft": false`; the release is visible on the repo's public releases page; the `.dmg`/`.AppImage` assets are downloadable via a plain unauthenticated URL.
**Complexity:** ⚡ Direct — 0-1 files, a GitHub release-state change, no code
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-06 (published `v0.1.0-beta.2` as a pre-release, real customer-verified: unauthenticated release page returns 200, `.dmg` asset downloads 302→200. Mid-task discovery: the repo was PRIVATE, so undrafting the release alone did not achieve the actual goal — flagged to Max, who chose to make `m4x-us/plyglt` public. Ran a full git-history secret scan before that irreversible-in-effect flip — clean. See cto.md Task Cycle Log for full detail.)**

---

### Task #510 | docs | severity 6
**What:** Rewrite `STATUS.md` end to end to match verified current state, confirmed independently by three separate /meet examination agents (Architecture, Docs, Product — 3-way convergence, the highest-convergence finding this run):
- §4 Curriculum Status table: A1=20/20 (2,810 cards), A2=30/30 (5,392), B1=36/36 (7,296), B2=40/40 (14,892), **Total 126/125 units, 30,609 cards** (verified directly against `public/packs/it.json`'s `unitCount`/`cardCount` fields and `content/index.ts`'s `ALL_UNITS` length — not just trusting CURRICULUM.md's own claim).
- §1 Shipped: replace "Italian A1–B1 curriculum — 57 of 125 planned units authored" with the completed-and-audited framing CURRICULUM.md already documents. Add the M3 proactive interruption engine (Batch 14, COMPLETE 2026-07-31 — currently has ZERO mention in STATUS.md despite being BRAND.md's headline differentiator). Add the multi-language / source-language selection feature (2026-08-04/05). Update the auto-updater entry — no longer "pending signed macOS packaging," Task #122/#123/#508 are all COMPLETE with a real published release (see Task #509).
- §2 Planned: replace the stale "M2 — Desktop shipping" framing with the real current frontier — Batch 15 (Windows/Linux) code-complete but paused on Max's hardware/Azure access; Batch 16 Task #169 (real sync backend) now the active priority per Max's 2026-08-06 90-day-priority answer; real Spanish A1-B2 content authoring not started (content/es/ is a scaffold only).
- §3 Known Issues: remove the obsolete "68 curriculum units not yet authored" entry entirely. Update the next/postcss/sharp CVE entry — per Task #513 (below), this is no longer "unfixable without a major downgrade" once the `next@16.3.0` upgrade lands.
**Why:** A fresh Claude Code session, an investor, or a teammate reading only STATUS.md today would materially understate the product's real completeness — frozen since commit `fecd86c` (2026-07-01), unchanged across two later STATUS.md-touching commits that edited unrelated sections and missed the entire B1/B2 curriculum completion and M3 shipment.
**File:** `STATUS.md`
**Blocks:** Nothing | **Blocked by:** Task #513 (CVE section wording depends on that upgrade landing first — sequence #513 before finalizing §3)
**Risk:** Low — documentation only.
**Done when:** Every number in `STATUS.md §4` is verified against a live `public/packs/it.json`/`content/index.ts` read at write time, not copied from CURRICULUM.md's own prose. `grep -c "57 of 125\|68 curriculum units"  STATUS.md` returns 0.
**Complexity:** ⚡ Direct — 1 file, doc rewrite
**Owner:** Docs Agent
**Status: COMPLETE — 2026-08-06 (rewrote §1/§2/§3/§4, light-touch §5. Real numbers verified live against public/packs/it.json + content/index.ts, not copied from CURRICULUM.md — caught and corrected a 219-card B2 discrepancy in CURRICULUM.md's own stale prose along the way. `grep -c "57 of 125\|68 curriculum units" STATUS.md` = 0. Committed as `c63ebad`. See cto.md Task Cycle Log for full detail.)**

---

### Task #511 | docs | severity 4
**What:** Remove Vacation Mode and Forecast ("B2 in ~7 months at current pace") from BRAND.md's Pro pricing table. Confirmed dead: `lib/featureFlags.ts`'s `vacationMode` flag has zero consumers anywhere outside its own definition and test mocks (`grep -rn "flags.vacationMode\|vacationMode"` outside `lib/featureFlags.ts` returns nothing); Forecast has zero code anywhere in the repo (`grep -rn "at current pace\|B2 in ~"` returns nothing). Do not delete the `vacationMode` flag itself in this task — that's a separate code-cleanup decision; this task is scoped to the pricing table only, per Max's explicit choice (2026-08-06: "pull from pricing table for now," not "build them").
**Why:** BRAND.md is selling two Pro features that do not exist in any form. Cheapest time to fix this is now, before any real paying customer exists (Max confirmed 2026-08-06: no real customers yet). Leaving false promises in the pricing table past first launch is a much costlier fix (an actual paying customer could notice).
**File:** `BRAND.md`
**Blocks:** Nothing | **Blocked by:** Nothing
**Risk:** Low — documentation only. Re-add both rows the moment either feature actually ships.
**Done when:** `grep -n "Vacation mode\|Forecast" BRAND.md` shows no pricing-table row for either (mentions elsewhere in BRAND.md discussing the *concept*, e.g. the Stress-Free Principle's vacation-mode paragraph, may stay — only the pricing table row and the feature-comparison table entry are in scope).
**Complexity:** ⚡ Direct — 1 file, doc edit
**Owner:** Docs Agent
**Status: COMPLETE — 2026-08-06 (removed both pricing-table rows; the Stress-Free Principle's vacation-mode concept paragraph at line 71 left untouched. `grep -n "Vacation mode\|Forecast" BRAND.md` shows only that paragraph, no pricing-table row. Committed as `786a4ad`.)**

---

### Task #512 | fix | severity 6
**What:** Fix a reproducible flaky test in `tests/importBackup.test.ts`. Root cause: `validBackup()` (line 33) computes its default nested card's `dueDate` as `Date.now() + 86400000` fresh on every call. Two tests (`#481/#487`, ~lines 452 and 459-460) each call `validBackup(...)` twice independently — once for a numeric `_version`, once for the string equivalent — then deep-`toEqual` the two full parsed results, including the embedded `dueDate` field. If a millisecond boundary falls between the two `validBackup()` calls, the two `dueDate` values differ by 1-2ms and the assertion fails. **Reproduced live during this /meet run's QA examination**: failed on a full `npm test` run, then failed again independently on a targeted re-run of just this file, before passing clean on two subsequent runs — a genuine, nondeterministic CI hazard, not a one-off. Fix: change `validBackup()`'s default `dueDate` (line 33) to a fixed constant (e.g. a hardcoded epoch literal) instead of a `Date.now()`-derived value. This does not affect the one test that legitimately needs dynamic `Date.now()` behavior (`"defaults dueDate to approximately now when value is not a finite number"`, lines 251-265) — that test constructs its own override with `dueDate: "invalid"` and never goes through `validBackup()`'s default value.
**Why:** QA finding, 2026-08-06 /meet, severity 6. Max confirmed 2026-08-06: fix now — "small, contained, root-cause pattern already proven elsewhere in the same file."
**File:** `tests/importBackup.test.ts`
**Blocks:** Nothing | **Blocked by:** Nothing
**Risk:** Low — test-only change, no production code touched.
**Done when:** `npx vitest run tests/importBackup.test.ts --repeat=20` (or equivalent repeated-run flag) passes 20/20 with no flake. `npm test` full suite still green.
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Status: COMPLETE — 2026-08-06 (validBackup()'s dueDate default changed from Date.now()+86400000 to a fixed constant. Verified with 20 sequential runs of the file, 68/68 passing every time — not just one lucky pass. Full suite 1546/1546. Committed as `24d9aaf`.)**

---

### Task #513 | security | severity 4
**What:** Upgrade `next` from the currently-locked `16.2.12` to `16.3.0` (already permitted by `package.json`'s existing `^16.2.12` range — no `package.json` edit needed, just `npm install`/`npm update next` to refresh `package-lock.json`). This resolves all 3 current high-severity `npm audit` advisories (`next`, `postcss`, `sharp`) — verified empirically during this /meet run's Security examination: a fresh isolated install of `next@16.3.0` bundles patched `postcss@8.5.23` and `sharp@0.35.3`, and `npm audit` on that install reports 0 vulnerabilities.
**Why:** STATUS.md's Known Issues section currently claims these 3 CVEs are "unfixable without a major Next.js downgrade" — that claim is now stale; a real fix has shipped upstream since it was last checked. Max confirmed 2026-08-06: do it now, given the near-zero risk (patch-level Next.js bump, zero `package.json` range change).
**File:** `package.json` (lockfile only, no version-range edit expected), `package-lock.json`
**Blocks:** Task #510 (STATUS.md's CVE wording should reflect this being fixed, not just fixable — sequence this task first)
**Blocked by:** Nothing
**Risk:** Low-Medium — a patch-level Next.js bump; run the full verification gate (`npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`) before considering this done, since even patch bumps have occasionally shifted Next.js build output in this project's history.
**Done when:** `npm audit --json` reports 0 vulnerabilities. `npx tsc --noEmit`, `npm test`, `npm run lint`, and a real `npm run build` all pass clean. `STATUS.md`'s CVE entry (Task #510) is updated to reflect the fix, not left describing it as impossible.
**Complexity:** ⚡ Direct — 2 files (lockfile + manifest, no source code), dependency bump
**Owner:** Security Agent
**Status: COMPLETE — 2026-08-06 (npm audit 0 vulnerabilities, was 3 high. Full gate green: tsc, 1546/1546 tests, lint, real `next build`. package.json unchanged, package-lock.json refreshed. Committed as `bdf742e`. See cto.md Task Cycle Log for full detail.)**

---

## Batch 21 — Interrupt Trigger & Cross-Device Scheduling Redesign [COMPLETE — 2026-08-13, all 10 tasks closed via /advance across 3 waves]
Dependency: None — self-contained redesign of the existing interrupt engine plus new Supabase infra, doesn't block or get blocked by any other open batch. `docs/INTERRUPT_ARCHITECTURE.md` is now APPROVED; all 4 open questions resolved same day (90-minute unified interval, 500ms–1s gate-check timeout, fire-anyway-on-timeout fallback, DND/waking-hours merged into one shared setting). Ready for `/task` or `/advance`.

Theme: two real bugs found live during Task #166's Windows VM testing (desktop's unlock/wake/idle bypass the interrupt interval entirely — no spacing at all; the interval clock advances even when a check finds nothing due) turned into a design conversation about what "due" should mean, which surfaced that mobile's not-yet-shipped push pipeline (Task #170) already solved this correctly and desktop should match it, plus a real gap: nothing coordinates interrupt timing across a Pro user's multiple synced devices. Full reasoning and schema in `docs/INTERRUPT_ARCHITECTURE.md`.

**Ordering / parallelism (optimized for `/advance`):**
- **Wave 1 (fully parallel, no cross-dependencies, distinct files):** #523, #524, #525.
- **Wave 2 (each depends on exactly one Wave-1 task, otherwise parallel):** #526 (needs #524), #527 (needs #525), #528 (needs #525).
- **Wave 3 (each depends on two Wave-2 tasks, but touch different files from each other — parallel):** #529 (needs #526 + #528), #530 (needs #528).
- **Independent leaves, no dependency on the waves above, ready any time:** #531, #532 (both were gated on Max's open-question answers — resolved 2026-08-13).
- #524 deliberately spans both `interrupt.rs` and `os_events.rs` as one task rather than being split further — they share the exact same interval/clock state, and this codebase has already been burned once (Wave 17, see `.autocode/agents/cto.md`'s Open Escalations #0.5) by splitting tightly-coupled shared-state changes across parallel streams that individually looked file-isolated.

### Task #523 | correctness | severity 5
**What:** `hooks/useInterruptConfig.ts`'s `computeDue()` only sums `store/srsStore.ts`'s `getStats(unitCards).due` (cards with `reps > 0 && isDue(now)`). Extend it to also count cards due via `getIntroductionDueCardIds` (the intensive introduction cadence) and qualifying new cards via `getNewCards` — the same content `lib/queue.ts`'s `buildQueue` already pulls in for a session, just missing from the fire-gate.
**Why:** Today, on a day where a user has only an introduction-phase card needing its next appearance (per BRAND.md's "appears every interrupt on Day 1" cadence table) and zero traditional FSRS reviews due, `computeDue()` returns 0 and the interrupt never fires — silently breaking the introduction engine's own cadence promise. See `docs/INTERRUPT_ARCHITECTURE.md` §2.
**File:** `hooks/useInterruptConfig.ts`, `hooks/useInterruptConfig.test.ts` (new or extended)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, single-scope logic fix
**Blocked by:** Nothing | **Blocks:** Nothing (independent of the rest of this batch)
**Done when:** A test proves `computeDue` returns non-zero when the only due content is an introduction-cadence card or a qualifying new card (today's implementation would return 0 for both — this is the Deletion Test). `npx tsc --noEmit`, full test suite, lint all clean.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W1B/Barry. `computeDue` now also counts introduction-due cards and at most 1 qualifying new card, gated by `canIntroduceNewCard`. 9 new tests. Also fixed a mechanical ripple: `components/InterruptHandler.test.tsx`'s srsStore mock needed 3 new no-op stubs since `computeDue`'s real implementation now calls them — not this task's owned file, but required to keep the full suite green. `npm test` 1834/1834, `tsc`/`lint` clean.)

---

### Task #524 | correctness | severity 6
**What:** Two coupled fixes to the desktop interrupt engine's Rust core, landed together: (1) unlock/wake/idle-return (`src-tauri/src/os_events.rs`, all three platform blocks — macOS poll loop, Windows wndproc, Linux D-Bus handlers) currently bypass `interval_secs` entirely per the module's own comment ("OS events intentionally bypass interval_secs") — add the same interval-elapsed gate the scheduled poll (`interrupt.rs`) already uses, so an OS event is a *check-in moment* against the schedule, not an independent trigger. (2) The "last fired" clock currently advances the instant a check happens (`interrupt.rs`'s poll loop sets `last_triggered_secs = now` before the JS layer even evaluates due-count; `os_events.rs`'s `emit_interrupt` helper does the same on every OS-triggered emit) — stop advancing it automatically on emit. Add a new Tauri command (e.g. `mark_interrupt_fired`) that becomes the *only* thing that advances `last_triggered_secs`, called by the JS layer only when it actually shows real content (wired in Task #526).
**Why:** Without (1), lock your screen 15 times a day with anything due each time and you get 15 interrupts, not 6–10 — the core complaint that started this whole redesign. Without (2), an empty check (nothing due) silently spends a full interval for nothing, pushing the next *possible* interrupt further out than intended — the opposite failure mode, also wrong. See `docs/INTERRUPT_ARCHITECTURE.md` §3–§4.
**File:** `src-tauri/src/interrupt.rs`, `src-tauri/src/os_events.rs`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no matched scope-trigger word (rubric-mechanical label; real coupling risk across 3 platform blocks noted in the batch header's parallelism rationale, not reflected by this label alone)
**Blocked by:** Nothing | **Blocks:** #526
**Done when:** New unit tests (matching `os_events.rs`'s existing pure-guard-function test pattern) prove: an OS event with `now - last_triggered < interval_secs` does not fire even when due; a scheduled or OS-triggered check that finds nothing due does not change `last_triggered_secs`. `mark_interrupt_fired` command exists and is the only writer of `last_triggered_secs`. `cargo check`/`cargo test` clean on macOS host (does not compile-check Windows/Linux `cfg` blocks — same caveat as Tasks #166/#167; a real CI build on each target is still required before calling this done end-to-end).
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W1A/Adam. New shared `interval_elapsed()` gate used by both the scheduled poll and all 3 platforms' OS-event handlers in `os_events.rs`. New `mark_interrupt_fired` Tauri command is now the sole writer of `last_triggered_secs`; the poll thread and `emit_interrupt()` no longer touch it. 17 new/extended Rust tests, 35/35 total pass. Known, scoped interim state until Task #526 wires the JS caller: the scheduled poll can still re-emit every 30s once the interval elapses, since nothing calls `mark_interrupt_fired` yet — matches the architecture doc's own model, not a bug.)

---

### Task #525 | infrastructure | severity 5
**What:** New Supabase migration creating the `interrupt_gate_events` table — one append-only row per real "fired" or "snoozed" event, per user, reusing the exact conflict-resolution pattern `supabase/migrations/20260806000000_review_events.sql` already established (append-only, not a mutable current-state row) rather than inventing a new one.
**File:** New file under `supabase/migrations/`
**Why:** The shared per-user gate every device (desktop OS events, desktop scheduled poll, mobile cron dispatch) will check before firing and write to after firing. See `docs/INTERRUPT_ARCHITECTURE.md` §5 for the full schema and reasoning (why append-only, not last-write-wins).
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 new SQL file, schema only, no application code
**Blocked by:** Nothing | **Blocks:** #527, #528
**Done when:** Migration matches the schema in `docs/INTERRUPT_ARCHITECTURE.md` §5 (`id`, `user_id`, `event_type` check-constrained to `'fired'`/`'snoozed'`, `occurred_at`, `effective_until`, `device_id`, `created_at`). RLS enabled, scoped to `auth.uid() = user_id` for select/insert (matches `push_tokens`' policy shape — a user only ever sees/writes their own rows; no update/delete policy needed, append-only). Migration applies cleanly against a local/staging Supabase instance.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W1C/Charles. `supabase/migrations/20260813000000_interrupt_gate_events.sql` — matches the doc's schema exactly, plus a `(user_id, effective_until desc)` index for the hot-path read. Verified by hand against a real local Postgres instance (Supabase CLI unavailable in this environment) — table/index/constraints/RLS policies all confirmed via `\d` and `pg_policies`, plus a re-run idempotency check. Blocks #527/#528, both now unblocked.)

---

### Task #526 | feature | severity 5
**What:** `components/InterruptHandler.tsx`'s `interrupt:fire` handler calls the new `mark_interrupt_fired` Tauri command (Task #524) at the exact point it decides to actually show content — after the `totalDue === 0` early-return, for both the mandatory and passive-notification paths.
**Why:** Closes the loop Task #524 opens: the Rust side stops auto-advancing the clock on emit, so nothing advances it at all until this task wires up the confirmation. Both tasks are needed together for the desktop clock semantics to actually work end to end.
**File:** `components/InterruptHandler.tsx`, `components/InterruptHandler.test.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, one new IPC call at an existing decision point
**Blocked by:** #524 | **Blocks:** #529
**Done when:** A test proves `mark_interrupt_fired` is called exactly when real content is shown (both mandatory and passive branches) and NOT called when `totalDue === 0` short-circuits. `npx tsc --noEmit`, full test suite, lint clean.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W2A/Adam. New `lib/tauriInterrupt.ts` export `markInterruptFired(): Promise<void>` — no args, matches the file's existing 4-sibling wrapper pattern (log-and-throw on IPC failure). Called from `InterruptHandler.tsx` right after the `totalDue === 0` guard, covering both mandatory and passive paths with one call site. Necessary scope extension beyond the brief's owned-files list: `lib/tauriInterrupt.ts` + its own test file `tests/tauri.test.ts` — required by CLAUDE.md's Layer Map (components must route Tauri IPC through `lib/`, never call `invoke()` directly) and by AGENTS.md's zero-test-coverage stop-the-line rule for new production code; no collision with Barry/Charles's Wave 2 files. `npm test` 1863/1863 at this stream's own finish time.)

---

### Task #527 | feature | severity 5
**What:** `supabase/functions/send-interrupt-notifications/dueSelection.ts`'s `selectDueTokens` currently gates on `push_tokens.last_sent_at` (per device-token). Change it to read `interrupt_gate_events` (per user, Task #525) instead. `dispatch.ts` writes a `fired` event to the same table on a real send, instead of (or in addition to, if `last_sent_at` is kept as a device-registration diagnostic only) updating `push_tokens.last_sent_at`.
**Why:** Without this, mobile push and desktop remain on two completely separate clocks even after Task #525's table exists — the cross-device coordination problem isn't actually solved until mobile's dispatch reads/writes the same shared state desktop will. See `docs/INTERRUPT_ARCHITECTURE.md` §5.
**File:** `supabase/functions/send-interrupt-notifications/dueSelection.ts`, `dispatch.ts`, and their Vitest-tested counterparts (`tests/` or co-located, per this directory's existing pure-function-testing pattern — see `index.ts`'s own header on why Deno-only wiring is excluded from `tsc`)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (2 source + their 2 test counterparts), changes the core dispatch-gating query
**Blocked by:** #525 | **Blocks:** Nothing (mobile has no production caller yet — Tasks #171/#522/#172)
**Done when:** `selectDueTokens` (or its replacement) queries `interrupt_gate_events` per user, not `push_tokens.last_sent_at` per token. Tests prove a user with a recent `fired` event (from ANY device) is excluded even if their specific token's own `last_sent_at` is old/null. Existing dispatch tests still pass.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W2B/Barry. `selectDueTokens` gained a `gateStateByUser` map param and no longer reads `token.last_sent_at` for the due decision at all — a recent gate event from ANY device now excludes all of that user's tokens. `dispatch.ts` writes a `fired` event via new `recordGateFired` only after a confirmed send. `push_tokens.last_sent_at` deliberately KEPT (not removed, not merely diagnostic) — still the atomic CAS field preventing double-claiming the same token within one 5-min cron tick, a distinct concern from the new per-user cross-device gate. One documented, deliberate tradeoff: `fetchGateStateForUsers` fails open on a read error (not logged as debt — reasoned safety net explained inline). Necessary scope extension into `supabaseAdmin.ts`/`index.ts`/`types.ts` (this directory's DB-access layer, required to make the feature real) — no collision with Adam/Charles's Wave 2 files. `npm test` 1880/1880 at combined-state verification.)

---

### Task #528 | feature | severity 5
**What:** New pure client-side module (e.g. `lib/interruptGate.ts`, no React/Zustand — matches `lib/syncClient.ts`'s existing pattern) exposing a read function ("what's the most recent `effective_until` for this user") and a write function ("record a `fired`/`snoozed` event"), both plain authenticated Supabase REST calls against `interrupt_gate_events` (Task #525) — reusing desktop's existing authenticated Supabase session from Task #169, no new auth plumbing. Read calls use a short, non-blocking timeout (starting point 500ms–1s per `docs/INTERRUPT_ARCHITECTURE.md` §6 — Max hasn't explicitly confirmed this exact number, using the doc's own proposed default; easy to tune later, not a hard blocker) with a documented fallback contract (caller decides what to do on timeout — this module just surfaces "gate state" or "unknown, timed out," it doesn't itself decide fire-vs-suppress).
**Why:** The shared-gate read/write logic needs to live somewhere both the OS-event path and the snooze button can call — a dedicated `lib/` module keeps it testable in isolation (mocked Supabase calls) rather than duplicated inline in two different UI entry points.
**File:** New `lib/interruptGate.ts`, `lib/interruptGate.test.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no UI wiring yet (that's #529/#530)
**Blocked by:** #525 | **Blocks:** #529, #530
**Done when:** Read function returns the gate state or an explicit timeout/unknown signal within the configured timeout, tested with a mocked slow/failing Supabase client. Write function correctly computes `effective_until` for both `fired` (occurred_at + interval) and `snoozed` (occurred_at + snooze minutes) event types. No React, no Zustand imports (matches CLAUDE.md's Layer Map for `lib/`).
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W2C/Charles. Exports `readInterruptGateState(userId, timeoutMs = 750)` and `recordInterruptGateEvent({userId, deviceId, eventType, occurredAt, minutesUntilEligible})` — exact signatures for Wave 3's #529/#530 to call. Read returns `{status:"known", effectiveUntil}` or an explicit `{status:"unknown", reason}` on timeout/error, never guesses fire-vs-suppress itself (that's the caller's job per §6). Default timeout 750ms — midpoint of the confirmed 500ms–1s range. 13/13 new tests, 100% coverage on the new file. Followed `lib/syncClient.ts`'s established gateway pattern.)

---

### Task #529 | feature | severity 6
**What:** Wire Task #528's gate-check into desktop's actual firing decision: before firing (OS event or scheduled poll path), check the shared gate via `lib/interruptGate.ts`; on timeout/unknown, fall back to local last-known state and fire anyway (per `docs/INTERRUPT_ARCHITECTURE.md` §6's recommendation — fire-anyway-on-timeout over suppress-on-timeout, flagged in the doc as something Max should sanity-check, not yet a hard confirmation). On an actual fire with content, write a `fired` event via #528.
**Why:** This is the task that actually makes cross-device coordination real — #525/#527/#528 build the pieces, this is where desktop starts using them for real firing decisions instead of only its local clock.
**File:** `components/InterruptHandler.tsx` (or a new co-located hook if this pushes the file past its size cap, matching the project's existing extraction pattern for oversized files)
**Severity:** 6 | **DoD Tier:** 3
**Complexity:** ⚡ Direct — 1 file, no matched scope-trigger word (rubric-mechanical label; genuinely cross-cutting in effect since it's the task that makes #526/#528 actually load-bearing, not reflected by file count alone)
**Blocked by:** #526, #528 | **Blocks:** Nothing
**Done when:** Tests prove: a fresh `fired` event from another device (simulated) suppresses a local fire that would otherwise have happened; a gate-check timeout still allows a local fire (fire-anyway fallback); a real local fire writes a `fired` event. Full verification gate clean.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W3A/Adam. `InterruptHandler.tsx`'s `interrupt:fire` handler now reads the shared gate before firing (suppresses on a still-future `effectiveUntil` from any device; falls through to firing on timeout/unknown/no-history/signed-out, per the confirmed fire-anyway policy) and fire-and-forget writes a `fired` event after a real local fire. Necessary scope extension: `hooks/useInterruptConfig.ts` gained `userId`/`deviceId` passthrough — required by the Layer Map, since `components/` can't import `store/` directly. 8 new tests covering all 3 DoD scenarios plus edge cases. `npm test` 1889/1889 at this stream's own finish time.)

---

### Task #530 | feature | severity 5
**What:** Desktop's snooze action (currently `lib/tauriInterrupt.ts`'s `snoozeInterrupt`, which only ever touches local in-memory Rust state via `interrupt.rs`'s `snooze_interrupt` command) also writes a `snoozed` event via Task #528's write function, so a snooze on one device is visible to every other device (including, once mobile ships, a phone) via the same shared gate.
**Why:** Without this, a user who snoozes on their phone gets no relief on their desktop a few minutes later, and vice versa — directly the scenario Max raised. This is a genuinely new capability for mobile (which has no snooze concept at all today), not just syncing an existing one. See `docs/INTERRUPT_ARCHITECTURE.md` §8.
**File:** `lib/tauriInterrupt.ts`, `app/study/page.tsx` (the "Snooze X min" button call site), relevant test files
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (2 source + their 2 test counterparts)
**Blocked by:** #528 | **Blocks:** Nothing
**Done when:** Clicking Snooze writes a `snoozed` event with the correct `effective_until` (now + snooze minutes). A test proves a device checking the gate shortly after respects a snooze event it didn't itself create (simulated as if from another device).
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W3B/Barry. `snoozeInterrupt` gained an optional `gateContext` param — local Rust snooze runs first, unchanged; the shared-gate write is purely additive and never blocks or throws on failure. New `hooks/useSnoozeAndExit.ts` extracted (necessary scope extension flagged by architect memory: `app/study/page.tsx` was already at 149/150 lines) — net result the route actually shrank to 148 lines while gaining the feature. Cross-device semantics proven end-to-end with a real (non-mocked) `lib/interruptGate.ts` against a fake in-memory Supabase client — device-A's snooze read back by a caller with no device context, exact `effectiveUntil` asserted via fake timers, plus per-user scoping confirmed. `npm test` 1902/1902.)

---

### Task #531 | product-decision | severity 3
**What:** Unify desktop's `interrupt.rs` `interval_secs` default (currently 3 hours) with mobile's already-correctly-calibrated `push_tokens.interrupt_interval_minutes` default (90 minutes — lands at ≈8.7 interrupts over a 13-hour waking window, matching BRAND.md's 6–10/day target; desktop's 3-hour default only reaches ≈4.3/day over the same window).
**Why:** Two independently-picked numbers for what should be one product-level cadence decision. See `docs/INTERRUPT_ARCHITECTURE.md` §7 and Open Question 1.
**File:** `src-tauri/src/interrupt.rs` (default), `store/settingsStore.ts` / `store/migrations.ts` (if a version bump is needed for existing users' persisted default)
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — default-value change, not a structural one
**Blocked by:** Nothing — **RESOLVED 2026-08-13: Max confirmed 90 minutes, unified across both platforms.** | **Blocks:** Nothing
**Done when:** Desktop's default is 90 minutes. Existing users' already-persisted custom interval settings are untouched (this only changes the *default* for new installs / never-configured users).
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W1A/Adam. `interrupt.rs`'s default is now `90 * 60`; `settingsStore.ts`'s `INTERVAL_OPTIONS` extended to include 1.5h with `intervalHours` defaulting to it. No version bump needed — default-value-only change, zustand's `persist` only applies the `create()` default when no persisted state exists at all. Existing users' custom settings untouched, confirmed by a dedicated fresh-module-import test.)

---

### Task #532 | product-decision | severity 4
**What:** Merge desktop's DND start/end (`store/settingsStore.ts`) and mobile's waking-hours window (`push_tokens.waking_hours_start_local`/`_end_local`) into one literally-shared, synced setting.
**Why:** Same practical effect for a single contiguous window today, but they're framed oppositely (DND = "don't interrupt during this window" vs. waking hours = "only ever interrupt during this window") and nothing currently ties them together across platforms. See `docs/INTERRUPT_ARCHITECTURE.md` §7 and Open Question 4.
**File:** `store/settingsStore.ts`, `store/migrations.ts`, `push_tokens` schema, UI in `app/settings/page.tsx`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — a real schema/sync decision, not a default tweak
**Blocked by:** Nothing — **RESOLVED 2026-08-13: Max confirmed merge into one shared, synced setting** (not "keep separate"). | **Blocks:** Nothing
**Done when:** One synced setting governs both desktop and mobile's quiet-hours behavior, replacing the two independent concepts. `docs/INTERRUPT_ARCHITECTURE.md`'s "Open questions" section already reflects this decision.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-13** (Stream W1A/Adam. `store/settingsStore.ts`'s `dndStart`/`dndEnd` are now documented as the single canonical shared quiet-hours setting; default realigned to `"21:00"`/`"08:00"` — the exact complement of mobile's waking-hours default (8–21), fixing a prior 1-hour misalignment between the two platforms. New pure conversion helpers `dndWindowToWakingHours`/`wakingHoursToDndWindow` bridge desktop's "HH:MM" shape and `push_tokens`' whole-hour smallint columns, ready for the future desktop sync layer to call — no live cross-device write-through exists yet, since that layer isn't built (correctly not overclaimed in UI copy). Wire shape/signature of `dndStart`/`dndEnd`/`isInDnd()` deliberately UNCHANGED — Adam could not touch `hooks/useInterruptConfig.ts`/`InterruptHandler.tsx` (owned by other streams), so the semantic coupling flagged by pre-wave analysis (§532→#526/#527/#529) is resolved by preserving the existing contract rather than by coordinating a breaking change.)

---

## Batch 22 — Interrupt Content-Supply Floor [COMPLETE — 2026-08-14]
Dependency: Batch 21 complete (cross-device gate live). Theme: close a real gap live Task #166 Windows testing surfaced — the interrupt engine could go completely silent on a day with nothing FSRS-due, contradicting BRAND.md's literal "6-10 interrupts every day" promise. Spawned mid-session, not pre-planned; registered here after the fact per this project's own convention for live-discovered work.

### Task #533 | feature | severity 7
**What:** Live Windows VM testing (Task #166) hit a real scenario: 2 hours locked, nothing FSRS-due, unlock produced no fire at all — `components/InterruptHandler.tsx`'s `if (totalDue === 0) return;` treated "nothing due" as "skip the lesson entirely." Max's explicit product decision, captured via a structured multiple-choice design conversation: (1) 6-10 interrupts/day is a **hard floor**, never fewer, for every user including day one; (2) when today's normal supply (FSRS due + introduction cadence + the one-new-card cap) is empty, **prefer introducing another new card** over replaying old content; (3) the daily new-card cap should **flex upward** whenever needed to avoid an empty day, rather than staying fixed at 1.
**Why:** BRAND.md's core numeric claim ("6–10 minutes... enough to reach B2 in 2.5 years") assumes a *reliable* daily minimum, not an average that can silently hit zero for a caught-up user. This was live-verified as a real, reachable gap, not a hypothetical.
**File:** `store/srsStore.ts` (`canIntroduceNewCard` gains an optional `maxPerDay` param, default 1 — preserves normal behavior everywhere except the flex path), `hooks/useInterruptConfig.ts` (`computeDue` flex fallback — counts any untouched, prerequisite-met card when the day's normal supply is otherwise 0), `hooks/useStudySession.ts` (mount-effect performs the matching flexed introduction, scoped to `isInterrupt` so a manually-opened Global Review still shows the normal empty state), `app/study/page.tsx` (fixed a real display bug this exposed: the empty-queue guard was checking the stale `initialQueue` memo instead of the hook's live `queue` state, so even a successful flex introduction would still have rendered "Nothing ready.")
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files, core scheduling logic
**Blocked by:** Nothing | **Blocks:** Nothing
**Done when:** `computeDue` returns non-zero when the only content available is an untouched card past the normal 1/day cap. The mount-effect flex fallback fires only when `isInterrupt` and the session would otherwise be empty. `app/study/page.tsx` renders real content instead of the empty-queue screen once the flex fallback succeeds.
**Owner:** Architecture Agent
**Status: COMPLETE — 2026-08-14.** Built same session as the design conversation, full gate green (`npx tsc --noEmit` clean, 1914/1914 tests passing — 12 new tests across 4 files, `npm run lint` 0 new errors, coverage above thresholds). Committed as `feat: guarantee 6-10 daily interrupts — never skip a lesson for lack of due content` (commit `7649411`). **Live-verified on the real Windows VM the same session**, on a fresh `v0.1.0-beta.12` build: an unlock with nothing FSRS-due correctly fired and introduced new content instead of staying silent — confirmed via the shared `interrupt_gate_events` gate and direct observation (see Task #166's log for the follow-on foreground-forcing finding this same test surfaced, tracked separately).

---

## Batch 23 — Interrupt Session Size Floor (6 cards) + Server Push Content Floor [CURRENT SPRINT]
Dependency: Batch 22 complete. Theme: the first real-iPhone push test (Task #522 live verification, 2026-08-14 evening) surfaced that Batch 22's floor guarantees a NON-EMPTY interrupt session but not a SUBSTANTIVE one — a caught-up user can get a 10-second, 1-card session, contradicting BRAND.md's "3-5 cards" framing and feeling broken (Max's words: "way too small"). Owner decision captured same evening via structured AskUserQuestion (three rounds, science-grounded — retrieval-count math, Cowan's ~4-chunk working-memory limit for new items, and the discovery that BRAND's own intro cadence table means 1 new card/day yields ~28 intro appearances/day at steady state, so starvation is a cold-start/post-vacation phenomenon):

**The ratified spec — every INTERRUPT session:**
- **Floor: 6 cards** (the largest floor that fits the ratified 45-90-second target at 8-15s/card). Target 6, never fewer when the catalog allows.
- **Duration target: 45-90 seconds** (BRAND.md's "under a minute" ceiling framing becomes a 45-90s target range — minor BRAND.md wording update).
- **Fill order when the day's normal supply falls short:** (1) intro-engine appearances already owed today, (2) flex-introduce NEW cards — **hard cap 3 new per session** (working-memory limit, non-negotiable), (3) pull near-due FSRS reviews slightly early. "More new cards" as primary fill is deliberate (Max's choice): starvation is cold-start-shaped, exactly when extra intros are pure ramp-up with no review load to compete.
- **90-minute interval and 6-10/day cadence: unchanged.** (The "5-6 minute" push in the live test was manual test-forcing — the gate was verified working.)
- **Server dispatch floor:** `send-interrupt-notifications` must never `skippedNoCards` an active registered user — the client fills the session; the server's due estimate is a lower bound and must not be a send/no-send gate (closes the debt row logged 2026-08-14).

**Status: COMPLETE — 2026-08-14, same evening.** Shipped: `lib/queue.ts` gains `INTERRUPT_SESSION_FLOOR` (6), `INTERRUPT_SESSION_MAX_NEW` (3), and `INTERRUPT_SESSION_CAP` (8 — replacing app/study/page.tsx's old `INTERRUPT_CARD_LIMIT` of 5, which sat BELOW the new floor); `lib/srs.ts`'s `selectQualifyingNewCard` gains an `excludeIds` param so one fill pass can pick several distinct new cards against a stale introductions snapshot; `store/srsStore.ts` gains `getNearDueCards(unitCards, limit)` (studied, not-yet-due, soonest-due first); `hooks/useStudySession.ts`'s mount effect is now a two-phase fill (normal 1/day intro for every session type, then interrupt-only fill: flex new cards ≤3/session gated on the stranded pause via `canIntroduceNewCard(today, MAX_SAFE_INTEGER)`, then near-due, then the #533 never-empty backstop); `hooks/useInterruptConfig.ts`'s computeDue mirrors the near-due fill so the fire-gate never stays silent in a servable scenario; server `buildNotificationPayload` floors the announced count at 6 and never returns null, `dispatch.ts`/`types.ts` drop `skippedNoCards` entirely (the zero-estimate skip was the mobile version of the exact gap #533 closed on desktop — closes the debt row logged earlier today); BRAND.md updated (6-8 cards / 45-90s, corrected working-memory science — Cowan ~4 chunks caps NEW items at 3/session, reviews are not WM-bound — and the daily-cap paragraph now describes the cold-start flex honestly). Verification gate green: tsc clean, 1937/1937 tests (23 new: 6 session-floor, 2 getNearDueCards, 1 computeDue near-due, server payload/dispatch rewrites), lint 0 errors, weak-assertion grep clean. Edge function redeployed to prod (config.toml's verify_jwt=false honored — no flag needed) and sanity-invoked: new summary shape live, `total: 0` correctly produced by the still-active 90-minute gate from the evening's real-device test.

---

**`/audit 23` — 2026-08-15, FAIL, severity 7 (2 critical, 4 major, 22 minor), 8-agent cycle (A, B, S, K, W, V, R + Agent N naive-reader lane).** Highest-convergence finding (independently found by 4 of 8 agents — A, B, W, R): `components/InterruptHandler.tsx`'s desktop passive notification still announces the raw, un-floored `computeDue()` count while the session that opens now always holds ≥6 cards — the exact defect this batch fixed on the server (`dueEstimate.ts`) but never touched on desktop; the sibling test file (`InterruptHandler.test.tsx`) actively pins the stale "1 card ready" text. Two severity-7 findings (F011/F012): the server push's floor-at-6 has no matching ceiling, so a backlog day announces MORE cards than the client's 8-card cap can ever deliver, and a genuinely-zero-history new Pro signup's very first interrupt gets a "6 cards ready" push while the real session (empty near-due pool, flex capped at 3) delivers at most 3. Full findings promoted below as Tasks #534-#561. Per this project's BATCH_REMEDIATION_GATE, Batch 23 is reopened as `[CURRENT SPRINT]` until a re-audit passes.

<!-- BATCH_REMEDIATION_GATE: batch=23; paused_batch=none; paused_batch_old_tag="" -->

### Task #534: Fix requirements: desktop passive notification never applies the session-floor treatment its mobile sibling now gets

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P2

**What:**
Desktop passive notification body uses raw `computeDue()` (`totalDue`) verbatim, never floored to `INTERRUPT_SESSION_FLOOR` (6), unlike the server push this batch just fixed (`dueEstimate.ts:89`). `hooks/useInterruptConfig.ts`'s `computeDue` was not updated to mirror Batch 23's new floor-fill magnitude, so desktop undercounts true session size in the ordinary non-empty case. `components/InterruptHandler.test.tsx:550,564,694` assert the stale "1 card ready — 2 min study break?" text and actively pin the regression. Rule 19: sibling call site of the identical announce-card-count pattern the server side just fixed was left unhardened. Independently found by 4 auditors (A, B, W, R) — the audit's highest-convergence finding.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:notification body / computeDue:179
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F001 — severity 6 — requirements

---

### Task #535: Fix code-quality: two independent INTERRUPT_SESSION_FLOOR=6 literals have no mechanical sync guard

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Two independent `INTERRUPT_SESSION_FLOOR=6` literals exist (`lib/queue.ts:21` and `supabase/functions/send-interrupt-notifications/dueEstimate.ts:87`), synced only by a comment instruction, with no test asserting equality between them. AGENTS.md names a hardcoded value that should be derived from a single source of truth as a stop-the-line pattern; currently the values match so there is no live-today incorrect outcome.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_FLOOR const:21
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F002 — severity 4 — code-quality

---

### Task #536: Fix tests: no seam test wires the real Batch 23 fill pipeline end-to-end

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 2)
**Blocked by:** Nothing
**Priority:** P3

**What:**
No seam test wires the real app/study/page.tsx through the real useStudySession into the real store/srsStore.ts getNearDueCards/canIntroduceNewCard/introduceCard end-to-end; every layer of Batch 23's new fill pipeline is unit-tested in isolation only. Rule 13 seam-test gap.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.tsx:StudyInner:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F003 — severity 4 — tests

---

### Task #537: Fix tests: stale test title now describes a false general rule

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Test titled "does not flex when isInterrupt is true but queue is non-empty" now describes a false general rule since Batch 23 deliberately does fill non-empty queues in the very next describe block; it only still passes because of specific default mocks, misleading for future maintainers reading the test name as documentation.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:describe block:249
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F004 — severity 2 — tests

---

### Task #538: Fix requirements: #533 never-empty backstop bypasses the stranded-pause invariant

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P2

**What:**
The final never-completely-empty backstop calls `introduceNext()` with no `canIntroduceNewCard` check of any kind, bypassing `strandedAcrossDays` entirely; contradicts BRAND.md's wrong-answer-rules table (new-card introductions pause until the stranded card stabilizes). Confirmed pre-existing from Task #533, not newly introduced by this diff, but Batch 23's wider interrupt fill surface makes this path newly more reachable in production, and no test covers the stranded+empty-near-due combination. Independently found by A, V (validator-coverage), R.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect Task #533 backstop:159
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F005 — severity 6 — requirements

---

### Task #539: Fix requirements: computeDue's flex-fallback can promise a stranded-blocked new card

**File:** hooks/useInterruptConfig.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
computeDue's zero-supply flex-fallback (lines 60-73) sets `newCardDue=1` via a raw `getNewCards()` check with no `canIntroduceNewCard`/`strandedAcrossDays` check at all; `getNewCards` (store/srsStore.ts:180-187) only filters on FSRS progress and prerequisites, never on introduction-pause state. This lets computeDue fire an interrupt promising new-card content during a stranded pause that useStudySession's own normal-cap path (line 129, `canIntroduceNewCard(today)`) would refuse to honor. CLAUDE.md's own documentation ("gated on the stranded-pause check") is accurate only for the useStudySession while-loop, not this caller. Independently found by V and R.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useInterruptConfig.ts:computeDue flex-fallback branch:60
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.ts

**Source:** Audit finding F006 — severity 5 — requirements

---

### Task #540: Fix code-quality: INTERRUPT_ARCHITECTURE.md not updated for Batch 23's contract change

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 2)
**Blocked by:** Nothing
**Priority:** P3

**What:**
docs/INTERRUPT_ARCHITECTURE.md was not updated to describe the new 6-card floor, 3-new-card cap, 8-card ceiling, or the removed `skippedNoCards` field, despite this batch materially changing the interrupt content-delivery contract the doc exists to describe.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:n/a:0
- [ ] Audit passes: bash scripts/deep-audit.sh docs/INTERRUPT_ARCHITECTURE.md

**Source:** Audit finding F007 — severity 2 — code-quality

---

### Task #541: Fix edge-case: near-due over-fetch heuristic is not a mathematically proven bound

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The near-due over-fetch heuristic (`INTERRUPT_SESSION_FLOOR + sessionIds.size`) is not a mathematically proven bound if already-included cards are interleaved rather than clustered at the front of getNearDueCards' sorted pool; untested edge case, low real-world likelihood.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount effect near-due fill:147
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F008 — severity 3 — edge-case

---

### Task #542: Fix performance: full-catalog scan on every interrupt mount has no documented budget

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The getNearDueCards binding passed into useStudySession scans the full ~30,609-card catalog (`allCards`) via a synchronous filter+sort on every interrupt mount, up to 4 times across the fill pipeline. Unbounded-growth perf debt with no documented budget, not yet a measured real problem.
NEW

**Acceptance Criteria:**
- [ ] Fix performance issue at app/study/page.tsx:getNearDueCards binding:73
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F009 — severity 3 — performance

---

### Task #543: Fix tests: four compounding seam-test gaps around the interrupt fill pipeline

**File:** components/InterruptHandler.test.tsx, app/study/page.test.tsx, hooks/useStudySession.test.ts
**Complexity:** 🔧 Full — 3 files (seam gaps span InterruptHandler.test.tsx's srsStore mock, page.test.tsx's useStudySession mock, and useStudySession.test.ts's getNearDueCards mock)
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Four compounding seam-test gaps: app/study/page.test.tsx mocks useStudySession entirely, useStudySession.test.ts mocks getNearDueCards entirely, the page.tsx:73 binding itself is asserted by zero tests, and InterruptHandler.test.tsx's srsStore mock does not implement getNearDueCards at all — currently silently safe only because the getStats stub always returns non-zero due, an incidental (not designed) protection that could break on an unrelated future change. Rule 13.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at components/InterruptHandler.test.tsx:srsStore mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.test.tsx

**Source:** Audit finding F010 — severity 4 — tests

---

### Task #544: Fix requirements: server push floor has no matching ceiling — overstates card count on backlog days

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P2

**What:**
buildNotificationPayload floors the announced count at INTERRUPT_SESSION_FLOOR(6) via Math.max but applies no ceiling; on any backlog day where cardCount exceeds INTERRUPT_SESSION_CAP(8), the push announces more cards than the client session (capped at 8 in app/study/page.tsx) can ever deliver. Empirically demonstrated by the shipped test tests/pushDueEstimate.test.ts:107-112 (cardCount:9 producing body "9 cards ready"), reachable by any real user with a backlog above 8, including the vacation-return scenario BRAND.md explicitly names.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F011 — severity 7 — requirements

---

### Task #545: Fix requirements: server push overstates card count on a brand-new user's first interrupt

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P2

**What:**
For a genuinely zero-history new Pro signup (near-due pool empty by definition, no FSRS reviews yet), buildNotificationPayload still announces "6 cards ready" unconditionally, but the real session (useStudySession.ts mount effect) delivers at most INTERRUPT_SESSION_MAX_NEW(3) cards via flex-introduction, or 0 in a fully-exhausted edge case — reachable on 100% of new Pro users' first interrupt, the exact opposite-direction divergence from Task #544.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F012 — severity 7 — requirements

---

### Task #546: Fix code-quality: doc comment overclaims the client's floor as an unconditional guarantee

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Doc comment states as settled fact "the client guarantees every interrupt session holds at least INTERRUPT_SESSION_FLOOR cards", contradicted by the client's own test (hooks/useStudySession.test.ts, "stops at the catalog's edge without padding duplicates when supply runs out below the floor") which proves the client itself accepts sub-floor sessions as correct. Doc-comment overclaim, root cause distinct from the functional defects in F011/F012.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:71
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F013 — severity 3 — code-quality

---

### Task #547: Fix code-quality: 8-card ceiling comment's arithmetic is wrong

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Comment claims the 8-card ceiling is "approximately the top of the 45-90s window at 8-15s/card", which is arithmetically false by the file's own numbers: 8 cards times 15s/card equals 120 seconds, 33% beyond the stated 90-second ceiling; only true at roughly 11.25s/card, a figure never stated.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_CAP comment:23
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F014 — severity 2 — code-quality

---

### Task #548: Fix code-quality: doc comment hedges the exhaustion case but not the overflow case

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The doc comment's "the session the tap opens genuinely holds at least that many cards (catalog permitting)" hedges only the too-few (exhaustion) case; it never acknowledges the too-many (overflow) case documented in Task #544, a second distinct doc-accuracy gap in the same paragraph.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:79
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F015 — severity 3 — code-quality

---

### Task #549: Fix code-quality: dispatch.ts header comment not revisited despite increased send volume

**File:** supabase/functions/send-interrupt-notifications/dispatch.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
dispatch.ts's sequential-processing header comment was not revisited despite this diff structurally increasing dispatch volume by removing the zero-estimate skip.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dispatch.ts:module header comment:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dispatch.ts

**Source:** Audit finding F016 — severity 2 — code-quality

---

### Task #550: Fix code-quality: removed skippedNoCards field loses observability into fabricated-floor sends

**File:** supabase/functions/send-interrupt-notifications/types.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Removing the zero-estimate skip (and the skippedNoCards field) removes the only signal distinguishing "sent because of real content" from "sent because the floor fabricated a number"; the two materially different `sent` outcomes can no longer be distinguished in any future dispatch summary or observability dashboard, and the only kill switch (PUSH_DISPATCH_ENABLED) is all-or-nothing.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/types.ts:skippedNoCards field removal:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/types.ts

**Source:** Audit finding F017 — severity 3 — code-quality

---

### Task #551: Fix requirements: no daily ceiling on flex-introduced new cards across multiple same-day interrupts

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P2

**What:**
`canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER)` disables the daily aggregate new-card cap for the rest of the day (store/srsStore.ts:312-319's `introducedTodayCount>=maxPerDay` check effectively never trips), not just for the current session; across multiple interrupt sessions in one day with a persistently empty near-due pool (the default state for any new user with zero FSRS reviews), up to INTERRUPT_SESSION_MAX_NEW(3) new cards can be flex-introduced in every session that day with no cross-session ceiling, directly contradicting BRAND.md's "one new card introduced per day at steady state" framing for the exact new-user population this feature targets first.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:135
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F018 — severity 6 — requirements

---

### Task #552: Fix edge-case: initialQueue useMemo missing allCards dependency (pre-existing, flagged for cold-start interaction with this batch's guarantee)

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
initialQueue's useMemo references `allCards` in its body but omits it from the dependency array (react-hooks/exhaustive-deps disabled); verified via `git show f5f1305 -- app/study/page.tsx` that this dependency array and eslint-disable predate Batch 23 (only the INTERRUPT_CARD_LIMIT to INTERRUPT_SESSION_CAP constant swap touched this block) — pre-existing and out of scope for this batch's verdict. Noted because a cold-start pack-loading race on this exact line could freeze initialQueue at `[]` before ALL_UNITS populates, permanently defeating the never-empty guarantee this batch exists to deliver, most plausibly via the push-tap cold-start path.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/study/page.tsx:initialQueue useMemo:60
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F019 — severity 3 — edge-case

---

### Task #553: Fix tests: useLangPack mock cannot catch a pack-loading-race regression

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
useLangPack mock hardcodes `loading:false` in every test case; structurally cannot catch Task #552's issue even if that pre-existing issue is real, a genuine test-coverage gap regardless of Task #552's in-scope status.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:useLangPack mock:78
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F020 — severity 2 — tests

---

### Task #554: Fix edge-case: sync cards merge can silently overwrite a just-recorded local review (pre-existing, out of Batch 23 scope)

**File:** hooks/useSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Cards merge can silently overwrite a just-recorded local review with stale server data in a specific race window; file not touched by Batch 23's diff and unrelated caller-context code, flagged as informational only, out of scope for this batch's verdict.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useSync.ts:cards merge:104
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useSync.ts

**Source:** Audit finding F021 — severity 2 — edge-case

---

### Task #555: Fix tests: weak greater-than-or-equal assertion where an exact value is provable

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Test uses `toBeGreaterThanOrEqual(1)` where an exact `toBe(1)` is provable given the test's own setup; weak but self-consistent with the test's stated intent, not full pseudocode. Rule 18 nit.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:n/a:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F022 — severity 2 — tests

---

### Task #556: Fix tests: 4-card-to-6 top-up test only asserts queue length, not exact contents

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
This test only asserts `toHaveLength(6)` on the final queue rather than the exact array of ids; a wrong or duplicate id landing at length 6 would slip through this specific assertion undetected, weaker than sibling tests in the same file. A separate exact-array assertion on introduceCard's call arguments still catches ordering, but not the queue's own final contents.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"tops up a 4-card interrupt queue to 6":0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F023 — severity 3 — tests

---

### Task #557: Fix tests: no test exercises the real INTERRUPT_SESSION_CAP=8 slicing behavior

**File:** app/study/page.test.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
No test exercises the actual INTERRUPT_SESSION_CAP=8 slicing behavior in app/study/page.tsx's initialQueue memo; only a mock constant was added to the test file, with nothing asserting the real 8-card cap fires against a real oversized queue.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at app/study/page.test.tsx:INTERRUPT_SESSION_CAP mock:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.test.tsx

**Source:** Audit finding F024 — severity 3 — tests

---

### Task #558: Fix tests: "truly nothing left" test doesn't exercise the near-due-mirror code path

**File:** hooks/useInterruptConfig.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 2)
**Blocked by:** Nothing
**Priority:** P3

**What:**
This test does not actually exercise the near-due-mirror code path's presence; it passes identically with that code deleted, since nearDueIds defaults to [] regardless. Deletion-test failure, Rule 18.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useInterruptConfig.test.ts:"stays at 0 (truly nothing left)" test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.test.ts

**Source:** Audit finding F025 — severity 3 — tests

---

### Task #559: Fix tests: "never duplicates a near-due card" test doesn't prove the loop-level dedup check is load-bearing

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
This test passes even with the loop-level dedup check (`if (sessionIds.has(card.id)) continue;`) deleted, because an outer setQueue filter independently re-deduplicates; the test proves the composite pipeline is duplicate-free but does not prove the loop-level check itself is load-bearing. Deletion-test failure, Rule 18.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:"never duplicates a near-due card" test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F026 — severity 3 — tests

---

### Task #560: Fix tests: "keeps an estimate above the floor exact" test doesn't prove the floor exists

**File:** tests/pushDueEstimate.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 2)
**Blocked by:** Nothing
**Priority:** P3

**What:**
This test (cardCount:9) passes identically whether the Math.max floor logic exists or is deleted, since 9 is greater than 6 either way; it does not prove the floor exists, only re-exercises pre-existing plural-formatting coverage. Deletion-test failure, Rule 18, and the same test line that empirically demonstrates Task #544's overflow bug.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/pushDueEstimate.test.ts:"keeps an estimate above the floor exact":107
- [ ] Audit passes: bash scripts/deep-audit.sh tests/pushDueEstimate.test.ts

**Source:** Audit finding F027 — severity 3 — tests

---

### Task #561: Fix code-quality: 6-card floor is not an unconditional guarantee when the near-due pool is empty (expectation-alignment note, matches ratified spec)

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 1)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The 6-card floor is not an unconditional guarantee: when the near-due pool is empty and INTERRUPT_SESSION_MAX_NEW(3) is hit, a session ships with exactly 3 cards, not 6. Confirmed by Contract Verifier K to match BRAND.md's own ratified hedge ("never more than 3 per session... until the pipeline refills") — not a functional defect, included per the low-severity preservation rule as an expectation-alignment note rather than a bug.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:136
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F028 — severity 2 — code-quality

---

**`/audit batch 23` — 2026-08-15, re-audit round 2 (after Wave 1+2 remediation), FAIL, severity 8 (4 critical, 6 major, 15 minor), 8-agent cycle (A, B, S, K, W, V, R + Agent N naive-reader lane).** All 10 headline claims from round 1's remediation verified holding (notification floor, stranded-pause gating, server clamp+honest-zero, daily-cap constant swap, sync guard test, near-due over-fetch, sentWithZeroEstimate, useSync fix, docs). But the fixes themselves introduced or left open real gaps, several found independently by 3-4+ agents: (1) severity 8 — `components/InterruptHandler.tsx`'s passive branch calls `markInterruptFired()`/`recordInterruptGateEvent` unconditionally BEFORE checking notification permission, so a user who denied permission gets the cross-device fired gate written and the cooldown clock advanced for a fire they never saw, silently suppressing future interrupts (found only by the naive-reader lane); (2) severity 7 — the desktop notification's floor-Wave-1 fix (`InterruptHandler.tsx:183`) still never caps, the exact defect class fixed server-side in the SAME wave (Task #544) never propagated to this sibling; (3) severity 7 — `app/study/page.tsx`'s "Study more" button is gated only on `!isGlobal`, also true for interrupt sessions, letting a post-interrupt tap build an uncapped 15-card queue; (4) severity 7 — Task #552's own fix (adding a dependency to a useMemo) does not close the cold-start freeze it was meant to fix, since `useStudySession`'s `useState(initialQueue)` only consumes its initializer on true first mount; (5) severity 6 — the new `INTERRUPT_FLEX_DAILY_MAX` daily ceiling (Task #551) is checked once per session mount, not once per introduction, so it can overshoot by up to 2 cards/day (independently found via trace by W, via contract analysis by V, and by N). Full findings promoted below as Tasks #562-#586. Per this project's BATCH_REMEDIATION_GATE, Batch 23 remains `[CURRENT SPRINT]` until a clean re-audit passes.

### Task #562: Fix edge-case: flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 1

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P2

**What:**
flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 142, then the while loop at 143-149 introduces up to INTERRUPT_SESSION_MAX_NEW (3) cards against that single stale boolean with no per-iteration recheck. Across repeated interrupt sessions in one day this lets the daily flex ceiling of 9 be exceeded by up to 2 cards (concrete trace: normal-cap introduces 1, then three interrupt sessions each re-evaluate flexIntroAllowed against a count still under 9 at 1, 4, 7 and each is granted a full 3-card batch, landing the day total at 10). Consequence is a cognitive-load overshoot against BRAND.md's documented working-memory ceiling, not data loss. Confirmed independently by World-Class Reviewer W (trace), Claim Verifier V (contract analysis), and Naive Reader N. at hooks/useStudySession.ts:mount-fill effect (flexIntroAllowed / while-loop introduction):142.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount-fill effect (flexIntroAllowed / while-loop introduction):142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F001 — severity 6 — edge-case

---

### Task #563: Fix tests: No test in the suite can detect the F001 overshoot

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No test in the suite can detect the F001 overshoot. The canIntroduceNewCard mock (capUsedNotStranded) is a pure function of its own call arguments only and returns the same answer regardless of how many cards were already introduced earlier in the same render. INTERRUPT_FLEX_DAILY_MAX's actual value (9) is never asserted in any test file; a regression reverting the daily cap back to the pre-#551 Number.MAX_SAFE_INTEGER bug would pass every existing test unchanged. at hooks/useStudySession.test.ts:capUsedNotStranded mock / flexes-past-daily-cap test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:capUsedNotStranded mock / flexes-past-daily-cap test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F002 — severity 5 — tests

---

### Task #564: Fix requirements: announcedDue = Math

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P2

**What:**
announcedDue = Math.max(totalDue, INTERRUPT_SESSION_FLOOR) floors the desktop notification count but never caps it at INTERRUPT_SESSION_CAP (8). totalDue sums FSRS-due cards across the whole catalog and is genuinely unbounded, so on a backlog day the notification can announce e.g. 40 cards ready while the session that actually opens is capped at 8 -- the exact defect class Task #544 already fixed on the server side, left unfixed on this client sibling. No test in InterruptHandler.test.tsx exercises totalDue greater than CAP. at components/InterruptHandler.tsx:passive-notification body construction:183.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:passive-notification body construction:183
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F003 — severity 7 — requirements

---

### Task #565: Fix code-quality: The #533/#538 never-empty backstop is dead code: introduceNext() is a pure function of (allCardMap, 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The #533/#538 never-empty backstop is dead code: introduceNext() is a pure function of (allCardMap, cards, introductions, introducedIds), none of which change between the while loop's attempts (143-149) and the backstop call, so whenever the backstop's guard is true, the while loop already tried and failed with bit-identical arguments and the backstop is structurally guaranteed to fail again. The surrounding comment and docs/INTERRUPT_ARCHITECTURE.md section 10.4 both describe this as a working, distinct safeguard; it is a no-op. at hooks/useStudySession.ts:never-empty backstop (post-loop fallback):180.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:never-empty backstop (post-loop fallback):180
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F004 — severity 3 — code-quality

---

### Task #566: Fix code-quality: flexIntroAllowed is a single boolean that is false for two distinct, undistinguishable reasons -- th

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
flexIntroAllowed is a single boolean that is false for two distinct, undistinguishable reasons -- the stranded-pause invariant and the daily-flex-ceiling being hit -- but the adjacent code comment and docs section 10.4 attribute 100% of the backstop's empty-session outcome to the stranded pause only. Moot in practice given F004, but the comment/doc framing remains factually wrong on its own terms. at hooks/useStudySession.ts:flexIntroAllowed / backstop comment:142.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:flexIntroAllowed / backstop comment:142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F005 — severity 3 — code-quality

---

### Task #567: Fix edge-case: getNewCards filters only on FSRS progress and prerequisites, never checking introductions[card

**File:** store/srsStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
getNewCards filters only on FSRS progress and prerequisites, never checking introductions[card.id] -- unlike lib/srs.ts's selectQualifyingNewCard, which the real session-open fill logic actually uses and which explicitly excludes cards with an existing IntroductionRecord. hooks/useInterruptConfig.ts's computeDue reads getNewCards at both the normal-cap and flex-fallback checks: a card mid-intensive-phase that already met today's appearance quota but has no FSRS progress yet still satisfies getNewCards, so computeDue can fire an interrupt for content the real fill logic will refuse to introduce. at store/srsStore.ts:getNewCards:180.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at store/srsStore.ts:getNewCards:180
- [ ] Audit passes: bash scripts/deep-audit.sh store/srsStore.ts

**Source:** Audit finding F006 — severity 5 — edge-case

---

### Task #568: Fix code-quality: CLAUDE

**File:** CLAUDE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
CLAUDE.md's own Architecture section 1 entry for hooks/useStudySession.ts still describes the interrupt flex gate as canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER) -- stale relative to the actual Task #551 implementation, which replaced that unbounded call with INTERRUPT_FLEX_DAILY_MAX. docs/INTERRUPT_ARCHITECTURE.md is accurate; this project-root doc is not. at CLAUDE.md:hooks/useStudySession.ts architecture entry:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at CLAUDE.md:hooks/useStudySession.ts architecture entry:0
- [ ] Audit passes: bash scripts/deep-audit.sh CLAUDE.md

**Source:** Audit finding F007 — severity 2 — code-quality

---

### Task #569: Fix edge-case: onStudyMore is gated only on !isGlobal, which is also true for isInterrupt sessions

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P2

**What:**
onStudyMore is gated only on !isGlobal, which is also true for isInterrupt sessions. For an interrupt session allCards is the full cross-unit catalog and buildQueue is called with globalMode=false (interleaving up to SESSION_NEW_LIMIT=15 brand-new cards) with no INTERRUPT_SESSION_CAP slice applied to the result, unlike the initialQueue construction which does slice. A user finishing a normal 6-8 card interrupt session and tapping Study more can get a session of 15+ new cards with no interrupt-specific limit applied. No test in app/study/page.test.tsx exercises onStudyMore or asserts on buildQueue's call arguments. at app/study/page.tsx:onStudyMore handler:116.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at app/study/page.tsx:onStudyMore handler:116
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F008 — severity 7 — edge-case

---

### Task #570: Fix requirements: markInterruptFired() and recordInterruptGateEvent({eventType: fired, 

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P1

**What:**
markInterruptFired() and recordInterruptGateEvent({eventType: fired, ...}) are both called unconditionally in the passive (non-mandatory) branch, before the notification-permission check determines whether a notification is actually shown. If permission is denied or never granted, sendNativeNotification is never invoked, yet the Rust cooldown clock has already been advanced and a fired event has already been written to the shared cross-device interrupt_gate_events table -- suppressing or delaying future interrupts on this and every other device the user owns, for a fire the user never actually saw. Any user who has denied notification permission is affected today, and the effect is silent. InterruptHandler.test.tsx's does-not-send-when-permission-refused test only asserts sendNativeNotification was not called, never asserting on markInterruptFired or recordInterruptGateEvent. at components/InterruptHandler.tsx:passive interrupt-fire branch:134.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:passive interrupt-fire branch:134
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F009 — severity 8 — requirements

---

### Task #571: Fix tests: Uses toBeGreaterThanOrEqual(1) instead of toBe(1) for a test named introduces exactly one new card

**File:** tests/seam_studyLoop.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
Uses toBeGreaterThanOrEqual(1) instead of toBe(1) for a test named introduces exactly one new card. This passes even if multiple cards were introduced in a single mount, which would violate the one-new-card-per-day cap the feature exists to enforce. at tests/seam_studyLoop.test.ts:introduces exactly one new card test:44.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/seam_studyLoop.test.ts:introduces exactly one new card test:44
- [ ] Audit passes: bash scripts/deep-audit.sh tests/seam_studyLoop.test.ts

**Source:** Audit finding F010 — severity 5 — tests

---

### Task #572: Fix tests: Uses toBeLessThanOrEqual(3) instead of toBe(3) for a test named respects the limit parameter

**File:** tests/srsStore.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Uses toBeLessThanOrEqual(3) instead of toBe(3) for a test named respects the limit parameter. This passes even if the slice returned 0 or 1 cards instead of the correct 3. at tests/srsStore.test.ts:respects the limit parameter test:351.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at tests/srsStore.test.ts:respects the limit parameter test:351
- [ ] Audit passes: bash scripts/deep-audit.sh tests/srsStore.test.ts

**Source:** Audit finding F011 — severity 5 — tests

---

### Task #573: Fix async: useState(initialQueue) only consumes its initializer on true first mount, and the mount-fill effect 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P2

**What:**
useState(initialQueue) only consumes its initializer on true first mount, and the mount-fill effect has an empty dependency array, so it runs once and closes over render-1's data. app/study/page.tsx calls useStudySession before the packLoading early-return, so any component that mounts while a pack is still loading -- es-language sessions, specialty-pack loads, cold push-tap launches -- permanently freezes the queue empty. This regresses the never-completely-empty guarantee for the exact task (#552) that was supposed to have closed this gap: the fix that shipped (adding allCards to a useMemo dependency array) does not address the stale-closure root cause. No test can catch it because every test touching this path mocks useStudySession away. at hooks/useStudySession.ts:mount-time introduce effect (useState(initialQueue)):83.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useStudySession.ts:mount-time introduce effect (useState(initialQueue)):83
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F012 — severity 7 — async

---

### Task #574: Fix tests: No seam test proves the combined interaction where a normal-cap introduction on session mount consum

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
No seam test proves the combined interaction where a normal-cap introduction on session mount consumes 1 of the 3 available flex slots on an interrupt session. The code looks correct by inspection but the interaction path itself is untested. at hooks/useStudySession.ts:mount effect (normal-cap intro + flex fill interaction):142.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.ts:mount effect (normal-cap intro + flex fill interaction):142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F013 — severity 3 — tests

---

### Task #575: Fix code-quality: docs/INTERRUPT_ARCHITECTURE

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
docs/INTERRUPT_ARCHITECTURE.md section 10 does not mention the #552 residual gap described in F012, leaving the documented state of that fix inaccurate. at docs/INTERRUPT_ARCHITECTURE.md:section 10:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:section 10:0
- [ ] Audit passes: bash scripts/deep-audit.sh docs/INTERRUPT_ARCHITECTURE.md

**Source:** Audit finding F014 — severity 2 — code-quality

---

### Task #576: Fix tests: The regression tests explicitly requested for #538 (stranded-pause-blocks-backstop) and #541 (near-d

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The regression tests explicitly requested for #538 (stranded-pause-blocks-backstop) and #541 (near-due-interleaving) were never added to hooks/useStudySession.test.ts, by either the Wave 1 remediation stream or Wave 2. No test in the current suite regresses either specific fix. at hooks/useStudySession.test.ts:stranded-pause-blocks-backstop / near-due-interleaving regression tests:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:stranded-pause-blocks-backstop / near-due-interleaving regression tests:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F015 — severity 5 — tests

---

### Task #577: Fix security: INTERRUPT_FLEX_DAILY_MAX is enforced via a check-then-act read of in-memory Zustand state with no cr

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
INTERRUPT_FLEX_DAILY_MAX is enforced via a check-then-act read of in-memory Zustand state with no cross-tab or cross-window coordination -- two tabs of the same account can each independently pass canIntroduceNewCard and each flex up to 3 new cards, exceeding the intended daily ceiling beyond even the single-tab overshoot in F001. Real but low-stakes given the client-only honor-system entitlement model already documented in CLAUDE.md section 5 as an accepted, intentional trade-off. at hooks/useStudySession.ts:flexIntroAllowed check-then-act:142.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at hooks/useStudySession.ts:flexIntroAllowed check-then-act:142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F016 — severity 3 — security

---

### Task #578: Fix error-handling: A negative cardCount (malformed upstream data) fails the ===0 branch and silently clamps to FLOOR (6

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
A negative cardCount (malformed upstream data) fails the ===0 branch and silently clamps to FLOOR (6) via Math.max with no logging of the anomaly. Latent, not currently reachable: computeDueEstimate only increments a counter and never produces a negative value today. at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:0.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F017 — severity 2 — error-handling

---

### Task #579: Fix tests: docs section 10

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
docs section 10.1's INTERRUPT_FLEX_DAILY_MAX=9 table entry has no mechanical cross-check against lib/queue.ts's real derivation, unlike FLOOR and CAP which tests/interruptFloorSync.test.ts does mechanically verify. A third place the constant is documented with no automated guard against drift. at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX:0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F018 — severity 4 — tests

---

### Task #580: Fix code-quality: The notification body (Cards ready) unconditionally implies content is ready, but docs section 10

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
The notification body (Cards ready) unconditionally implies content is ready, but docs section 10.4 documents a case (stranded pause combined with an empty near-due pool) where the session opened by the notification may genuinely be empty. Pre-existing limitation, not newly introduced by this batch, but still a live, undocumented-in-code gap between the notification copy and the actual guarantee. at components/InterruptHandler.tsx:native notification body text:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/InterruptHandler.tsx:native notification body text:0
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F019 — severity 2 — code-quality

---

### Task #581: Fix code-quality: The comment on INTERRUPT_FLEX_DAILY_MAX claims it bounds total same-day flex introductions and gives

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The comment on INTERRUPT_FLEX_DAILY_MAX claims it bounds total same-day flex introductions and gives a real cross-session ceiling with no store-layer change needed. This is false for the same reason described in F001: the value is checked once per session mount, not once per introduction, so it does not actually bound the total as claimed. at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX comment:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX comment:0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F020 — severity 3 — code-quality

---

### Task #582: Fix code-quality: docs/INTERRUPT_ARCHITECTURE

**File:** docs/INTERRUPT_ARCHITECTURE.md
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
docs/INTERRUPT_ARCHITECTURE.md section 10.3 restates the same false per-introduction-ceiling claim as F020 verbatim from the original completion note, never independently verified against the while loop's actual call pattern before being written down. at docs/INTERRUPT_ARCHITECTURE.md:section 10.3:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at docs/INTERRUPT_ARCHITECTURE.md:section 10.3:0
- [ ] Audit passes: bash scripts/deep-audit.sh docs/INTERRUPT_ARCHITECTURE.md

**Source:** Audit finding F021 — severity 2 — code-quality

---

### Task #583: Fix code-quality: A code comment claims getNearDueCards is called up to 4x per mount

**File:** app/study/page.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
A code comment claims getNearDueCards is called up to 4x per mount. This is false: it is called exactly once per useStudySession mount. The 4x figure conflates a different function entirely, computeDue's per-unit loop in hooks/useInterruptConfig.ts, with a number that matches neither function's actual call count. at app/study/page.tsx:Task #542 comment on getNearDueCards:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at app/study/page.tsx:Task #542 comment on getNearDueCards:0
- [ ] Audit passes: bash scripts/deep-audit.sh app/study/page.tsx

**Source:** Audit finding F022 — severity 3 — code-quality

---

### Task #584: Fix tests: This pre-existing test only proves the outer setQueue dedup filter catches a duplicate; it does not 

**File:** hooks/useStudySession.test.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
This pre-existing test only proves the outer setQueue dedup filter catches a duplicate; it does not exercise the inner loop-level check at all, a gap the test's own inline comment admits. A regression that removed the inner check would not be caught by this test. at hooks/useStudySession.test.ts:never duplicates a near-due card already in the queue test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.test.ts:never duplicates a near-due card already in the queue test:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.test.ts

**Source:** Audit finding F023 — severity 4 — tests

---

### Task #585: Fix error-handling: lib/queue

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
lib/queue.ts silently drops stale or mismatched card ids with no logging. Low severity, pre-existing pattern not introduced by this batch. at lib/queue.ts:buildQueue (stale/mismatched id handling):0.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/queue.ts:buildQueue (stale/mismatched id handling):0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F024 — severity 2 — error-handling

---

### Task #586: Fix async: inFlightSyncPromise is not keyed by userId

**File:** hooks/useSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Status:** COMPLETE — 2026-08-15 (Wave 3)
**Blocked by:** Nothing
**Priority:** P3

**What:**
inFlightSyncPromise is not keyed by userId. A sign-out followed immediately by sign-in as a different user could misattribute an in-flight sync's result to the wrong account. Low probability, informational; the surrounding comment does not discuss this case. at hooks/useSync.ts:inFlightSyncPromise:0.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useSync.ts:inFlightSyncPromise:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useSync.ts

**Source:** Audit finding F025 — severity 3 — async

---

## Escalation Queue
| Issue | Why it needs a decision | Options |
|-------|------------------------|---------|
| ALL_PACK_CODES vs READY_PACK_CODES decision (Task #068) | Should loadPack validate against all registered pack codes (including es with ready:false) or only packs that are actually ready to download? With es.json now in the CDN but hidden, this question is active again. | (A) Validate against READY_PACK_CODES only — es.json inaccessible until ready:true; (B) Validate against all registered codes — allows direct pack URL access even when hidden from UI |
| Sentence generator go/no-go | BRAND.md flags this as "under evaluation." No task created. | (A) Greenlight — add BUILD task to Batch 10/11; (B) Hold — revisit at B2 content milestone |
| Spanish pack quality gate | es.json (245KB, v0.9.0) exists but Max confirmed "not yet ready" on 2026-06-29. When is it ready? | Owner sets criteria: word count target, unit count, QA pass |
| LS store creation (Task #120) — **RESOLVED 2026-07-28**: confirmed already live during Batch 10 review — lib/checkout.ts:12 has a real product URL, live-verified via curl (HTTP 302). Task #120 marked COMPLETE; this row kept only for history. | n/a | — |
| Apple Developer Program membership — **RESOLVED 2026-07-08: Max's enrollment is approved.** Task #122 still needs one more concrete step before it can close: generate a "Developer ID Application" certificate from this membership (developer.apple.com or Xcode), export it as a `.p12`, and wire 6 GitHub Actions secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) — see Task #122. Not yet started. | n/a — membership prerequisite cleared, cert generation still pending | When ready: generate + export the cert, then resume with `/task #122` |
| No GitHub remote configured for this repo — **RESOLVED 2026-07-29**: repo pushed to `github.com/m4x-us/plyglt` (private) during Batch 10 closure. `origin` remote confirmed configured and reachable as of 2026-07-30. Row kept only for history. | n/a | — |
| BRAND.md's "variety rule" is undeliverable with the current content model (Batch 18 WorldClass cycle 1) | `getNextCardType` (lib/introduction.ts) correctly implements retrieval-angle rotation, but the content model authors one `Card` object per word per type — there is no sibling card to rotate to. Delivering this requires generating sibling `Card` objects per word across the curriculum (an 8,000-word content-authoring initiative per CURRICULUM.md), not a code fix. Disclosed in BRAND.md 2026-07-08; logged as debt.md severity 5. | (A) Greenlight a future content-model batch to author sibling cards per word; (B) Accept the current one-card-per-word model permanently and remove the variety rule from BRAND.md instead of disclosing it as pending; (C) Hold — revisit at next content milestone |
