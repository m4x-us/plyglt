# Audit Checklist — plyglt
Generated: 2026-07-01 by /meet
Stack: Node.js / Next.js 16.2.9 + Tauri 2 / desktop app (macOS/Windows/Linux)

## Trust Boundary Checks
[ ] `lib/entitlement.ts:activateLicense` — `raw as LsActivateBody` casts Tauri IPC response with only field-level null guards; verify that a truthy non-string `res.error` value (e.g. `{}`) does not fall through the `|| res.error` branch into entitlement-grant logic
[ ] `lib/packLoader.ts:fetchManifest:161` — `(await res.json()) as Manifest` has no structural field validation; verify that a CDN error envelope (valid JSON, non-manifest shape) triggers a missing-field path rather than a silent SHA-256 skip on the manifest entry lookup
[ ] `lib/packLoader.ts:loadPack:203` — `READY_PACK_CODES.some(c => c === lang)` allowlist guard fires before any network request; verify the guard also rejects strings with path-separator characters (`../`) that could be valid array members if the registry is ever built from untrusted input
[ ] `hooks/useLicenseActivation.ts:handleActivate:25` — format validation (`length > 200 || !/^[A-Za-z0-9-]+$/`) runs client-side before IPC; verify `activateLicense` in `lib/entitlement.ts` also validates or that the Tauri command rejects oversized strings so a crafted deep-link bypass does not reach the network call

## Parse Boundary Checks
[ ] `lib/packLoader.ts:readCacheMeta:111` — `JSON.parse(raw) as CachedPackMeta` has no field validation; verify a stored `"null"` string (possible on interrupted write) does not produce a `null.version` TypeError — the re-download fallback is implicit through `cacheValid = false`, not an explicit guard
[ ] `lib/packLoader.ts:loadPack:358` — `JSON.parse(json) as Pack` validates only `Array.isArray(pack.units)` at line 364; verify individual `Unit` and `Card` fields (tier, accepted answers, card type) are validated or that corrupt field values are caught at consumer call sites before reaching `lib/srs.ts:scheduleCard`
[ ] `hooks/useExportImport.ts:readFile:59` — `parseBackup(JSON.parse(reader.result as string))` passes `null` to `JSON.parse` when `FileReader.result` is null before `onload` fires; verify the outer `catch` at line 85 covers the resulting `SyntaxError` and sets an error status rather than leaving the UI in a loading state
[ ] `lib/importBackup.ts:parseBackup` — `isFinite()` guards on card `stability`, `dueDate`, and `validUntil`; verify tests exercise these guards with `NaN` and `Infinity` inputs (not just missing-field cases), since `typeof NaN === "number"` passes the type check before `isFinite`

## Invariant Verification
[ ] `lib/introduction.ts:shouldGraduate:65` — returns `consecutiveCorrect >= 15`; verify `recordResult` at line 88–101 always resets `consecutiveCorrect` to 0 on any wrong answer (both the single-wrong path at line 108 and the triple-wrong reset at line 101) so no call site can accumulate across a wrong answer
[ ] `lib/introduction.ts:recordResult:99` — triple-wrong (`consecutiveWrongToday >= 3`) resets `dayOfPhase` to 1; verify tests assert specific field values (`dayOfPhase === 1`, `consecutiveCorrect === 0`, `consecutiveWrongToday === 0`) after each wrong-answer scenario rather than just checking the returned object is truthy
[ ] `lib/packLoader.ts:sha256Hex:97` — uses `crypto.subtle.digest("SHA-256")`; verify a known-answer test vector exists (e.g. `sha256Hex("abc") === "ba7816bf..."`) to pin Web Crypto stub alignment in the test environment so a divergent stub would allow tampered packs through integrity checks while tests still pass
[ ] `store/srsStore.ts:introduceCard:209` — guard `if (existing && !existing.graduated) return` at line 211 prevents re-introduction of an active card; verify the guard does NOT block re-introduction of a graduated card (after it re-enters the FSRS scheduler), since `!existing.graduated` would pass for a graduated record

