# Stream W1A Brief — /advance Wave 1 — 2026-06-26

## Your Role
You are a child CTO executing Wave 1, Stream A of a parallel /advance session.
Work exclusively on the files listed in "Files You Own". MUST NOT modify any other file.

## STREAM_ID
Your STREAM_ID is: W1A
Your stream's tasks.md has been pre-populated at `.autocode/stream-W1A/tasks.md`.

## Execution Order
Run in this exact order (blockers first):

1. Skill({ skill: "task", args: "#066" })  — Fix unstable lang object in useEffect deps (useLangPack.ts)
2. Skill({ skill: "task", args: "#059" })  — Fix unsafe PackCode[] cast in langRegistry.ts
3. Skill({ skill: "task", args: "#061" })  — Add QuotaExceededError test (packLoader)
4. Skill({ skill: "task", args: "#060" })  — Add invalid_lang discriminant to LoadPackResult
5. Skill({ skill: "task", args: "#067" })  — Add ref-ID logging to fetchManifest silent catch
6. Skill({ skill: "task", args: "#008" })  — Fix silent catches in readCacheMeta/readCacheData
7. Skill({ skill: "task", args: "#062" })  — Strengthen LANG_CONFIG_MAP assertions to value-level
8. Skill({ skill: "task", args: "#075" })  — Fix silent catch in packLoader cache-parse path
9. Skill({ skill: "task", args: "#057" })  — Mark re-export in useLangPack.ts as @deprecated

## Files You Own (edit ONLY these)
hooks/useLangPack.ts
lib/langRegistry.ts
lib/packLoader.ts
tests/packLoader.test.ts
tests/langRegistry.test.ts
tests/useLangPack.test.ts  ← create new file for #066 and #057 tests

## IMPORTANT: Test Redirection for Task #057
Task #057's task definition says to write its test to `tests/srsStore.test.ts`. That file is
owned by Stream W1B this wave. Instead: write Task #057's test to `tests/useLangPack.test.ts`
(which you own). The test content is identical — assert that hooks/useLangPack.ts exports
`LANG_PAIR_KEY` AND contains `@deprecated`. Only the destination file changes.

## Off-Limits Files (DO NOT MODIFY — owned by other streams this wave)
lib/tauri.ts                          (W1B)
components/InterruptHandler.tsx       (W1B)
store/srsStore.ts                     (W1B)
app/study/page.tsx                    (W1B)
lib/constants.ts                      (W1B)
tests/srsStore.test.ts                (W1B)
lib/importBackup.ts                   (W1C)
app/settings/page.tsx                 (W1C)
lib/entitlement.ts                    (W1C)
store/entitlementStore.ts             (W1C)
components/EntitlementValidator.test.tsx  (W1C)
tests/entitlement.test.ts             (W1C)
lib/srs.ts                            (W1D)
app/decks/                            (W1D)
vitest.config.ts                      (W1D)

## Task Definitions

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

---

### Task #059 | security | severity 7
**What:** Fix unsafe `as PackCode[]` cast — annotate `LanguageEntry.code: PackCode` in the interface so the derived arrays are typed correctly without a cast
**Why:** `LANGUAGE_REGISTRY.map(l => l.code) as PackCode[]` is an unsafe cast. `LanguageEntry.code: string` means `.map()` yields `string[]`; the `as PackCode[]` assertion bypasses TypeScript. If a new LANGUAGE_REGISTRY entry has a code outside the union, the cast silently accepts it — the security allowlist in `loadPack`/`evictPack` contains an unvalidated value. Fix: annotate `LanguageEntry.code: PackCode` so the registry itself enforces membership at compile time.
**File:** `lib/langRegistry.ts:18,46-47`
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Task #064, Task #065
**Risk:** Low — one field annotation; TypeScript flags any entry whose code is not in the union
**Test required (write first):** `tests/langRegistry.test.ts` — add: runtime assertion that every element of ALL_PACK_CODES is one of `["it","es","fr","de","pt"]`. Confirm the `as PackCode[]` cast no longer appears in `lib/langRegistry.ts` after the fix.
**Done condition:** `grep -n "code: PackCode" lib/langRegistry.ts` returns a hit. `grep -n "as PackCode\[\]" lib/langRegistry.ts` returns no hit. Verification gate green.
**Owner:** Security Agent

