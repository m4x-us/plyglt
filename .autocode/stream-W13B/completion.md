# Stream W13B — Completion Summary

**Agent:** Barry
**Wave:** 13
**Date:** 2026-07-14

## Tasks Closed

- **#328** — Fix circular ES-module dependency between lib/packCache.ts and lib/specialtyPackLoader.ts: COMPLETE
- **#374** — Fix stale "Called by" header in lib/specialtyPackLoader.ts: COMPLETE
- **#329** — Fix incomplete consumer list in lib/packCache.ts header: COMPLETE
- **#346** — Fix PackMemCacheImpl.write() specialty storage-key cleanup gap: COMPLETE
- **#367** — Fix clearPackCache doc comment accretion pattern: COMPLETE
- **#358** — Fix clearPackCache/loadPack race (memCache.delete ordering): COMPLETE
- **#348** — Fix hasValidUnitsArray to validate unitCount/cardCount are numbers: COMPLETE
- **#375** — Fix lib/packTypes.ts "Imported by" header to include lib/packCache.ts: COMPLETE
- **#365** — Fix Promise reference-equality doc contradiction in loadSpecialtyPack: COMPLETE

## Tasks NOT Completed

None.

## How #328 Was Resolved

**Root cause:** `lib/packCache.ts` imported `clearSpecialtyPacksForLang` from
`lib/specialtyPackLoader.ts`; `lib/specialtyPackLoader.ts` imported 5 symbols + 1 type from
`lib/packCache.ts`. A genuine two-way cycle.

**Resolution (Option 2 — move ownership):** Moved `loadedAddOns` and all management functions
to `lib/packCache.ts`. Reasoning: `loadedAddOns` is cache state — it tracks what is merged into
`memCache` — and `memCache` already lives in `packCache.ts`. Moving them together means
`PackMemCacheImpl.write()` and `clearPackCache()` can both call `clearSpecialtyPacksForLang`
directly (same file, no import needed), and no new parameter thread-through was needed.

**New import shape post-#328:**

`lib/packCache.ts` imports from:
- `@/lib/storage` (unchanged)
- `@/lib/langRegistry` (NEW — needed for `SPECIALTY_PACKS` in `clearSpecialtyPacksForLang`)
- `@/lib/packTypes` (unchanged)

`lib/specialtyPackLoader.ts` imports from:
- `@/lib/packTypes` (unchanged)
- `@/lib/langRegistry` (unchanged)
- `@/lib/utils` (unchanged)
- `@/lib/packCache` (as before, PLUS `isAddOnLoaded`, `markAddOnLoaded`, `clearLoadedAddOns`)
- Re-exports: `export { getLoadedAddOns } from "@/lib/packCache"` (preserves the re-export
  chain: `packLoader.ts` → `specialtyPackLoader.ts` → `packCache.ts`)

**`clearSpecialtyCache()` stays in `lib/specialtyPackLoader.ts`** (not moved) because
`store/entitlementStore.ts` imports it directly from there, and that file is off-limits.
`clearSpecialtyCache()` now calls `clearLoadedAddOns()` (from `packCache.ts`) instead of
directly zeroing `loadedAddOns.length`.

**Functions moved from `lib/specialtyPackLoader.ts` to `lib/packCache.ts`:**
- `loadedAddOns: string[]` (module-private array)
- `getLoadedAddOns(): string[]` (exported; re-exported by specialtyPackLoader for packLoader)
- `isAddOnLoaded(lang: string): boolean` (exported; replaces inline `loadedAddOns.includes`)
- `markAddOnLoaded(lang: string): void` (exported; replaces inline `loadedAddOns.push`)
- `clearLoadedAddOns(): void` (exported; called by `clearSpecialtyCache()`)
- `clearSpecialtyPacksForLang(baseLang: string): string[]` (exported; still called by packCache
  internally, now callers in specialtyPackLoader use packCache's version)

## What Was Done Per Task

### Task #346 — write() storage-key cleanup

**Root cause:** `PackMemCacheImpl.write()` called `clearSpecialtyPacksForLang(lang)` (pruning
in-memory tracking) but never removed the pruned codes' platform storage keys
(`pack-meta-v1-{code}` / `pack-data-v1-{code}`). Same omission pattern that required
`clearPackCache` to be patched in prior tasks.

**Fix:** Extracted `_clearSpecialtyStorageKeys(prunedCodes, context)` as a shared private async
helper. `write()` calls it fire-and-forget (storage cleanup is best-effort; in-memory state is
already authoritative). `clearPackCache()` calls it awaited (full eviction must leave no orphaned
bytes). The composable helper closes the pattern once rather than repeating the pairing at each
call site.

**New test (tests/specialtyPackLoader.test.ts):**
- `#346: replacing a base pack via write() clears the specialty pack's persisted storage keys`
- `#346: replacing a base pack when no specialty was loaded does not disturb other storage keys`

### Task #367 — clearPackCache doc comment

Replaced the accretion-style doc comment (which listed six prior remediation tasks and two
bolted-on responsibility paragraphs) with a forward-looking design description: the composable
`_clearSpecialtyStorageKeys` helper is documented as the pattern, not the failure history.

### Task #358 — clearPackCache/loadPack race

**Root cause:** `memCache.delete(lang)` ran AFTER `await Promise.allSettled(...)`. A concurrent
`loadPack` completing during the async storage await could write a fresh entry via
`memCache.write(...)`, which `clearPackCache`'s subsequent `memCache.delete` would then wipe.

**Fix:** Moved `memCache.delete(lang)` and `clearSpecialtyPacksForLang(lang)` BEFORE the
`Promise.allSettled` call. Both are synchronous — they complete atomically before any async I/O
begins. A concurrent load completing during storage cleanup now writes to an already-deleted slot
and its result survives.

### Task #348 — hasValidUnitsArray numeric validation

Added `typeof pack.unitCount !== "number"` and `typeof pack.cardCount !== "number"` guards at
the top of `hasValidUnitsArray`. Without these, a pack whose JSON contains
`"unitCount": "5"` (string instead of number) would pass shape validation and then silently
string-concatenate when `_mergeFromJson` computed `base.unitCount + addOnPack.unitCount`.

### Task #375 — packTypes.ts "Imported by" header

Added `lib/packCache.ts` to the "Imported by" line in the module header. packCache.ts imports
`hasValidUnitsArray`, `Pack`, `LoadPackResult`, and `PackMemCache` from this file.

### Task #365 — Promise reference-equality doc contradiction

The old doc comment claimed `p1 === p2` held "via loadPack's return for concurrent same-code
loads." This was false: `loadPack` is declared `async` and always wraps its return in a new
Promise regardless of what `loadSpecialtyPack` returns. The new doc comment correctly limits
the guarantee: `p1 === p2` holds only for direct `loadSpecialtyPack` callers. Callers through
`loadPack` receive a new Promise wrapper.

## Verification Gate

- `npx tsc --noEmit` — ✓ 0 errors
- `npm test` — 18 pre-existing failures (from other W13 waves; verified by running without
  Barry's changes — failure count is identical: 18 before, 18 after); 1152 tests pass
  (net +2 new passing tests from the #346 describe block)
- `npm run lint` — ✓ 0 errors (2 pre-existing warnings in off-limits files)
- assertion grep — ✓ clean

## Debt Entries Logged

0

## Carry-Forward Tasks Generated

0