## Type Discriminant Exhaustiveness
[ ] `lib/packLoader.ts:LoadPackResult` — callers must check `ok` before accessing `pack`; verify every call site of `loadPack` checks `result.ok` before accessing `result.pack` — a false branch access produces a runtime `undefined` reference with no TypeScript error because the discriminated union narrows correctly only after the check
[ ] `lib/licenseTypes.ts:LicenseType` — narrowed to `"free" | "subscription"`; verify `store/migrations.ts` v2 migration handles all historical unknown values (`"lifetime"`, `"one-time"`) and that the fallback is `"subscription"` (not `"free"`) for users who paid under an older licensing model
[ ] `content/types.ts:CardType:8` — five string literals (`"recognize" | "produce" | "conjugate" | "fill_blank" | "passage_cloze"`); verify `lib/introduction.ts:getNextCardType:116` tests assert the returned string matches a specific literal value (not `toBeDefined()`) so a typo in the returned type name fails a test
[ ] `store/entitlementStore.ts:isPackUnlocked:69` — returns `boolean` derived from `licenseType`, `unlockedPacks`, and `validUntil + SUBSCRIPTION_GRACE_PERIOD_MS`; verify there is no third `licenseType` value that could fall through to `unlockedPacks.some(...)` without the subscription-expiry guard running

## Silent Failure Audit
[ ] `lib/packLoader.ts:_storage:80` — `let _storage: ... | null = null` module-level lazy singleton; if two concurrent `loadPack` calls arrive before the first `getStorage()` completes, both enter the `if (!_storage)` branch and call `createPlatformStorage` twice; verify the factory is idempotent (opening the same store file name twice does not corrupt state) or add a sync guard
[ ] `lib/packLoader.ts:loadedAddOns:76` — module-level mutable `string[]`; `loadedAddOns.push(lang)` at line 261 is not guarded against concurrent async specialty pack loads (two simultaneous calls for the same add-on code could both pass the `loadedAddOns.includes(lang)` check at line 220); verify the SPECIALTY_PACKS-empty invariant is documented as the guard and add a test that asserts idempotency when ready packs ship
[ ] `components/InterruptHandler.tsx:81` — `catch (e)` on `enterMandatoryMode()` logs `[IH-MANDATORY-${Date.now()}]` and continues to navigate; verify the log includes the error message (not just the ref ID) and that the comment explains the soft-lock decision so it is not silently removed
[ ] `app/settings/page.tsx:28` — `catch (e)` on `enableAutostart`/`disableAutostart` logs `[ERR-AUTOSTART-${Date.now()}]` but lacks a user-visible error state update; verify the UI reverts `launchAtLogin` (the `setLaunchAtLogin(!v)` rollback) in all error paths including IPC promise rejection after the autostart call returns

## Test Assertion Quality

UNIVERSAL RULE — auditors must apply this to every `it()` block in scope, not just the named examples below:
For every test you read: perform the Deletion Test. Mentally delete the production code path the test name describes. If any assertion still passes after that deletion — it is a Rule 16 violation (Enumerate Before You Assert, `~/.claude/autocode/philosophy.md`). Report it as: `[filepath:line] — test name claims "[X]" but the assertion passes even if [X] is broken — pseudocode test.` Do not skip tests in files you did not modify — if you read it, you audit it.

Mandatory rewrite triggers (suppression comment is NOT valid for these — rewrite the assertion):
- Any assertion on a named constant or enum value
- Any assertion on a deterministic function's return value
- Any assertion on store state after a known operation (card inserted → assert card fields, not card existence)
- Any assertion on data after import/restore (assert specific field values, not that the record exists)

Suppression (`// existence-check: [reason]`) is valid ONLY for:
- Auto-generated IDs (crypto.randomUUID(), Zustand internal IDs)
- Timestamps (Date.now() results, any date that is non-deterministic)

