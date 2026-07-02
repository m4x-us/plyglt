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

## Run History
9 runs total. Blind spots: CONTRIBUTING_LANGUAGE.md lifetime refs (run 1); F7 raw LS errors to UI (run 3 — resolved Task #089); missed deactivation Ok(()) → null serialization bug until run 5; missed CI audit/lint gaps until run 6. No new blind spots — both findings detected in the new Batch 12-13 specialty pack code (run 7). Run 9: AUTO-UPDATER SIGNING resolved; Task #120/#154/#155 verified clean — no new findings.
