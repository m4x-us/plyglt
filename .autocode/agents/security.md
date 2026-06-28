---
agent: security
last-updated: 2026-06-27
runs: 3
---
# Security Agent Memory — plyglt

## Codebase Model

**Auth / entitlement model:** Client-only. No server-side purchase verification. Entitlement state lives in Zustand (`store/entitlementStore.ts`) and is mutable via DevTools. Owner decision: intentional for offline-first architecture. The Lemon Squeezy integration (`lib/entitlement.ts`) calls the LS API for activation/deactivation but there is no re-verification path on startup or on backup import.

**Data flow:** Language packs are fetched over HTTPS from `/packs/${lang}.json` and cached in localStorage. SHA-256 hash verification of cached packs is present (`lib/packLoader.ts:184-192`). The lang parameter is validated against `ALL_PACK_CODES` allowlist at the entry of both `loadPack()` and `evictPack()` before any I/O (Task #003, 2026-06-25).

**Backup/restore:** `lib/importBackup.ts` handles full state import. Validation is thorough — regex, allowlist, `isFinite()` checks before any state mutation. Backup can restore paid entitlement without server re-verification (accepted risk). Default fallback for unknown licenseType is "free" here (asymmetric with migrations — see open findings).

**Tauri IPC layer:** Desktop-specific commands wrapped in `lib/tauri.ts`. IPC calls include `update_interrupt_config` (lines 59-65) and `snooze_interrupt` (lines 71-77), both now have proper try/catch with logging and re-throw. `checkForUpdates` (lines 131-134) logs `[ERR-UPDATER-...]`. Major IPC error handling is resolved as of Batch 3. Remaining: `listen()` promise chains in `components/InterruptHandler.tsx` (lines 91, 104) and `enterMandatoryMode()` (line 70) still lack error handling.

**Feature flags:** `lib/featureFlags.ts` reads `NEXT_PUBLIC_FLAGS_*` env vars. Flags default to true when env var is absent. `components/InterruptHandler.tsx` reads the feature flag and returns null or `<InterruptHandlerCore/>` accordingly.

**License hooks:** `hooks/useLicenseActivation.ts` — all three async IPC handlers (activate, validate, deactivate) have try/catch per sev:7 requirement (Batch 3).

**Backup export:** `lib/exportBackup.ts` uses `CURRENT_BACKUP_VERSION` constant — no magic version literals.

**Trust boundaries:**
- Web: browser localStorage is user-controlled; URL parameters and stored values must be validated
- Desktop (Tauri): Rust process runs the interrupt scheduler; JS/Rust IPC errors must be surfaced
- No server trust boundary — all logic is client-side by design

**Key files:**
- `lib/packLoader.ts` — pack fetching, caching, hash verification
- `lib/importBackup.ts` — backup import with validation
- `lib/exportBackup.ts` — backup export with versioned constant
- `lib/tauri.ts` — Tauri IPC wrapper
- `lib/featureFlags.ts` — feature flag reads from env vars, default-true
- `store/entitlementStore.ts` — entitlement state
- `store/migrations.ts` — Zustand migration chain
- `lib/entitlement.ts` — Lemon Squeezy activation/deactivation
- `hooks/useLicenseActivation.ts` — license IPC hook
- `hooks/useExportImport.ts` — export/import hook
- `components/InterruptHandler.tsx` — interrupt UI, notification plugin calls, feature flag gate
- `components/EntitlementValidator.tsx` — entitlement check on load
- `app/settings/page.tsx` — settings UI including backup import
- `src-tauri/src/license.rs` — Rust license open_url handler

## Recurring Patterns

- **Bare `.catch(() => {})` on Tauri IPC calls.** LARGELY FIXED in Batch 3. All major IPC calls (`update_interrupt_config`, `snooze_interrupt`, `checkForUpdates`, pack cache reads) now have structured error logging. Still present: `listen()` chains (InterruptHandler.tsx:91,104 — Task #058) and `enterMandatoryMode()` (InterruptHandler.tsx:70). Pattern likely to recur as new IPC commands are added. Every IPC call must propagate errors to UI state or logs — silent catches are a stop-the-line violation per SCTS.
- **Unvalidated localStorage values used in URL/path construction.** FIXED (Task #003). Pattern still applies: any new feature reading from localStorage and using the value in a URL, file path, or command must validate against `ALL_PACK_CODES` or equivalent allowlist first.
- **Console statements left in production components.** `console.warn` leaking raw third-party API error text is now FIXED (EntitlementValidator, deactivateLicense). Review any new component touching external APIs for console leakage before shipping.

## Accepted Risk Register

These risks were reviewed and accepted by the owner. Do NOT re-raise as new findings.

| Risk | Decision |
|------|----------|
| Client-only entitlement — mutable via DevTools, no HMAC | Intentional. Offline-first architecture. No server-side verification planned. |
| Backup import can restore paid entitlement without Lemon Squeezy re-verification | Intentional. Honor-system model. Document only. |
| No server-side purchase verification on app startup | Same decision as above. |
| Zustand forged JSON bypass — storedVersion matching ENTITLEMENT_VERSION loads raw JSON without re-running migrations | Accepted. Client-only model. More specific than prior entry: attacker must also set unlockedPacks consistently. |

## Known Blind Spots

*(Populated by /patterns after multiple runs.)*

## Past Findings — Open

| Task | Location | Severity | Description |
|------|----------|----------|-------------|
| Task #058 | `components/InterruptHandler.tsx:91,104` | MEDIUM | `listen()` promises have no `.catch()`. If Tauri IPC throws during subscription setup, all interrupt and tray events are silently lost — the interrupt system fails open with no user feedback. |
| — | `components/InterruptHandler.tsx:70` | LOW | `enterMandatoryMode()` not in try/catch. Error propagates as unhandled rejection from async callback; mandatory window lock may silently fail. |
| — | `store/migrations.ts:70` | LOW | Migration v2 coerces any unknown `licenseType` to `"subscription"` (not just the intended legacy `"lifetime"`). Asymmetric with `lib/importBackup.ts` which uses `"free"` as fallback. Policy inconsistency is undocumented. Intentional for offline-first but should be documented in code comment. |
| — | `src-tauri/src/license.rs:open_url:52` | LOW | `open_url` lacks domain allowlisting beyond the `https://` prefix guard. All callers currently use compile-time constants (zero attack surface today). Defense-in-depth: restrict to known LS domains to prevent future misuse if any user-editable URL is ever routed through `openExternalUrl`. |
| — | `lib/featureFlags.ts:17-21` | INFO | Default-true flag evaluation silently accepts `"0"`, `"off"`, `"False"` as enabled (only exact string `"false"` disables). Configuration footgun: an operator expecting `FLAG=0` to disable will be surprised. No injection risk. |
| Known CVEs | `postcss` (via `next`) | MODERATE | 2 moderate CVEs in `postcss` dependency pulled in by Next.js. Not runtime-critical (build tooling only). Fix requires a major Next.js version bump. Accepted for now; track at next Next.js upgrade. |

## Past Findings — Resolved

| Task | Location | Severity | Description |
|------|----------|----------|-------------|
| Task #001 | `lib/entitlement.ts:9-10` | CRITICAL | Lifetime checkout URLs (`italian_lifetime`, `all_languages_lifetime`) removed. All lifetime entitlement code deleted. Resolved 2026-06-24. |
| Task #001 | `app/settings/page.tsx:178` | LOW | Unbound catch on `FileReader` callback in backup import flow. Fixed: `catch (e)` bound + `console.error`. |
| Task #003 | `lib/packLoader.ts:loadPack + evictPack` | HIGH | `lang` param from localStorage not validated before URL interpolation. Fixed 2026-06-25: `ALL_PACK_CODES.includes(lang)` guard added to both `loadPack()` and `evictPack()` before any I/O. |
| Task #004 | `lib/tauri.ts:58` | HIGH | `update_interrupt_config` `.catch(() => {})` — IPC failure silently swallowed. CLOSED Batch 3 (2026-06-27): lines 59-65 now have proper try/catch + logging + re-throw. |
| Task #005 | `lib/tauri.ts:64` | HIGH | `snooze_interrupt` `.catch(() => {})` — IPC failure silently discarded. CLOSED Batch 3 (2026-06-27): lines 71-77 now have proper try/catch + logging + re-throw. |
| Task #006 | `components/InterruptHandler.tsx:73` | MEDIUM | Bare `catch {}` on notification plugin call. CLOSED Batch 3 (2026-06-27): lines 87-89 now log `[ERR-NOTIF-...]`. |
| Task #006b | `components/InterruptHandler.tsx:29` | MEDIUM | `validateLicense` `.then()` has no `.catch()`. CLOSED Batch 3 (2026-06-27): lines 43-45 have catch handler. |
| Batch 1 | `lib/tauri.ts:118` | MEDIUM | `checkForUpdates` bare `catch {}` discards all error context. CLOSED Batch 3 (2026-06-27): lines 131-134 log `[ERR-UPDATER-...]`. |
| Task #007 | `lib/packLoader.ts:91,101` | LOW | Storage-read catch blocks return `null` with no logging. CLOSED Batch 3 (2026-06-27): lines 99,112 both log `[ERR-CACHE-...]`. |
| Task D | `lib/entitlement.ts:207` | MEDIUM | `deactivateLicense` returned `res.error` (raw Lemon Squeezy error string) to caller. CLOSED Batch 3 (2026-06-27): now returns `ERR_DEACTIVATE_NETWORK` constant. |
| Task #009 | `components/EntitlementValidator.tsx:22` | LOW | `console.warn` leaked raw Lemon Squeezy API error text to DevTools in production builds. CLOSED 2026-06-26. |
| Task #059 (partial) | `lib/langRegistry.ts:ALL_PACK_CODES` | MEDIUM | `ALL_PACK_CODES` mutation vector + `PackCode` resolving to `string`. `readonly` + `Object.freeze()` applied. `PackCode` type derivation from `typeof LANGUAGE_REGISTRY[number]["code"]` remains to be verified fully resolved. |