Known gaps from 2026-07-03 Batch 1 audit (all require REWRITE, not suppression):
[ ] `app/learn/page.test.tsx:96-97` — `expect(screen.getByText("cards ready")).toBeDefined()` and `expect(screen.getByText("day streak 🔥")).toBeDefined()` verify element existence but not the numeric values rendered; verify at least one test asserts the exact due count and streak count so a regression that renders "0 cards ready" while non-zero cards exist would fail
[ ] `tests/seam_importRestore.test.ts:85-86` — `expect(result.srs.cards["card-due"]).toBeDefined()` verifies card presence but not field correctness after import; verify `dueDate`, `stability`, and `state` are asserted for at least one restored card so field-level corruption in the import seam fails a test
[ ] `tests/introduction.test.ts:64` — `expect(MAX_APPEARANCES_BY_PHASE_DAY).not.toBeNull()` asserts the table exists but not its values; verify at least one test asserts specific phase entries (e.g. day 1 maps to `Infinity`, day 22 maps to `0`) so a silent modification to the cadence table fails a test
[ ] `tests/packLoader.test.ts:118-119` — `expect(localStorageMock.getItem("pack-data-v1-it")).not.toBeNull()` verifies a write happened but not its content; verify at least one test parses the cached value and checks the `sha256` or `version` field so a write of corrupted data would fail

## Authorization and Data Isolation
[ ] `store/entitlementStore.ts:isPackUnlocked:69` — the only pack-access gate; verify no call path invokes `lib/packLoader.ts:loadPack` without first passing through `isPackUnlocked` — currently enforced at `components/LanguageGrid.tsx` before `onSelect` fires; verify the interrupt engine path (`components/InterruptHandler.tsx`) that calls `useLangPack` does not bypass this gate for the selected language
[ ] `store/entitlementStore.ts:isPackUnlocked:79` — `Date.now() > validUntil + SUBSCRIPTION_GRACE_PERIOD_MS` uses `Date.now()` at call time; verify no call site caches the boolean result across render cycles so a subscription expiring mid-session is denied on the next pack-load attempt without requiring a page reload
[ ] `store/entitlementStore.ts:hasAddOn:133` — `purchasedAddOns.includes(code)` is the add-on gate; verify that no code path calls `lib/packLoader.ts:loadPack` with a specialty pack code without first confirming `hasAddOn` returns true — the `loadPack` specialty path itself does not check entitlement, only `SPECIALTY_PACKS[*].ready`

## Concurrency Safety
[ ] `lib/packLoader.ts:getStorage:82` — `if (!_storage) { _storage = createPlatformStorage(...) }` lazy-init: two simultaneous `loadPack` calls that both enter the branch before either returns would call `createPlatformStorage` twice; verify the factory is safe to call twice with the same store name (idempotent file open) or add an in-flight Promise guard
[ ] `lib/packLoader.ts:loadedAddOns:220` — `loadedAddOns.includes(lang)` read and `loadedAddOns.push(lang)` write at line 261 are non-atomic; two concurrent specialty-pack loads for the same code both pass the includes check and both download+merge; verify SPECIALTY_PACKS being currently empty is the only guard and add a comment documenting this TOCTOU assumption
[ ] `store/srsStore.ts:commitSession:65` — merges card rating, session state, and streak in a single Zustand `set()` call; verify the interrupt handler cannot fire a second `commitSession` for the same card while the first `set()` is executing — Zustand `set` is synchronous so this risk is zero, but the assumption should be documented given the FSRS mutation is non-idempotent

## Idempotency Verification
[ ] `store/srsStore.ts:introduceCard:210` — `if (existing && !existing.graduated) return` guards against re-introduction; verify calling `introduceCard` twice for the same `cardId` in the same render cycle (component re-mount during HMR or Strict Mode double-invoke) does not overwrite an existing in-progress `IntroductionRecord` with a fresh one resetting `dayOfPhase` to 1
[ ] `lib/entitlement.ts:activateLicense` — Lemon Squeezy returns an existing activation on duplicate calls with the same key+instance; verify `hooks/useLicenseActivation.ts:handleActivate` does not call `setEntitlement` a second time with stale `validUntil` if the store already holds a newer `lastValidated` timestamp from a background validation
[ ] `store/entitlementStore.ts:purchaseAddOn:137` — `s.purchasedAddOns.includes(code) ? s.purchasedAddOns : [...s.purchasedAddOns, code]` is idempotent; verify at least one test calls `purchaseAddOn` twice with the same code and asserts `purchasedAddOns.length` did not increase, to protect against future refactors breaking the guard

