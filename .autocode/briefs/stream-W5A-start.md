# Adam — Stream W5A — Wave 5 — 2026-08-15

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W5A | #587 #592 #593 #594 #602 #605 #588 #596

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Context

All 8 of your tasks live in the SAME mount-fill effect inside hooks/useStudySession.ts. Read the entire current file first — not just the effect — before touching anything, since #587 (the critical severity-8 finding) requires understanding how app/study/page.tsx calls this hook relative to useIsHydrated().

**#587 is the priority task — fix it first, fully, before touching anything else.**
Root cause: app/study/page.tsx destructures `cards`/`introductions` from `useSRSStore()` before its own `useIsHydrated()` check, and calls `useStudySession` unconditionally. Italian's pack loads synchronously via STATIC_PACKS, so `allCardMap` (the current sole readiness signal, from Task #573) is non-empty almost immediately — but on Tauri, SRS-store hydration is an async `@tauri-apps/plugin-store` file-IPC round trip that can still be in flight. On a cold launch, the mount-fill effect can fire once `allCardMap` is ready but while `introductions`/`cards` are still pre-hydration (empty/default) state. If the fill pass introduces a new card via `introduceCard` during that window, it writes against a store snapshot that then gets overwritten wholesale when Zustand's persist middleware finishes hydrating (a full top-level state replace — see lib/storage.ts and store/srsStore.ts's persist config) — silently discarding the just-created IntroductionRecord. This is the SAME defect class Task #573 already fixed for pack-loading readiness (allCardMap-as-ready-signal + mountFillDoneRef), left open for the sibling SRS-store hydration signal.

Design the fix around a second readiness signal, analogous to #573's pattern: `app/study/page.tsx` already has a `useIsHydrated()` gate (check how it's used there today — it likely early-returns before rendering the study UI, but `useStudySession` may still be called before that return). The cleanest fix is almost certainly to thread hydration-readiness into `useStudySession`'s own gating — either accept a `hydrated: boolean` param and add it to the mount-fill effect's guard (alongside the existing `allCardMap` emptiness check), or gate the call site in page.tsx so the hook only fires its fill logic once both pack AND store are ready. Prefer extending the hook's own readiness check over changing the call site, consistent with how #573 was solved (the hook owns its own readiness invariant) — but read the actual current code before deciding; if page.tsx already fully gates on `useIsHydrated()` before calling the hook at all, the story may be different than assumed here. Verify your fix with a real test that reproduces the race (mount the hook / render the page with pack ready but store not yet hydrated, assert no premature fill) — this is exactly the kind of defect a Deletion Test must catch.

After #587, the remaining 7 tasks are smaller, related error-handling and code-quality items in the SAME effect — fix them in the listed order so each one builds on the last (try/catch first, then the error-boundary question, then update the ref's name/comment and the readiness-invariant comment to describe the final, corrected state, not the pre-fix state).

## Your Tasks (run in this exact order)
1. /task #587  — Fix data-loss: The mount-fill effect gates readiness only on allCardMap (pack-loading) and ignores SRS-store hydrat
2. /task #592  — Fix error-handling: mountFillDoneRef
3. /task #593  — Fix error-handling: An uncaught exception from the mount-fill effect body (same location as F006) propagates out of the 
4. /task #594  — Fix code-quality: mountFillDoneRef's name and its own comment describe post-completion state, but the ref is actually 
5. /task #602  — Fix code-quality: The claim that allCardMap-emptiness can only mean not-loaded-yet is technically false in two reachab
6. /task #605  — Fix async: Within the mount-fill effect, canIntroduceNewCard, introduceCard, and getNearDueCards read live stor
7. /task #588  — Fix edge-case: mountFillDoneRef permanently suppresses re-fill if allCardMap legitimately grows after the one real 
8. /task #596  — Fix async: A cross-tab race exists on the flex daily-new-card maximum

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W5A
[→] #587 — Fix data-loss: The mount-fill effect gates readiness only on allCardMap (pack-loading) and ignores SRS-store hydrat   ← starting now
[ ] #592 — Fix error-handling: mountFillDoneRef
[ ] #593 — Fix error-handling: An uncaught exception from the mount-fill effect body (same location as F006) propagates out of the 
[ ] #594 — Fix code-quality: mountFillDoneRef's name and its own comment describe post-completion state, but the ref is actually 
[ ] #602 — Fix code-quality: The claim that allCardMap-emptiness can only mean not-loaded-yet is technically false in two reachab
[ ] #605 — Fix async: Within the mount-fill effect, canIntroduceNewCard, introduceCard, and getNearDueCards read live stor
[ ] #588 — Fix edge-case: mountFillDoneRef permanently suppresses re-fill if allCardMap legitimately grows after the one real 
[ ] #596 — Fix async: A cross-tab race exists on the flex daily-new-card maximum

## Files You Own (edit ONLY these)
hooks/useStudySession.ts
hooks/useStudySession.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/study/page.test.tsx
app/study/page.tsx
components/InterruptHandler.test.tsx
components/InterruptHandler.tsx
hooks/useInterruptConfig.test.ts
hooks/useInterruptConfig.ts
store/srsStore.ts
tests/srsStore.test.ts

## Task Definitions

### Task #587

### Task #587: Fix data-loss: The mount-fill effect gates readiness only on allCardMap (pack-loading) and ignores SRS-store hydrat

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
The mount-fill effect gates readiness only on allCardMap (pack-loading) and ignores SRS-store hydration readiness. app/study/page.tsx destructures cards/introductions from useSRSStore() before its own useIsHydrated() check and calls useStudySession unconditionally. Italian's pack loads synchronously via STATIC_PACKS while Tauri SRS-store hydration is an async file-store IPC round trip, so on a cold push-tap launch into /study?mode=interrupt, allCardMap is populated before cards/introductions hydrate from their {} defaults. mountFillDoneRef latches true on this first render and cards/introductions are not in the dependency array, so the one real fill pass runs against stale pre-hydration state: selectQualifyingNewCard treats every card as untouched and introduceCard writes a new IntroductionRecord into the still-empty in-memory introductions map. When hydration completes moments later, zustand persist's default merge behavior fully replaces top-level introductions with the persisted value, silently discarding the just-created record while the card's FSRS progress from the unconditional commitSession/handleRate path is kept. The card permanently and silently skips BRAND.md's 22-day intensive introduction cadence with no error or log anywhere. at hooks/useStudySession.ts:mount-time introduce/fill effect (isInterrupt fill pass):144.
NEW

**Acceptance Criteria:**
- [ ] Fix data-loss issue at hooks/useStudySession.ts:mount-time introduce/fill effect (isInterrupt fill pass):144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F001 — severity 8 — data-loss

---

### Task #592

### Task #592: Fix error-handling: mountFillDoneRef

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
mountFillDoneRef.current is set to true before any fill logic executes, and the entire effect body has no try/catch. If anything throws mid-fill, cards already committed via introduceCard remain permanently recorded as introduced today, consuming the daily cap, but never reach the visible queue via the final setQueue call. This session instance never retries since the ref already reads true. at hooks/useStudySession.ts:mount-fill effect body:144.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useStudySession.ts:mount-fill effect body:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F006 — severity 6 — error-handling

---

### Task #593

### Task #593: Fix error-handling: An uncaught exception from the mount-fill effect body (same location as F006) propagates out of the 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
An uncaught exception from the mount-fill effect body (same location as F006) propagates out of the useEffect callback entirely. No error boundary exists around the /study route, so a genuine throw here crashes the whole route to Next.js's default error UI instead of degrading gracefully. at hooks/useStudySession.ts:mount-fill effect body; /study route:144.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at hooks/useStudySession.ts:mount-fill effect body; /study route:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F007 — severity 5 — error-handling

---

### Task #594

### Task #594: Fix code-quality: mountFillDoneRef's name and its own comment describe post-completion state, but the ref is actually 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
mountFillDoneRef's name and its own comment describe post-completion state, but the ref is actually set at the start of the fill body before any of it can fail. The name and comment overclaim a stronger guarantee than the code delivers, directly compounding F006. at hooks/useStudySession.ts:mountFillDoneRef:144.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mountFillDoneRef:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F008 — severity 3 — code-quality

---

### Task #602

### Task #602: Fix code-quality: The claim that allCardMap-emptiness can only mean not-loaded-yet is technically false in two reachab

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The claim that allCardMap-emptiness can only mean not-loaded-yet is technically false in two reachable scenarios: a pack-load error leaves allCardMap permanently empty, and an invalid unitId makes allCards permanently an empty array. Both are currently harmless since the effect's guard correctly no-ops in both cases. at hooks/useStudySession.ts:mount-fill readiness invariant:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount-fill readiness invariant:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F016 — severity 3 — code-quality

---

### Task #605

### Task #605: Fix async: Within the mount-fill effect, canIntroduceNewCard, introduceCard, and getNearDueCards read live stor

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Within the mount-fill effect, canIntroduceNewCard, introduceCard, and getNearDueCards read live store state via get() while selectQualifyingNewCard reads parameters captured from the render closure. This mixed live-read/stale-snapshot pattern could let sync-triggered background patches to cards desync from what canIntroduceNewCard sees. at hooks/useStudySession.ts:mount-fill effect (live get() reads vs closure-captured params):144.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useStudySession.ts:mount-fill effect (live get() reads vs closure-captured params):144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F019 — severity 4 — async

---

### Task #588

### Task #588: Fix edge-case: mountFillDoneRef permanently suppresses re-fill if allCardMap legitimately grows after the one real 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
mountFillDoneRef permanently suppresses re-fill if allCardMap legitimately grows after the one real fill pass, e.g. a specialty-pack merge completing after session mount. No specialty pack is registered ready:true today, so this path has no real caller today. at hooks/useStudySession.ts:mountFillDoneRef exactly-once guard:144.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mountFillDoneRef exactly-once guard:144
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F002 — severity 2 — edge-case

---

### Task #596

### Task #596: Fix async: A cross-tab race exists on the flex daily-new-card maximum

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A cross-tab race exists on the flex daily-new-card maximum. Already self-documented and accepted under CLAUDE.md section 5's client-only entitlement model; no new exploitation surface added by this round. at hooks/useStudySession.ts:INTERRUPT_FLEX_DAILY_MAX cross-tab check:0.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useStudySession.ts:INTERRUPT_FLEX_DAILY_MAX cross-tab check:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F010 — severity 1 — async

---

## Architect Agent Memory (first 100 lines)

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

## Resolved Findings
- **RESOLVED (Task #226, 2026-07-07):** `lib/answerCheck.ts` curly-apostrophe grading bug. Root cause was one level deeper than the reported duplicate alternation in `ITALIAN_ARTICLES`: the pre-existing apostrophe-normalization regex `/['']/g` (in `normalize()`/`normalizeStripped()`) was itself byte-identical on both sides, so it never matched U+2019. Fixed with a single shared `APOSTROPHE_RE = /['’]/g` constant used at all 3 call sites (`normalize`, `normalizeStripped`, `stripArticle`); `ITALIAN_ARTICLES`'s dead duplicate branches removed since apostrophe normalization now happens before the regex runs.
- **RESOLVED (Batch 18 WorldClass, 2026-07-08):** `lib/answerCheck.ts` article-stripping false-positive — `ITALIAN_ARTICLES`/`SPANISH_ARTICLES` had no word-boundary check after the matched article, so any word starting with a plain-word alternative (i/il/lo/la/le/un/una/uno/gli, el/los/las/unos/unas/una/un) had that prefix silently stripped even mid-word (e.g. "isola" → "sola", graded "correct" against an unrelated word). Fixed with a `(?=\s|$)` lookahead on the non-apostrophe alternatives. Two more real bugs in the same function found by a subsequent fresh-eyes pass and fixed in the same cycle: the Levenshtein typo-tolerance length gate used the article-inclusive length instead of the stripped length (an accepted answer carrying an article could grant typo tolerance to a 2-char word); and `stripArticle` was called on untrimmed input, so leading whitespace defeated the anchored regex entirely. 34+ new exact-value regression tests added across `tests/answerCheck.test.ts`/`tests/language.test.ts`.

## Verification Gate (run before writing completion.md)
- `npx tsc --noEmit` — zero errors
- `npm test` — all tests pass (note: other streams are editing other files concurrently;
  a failure in a file you did not touch is not yours to fix, but confirm it via `git status`
  before assuming that)
- `npm run lint` — zero errors
- `scripts/deep-audit.sh` does not exist in this repo (confirmed every prior wave) —
  the real Verification Gate above is the actual acceptance criterion for every task.
- For every NEW assertion you add, run the Deletion Test: temporarily revert the production
  fix and confirm your new test fails, then restore it and confirm it passes. State explicitly
  in your completion.md which tasks got a live Deletion Test vs. a traced-by-hand verification
  (e.g. because the production file was off-limits to you this wave).

IMPORTANT — do not run `git stash` on your own initiative. If `git status` looks messy or
shows changes you don't recognize, report it in your completion.md rather than resolving it
yourself with a repo-wide command — a prior wave (B2 audit round 1) lost 8 units of another
agent's uncommitted work this exact way.

## When You Finish
Write your completion summary to .autocode/stream-W5A/completion.md. The file
MUST begin with exactly these two lines, in this exact format, before any other content:

CLOSED: #[NUM] #[NUM] ...
NOT_CLOSED: #[NUM] — [one-line reason]

(If every assigned task closed: `NOT_CLOSED: none`. If none closed: `CLOSED: none`.)

After those two lines, write whatever prose detail is useful.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W5A | #587 #592 #593 #594 #602 #605 #588 #596