---

### Task #061 | tests | severity 7
**What:** Add test covering the `QuotaExceededError` catch path in `writeCacheData`/`writeCacheMeta` (`lib/packLoader.ts:286-295`)
**Why:** The F006 fix (try/catch around cache write) has zero test coverage. Removing the try/catch causes no test failures — the fix is unverifiable. Test must confirm: (a) `loadPack` returns `{ ok: true, pack }` when storage throws, (b) `console.error` is called with `PACK_CACHE_WRITE_FAIL`, (c) pack is in memCache for the session.
**File:** `tests/packLoader.test.ts`
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — test only
**Test required (write first):** Stub `localStorage.setItem` to throw `new DOMException("QuotaExceededError")`. Assert result is `{ ok: true, pack }`. Assert `console.error` called with string matching `PACK_CACHE_WRITE_FAIL`. Assert second `loadPack("it", ...)` returns from memCache without a second fetch.
**Done condition:** `npm test -- tests/packLoader.test.ts` passes including the new test. Verification gate green.
**Owner:** QA Agent

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

---

### Task #062 | tests | severity 5
**What:** Strengthen `LANG_CONFIG_MAP` assertions in `tests/langRegistry.test.ts` from `toBeDefined()` to value-level checks
**Why:** `expect(LANG_CONFIG_MAP[code]).toBeDefined()` passes even though `fr`, `de`, `pt` return the Spanish config. This is pseudocode — it proves key existence, not correctness. The test should FAIL on the current codebase and PASS only after escalation #3 is resolved.
**File:** `tests/langRegistry.test.ts:10-14`
**Severity:** 5 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — expected to surface the existing fr/de/pt config bug as a failing test (this is the point)
**Test required (write first):** This task IS the rewrite. For each code, assert the config's identifying field matches that code (e.g. `LANG_CONFIG_MAP["it"].code === "it"`). Assert `LANG_CONFIG_MAP["fr"]` is not the Spanish config.
**Done condition:** The rewritten test fails on the current codebase. Test passes after CTO escalation #3 is resolved. Verification gate green (conditioned on escalation #3).
**Owner:** QA Agent

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
- `tests/useLangPack.test.ts` (NOT tests/srsStore.test.ts — that file is owned by Stream W1B this wave) — add an import-graph assertion: `hooks/useLangPack.ts` must still export `LANG_PAIR_KEY` (backward compat is preserved). Assert via grep seam test: the file must contain the string `export { LANG_PAIR_KEY` AND the string `@deprecated`.

**Done condition:** `grep -n "@deprecated" hooks/useLangPack.ts` returns a hit. `grep -n "export { LANG_PAIR_KEY" hooks/useLangPack.ts` returns a hit (compat export still present). Verification gate green.
**Owner:** Architecture Agent

---

## Agent Memories

## Security Agent Memory (first 100 lines)

agent: security
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Auth / entitlement model:** Client-only. No server-side purchase verification. Entitlement state lives in Zustand (`store/entitlementStore.ts`) and is mutable via DevTools. Owner decision: intentional for offline-first architecture. The Lemon Squeezy integration (`lib/entitlement.ts`) calls the LS API for activation/deactivation but there is no re-verification path on startup or on backup import.