## Production Diagnosability
[ ] `lib/packLoader.ts:readCacheMeta:113` — `[ERR-CACHE-META-${Date.now()}]` logs the error but not the `lang` argument; verify `lang` is included in the ref string (e.g. `[ERR-CACHE-META-${lang}-${Date.now()}]`) so a cache failure for a specific language is diagnosable in production logs without reading source
[ ] `lib/packLoader.ts:fetchManifest:166` — `[MANIFEST_FETCH_FAIL-${Date.now()}]` logs the error but not the URL or HTTP status; verify `manifestUrl()` and `res.status` (where available) are included so a CDN 403 vs 503 is distinguishable in logs
[ ] `hooks/useLicenseActivation.ts:46` — `[ERR-LICENSE-ACTIVATE-${Date.now()}]` includes ref ID; verify the log does NOT include the raw `key` argument (PII risk) but does include enough context (e.g. key prefix or length) to distinguish a network error from a malformed-key error in the field
[ ] `lib/packLoader.ts:readCacheData:126` — `[ERR-CACHE-DATA-${Date.now()}]` logs the error but not `lang`; same gap as `readCacheMeta` — a cache-data read failure for Spanish vs Italian requires source inspection to identify

## Degradation Under Load
[ ] `store/srsStore.ts:getDueCards:153` — iterates the full `unitCards` array passed by the caller (up to ~33,000 cards at B2 for a global session); verify `buildQueue` in `lib/queue.ts` calls this via `getState()` outside render cycles and that the result is not recalculated on every component re-render by memoizing in the calling hook
[ ] `lib/packLoader.ts:memCache:71` — `const memCache = new Map<string, Pack>()` grows without eviction; at two packs (Italian + Spanish, ~33,000 cards each) the footprint is bounded and acceptable; verify `clearCacheForTesting` (exported for tests) also clears `loadedAddOns` and `_storage` so test isolation does not require a full module reload
[ ] `store/srsStore.ts:getIntroductionDueCardIds:235` — iterates `state.introductions` (one new card per day maximum, bounded at ~365 records/year); at 3 years of daily use (~1,095 records) this remains fast; verify this ceiling assumption is documented in a comment so future changes to the one-card-per-day cap trigger a performance re-evaluation

## STRUCTURAL LAYER END

## TEAM_SPECIFIC LAYER
[PRESERVED — populated automatically by /advance after each wave. Do not edit manually. /meet will preserve this section across regenerations.]
[ ] requirements auto-detected from Wave 4 (4x, max severity 9): a fix that looks wired and passes its own unit test can still be dead code in production if the test drives state directly (setState/injected fixtures) instead of the real end-to-end call path — verify every "requirements implemented" claim against a seam test, not a unit test — added: 2026-07-07
[ ] code-quality auto-detected from Wave 4 (9x, max severity 8): check for algorithms that claim to "vary" or "rotate" a value but structurally can only reach a subset of their declared range (e.g. filtering out only the single most-recent value from a fixed-order pool) — added: 2026-07-07
[ ] tests auto-detected from Wave 4 (7x, max severity 6): a test named after an "atomicity" or "single-operation" contract must assert the operation COUNT (e.g. via subscribe + snapshot-count), not just final-state values — final-state-only assertions pass identically under a non-atomic multi-call implementation — added: 2026-07-07
[ ] data-loss auto-detected from Wave 4 (2x, max severity 6): date-validation guards using only isNaN(new Date(str).getTime()) miss day-of-month rollover (e.g. "2026-02-30" silently normalizes to a valid date) — require a round-trip re-format-and-compare check, not isNaN alone — added: 2026-07-07
[ ] security auto-detected from Wave 4 (2x, max severity 5): Object.freeze() on a map/registry only protects the outer object — verify nested config objects are also frozen (or explicitly documented as an accepted trade-off) wherever a Readonly<> type implies full immutability — added: 2026-07-07
[ ] documentation-trust auto-detected from Wave 4 (3x, max severity 2): file-header "USED BY"/dependency comments and deleted TODO markers drift from reality as code changes — verify header claims against an actual grep of callers before trusting them — added: 2026-07-07
