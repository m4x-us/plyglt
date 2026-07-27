CLOSED: #383 #406
NOT_CLOSED: none

## #383 — v0→v1 unlockedPacks migration registration check

Mirrored the #384 v2→v3 purchasedAddOns fix exactly as instructed: the v1 migration's
element-shape filter (`typeof item === "string"`) now also validates REGISTRATION via
`isValidPackCode` (membership in `ALL_PACK_CODES` — structural), never READINESS. Same
policy as `lib/importBackup.ts`'s `unlockedPacks` filter. Dropped entries are logged via
`console.warn` (previously silent — the v1 migration was the one asymmetric sibling with
zero drop logging while v3 already had it).

Also fixed a latent test bug this surfaced: `tests/migrations.test.ts`'s "preserves
existing unlockedPacks array" test used `["it", "es", "fr"]` — "fr" was never a registered
pack code (only "it" and "es" are registered in `lib/langRegistry.ts`), so the test was
silently exercising a scenario that could never occur in production. Replaced with
registered-code-only tests, plus new tests for the drop/log path and the
registered-but-not-ready case.

## #406 — useIsHydrated hydration race + no-finish-on-failure hang

Two sub-fixes, both confined to `lib/storage.ts`:

1. **Render/subscribe race**: replaced the `useState` + manual re-check effect with
   `useSyncExternalStore` — the React-provided primitive for exactly this class of bug
   (it re-reads `getSnapshot()` itself immediately after subscribing and forces a
   re-render if the value changed in the window between render and subscribe). A
   hand-rolled synchronous re-check + `setState` in the effect body also trips
   `react-hooks/set-state-in-effect` (found this the hard way — see below).

2. **No-finish-on-failure hang**: added `HYDRATION_FAILSAFE_MS` (3000ms, matching
   `useLangPack.ts`'s existing `HYDRATION_GRACE_MS` value) as a bounded fallback baked
   into `useIsHydrated` itself. After 3s with no successful hydration, the hook stops
   waiting and reports `hydrated=true` regardless, logging
   `[ERR-HYDRATION-TIMEOUT]` explicitly (Rule 8 — never silent).

### Important course-correction during this task — read before touching lib/storage.ts again

My first attempt at the failure-terminal-state fix made `createPlatformStorage`'s
`getItem` catch its own errors and resolve `null` instead of rejecting, reasoning that
since a rejected `getItem` is exactly what makes Zustand persist's hydrate() take its
`.catch()` branch (never setting `hasHydrated`), swallowing it at the source would let
persist finish normally. **This breaks `lib/packCache.ts`'s `readCacheMeta`/
`readCacheData`**, which are a SEPARATE consumer of the same `createPlatformStorage`
factory (used for the `"pack-cache"` store, unrelated to Zustand persist) and rely on
`getItem` rejecting so they can catch it and log `ERR-CACHE-META`/`ERR-CACHE-DATA` with
specific ref IDs — caught this via `tests/packLoader.test.ts` (off-limits to me, owned
by another stream) failing. Reverted `getItem` to its original error-propagating
behavior and moved the entire fix into `useIsHydrated` instead, which is the one place
every hydration-gated screen already goes through and doesn't touch the shared
`StateStorage` contract at all. Full verification gate (tsc, all 1264 tests including
`tests/packLoader.test.ts`, lint, coverage) is green with the final version.

### HYDRATION_GRACE_MS in hooks/useLangPack.ts — flag for whoever owns that file next

Yes, it can now be removed. `useIsHydrated` itself has the same 3s-failsafe behavior
baked in at the root (both problems the workaround exists for — the render/subscribe
race and the getItem-rejection hang — are now closed inside the hook every consumer
already calls). `useLangPack.ts`'s local `HYDRATION_GRACE_MS`/`hydrationGraceExpired`
effect (lines ~106-126) is now redundant — `entitlementHydrated` will itself become
`true` within `HYDRATION_FAILSAFE_MS` even on a hydration failure, so the outer
grace-timeout wrapper adds nothing but duplicated logging. I did not touch
`hooks/useLangPack.ts` (off-limits — owned by another stream this wave).

Debt entries logged: 0
Carry-forward tasks generated: 0 (the useLangPack.ts cleanup above is a candidate for a
future task, not filed as one since I don't own scoping decisions for that file's stream)

### Note on repo state during this session

Mid-session, uncommitted working-tree changes across multiple files (including my
in-progress edits and the queue file claim) were briefly reset and then restored —
consistent with concurrent activity from other parallel windows in this wave. Final
state was verified directly against disk before every gate run in this report; nothing
here is stale.
