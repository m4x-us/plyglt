@BRAND.md
@CURRICULUM.md
@AGENTS.md

## Architecture

### 1. Layer Map

The codebase is organized into four layers. Dependencies flow strictly downward — no layer imports from a layer above it.

```
app/          — Next.js routes, pages, and layouts. Thin: no business logic.
components/   — React UI components. Import from hooks/ and lib/ only.
hooks/        — Custom React hooks. Compose lib/ modules and Zustand stores.
lib/          — Pure services and utilities. No React. No Zustand imports.
store/        — Zustand stores (srsStore, settingsStore, entitlementStore).
              — Peer of lib/, not above it. Stores import from lib/, not vice versa.
content/      — Static card data and type definitions. Imported by lib/packLoader.ts.
```

Notable modules:
- `lib/utils.ts` — pure utility functions; exports `localDateStr(d?)`, `sha256Hex(text)`, and `packUrl(lang)`. Used by `hooks/useStudySession.ts`, `lib/queue.ts`, `lib/packLoader.ts`, and `lib/specialtyPackLoader.ts`.
- `lib/packTypes.ts` — shared type definitions for the pack subsystem: `Pack`, `PackMeta`, `Manifest`, `LoadPackResult`. Single source of truth — both `lib/packLoader.ts` and `lib/specialtyPackLoader.ts` import types from here. No React, no Zustand.
- `lib/checkout.ts` — checkout URL constants and pricing ($34.99/yr — annual plan only), plus the customer portal URL. Re-exported by `lib/entitlement.ts`. Used by `components/BuyModal.tsx` and `app/settings/page.tsx`.
- `lib/specialtyPackLoader.ts` — handles specialty pack download, sha256 verification, and unit merge into the base pack's in-memory cache. Exports `loadSpecialtyPack()`, `getLoadedAddOns()`, `clearSpecialtyCache()`. Re-exports `getLoadedAddOns` via `lib/packLoader.ts`. Must remain pure (no React, no Zustand).
- `lib/featureFlags.ts` — feature flag reader (`getFeatureFlags()`); also exports `isProEnabled(flagValue, licenseType)`, a single combinator for all Pro-gated features. Returns `flagValue && licenseType === "subscription"`.
- `lib/srs.ts` — FSRS v4 scheduler; also owns `prerequisitesMet(card, progressMap)` and `selectQualifyingNewCard(allCardMap, cards, introductions)` (Batch 18), the single source of truth for `Card.prerequisites` gating. Used by `store/srsStore.ts`'s `getNewCards` (FSRS new-card queue) and `hooks/useStudySession.ts`'s introduce-on-mount effect (introduction-engine gating) — both routes must stay on this shared implementation so the two subsystems can never diverge on how prerequisites are enforced.
- `hooks/useStudySession.ts` — session management hook; 12-param contract managing queue, position, ratings, active session commit, and session-start introduction auto-selection. Do not add business logic here.
- `components/BuyModal.tsx` — primary conversion surface; renders pricing and opens the checkout URL via `openExternalUrl`. Receives `onActivate` callback for key entry flow.
- `components/UpdateChecker.tsx` — invisible component mounted inside `EntitlementValidator.tsx`. Calls `checkForUpdates()` on mount in Tauri. Never auto-installs.
- `components/LanguageGrid.tsx` — language picker on `app/page.tsx`; implements Free / Unlock / In-development display states. Also renders an Add-ons section (specialty packs) when any registered specialty packs exist for the selected language. Receives `hasAddOn(code)` callback to determine purchase state.

**Rule:** `lib/` must never import from `store/`, `hooks/`, `components/`, or `app/`. `store/` must never import from `hooks/`, `components/`, or `app/`. Violations are a stop-the-line event.

---

### 2. Tauri Graceful-Degradation Pattern

`lib/tauri.ts` is the single gateway to all Tauri APIs. Every export in that file degrades gracefully when running in a browser (Next.js web build or test environment):

- `isTauri` — boolean, `false` during SSR and in any non-Tauri window.
- `invoke(cmd, args)` — wraps `@tauri-apps/api/core`. Returns `null` in web; never throws.
- `listen(event, handler)` — wraps `@tauri-apps/api/event`. Returns a no-op unlisten function in web.
- `checkForUpdates()` — queries the Tauri updater plugin; no-ops in web. Never auto-installs.
- `enableAutostart()` / `disableAutostart()` — Tauri autostart plugin; no-op in web.

