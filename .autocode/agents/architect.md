# Architecture Agent Memory — plyglt

## Stack
Next.js 16.2.9, React 19, Zustand 5, Tauri 2 (desktop + web). TypeScript throughout.

## Layer Structure (dependencies flow strictly down)
- `app/` — Next.js routes. LIMIT: ≤150 lines. All pages within limit: page=107, study=150, learn=130, stats=146, settings=150.
- `components/` — React UI components. All within limits.
- `hooks/` — Custom React hooks. Own session management contract.
- `store/` — Zustand stores (srsStore, settingsStore, entitlementStore). Imports from lib/.
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.
- `content/` — Static card data and type definitions.

## Key Files and Blast Radius
High blast-radius (many importers — touch carefully):
1. `store/srsStore.ts` — 20 files
2. Entitlement cluster (`lib/entitlement.ts` + `lib/checkout.ts` + `store/entitlementStore.ts`) — 26 files combined
3. `lib/langRegistry.ts` — 20 importers
4. `lib/packLoader.ts` — 5 importers
5. `lib/srs.ts` — 13 importers
6. `lib/tauri.ts` — 8 importers (151 lines — 1 over route limit; within service limit 400; acceptable as gateway — note only)
7. `lib/constants.ts` — 8 importers

## Specialty Pack Architecture (Batch 12 — CURRENT SPRINT)
- `lib/langRegistry.ts` — now exports: `SpecialtyPack` interface (code, baseLang, name, ready:boolean), `SPECIALTY_PACKS` (frozen empty array), `getSpecialtyPacks(lang)` filter helper, `isSpecialtyPackCode(s)` type guard. Task #147 COMPLETE.
- `lib/packLoader.ts:loadPack` guard — restructured to accept ready specialty packs (SPECIALTY_PACKS with ready:true) alongside base packs. No behavior change yet (registry empty). Task #147 COMPLETE.
- Task #148 (COMPLETE 2026-06-30): Entitlement model extended — purchasedAddOns: string[] in EntitlementState, hasAddOn(code) store method + pure function in lib/entitlement.ts, purchaseAddOn(code) idempotent no-op stub, ENTITLEMENT_VERSION=3 + migration v3 (adds purchasedAddOns:[]).
- Task #149 (COMPLETE 2026-06-30): packLoader merge logic for specialty packs alongside base pack. loadedAddOns:string[] module-level array; "base_pack_not_loaded" error variant; specialty path (isReadySpecialtyPack guard — unreachable while SPECIALTY_PACKS empty): baseLang check, download+verify+merge into memCache[baseLang], loadedAddOns.push; getLoadedAddOns() export; clearCacheForTesting reset; hooks/useLangPack.ts LOAD_PACK_ERROR_MESSAGES updated (exhaustiveness); +4 tests.
- Task #150 (COMPLETE 2026-06-30): LanguageGrid.tsx specialty pack UI slot. Added hasAddOn prop; getSpecialtyPacks import; specialtyPacks computed from unlocked base langs; Add-ons section conditionally rendered (empty in production since SPECIALTY_PACKS=[]); 5 states tested: no section when empty, purchased+ready selectable, locked+pricing, hidden when base not unlocked, not-ready "Coming soon". Full data flow registry→loader→entitlement→UI exercised end-to-end. Batch 12 COMPLETE.