**Data flow:** Language packs are fetched over HTTPS from `/packs/${lang}.json` and cached in localStorage. SHA-256 hash verification of cached packs is present (`lib/packLoader.ts:184-192`). The lang parameter is now validated against `ALL_PACK_CODES` allowlist at the entry of both `loadPack()` and `evictPack()` before any I/O (Task #003, 2026-06-25).

**Tauri IPC layer:** Desktop-specific commands wrapped in `lib/tauri.ts`. IPC calls include `update_interrupt_config` and `snooze_interrupt`. Error handling on these calls is currently missing (bare `.catch(() => {})`).

**Trust boundaries:**
- Web: browser localStorage is user-controlled; URL parameters and stored values must be validated
- Desktop (Tauri): Rust process runs the interrupt scheduler; JS/Rust IPC errors must be surfaced
- No server trust boundary — all logic is client-side by design

**Key files:**
- `lib/packLoader.ts` — pack fetching, caching, hash verification
- `lib/importBackup.ts` — backup import with validation
- `lib/tauri.ts` — Tauri IPC wrapper
- `store/entitlementStore.ts` — entitlement state
- `lib/entitlement.ts` — Lemon Squeezy activation/deactivation
- `components/InterruptHandler.tsx` — interrupt UI, notification plugin calls

**Recurring pattern — Bare `.catch(() => {})` on Tauri IPC calls:** Every IPC call must propagate errors to UI state or logs.

**Recurring pattern — Unvalidated localStorage values used in URL/path construction:** Any new feature reading from localStorage and using the value in a URL, file path, or command must validate against `ALL_PACK_CODES` or equivalent allowlist first.

**Accepted risks (do NOT re-raise):**
- Client-only entitlement — mutable via DevTools, no HMAC (intentional)
- Backup import can restore paid entitlement without LS re-verification (intentional)
- No server-side purchase verification on startup (intentional)

**Open findings relevant to this stream:**
- Task #059: `as PackCode[]` cast — PARTIALLY RESOLVED (readonly+freeze applied). Remaining: derive PackCode from `typeof LANGUAGE_REGISTRY[number]["code"]`.
- Task #003 standalone re-audit: `PackCode` resolves to `string` due to cast — same fix.
- lib/packLoader.ts:loadPack:283: `writeCacheData`/`writeCacheMeta` no try/catch; `QuotaExceededError` propagates as wrong `"download_failed"` discriminant.
- CTO escalation #3: fr/de/pt entries use `config: SPANISH` as placeholders.

## Architect Agent Memory (first 100 lines)

agent: architect
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Blast-radius ranking:**
1. `lib/srs.ts` — 11 importers
2. `lib/langRegistry.ts` — 10 importers (highest relevant to this stream)
3. `store/srsStore.ts` — 9 importers
6. `lib/packLoader.ts` — 2 direct, but transitively loaded by every route via `useLangPack.ts`

**Open findings relevant to this stream:**
- Task #002 — F003: `hooks/useLangPack.ts:65` — `lang = getLanguageConfig(targetLang)` is unstable object reference in useEffect deps. Infinite re-render masked by static-pack early return. Latent bug when second language ships.
- Task #003 standalone re-audit: `lib/langRegistry.ts:PackCode:42` — `PackCode` resolves to `string` due to `as string[]` cast. Fix: derive from `typeof LANGUAGE_REGISTRY[number]["code"]`.
- Task #003 standalone re-audit: `lib/packLoader.ts:loadPack:283` — `writeCacheData`/`writeCacheMeta` no try/catch; QuotaExceededError propagates as wrong discriminant.
- CTO escalation #3: fr/de/pt entries use `config: SPANISH` as placeholders.

**Rule 8 violations in your stream's files:**
- `lib/packLoader.ts:91` — silent catch (ERR-CACHE-META ref ID needed)
- `lib/packLoader.ts:103` — silent catch (ERR-CACHE-DATA ref ID needed)
- `lib/packLoader.ts:139` — silent catch (MANIFEST_FETCH_FAIL ref ID needed)
- `lib/packLoader.ts:223-226` — third silent catch (CACHE_PARSE_FAIL ref ID needed)

## Done When
All 9 tasks complete when each Skill({ skill: "task" }) call confirms done-when met.
Write your completion summary to `.autocode/stream-W1A/completion.md`:

```
Tasks closed: [list task numbers that reached COMPLETE status]
Tasks NOT completed: [list task number + done-when condition that failed]
Debt entries logged: [count of rows appended to your .autocode/stream-W1A/debt.md]
Carry-forward tasks generated: [count of new ### Task # blocks added to your tasks.md]
```