**Rule:** Never import `@tauri-apps/api` directly from any file outside `lib/tauri.ts`. All Tauri surface area flows through this module. This keeps the web build clean, keeps tests runnable without a Tauri context, and provides a single point to audit for platform-specific behaviour.

---

### 3. Platform Storage Abstraction

`lib/storage.ts` exports `createPlatformStorage(storeName)`, a factory that returns a Zustand-compatible `StateStorage` object backed by the correct persistence layer for the current runtime:

- **Tauri (desktop):** `@tauri-apps/plugin-store` — JSON file in the OS `appDataDir`. Survives browser cache clears. Scoped to the app, not the browser profile.
- **Web / browser:** `localStorage` — synchronous, origin-scoped.

All three Zustand stores (`srsStore`, `settingsStore`, `entitlementStore`) pass a `createPlatformStorage(...)` instance to Zustand's `persist` middleware. Store hydration is asynchronous; use `useIsHydrated()` to gate any UI that requires the full persisted state before rendering.

**Rule:** Never call `localStorage` directly from any file outside `lib/storage.ts`. The abstraction layer exists precisely so that desktop and web builds behave identically from the perspective of every caller.

---

### 4. Migration Convention

`store/migrations.ts` is the single source of truth for all Zustand store schema migrations. Each persisted store has:

- A `*_VERSION` integer constant (e.g. `SRS_VERSION`).
- A `*_MIGRATIONS` record mapping each version number to a migration function.
- An exported `migrate*Store(persisted, storedVersion)` function that walks the chain from the stored version to the current version, one step at a time.

**When changing the persisted shape of a store:**
1. Increment the relevant `*_VERSION` constant.
2. Add a new entry to the `*_MIGRATIONS` record for the new version number.
3. Add a test in `tests/migrations.test.ts` that exercises the new migration on a realistic stored blob.

**Never remove an entry from a migrations record.** The chain must remain intact to upgrade data from any historical version. Throwing on a missing migration step is intentional — silent fallbacks would corrupt user data.

---

### 5. Entitlement Model

Entitlement is **client-only and honour-system**. There is no server-side license verification. This is an intentional, owner-confirmed trade-off (decision 2026-06-24): the product prioritises offline-first operation, zero backend dependency for core functionality, and user privacy over DRM enforcement.

`lib/entitlement.ts` and `store/entitlementStore.ts` manage license state locally. `lib/licenseTypes.ts` defines the `LICENSE_TYPES` enumeration and the `LicenseType` type. Activation is handled by `hooks/useLicenseActivation.ts`. Pricing constants and checkout URLs live in `lib/checkout.ts` (re-exported by `lib/entitlement.ts` for backwards compatibility).

**Specialty pack add-ons:** `store/entitlementStore.ts` also tracks purchased specialty packs via `purchasedAddOns: string[]`. Two store actions manage this: `hasAddOn(code)` returns whether a given specialty pack code has been purchased; `purchaseAddOn(code)` appends the code idempotently. `lib/entitlement.ts` exports a parallel pure function `hasAddOn(state, code)` for use outside React. The entitlement store schema is at `ENTITLEMENT_VERSION = 3` (see `store/migrations.ts`).

**Do not treat this as a bug or a missing feature.** Document it as designed when writing tests, comments, or new features that touch entitlement.

---

### 6. Pack Format

Language packs are served as static JSON files at `public/packs/{lang}.json`. The shape of each file is defined by the `Pack` interface in `lib/packTypes.ts`.

`lib/packLoader.ts` manages a three-level cache (in-memory → platform storage → network) and performs sha256 integrity verification on every load:

- On cache hit: re-verifies the sha256 hash against the manifest before serving. A hash mismatch evicts the cached copy and re-fetches.
- On network fetch: verifies sha256 before writing to storage. A mismatch is a hard error — no corrupted pack is ever cached or returned.

The manifest lives at `public/packs/manifest.json` and maps each language code to `{ version, sha256, size, name }`. `loadPack` validates the requested language code against `READY_PACK_CODES` before making any network request, preventing path traversal and storage key poisoning.

Only `it` (Italian) and `es` (Spanish) are registered in `lib/langRegistry.ts`.

