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

**Rule:** `lib/` must never import from `store/`, `hooks/`, `components/`, or `app/`. `store/` must never import from `hooks/`, `components/`, or `app/`. Violations are a stop-the-line event.

---

### 2. Tauri Graceful-Degradation Pattern

`lib/tauri.ts` is the single gateway to all Tauri APIs. Every export in that file degrades gracefully when running in a browser (Next.js web build or test environment):

- `isTauri` — boolean, `false` during SSR and in any non-Tauri window.
- `invoke(cmd, args)` — wraps `@tauri-apps/api/core`. Returns `null` in web; never throws.
- `listen(event, handler)` — wraps `@tauri-apps/api/event`. Returns a no-op unlisten function in web.

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

`lib/entitlement.ts` and `store/entitlementStore.ts` manage license state locally. `lib/licenseTypes.ts` defines the `LICENSE_TYPES` enumeration and the `LicenseType` type. Activation is handled by `hooks/useLicenseActivation.ts`.

**Do not treat this as a bug or a missing feature.** Document it as designed when writing tests, comments, or new features that touch entitlement.

---

### 6. Pack Format

Language packs are served as static JSON files at `public/packs/{lang}.json`. The shape of each file is defined by the `Pack` interface in `lib/packLoader.ts`.

`lib/packLoader.ts` manages a three-level cache (in-memory → platform storage → network) and performs sha256 integrity verification on every load:

- On cache hit: re-verifies the sha256 hash against the manifest before serving. A hash mismatch evicts the cached copy and re-fetches.
- On network fetch: verifies sha256 before writing to storage. A mismatch is a hard error — no corrupted pack is ever cached or returned.

The manifest lives at `public/packs/manifest.json` and maps each language code to `{ version, sha256, size, name }`. `loadPack` validates the requested language code against `READY_PACK_CODES` before making any network request, preventing path traversal and storage key poisoning.

Only `it` (Italian) and `es` (Spanish) are registered in `lib/langRegistry.ts`. Stubs for `fr`, `de`, and `pt` exist in the registry but are not user-visible.
