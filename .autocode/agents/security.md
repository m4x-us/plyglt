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
- RESOLVED: `ci.yml:22` now runs `npm audit --audit-level=high` (confirmed live during Batch 18 cycle-3 re-audit, 2026-07-08 — predates that batch, an earlier stale note here was corrected).
- 2 known moderate vulns: next/postcss chain (ReDoS at build time, not runtime). Unfixable without major Next.js downgrade. Documented in STATUS.md (Task #125).

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

## Batch 18 Remediation Re-Audit (run 11 — Tasks #228-245, post 2026-07-07 FAIL)

**Resolved and verified this run (live-checked, not just read):**
- LANG_CONFIG_MAP shallow freeze (prior sev 3) — RESOLVED. `deepFreezeConfig()` (lib/langRegistry.ts:41-48) freezes `cardLabels` → `uiStrings` → `config`, in that order (innermost first). Live-verified via a throwaway vitest probe: `Object.isFrozen()` is `true` at all 3 levels (config, uiStrings, cardLabels) for both `it` and `es`; mutation attempts at any level throw `TypeError` in the real ESM-strict test environment and leave the value unchanged. Tests at tests/langRegistry.test.ts:123-144 cover top-level and uiStrings-level throws; cardLabels-level throw is not explicitly covered by a checked-in test (only by my probe) — minor test-coverage gap, not a live security gap, since the runtime property holds regardless. Note: `config.articles` (a `RegExp`) is not itself frozen (freezing `config` only prevents *reassigning* `config.articles`, not mutating the RegExp object's own `lastIndex` etc.) — not security-relevant, `articles` is a stateless-usage regex (no `g`/`y` flag reliance on lastIndex found in lib/answerCheck.ts), noted for completeness only.
- entitlement.ts `activateLicense` instanceId type-confusion (prior sev 5) — RESOLVED. `lib/entitlement.ts:139`: guard changed to `if (!res.instance?.id || typeof res.instance.id !== "string")`. Verified truth table by hand: empty string, `0`, `null`/`undefined` id, and non-string truthy values (number, object, boolean) are all rejected; only a non-empty string passes. `lib/entitlement.ts:158` now casts `res.instance.id as string` after the interface changed `instance: {id: unknown}` (was `{id: string}`) — `npx tsc --noEmit` is clean, confirming TS's control-flow narrowing correctly accepts the non-optional `res.instance.id` access post-guard (no new type error introduced). Test `tests/entitlement.test.ts:403-414` ("type-confusion guard") exercises the exact numeric-id case and passes. No new bypass found.

**Still-open finding (partial fix — NOT closed despite being in scope of the same remediation):**
- [sev 6, REPEATED/partial] `store/srsStore.ts:239` `recordIntroductionResult` calls `getDayOfPhase(record.phaseStartDate, today)` with **no try/catch**, while the sibling call site `getIntroductionDueCardIds` (line 250) got a try/catch added in this same batch (Task #234, tested at tests/srsStore.test.ts:556). `getDayOfPhase` throws on calendar-invalid `phaseStartDate` (lib/introduction.ts:52). `recordIntroductionResult` is invoked directly, uncaught, from `app/study/page.tsx:147` inside the `onRate` inline handler — the primary hot path, hit on every single card rating. Live-verified: a throwaway vitest probe confirms `recordIntroductionResult` throws uncaught for a record with `phaseStartDate: "2026-02-30"`. The app has zero ErrorBoundary/componentDidCatch (confirmed again this run), so this throw would crash the whole React tree on the user's next rating action if a persisted record is ever corrupted after the v2→v3 migration runs (migration itself validates and repairs dates at upgrade time, but does not protect against later manual store edits or a future bug writing an invalid `phaseStartDate`). This is exactly the Rule 19b "enforcement symmetry" pattern from philosophy.md — one call site of a throwing function hardened with try/catch and a test, sibling call site of the identical function left exposed with no test proving the gap. Fix: wrap the line 239 call in the same try/catch pattern as line 250, logging cardId + bad value with a ref ID, and decide a safe fallback (e.g. skip the update, or treat as day 1) instead of letting the exception propagate into the click handler.

**Fresh-pass items with no findings:**
- No new hardcoded secrets/credential-shaped strings in any of the 30 changed files' test fixtures (checked via grep for key/secret/token/password patterns).
- `store/migrations.ts` v2→v3 (SRS_VERSION 2→3) correctly validates `phaseStartDate`/`introducedDate` via `isCalendarValidDate` at migration time, with a null/non-object record guard and today-fallback + error logging for corrupt entries — a solid, non-throwing boundary for the migration itself (see caveat above: this does not protect post-migration runtime corruption).
- `getNextCardType` (lib/introduction.ts) — the srsStore wiring that called it was removed as dead code (Task #229) but the function remains exported with a comment explaining why (kept for tests / future sibling-card support). Not a live attack surface — it's a pure function with no I/O; being unused-but-exported is a code-cleanliness note, not a security finding.
- `lib/packLoader.ts` new `Array.isArray(pack.units)` guards (lines ~213, ~232) only apply to the offline-stale-cache-serve fallback paths (network down / fetch non-ok), not the SHA-256-verified network path — this is a shape-integrity improvement on an already-documented trust boundary (persisted storage), not a new boundary.
- `lib/answerCheck.ts` apostrophe-normalization fix (curly ’ U+2019 vs straight ' U+0027) is a correctness fix to grading, not security-relevant; no injection surface (regex literals, no dynamic construction from user input).

## Run History
11 runs total. Blind spots: CONTRIBUTING_LANGUAGE.md lifetime refs (run 1); F7 raw LS errors to UI (run 3 — resolved Task #089); missed deactivation Ok(()) → null serialization bug until run 5; missed CI audit/lint gaps until run 6. No new blind spots — both findings detected in the new Batch 12-13 specialty pack code (run 7). Run 9: AUTO-UPDATER SIGNING resolved; Task #120/#154/#155 verified clean — no new findings. Run 10 (Batch 18): F07/F11 resolved and verified; new uncaught-throw blast-radius finding (getDayOfPhase) and shallow-freeze-consistency finding (LANG_CONFIG_MAP) — no ErrorBoundary anywhere in the app is a standing gap worth escalating if more throw-on-corrupt-data patterns get added. Run 11 (Batch 18 remediation re-audit): LANG_CONFIG_MAP deep-freeze and entitlement instanceId type-confusion both genuinely resolved and live-verified. The getDayOfPhase uncaught-throw finding was only half-fixed — remediation hardened the call site it wrote a test for (getIntroductionDueCardIds) and left the sibling call site (recordIntroductionResult, actually the hotter path) exposed. Lesson for future runs: when a prior finding names multiple call sites of the same throwing function, explicitly grep all call sites again post-remediation rather than trusting the batch's own test additions to indicate full coverage — this is the Rule 19b pattern recurring inside a single finding's remediation, not just across enforcement overlays.