**Specialty packs (add-ons):** `lib/langRegistry.ts` also exports the `SpecialtyPack` interface, the `SPECIALTY_PACKS` array, `getSpecialtyPacks(lang)` (filters by base language), and `isSpecialtyPackCode(s)`. Specialty packs extend a base language pack with domain-specific vocabulary (e.g. `it-medical`). `lib/specialtyPackLoader.ts` handles the merge path: `loadedAddOns` tracks which add-ons are in memory; `getLoadedAddOns()` exposes this list (re-exported via `lib/packLoader.ts`); `loadSpecialtyPack(lang, memCache, manifest)` performs the fetch, sha256 check, and unit merge. `lib/packLoader.ts` delegates the specialty branch to `lib/specialtyPackLoader.ts`. Attempting to load a specialty pack before its base language pack returns `{ ok: false, error: "base_pack_not_loaded" }`. The base pack's cards are never duplicated — specialty packs are additive overlays.

---

### 7. Introduction Engine

`lib/introduction.ts` is a pure-function module (no React, no Zustand) implementing the
22-phase intensive introduction cadence from BRAND.md.

10 exports — 4 constants: `GRADUATION_THRESHOLD`, `CONSECUTIVE_WRONG_RESET`, `MAX_PHASE_DAY`,
`MAX_APPEARANCES_BY_PHASE_DAY` (frozen); 6 functions: `getDayOfPhase`, `maxAppearancesToday`,
`shouldAppearToday`, `shouldGraduate`, `recordResult`, `getNextCardType`.

Integrates with `store/srsStore.ts` via four actions: `introduceCard`,
`recordIntroductionResult`, `getIntroductionDueCardIds`, `canIntroduceNewCard`.
These actions read/write `state.introductions: Record<string, IntroductionRecord>`.

**Rule:** `lib/introduction.ts` must remain pure — no React, no Zustand imports.
The store imports from lib/, not vice versa.

Session-start activation: on mount, `hooks/useStudySession.ts` calls `canIntroduceNewCard` and, if true, introduces the first qualifying card and appends it to the queue. This means every study session begins with a new card when the daily cap permits (live since Task #085, 2026-06-29).

**Reset and pause mechanism (Tasks #178, #228, #246, #254, #258):** `phaseStartDate` — not `dayOfPhase` — is the authoritative reset anchor. `dayOfPhase` is always recomputed by callers via `getDayOfPhase(record.phaseStartDate, today)`; a persisted `dayOfPhase` value is never trusted directly. On a triple-wrong streak, `recordResult` advances `phaseStartDate` to today (restarting Day 1 intensity) and sets `strandedAcrossDays: true` on the record. `canIntroduceNewCard` blocks all new-card introductions while ANY record has `strandedAcrossDays: true` — the flag is cleared only by a subsequent correct answer on that record (a wrong answer never clears it). When `getDayOfPhase` throws due to a corrupt `phaseStartDate`, `recordIntroductionResult`'s catch path fully repairs the record on a correct answer: `phaseStartDate` is reset to `today` (allowing the card to rejoin `getIntroductionDueCardIds` at Day-1 intensity) and `strandedAcrossDays` is cleared if set. A wrong answer does not repair either field. A day-22+ rescue path in `getIntroductionDueCardIds` (`store/srsStore.ts`) surfaces a non-graduated card once per day even past the 22-day table, so a non-graduated card can never permanently disappear from the due queue.

Key invariants:
- One new card per day maximum (`canIntroduceNewCard` enforces the cap)
- Graduation requires 15 consecutive correct retrievals (not time-based)
- Wrong 3× in a row advances `phaseStartDate` to today (Day 1 intensity restarts) and sets `strandedAcrossDays: true`, pausing new-card introductions until a correct answer clears it
- `recordResult` is immutable — always returns a new object, never mutates input
- `getDayOfPhase` throws `[ERR-INTRO-DATE]` on a calendar-invalid `phaseStartDate` or `today` rather than silently propagating `NaN`; callers (`store/srsStore.ts`) catch this per-record so one corrupted record cannot abort computation for every other card; a correct answer in `recordIntroductionResult`'s catch path also repairs the corrupt `phaseStartDate` to `today`, allowing the card to rejoin the due queue (Task #258)

---

### 8. E2E Testing

Playwright smoke tests live in `tests/e2e/`. The config is at `playwright.config.ts` (repo root). E2E tests run on port **3099** to avoid colliding with the default dev server on 3000. Run with:

```bash
npm run test:e2e
```

Unit and integration tests (Vitest) remain in `tests/` alongside source files and run with `npm test`. E2E tests are a separate suite and are not counted in coverage thresholds. Both suites must pass before any batch is considered done.
