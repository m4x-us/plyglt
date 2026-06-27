---
agent: security
last-updated: 2026-06-26
runs: 2
---
# Security Agent Memory — plyglt

## Codebase Model

**Auth / entitlement model:** Client-only. No server-side purchase verification. Entitlement state lives in Zustand (`store/entitlementStore.ts`) and is mutable via DevTools. Owner decision: intentional for offline-first architecture. The Lemon Squeezy integration (`lib/entitlement.ts`) calls the LS API for activation/deactivation but there is no re-verification path on startup or on backup import.

**Data flow:** Language packs are fetched over HTTPS from `/packs/${lang}.json` and cached in localStorage. SHA-256 hash verification of cached packs is present (`lib/packLoader.ts:184-192`). The lang parameter is now validated against `ALL_PACK_CODES` allowlist at the entry of both `loadPack()` and `evictPack()` before any I/O (Task #003, 2026-06-25).

**Backup/restore:** `lib/importBackup.ts` handles full state import. Validation is thorough — regex, allowlist, `isFinite()` checks before any state mutation. Backup can restore paid entitlement without server re-verification (accepted risk).

**Tauri IPC layer:** Desktop-specific commands wrapped in `lib/tauri.ts`. IPC calls include `update_interrupt_config` and `snooze_interrupt`. Error handling on these calls is currently missing (bare `.catch(() => {})`), which can cause silent divergence between UI state and the Rust scheduler.

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
- `components/EntitlementValidator.tsx` — entitlement check on load
- `app/settings/page.tsx` — settings UI including backup import

## Recurring Patterns

- **Bare `.catch(() => {})` on Tauri IPC calls.** Found on `update_interrupt_config` and `snooze_interrupt`. Pattern likely to recur as new IPC commands are added. Every IPC call must propagate errors to UI state or logs — silent catches are a stop-the-line violation per SCTS.
- **Unvalidated localStorage values used in URL/path construction.** ~~The lang param from localStorage is interpolated into a fetch URL before allowlist validation.~~ FIXED (Task #003). Pattern still applies: any new feature reading from localStorage and using the value in a URL, file path, or command must validate against `ALL_PACK_CODES` or equivalent allowlist first.
- **Console statements left in production components.** `console.warn` in `EntitlementValidator.tsx` leaks raw third-party API error text. Review any new component touching external APIs for console leakage before shipping.

## Accepted Risk Register

These risks were reviewed and accepted by the owner on 2026-06-24. Do NOT re-raise as new findings.

| Risk | Decision |
|------|----------|
| Client-only entitlement — mutable via DevTools, no HMAC | Intentional. Offline-first architecture. No server-side verification planned. |
| Backup import can restore paid entitlement without Lemon Squeezy re-verification | Intentional. Honor-system model. Document only. |
| No server-side purchase verification on app startup | Same decision as above. |

## Known Blind Spots

*(Populated by /patterns after multiple runs.)*

## Past Findings — Open

| Task | Location | Severity | Description |
|------|----------|----------|-------------|
| Task #004 | `lib/tauri.ts:58` | HIGH | `update_interrupt_config` `.catch(() => {})` — IPC failure is silently swallowed. User disables interrupts in UI but Rust scheduler continues firing. |
| Task #005 | `lib/tauri.ts:64` | HIGH | `snooze_interrupt` `.catch(() => {})` — IPC failure silently discarded. User presses Snooze but interrupts continue. |
| Task #006 | `components/InterruptHandler.tsx:73` | MEDIUM | Bare `catch {}` on notification plugin call. Notification failures are invisible to the user. |
| Task #006b | `components/InterruptHandler.tsx:29` | MEDIUM | `validateLicense` `.then()` has no `.catch()` — unhandled rejection on Tauri IPC error. The symmetric fix was applied to `app/settings/page.tsx:46` in Task #001 but this sibling call was not updated. |
| Batch 1 | `lib/tauri.ts:118` | MEDIUM | `checkForUpdates` bare `catch {}` discards all error context including non-network errors. |
| Task #007 | `lib/packLoader.ts:91,101` | LOW | Storage-read catch blocks return `null` with no logging. Silent failures on cache reads. |
| Task D | `lib/entitlement.ts:207` | MEDIUM | `deactivateLicense` returns `res.error` (raw Lemon Squeezy error string) directly to the UI caller. Exposes internal LS error format to user-visible surfaces. Should be mapped to a sanitized message before returning. |
| — | `store/migrations.ts:ENTITLEMENT_MIGRATIONS[2]:70` | LOW | Migration v2 coerces any unknown licenseType to "subscription" (not just the intended legacy "lifetime"). Asymmetric with `lib/importBackup.ts:93` which uses "free" as fallback. On a client-only desktop app this is low-risk (user editing their own localStorage) but the policy inconsistency is undocumented. |
| — (Standalone Audit 3) | `src-tauri/src/license.rs:open_url:52` | LOW | `open_url` lacks domain allowlisting beyond the `https://` prefix guard. All callers currently use compile-time constants (zero attack surface today). Defense-in-depth: restrict to known LS domains to prevent future misuse if any user-editable URL is ever routed through `openExternalUrl`. |
| — (Standalone Audit 3) | `store/migrations.ts + Zustand persist` | LOW | Forged JSON with storedVersion matching ENTITLEMENT_VERSION (e.g. `{"state":{"licenseType":"subscription","unlockedPacks":["es"]},"version":2}`) bypasses all migrations. Zustand persist loads raw JSON into state without re-running migrations when storedVersion = current version. Requires also setting unlockedPacks consistently. Accepted risk (client-only model) but more specific than prior register entry. |
| Task #059 (partial) | `lib/langRegistry.ts:ALL_PACK_CODES:37` | MEDIUM (escalated) | `ALL_PACK_CODES` mutation vector: **PARTIALLY RESOLVED 2026-06-26** — `readonly` + `Object.freeze()` applied to `ALL_PACK_CODES`. Remaining: `as PackCode[]` cast on line 42 still resolves `PackCode` to `string` instead of the expected `"it" \| "es" \| ...` union. Fix: derive `PackCode` from `typeof LANGUAGE_REGISTRY[number]["code"]` instead. |
| Task #003 standalone re-audit | `lib/langRegistry.ts:PackCode:42` | MEDIUM | `PackCode` resolves to `string` because `ALL_PACK_CODES` is cast to `string[]` (line 37 — now `readonly string[]` but cast still widens). `(typeof ALL_PACK_CODES)[number]` is therefore `string`, not the expected `"it" \| "es" \| "fr" \| "de" \| "pt"` union. Any function typed to accept `PackCode` accepts arbitrary strings at compile time. Fix: derive `PackCode` from `typeof LANGUAGE_REGISTRY[number]["code"]` instead. |
| Known CVEs | `postcss` (via `next`) | MODERATE | 2 moderate CVEs in `postcss` dependency pulled in by Next.js. Not runtime-critical (build tooling only). Fix requires a major Next.js version bump. Accepted for now; track at next Next.js upgrade. |

## Past Findings — Resolved

| Task | Location | Severity | Description |
|------|----------|----------|-------------|
| Task #001 | `lib/entitlement.ts:9-10` | CRITICAL | Lifetime checkout URLs (`italian_lifetime`, `all_languages_lifetime`) removed. All lifetime entitlement code deleted. Resolved Cycle 2 — 2026-06-24. |
| Task #001 | `app/settings/page.tsx:178` | LOW | Unbound catch on `FileReader` callback in backup import flow. Fixed in Cycle 2: `catch (e)` bound + `console.error`. |
| Task #003 | `lib/packLoader.ts:loadPack + evictPack` | HIGH | `lang` param from localStorage not validated before URL interpolation. Fixed 2026-06-25: `ALL_PACK_CODES.includes(lang)` guard added to both `loadPack()` and `evictPack()` before any I/O. WorldClass 98/100. |
| Task #009 | `components/EntitlementValidator.tsx:22` | LOW | `console.warn` leaked raw Lemon Squeezy API error text to DevTools in production builds. RESOLVED 2026-06-26 — raw LS error no longer propagated. |