## Important Modules (as of Batch 9 COMPLETE)
- `lib/utils.ts` — pure utilities; exports `localDateStr(d?)` for local-time ISO date strings. Used by useStudySession, lib/queue.ts.
- `hooks/useStudySession.ts` — session management hook, 12-param contract. Manages queue, position, ratings, active session commit, session-start introduction auto-selection. Do not add business logic here.
- `components/BuyModal.tsx` — primary conversion surface. Renders annual pricing ($34.99/yr) only — monthly option removed (Task #120). Opens checkout URL via `openExternalUrl`. Receives `onActivate` callback for key entry flow.
- `components/LanguageGrid.tsx` — language picker on app/page.tsx. Implements Free/Unlock/In-development display states. Pro-gating UI.
- `components/EntitlementValidator.tsx` — invisible component mounted in app/layout.tsx. Background license validation + update checking (via UpdateChecker.tsx).
- `components/UpdateChecker.tsx` — (added Task #102) invisible component mounted inside EntitlementValidator.tsx. Calls `checkForUpdates()` on mount in Tauri environments; never auto-installs. Logs availability only.
- `lib/featureFlags.ts` — feature flag framework. All flags are env-var booleans. Exports `isProEnabled(flagValue, licenseType)` — the single combinator all M2 Pro-gated call sites must use instead of inline `licenseType === "subscription"` checks. Currently used by: `components/InterruptHandler.tsx` only. Rule: all new Pro features route through isProEnabled. USED BY comment now correctly lists InterruptHandler.tsx (fixed Task #117).
- `lib/checkout.ts` — (extracted Task #101) checkout URL constants, pricing, portal URL. Re-exported by lib/entitlement.ts. Used by BuyModal.tsx, app/settings/page.tsx, app/page.tsx, LanguageGrid.tsx.
- `lib/licenseTypes.ts` — defines `LICENSE_TYPES` enumeration and `LicenseType` type ("free" | "subscription").
- `store/entitlementStore.ts` — owns `licenseType: LicenseType` (NOT settingsStore — common brief error). Also owns `unlockedPacks`, `purchasedAddOns`, `licenseKey`, `validUntil`. isProEnabled pattern: `import { useEntitlementStore } from "@/store/entitlementStore"` then `const licenseType = useEntitlementStore(state => state.licenseType)`.

## Introduction Engine (M1 — LIVE; Batch 5 audit FAIL 2026-07-02 — OPEN DEFECTS)

`lib/introduction.ts` — pure-function module (no React, no Zustand). Six exports: getDayOfPhase, maxAppearancesToday, shouldAppearToday, recordResult, shouldGraduate, getNextCardType.
Integrated via 4 srsStore actions: introduceCard, recordIntroductionResult, getIntroductionDueCardIds, canIntroduceNewCard.
Session-start activation: hooks/useStudySession.ts mount useEffect calls canIntroduceNewCard → introduces first qualifying card → appends to queue. LIVE since Task #085 (2026-06-29).

### Critical Architectural Defects (discovered Batch 5 audit — must fix before feature is correct)

**[F01 sev:9] Dead write — triple-wrong Day 1 reset never takes effect**
`recordResult` (lib/introduction.ts:101) writes `dayOfPhase: 1` on triple-wrong. But both store callers (`recordIntroductionResult:230` and `getIntroductionDueCardIds:239`) always call `getDayOfPhase(record.introducedDate, today)` which recomputes from the original `introducedDate`, discarding whatever dayOfPhase was stored. BRAND.md "Wrong 3× → resets to Day 1" is never honored. Fix: add `phaseStartDate: string` to IntroductionRecord (separate from introducedDate). Triple-wrong path sets `phaseStartDate: today`. `getDayOfPhase` callers use phaseStartDate, not introducedDate. Requires SRS_VERSION bump + migration.

**[F12 sev:7] Stranded cards — no recovery path for day 22+ non-graduates**
`getDayOfPhase` clamps to 22 (line 44). `maxAppearancesToday(22) = 0`. A card reaching calendar day 22 without 15 consecutive correct answers disappears from both queues permanently — introduction engine sees max=0 (stops scheduling), FSRS ignores it (graduated=false). No error, no recovery. Fix: rescue path in `getIntroductionDueCardIds` or `shouldAppearToday` routing day-22+ non-graduated cards to daily review until graduation.

**[F10 sev:7] canIntroduceNewCard missing BRAND.md spec**
BRAND.md: "Wrong across multiple days → new card introductions pause until this one stabilizes." `canIntroduceNewCard` (srsStore.ts:245-248) only checks whether any card was introduced today — no cross-day failure check. No TODO, no task reference acknowledges the gap.

**[F13 sev:6] introduceCard silently overwrites graduated card data**
Guard at srsStore.ts:211: `if (existing && !existing.graduated) return` — a graduated card falls through and is silently re-introduced, resetting introducedDate, totalEncounters, consecutiveCorrect, and graduated=false. Destroys all historical progress without error.

### Active Defects (sev 5-6 — medium priority)

**[F02 sev:5]** `shouldAppearToday` days 11-21 (0.5 branch, line 59): returns `dayOfPhase % 2 === 1` with no check on `appearancesToday`. On odd phase days a card can appear in every session all day with no cap. Fix: add `const appearances = record.lastSeenDate === today ? record.appearancesToday : 0; return appearances < 1;` after the odd-day check.

**[F03 sev:5]** `getNextCardType` has zero production callers (not imported by srsStore). `lastSeenType` is initialised to null and never written after introduction. The variety rule (BRAND.md: "each encounter uses a different retrieval angle") is completely unenforced. Fix: wire getNextCardType call in `recordIntroductionResult`; write returned CardType back to record.lastSeenType.

**[F09 sev:5]** `consecutiveWrongToday` never resets on calendar day boundary. Field is named "Today" and documented "wrong streak today" but accumulates across sessions. User with 2 wrong on day N + 1 wrong on day N+1 triggers Day 1 reset the spec does not intend.

**[F06 sev:6]** Magic literals 15 (graduation) and 3 (consecutive-wrong reset) appear in two functions each without named constants. If threshold changes, both sites must be updated manually with no sync test.

**[F07 sev:6]** `MAX_APPEARANCES_BY_PHASE_DAY` exported without Object.freeze() — any importer can corrupt the global schedule. Fix: `Object.freeze({...})` at line 9.

**[shouldGraduate note]** `shouldGraduate` has zero production callers — graduation is determined by the `graduated` field written by `recordResult`. The two graduation checks (shouldGraduate:line 66 and recordResult:line 94) share no constant. Wire `shouldGraduate` into `recordIntroductionResult` as the canonical graduation gate, or document its role as a utility for external callers only.

## Auto-Updater Architecture
- `tauri-plugin-updater` registered in src-tauri/src/lib.rs and Cargo.toml.
- `lib/tauri.ts:checkForUpdates()` — implemented, called by UpdateChecker.tsx on mount.
- RESOLVED (Task #121 COMPLETE): `src-tauri/tauri.conf.json:46` now has a real ed25519 pubkey (base64 minisign key). No longer a placeholder.
- PLACEHOLDER still: update endpoint = "https://github.com/REPLACE_WITH_REPO/releases/latest/download/latest.json". Task #123 (Batch 10).
- No release workflow exists. No macOS signing. No notarization.

## M2 Readiness State (Batch 10 CURRENT SPRINT)
- Quality hardening COMPLETE (Batch 9 done 2026-06-30).
- LS store: LIVE — Task #120 COMPLETE. Real annual checkout URL in lib/checkout.ts:12. Monthly pricing ($4.99/mo) removed; annual-only ($34.99/yr). CHECKOUT_URLS.monthly removed; only CHECKOUT_URLS.annual exists.
- Spanish pack: es.json exists (245KB, v0.9.0) but NOT ready — lib/langRegistry.ts:31 ready:false. Content still being authored.
- M2 release scope: macOS first, then Windows/Linux in Batch 11.
- CI hardening COMPLETE (Task #115): ci.yml now has lint + coverage + audit-level=high.
- RULE 1 RESOLVED (Task #156 COMPLETE 2026-07-01): `lib/packLoader.ts` reduced 426→363 lines. Specialty pack logic extracted to `lib/specialtyPackLoader.ts` (116 lines, Rule 2 header). `getLoadedAddOns` re-exported from packLoader.ts via `export { getLoadedAddOns } from "@/lib/specialtyPackLoader"` — callers unchanged.

## isProEnabled Audit (COMPLETE — Task #118)
All production `licenseType === "subscription"` occurrences resolved:
- `lib/featureFlags.ts:26` — isProEnabled body itself. Correct.
- `app/settings/page.tsx:91` — display label. Comment added: `{/* display label — not a feature gate */}`.
- `app/settings/page.tsx:100` — "Manage subscription →" button. Documented as intentional exception: no `manageSubscription` feature flag exists; button is correctly conditioned on licenseType alone.

## Dead Zones (features mentioned in docs but no implementation)
- `vacationMode` flag in featureFlags.ts — no store action, no UI, no scheduler logic. Intentional stub.
- `analytics` flag — now connected to stats page Pro gate (Task #155 scheduled). Gate was missing; stats page was always visible regardless of Pro status.
- Forecast ("B2 in ~7 months") — no code
- Custom cards — no code
- Sync — intentionally deferred to M4
- On-lock/wake interrupt triggers — M3 scope
- Push notification permission UI — Task #124 (Batch 10, UX only)

## Batch 13 — Quality Foundation (COMPLETE — 2026-06-30)
All 3 tasks closed. Key outcomes:

- Task #151 (COMPLETE): Content depth audit result: **unitCount=63, cardCount=3680**.
  - A1 milestone (20 units, ~2,600 cards): COMPLETE ✓
  - A2 milestone on units (50 total): COMPLETE ✓ (63 ≥ 50); card depth (3,680) lags A2 target (~8,300) — not a blocker
  - B1 progress: 63 of 85 units (22 remaining). B2: 63 of 125 (62 remaining).
  - No content tasks created — unitCount well above A1 trigger threshold.
  - public/packs/it.json and manifest.json regenerated (935KB, v1.0.0, 63 units, 3,680 cards).

- Task #152 (COMPLETE): 3 tests added to `tests/packLoader.test.ts` in "specialty pack merge path" describe block. Mock strategy: `vi.hoisted<SpecialtyPack[]>(() => [])` creates mutable array referenced inside `vi.mock` factory. Global `beforeEach` clears it so all 28 existing packLoader tests continue to see `SPECIALTY_PACKS = []`. The isReadySpecialtyPack branch is no longer dead code (removing it causes 3 test failures).

- Task #153 (COMPLETE): Playwright E2E smoke test added. Port 3099 (not 3000 — local "System 1701" auth portal runs on 3000). `test:e2e` script separate from `npm test`. 1 smoke test: language picker → /learn → A1 unit → StudyCard → card advance. Unit test count unchanged at 891.

## NEW FINDINGS RUN 9 (2026-07-01)

1. **RULE 1 VIOLATION** — `app/stats/page.tsx` is 158 lines; app route limit is ≤150. Task #155's Pro gate addition (lines 17-24) pushed it 8 lines over. Needs decomposition: the "not Pro" fallback (lines 17-24) should extract to a `<StatsProGate />` component in components/.

2. **POKA-YOKE VIOLATION: duplicate sha256Hex** — `lib/packLoader.ts:94` and `lib/specialtyPackLoader.ts:21` define identical `sha256Hex(text)` implementations. Should be extracted to `lib/utils.ts` (already owns pure utilities). This is a Poka-yoke stop-the-line: a parallel implementation of the same function is wrong, not just messy.

3. **POKA-YOKE VIOLATION: duplicate packUrl** — `lib/packLoader.ts:141` and `lib/specialtyPackLoader.ts:17` define identical `packUrl(lang)` functions. Same fix: extract to a shared location (either `lib/utils.ts` or keep it in packLoader and export it for specialtyPackLoader to import).

4. **TYPE-CIRCULAR DEPENDENCY** — `lib/specialtyPackLoader.ts:9` imports `Pack`, `LoadPackResult`, `Manifest` types from `lib/packLoader.ts`; `lib/packLoader.ts:32` imports functions from `lib/specialtyPackLoader.ts`. This is a circular module reference. TypeScript's `import type` prevents a runtime cycle but the design is architecturally fragile. Fix: extract `Pack`, `LoadPackResult`, `Manifest`, `PackMeta`, `CachedPackMeta` to `lib/packTypes.ts` — both files import from there; the cycle disappears.

5. **STALE CLAUDE.md — checkout.ts description** — CLAUDE.md Architecture section bullet for `lib/checkout.ts` still reads "pricing ($4.99/mo, $34.99/yr)". After Task #120, monthly is removed; correct description is "pricing ($34.99/yr, annual-only)".

6. **STALE CLAUDE.md — Pack Format section** — CLAUDE.md Section 6 says "`lib/packLoader.ts` handles the merge path: `loadedAddOns` tracks which add-ons are in memory; `getLoadedAddOns()` exposes this list." After Task #156, all of this lives in `lib/specialtyPackLoader.ts`. CLAUDE.md does not mention `lib/specialtyPackLoader.ts` at all.

7. **TASK #121 RESOLVED** — `src-tauri/tauri.conf.json:46` has a real base64 minisign ed25519 pubkey. Remove from open findings. (Update already applied above.)

## NEW FINDINGS RUN 8 (2026-07-01)

1. **RULE 1 RESOLVED** — `lib/packLoader.ts` reduced to 363 lines (Task #156 COMPLETE). `lib/specialtyPackLoader.ts` created.

2. **STOP-THE-LINE** — `components/InterruptHandler.tsx:39-56` duplicates license revalidation from `EntitlementValidator.tsx`. Two concurrent LS API calls on every app launch when validation is due. Task #154 scheduled (highest priority — first task in Batch 14).

3. **RULE 2 VIOLATION (x3)** — `src-tauri/src/lib.rs`, `interrupt.rs`, `license.rs` have no plain English headers describing their role, inputs, and outputs. Task #159 scheduled.

4. **BATCH 14 ACTUAL STATE CORRECTION** — Prior memory stated Batch 14 covers "the JS/React/Zustand layer ONLY." This is wrong. `interrupt.rs` (152 lines) and `InterruptHandler.tsx` (124 lines) already exist and are complete from M2 work. Batch 14 is macOS OS hooks + pre-extractions only. See updated Batch 14 scope in Strategic Roadmap below.

5. **PRE-EXTRACTIONS REQUIRED FOR BATCH 14** — `setup_tray()` (~40 lines in `lib.rs`) must be extracted to `tray.rs` (Task #160) before OS hooks are added. Interrupt IPC must be extracted from `lib/tauri.ts` (151 lines) to `lib/tauriInterrupt.ts` (Task #161).

## Strategic Roadmap — Agreed 2026-07-01 (owner decision — do not override)

Infrastructure and shipping take priority over content. 63 units (3,680 cards) is sufficient
to validate the product and retain early users. Content expansion comes after the full
infrastructure stack is shipped.

**Agreed milestone order:**

### Milestone 1 — Mac shipping (Batch 10 — CURRENT)
3 owner actions unblock everything: LS store (#120), signing keypair (#121), Apple Developer cert (#122).
Tasks #123–#125 follow immediately once unblocked.
Gate: signed, notarized .dmg downloadable by a stranger.

### Milestone 2 — M3: Proactive Interruption Engine (Batch 14 — IN PROGRESS)
The core product differentiator. Without this, plyglt is just another SRS app.
Desktop mechanic: tray notification → mandatory overlay → 3–5 cards → dismiss.
Triggers: schedule (every N hours), computer wake/unlock, idle time detection.

**ACTUAL STATE (confirmed run 8 — 2026-07-01):**
The JS/React layer and the core Rust engine are ALREADY COMPLETE from M2 work:
- `src-tauri/src/interrupt.rs` (152 lines) — InterruptState, 30-second poll thread, 4 IPC commands. COMPLETE.
- `components/InterruptHandler.tsx` (124 lines) — JS side handler. COMPLETE.

**Batch 14 actual scope — macOS OS hooks + pre-extractions only:**
- Add `src-tauri/src/os_events.rs` — wake/unlock/idle OS hooks for macOS (NSWorkspace/CGEventSource)
- Pre-extract `setup_tray()` (~40 lines in lib.rs) → `src-tauri/src/tray.rs` (Task #160) before adding hooks
- Pre-extract interrupt IPC from `lib/tauri.ts` → `lib/tauriInterrupt.ts` (Task #161)
- Add OS trigger toggles to settingsStore + settings page

**What is explicitly NOT in Batch 14:**
- Windows system event hooks (WM_POWERBROADCAST, GetLastInputInfo) → Batch 15
- Linux system event hooks (systemd-logind D-Bus, XScreenSaverQueryInfo) → Batch 15

**Why:** Tauri does NOT abstract OS-level system events. Wake detection, unlock detection,
and idle detection each require platform-specific Rust code (macOS: NSWorkspace/CGEventSource;
Windows: WinAPI; Linux: D-Bus/X11). Writing and testing three platform implementations
simultaneously adds risk. Mac ships first; Windows/Linux Rust implementations follow in
Batch 15 once the Mac version is validated.

Gate: interrupt fires on schedule on Mac, forces a 3-card session, dismisses cleanly.

### Milestone 3 — Windows + Linux (new Batch 15 — NO TASKS YET)
Packaging only — M3 interruption engine ports with minimal changes since it was built cross-platform.
Work includes: Windows code signing (EV cert or Azure Trusted Signing), NSIS/MSI installer,
auto-updater config for Windows. Linux: AppImage as primary format, optional .deb/Snap.
The auto-updater endpoint (Task #123) must be live before this milestone.
Gate: working signed installer on Windows 11 + AppImage on Ubuntu 22.04.

### Milestone 4 — Sync backend: design + build (new Batch 16 — NO TASKS YET)
This is a backend product, not a feature. Must be designed before mobile begins.
What syncs: SRS card state (reviews, due dates, stability, streaks), settings, entitlement.
Model: offline-first. All writes go local first; sync when online. Conflict resolution needed
(user reviews on Mac and iPhone before sync — last-write-wins is wrong for SRS data).
Backend decision pending: Supabase (Postgres + realtime, fast), Firebase, or custom server.
Auth decision pending: Apple Sign In + Google Sign In minimum (required for App Store).
Push notification infrastructure lives here too — a server that sends APNs (iOS) and FCM
(Android) notifications on the interrupt schedule. This is required for mobile interruptions.
Gate: SRS state syncs bidirectionally between two desktop instances with no data loss.

### Milestone 5 — Mobile: iOS + Android (new Batch 17 — NO TASKS YET)
Depends on Milestone 4 (sync) being live. Mobile without sync = two separate silos.
Tauri 2 has mobile support (alpha/beta maturity). iOS requires Apple Developer account
(already needed for Mac). Android requires Play Console account.
Interruption mechanic on mobile = push notifications via APNs/FCM from the sync backend.
The "mandatory overlay" desktop mechanic becomes a notification tap → in-app session.
Gate: app installable from App Store + Play Store; progress syncs with desktop automatically.

## What is missing from the task list (as of 2026-07-01)
Batch 14 is now active (Tasks #154–#164 in .autocode/tasks.md). Remaining:
- **Batch 15:** Windows + Linux packaging + signing + auto-updater (NO TASKS YET)
- **Batch 16:** Sync backend (architecture, auth, API, push notification server) (NO TASKS YET)
- **Batch 17:** Mobile (Tauri iOS/Android, App Store/Play Store, push notification client) (NO TASKS YET)

## Open Findings (Batch 10 scope)
- LS store LIVE — Task #120 COMPLETE (owner action done)
- Auto-updater pubkey WRITTEN — Task #121 COMPLETE (owner action done)
- macOS signing null — Task #122 (owner action — still pending)
- No release workflow — Task #123 (blocked by #122; endpoint still placeholder)
- Notification permission onboarding — Task #124
- STATUS.md CVE documentation — Task #125

## Open Findings (Batch 14 scope — run 9)
- Task #154 COMPLETE: duplicate license revalidation removed from InterruptHandler.tsx (now 102 lines)
- Task #155 COMPLETE: analytics Pro gate added to app/stats/page.tsx (isProEnabled at line 17) — BUT introduced Rule 1 violation (see New Findings Run 9)
- lib/packLoader.ts Rule 1 violation (426 lines) — RESOLVED by Task #156 (specialtyPackLoader.ts, 116 lines)
- Rust file headers missing (lib.rs, interrupt.rs, license.rs) — Task #159
- Pre-extract setup_tray() → src-tauri/src/tray.rs — Task #160
- Pre-extract interrupt IPC → lib/tauriInterrupt.ts — Task #161
- Tasks #162–#164: macOS OS hooks (os_events.rs) — wake, unlock, idle detection

## Past Findings — Resolved (do not re-report)
- Task #120 (LS store creation): COMPLETE — real checkout URL live in lib/checkout.ts:12
- Task #121 (ed25519 pubkey): COMPLETE — tauri.conf.json:46 has real key
- Task #154 (duplicate license revalidation in InterruptHandler.tsx): COMPLETE — removed; file now 102 lines
- Task #155 (analytics Pro gate): COMPLETE — isProEnabled gate at app/stats/page.tsx:17 (but introduced Rule 1 violation — see Run 9 findings)
- lib/importBackup.ts upward import: RESOLVED (Task #013)
- fr/de/pt stubs: REMOVED (Batch 3)
- PackCode type widening: FIXED
- app/page.tsx 253-line Rule 1 violation: RESOLVED (Task #087)
- app/settings/page.tsx decomposition: RESOLVED (Task #026 + subsequent)
- app/stats/page.tsx Rule 1: RESOLVED (Task #080)
- lib/entitlement.ts raw LS errors to UI: RESOLVED (Task #089)
- InterruptHandler listen() missing .catch(): RESOLVED (Task #083)
- lib/featureFlags.ts Rule 2 USED BY comment: RESOLVED (Task #117)
- isProEnabled combinator not at all call sites: RESOLVED (Task #118)
- CI missing lint + coverage + audit: RESOLVED (Task #115)
- CLAUDE.md 7 gaps from Batch 8: RESOLVED (Task #116)
- 4 app page routes missing tests: RESOLVED (Tasks #111–#114)

## Run History
9 runs total. Blind spots: missed importBackup upward import (run 1); missed stats/page.tsx Rule 1 (run 2); missed app/page.tsx 253-line violation until run 4; missed Task #001 W-series stale checkboxes in tasks.md; missed featureFlags.ts Rule 2 comment until run 6; Batch 9 closed all open arch findings (run 7); run 8 — corrected Batch 14 actual state; new Rule 1 violation (packLoader 426 lines); stop-the-line duplicate revalidation; 3 Rust files missing headers. Run 9 — Task #154/#155/#121/#120 COMPLETE; new Rule 1 violation (stats/page.tsx 158 lines); duplicate sha256Hex/packUrl across packLoader+specialtyPackLoader; type-circular dependency; 2 stale CLAUDE.md entries.
