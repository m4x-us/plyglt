# Security Agent Memory — plyglt

## Trust Boundaries
1. Lemon Squeezy API response (via Tauri IPC) → `lib/entitlement.ts` — `raw as LsActivateBody` structural cast only; field-presence checks guard happy path but do not reject unexpected types.
2. User-supplied license key → `hooks/useLicenseActivation.ts:21` → forwarded to LS API. After Task #098: length cap (200 chars) + alphanumeric+hyphen allowlist.
3. Persisted Zustand store (localStorage / Tauri store) → hydrated without runtime type validation; used in pack-unlock decisions.
4. Pack JSON from network → `lib/packLoader.ts` — SHA-256 verified before use. Integrity check is correct and robust.
5. Tauri IPC commands → `lib/tauri.ts:invoke()` — cmd is always a hardcoded string literal; Tauri backend uses `generate_handler![]` allowlist. No injection surface.
6. Update manifest from endpoint → `src-tauri/tauri.conf.json:46` — REAL ed25519/minisign pubkey in place (Task #121 COMPLETE). Key ID: 14D036725CBB20B9. Signature verification is now active.

## Resolved Findings (do not re-report)
- lifetime checkout URLs — DELETED (Task #001)
- monthly checkout URL — REMOVED; lib/checkout.ts is now annual-only (Task #120)
- auto-updater signing placeholder — REPLACED with real minisign pubkey (Task #121, COMPLETE run 9)
- InterruptHandler duplicate license revalidation — REMOVED (Task #154)
- Stats page analytics gating — ADDED via isProEnabled gate (Task #155)
- lang injection in packLoader — FIXED (Task #003)
- IPC silent catches — FIXED (Batches 1-3)
- EntitlementValidator console.warn leaking API error — FIXED
- deactivateLicense raw LS error to UI — FIXED (Task #074)
- ALL_PACK_CODES as readonly string[] — FIXED
- lib/importBackup.ts upward import — FIXED
- fr/de/pt stubs corrupting LANG_CONFIG_MAP — REMOVED
- InterruptHandler listen() chains without .catch() — FIXED (Task #083)
- activateLicense/validateLicense raw LS errors to UI — FIXED (Task #089)
- Deactivation always-failure bug — FIXED (Task #095)
- Auto-download without consent — FIXED (Task #096, checkForUpdates() now returns availability without auto-installing)
- enterMandatoryMode() bare await + touchValidated() gap — FIXED (Task #097)
- License key format/length validation — FIXED (Task #098)
- featureFlags "0"/"off"/"False" not recognised as false — FIXED (Task #099)

## Introduction Engine Security Findings (Batch 5 audit — 2026-07-02)

**[F07 sev:6] MAX_APPEARANCES_BY_PHASE_DAY exported unfrozen (lib/introduction.ts:9)**
`export const MAX_APPEARANCES_BY_PHASE_DAY: Record<number, number> = { ... }` — no `Object.freeze()`. Any same-process importer can mutate `MAX_APPEARANCES_BY_PHASE_DAY[1] = 0` and silently disable Day 1 scheduling for all cards. In a Tauri webview, exploitable by injected script in rendered card content. Fix: `export const MAX_APPEARANCES_BY_PHASE_DAY = Object.freeze({ ... })` with `Readonly<Record<number, number>>` type.

**[F11 sev:5] getDayOfPhase NaN propagation on malformed date strings (lib/introduction.ts:42)**
`new Date(invalid_string).getTime()` returns NaN. `Math.max(1, NaN)` returns NaN (not 1 — spec-defined). NaN propagates to `maxAppearancesToday(NaN)` → `undefined ?? 0` → `shouldAppearToday` returns false. A card with a corrupted `introducedDate` silently disappears from the introduction queue forever with no error, no log, no user feedback. Fix: add format validation (`/^\d{4}-\d{2}-\d{2}$/.test(str)`) before `new Date(str)`, throw with ref ID on invalid input.

**[F20 sev:3] today param is caller-controlled with no clock validation (lib/introduction.ts, store/srsStore.ts)**
`recordIntroductionResult` and `getIntroductionDueCardIds` accept `today` from the caller without validation against `Date.now()`. A caller alternating date strings bypasses the daily appearance cap. Low practical risk in offline Tauri context (all callers currently use `localDateStr()`), but the contract is implicit not enforced. No fix required now — monitor if more call sites are added.

## Open / Monitoring
- F5: `src-tauri/src/license.rs:open_url` — HTTPS-only check, no domain allowlist → accepted risk; all callers use hardcoded constants from lib/checkout.ts
- F6: `lib/entitlement.ts` String(e) in deactivate catch — may embed IPC error; key truncated to 8 chars before log. Low-confidence exploitation. Monitoring.
- S1 (NEW — run 7): `purchaseAddOn()` in `store/entitlementStore.ts:137` accepts unvalidated specialty pack codes. Defense-in-depth maintained by loadPack registry guard (invalid codes return "invalid_lang" error). Action required only when real LS add-on payment is wired: validate receipt code against `isSpecialtyPackCode()` before calling `purchaseAddOn()`. Not actionable now — SPECIALTY_PACKS is empty.
- S2 (NEW — run 7): `lib/packLoader.ts:233-239` — specialty pack merge path skips SHA-256 when manifest unavailable. Unlike base packs, add-on packs have no platform-storage cache. A manifest fetch failure on every session means every add-on load is unverified. Path is dormant (SPECIALTY_PACKS empty). Fix before first specialty pack ships: require manifest entry for all add-on codes, or add persistence layer for add-on packs.

## CRITICAL Batch 10 Blockers (ship-blockers for M2)
- AUTO-UPDATER SIGNING: RESOLVED (Task #121 COMPLETE). Real minisign pubkey `14D036725CBB20B9` at `src-tauri/tauri.conf.json:46`. Verified via base64 decode — valid minisign format, not a placeholder.
- macOS SIGNING NULL (DISTRIBUTION BLOCKER): `src-tauri/tauri.conf.json:41` signingIdentity = null. Gatekeeper blocks unsigned binaries. Task #122. STILL OPEN (Apple enrollment pending).
- NO RELEASE WORKFLOW: `.github/workflows/` has only ci.yml. No signed build, no artifact upload. Task #123. STILL OPEN.
- UPDATE ENDPOINT PLACEHOLDER: `src-tauri/tauri.conf.json:48` endpoint still `REPLACE_WITH_REPO`. Task #123 updates this when release.yml creates real releases. STILL OPEN.

## CI Security Gaps (Batch 9 scope — Task #115)
- No `npm audit` step in ci.yml — high/critical CVEs pass silently through CI.
- 2 known moderate vulns: next/postcss chain (ReDoS at build time, not runtime). Unfixable without major Next.js downgrade. Document in STATUS.md (Task #125). Gate CI on `--audit-level=high` only.

## Auto-Updater Security Requirements (Task #121, #122, #123)
- Generate ed25519 keypair: `tauri signer generate -w ~/.tauri/plyglt.key`
- Public key → `src-tauri/tauri.conf.json:updater.pubkey`
- Private key → CI secret `TAURI_SIGNING_PRIVATE_KEY` (NEVER committed)
- macOS: APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID
- Update endpoint → real GitHub Releases URL (after Task #123 creates release.yml)

## Intentional Design (do not raise as findings)
- Client-only entitlement — honor-system, no server-side verification. Decision 2026-06-24.
- No webhook endpoint — manual key activation by design.
- Interrupt engine ungated (free users can enable) — owner decision 2026-06-29.
- Spanish pack (es.json) hidden by ready:false — intentional; content not ready.

## Batch 18 Audit (run 10 — Introduction Engine Remediation + Correctness Hardening, #178-186/#226/#227)

**Resolved this batch:**
- F07 (unfrozen MAX_APPEARANCES_BY_PHASE_DAY) — RESOLVED. `Object.freeze()` applied (lib/introduction.ts:12-35); values are all primitive numbers, shallow freeze is sufficient here (no nested-object gap).
- F11 (NaN propagation on malformed date strings) — RESOLVED via DATE_RE format guard + throw in `getDayOfPhase` (lib/introduction.ts:52-57). See new finding below — the throw is uncaught anywhere in the call chain.
- entitlement.ts `!res.instance` → `!res.instance?.id` (Task #185) — VERIFIED correct. Optional chaining + falsy check rejects `undefined`, `""`, `0` uniformly, consistent with the existing `!res.license_key.key` pattern in the same file. No new bypass. Pre-existing structural-cast risk (non-string `id` value, e.g. a number, would still pass) is unchanged from Trust Boundary #1 — not new.

**New findings (Batch 18):**
- [sev 5] `getDayOfPhase` (lib/introduction.ts:52) now throws on malformed `phaseStartDate`/`today` instead of silently returning NaN (fixes F11) — but the throw is uncaught by every caller: `store/srsStore.ts` `recordIntroductionResult` (line 244) and `getIntroductionDueCardIds` (line 254, inside a `.filter()` over ALL introduction records) have no try/catch, and the app has zero `ErrorBoundary`/`componentDidCatch` components anywhere (`grep -rln "ErrorBoundary\|componentDidCatch" — no hits`). One corrupted record (e.g. from manual localStorage/Tauri-store edits, which the app already treats as a possible actor — see migration v3 null-record guard) now crashes the *entire* due-card computation and, with no error boundary, likely the whole session — worse blast radius than the silent single-card disappearance it replaced. Fix: wrap the `getDayOfPhase` call sites in srsStore.ts with try/catch that logs a ref ID and treats that one record as not-due, rather than letting the exception propagate; or add a root ErrorBoundary.
- [sev 3] `lib/langRegistry.ts:44-46` `Object.freeze(LANG_CONFIG_MAP)` is shallow. The map's values (`ITALIAN`/`SPANISH` from `lib/language.ts`) are themselves plain objects with a nested `uiStrings` object (itself containing a nested `cardLabels` object) — none of these are frozen. `LANG_CONFIG_MAP.it.uiStrings.correctFeedback = "x"` and `LANG_CONFIG_MAP.it.articles = /.*/ ` still succeed at runtime. Freeze only prevents reassigning/deleting top-level keys on the map itself (e.g. `LANG_CONFIG_MAP.it = evilConfig` or `delete LANG_CONFIG_MAP.es`). Low practical severity — LANG_CONFIG_MAP is UI-string/grading-regex data, not an entitlement or trust-boundary gate — but the same shallow-freeze class as F07, so flagged for consistency. Fix if ever made security-relevant: deep-freeze recursively, or clone before storing in LANG_CONFIG_MAP.
- [sev 2] AGENTS.md's documented "known limitation" of the assertion-quality grep gate (accurate: presence-of-comment not validity-of-justification) is incomplete. Because `grep -rn PATTERN tests/ | grep -v "existence-check:"` operates per matched-line, the `// existence-check:` tag must be on the *same physical line* as the banned assertion to suppress it — a tag placed on the line above (the style actually used in 3/3 real examples in the codebase today, e.g. tests/entitlement.test.ts:195/206) would NOT suppress a real banned-pattern match on the next line, and would fail-closed (blocks the build), not fail-open. Additionally the gate only scans `tests/` with glob `*.test.*` — a shared test-helper file (e.g. `tests/helpers.ts`) wrapping a banned matcher, or an E2E spec under a different naming convention, is outside its scan scope. Currently moot: zero real banned-pattern instances remain in tests/ as of this batch. Not a security bypass in the traditional sense (it fails safe, not open) — noted for completeness per audit checklist item 7.

## Run History
10 runs total. Blind spots: CONTRIBUTING_LANGUAGE.md lifetime refs (run 1); F7 raw LS errors to UI (run 3 — resolved Task #089); missed deactivation Ok(()) → null serialization bug until run 5; missed CI audit/lint gaps until run 6. No new blind spots — both findings detected in the new Batch 12-13 specialty pack code (run 7). Run 9: AUTO-UPDATER SIGNING resolved; Task #120/#154/#155 verified clean — no new findings. Run 10 (Batch 18): F07/F11 resolved and verified; new uncaught-throw blast-radius finding (getDayOfPhase) and shallow-freeze-consistency finding (LANG_CONFIG_MAP) — no ErrorBoundary anywhere in the app is a standing gap worth escalating if more throw-on-corrupt-data patterns get added.
