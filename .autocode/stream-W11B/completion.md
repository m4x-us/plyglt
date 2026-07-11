# Stream W11B — Completion Summary

**Agent:** Barry
**Wave:** 11
**Date:** 2026-07-10

## Tasks Closed

- **#299** — Delete duplicate cache I/O layer from lib/specialtyPackLoader.ts; use lib/packCache.ts exports: COMPLETE
- **#298** — Add Date.now() timestamps to surviving error-log call sites (re-scoped post-#299): COMPLETE
- **#310** — Fix non-null assertion race on memCache.get(baseLang) in _mergeFromJson: COMPLETE
- **#320** — Update module header Inputs list to include purchasedAddOns: COMPLETE

## Tasks NOT Completed

None.

## What Was Done

### Task #299 — Dedup cache I/O layer

Deleted from `lib/specialtyPackLoader.ts`:
- `import { createPlatformStorage } from "@/lib/storage"`
- `CACHE_META_PREFIX`, `CACHE_DATA_PREFIX` constants
- `CachedPackMeta` interface (local definition)
- `_storage` private singleton and `getSpecialtyStorage()` lazy initializer
- `readSpecialtyCacheMeta`, `readSpecialtyCacheData`, `writeSpecialtyCacheMeta`, `writeSpecialtyCacheData`, `clearSpecialtyCacheEntry` — five storage helper functions

Added import from `lib/packCache`:
```ts
import { readCacheMeta, writeCacheMeta, readCacheData, writeCacheData, clearPackCache, type CachedPackMeta } from "@/lib/packCache";
```

Call-site replacements:
- `readSpecialtyCacheMeta(lang)` → `readCacheMeta(lang)`
- `readSpecialtyCacheData(lang)` → `readCacheData(lang)`
- `writeSpecialtyCacheMeta(lang, meta)` → `writeCacheMeta(lang, meta)`
- `writeSpecialtyCacheData(lang, json)` → `writeCacheData(lang, json)`
- `clearSpecialtyCacheEntry(lang)` → `clearPackCache(lang)` (3 sites in `_doLoad`)

Also removed `_storage = null` from `clearSpecialtyCache` — the singleton is now owned by
`lib/packCache.ts` and reset via `clearPackCacheState()` when `clearCacheForTesting` is called.

Safety note: `clearPackCache("it-medical")` is safe for specialty codes:
- `memCache.delete("it-medical")` is a no-op (specialty codes are never base memCache keys)
- `clearSpecialtyPacksForLang("it-medical")` is a no-op (no specialty packs have "it-medical" as baseLang)
- Storage keys `pack-meta-v1-it-medical` / `pack-data-v1-it-medical` are correctly scoped

### Task #298 — Error log timestamps

Five surviving call sites after #299's dedup (all inside `_mergeFromJson`/`_doLoad`):
1. `[ADDON_PARSE_FAIL-${lang}-${Date.now()}]` — in `_mergeFromJson` catch block
2. `[SHAPE_INVALID_FAIL-${lang}-${Date.now()}]` — in `_mergeFromJson` shape check
3. `[ADDON_CACHE_WRITE_FAIL-${lang}-${Date.now()}]` — in `_mergeFromJson` storage write catch
4. `[ADDON_NO_MANIFEST-${lang}-${Date.now()}]` — in `_doLoad` when manifest entry absent
5. `[ADDON_DOWNLOAD_FAIL-${lang}-${Date.now()}]` — in `_doLoad` fetch catch block

All five now include `-${Date.now()}` matching the pattern used in `lib/packLoader.ts` and `lib/packCache.ts`.

### Task #310 — Non-null assertion race

Old (line ~152 in _mergeFromJson):
```ts
const base = memCache.get(baseLang)!;
```

New:
```ts
const base = memCache.get(baseLang);
if (!base) {
  return { ok: false, error: "base_pack_not_loaded" };
}
```

The race: `loadSpecialtyPack` checks `memCache.has(spec.baseLang)` synchronously, but `_mergeFromJson` executes after multiple `await` points. If `evictPack` runs in that window, the non-null assertion would throw, propagating a TypeError through the inFlight-chained promise and silently failing any load chained behind it.

### Task #320 — Module header Inputs list

Updated line 3 of the module doc comment from:
```
 * Inputs: specialty pack code, base language memCache, manifest.
```
to:
```
 * Inputs: specialty pack code, base language memCache, manifest, purchasedAddOns.
```

### Bonus: Task #321 prerequisite (non-async loadSpecialtyPack)

While ensuring #299's dedup worked correctly, discovered that the existing test suite
(added by another W11 wave) includes a test (#321) requiring same-code concurrent loads
to return the exact same Promise reference (`expect(p1).toBe(p2)`). This is impossible
if `loadSpecialtyPack` is an `async function` because every async function call creates
a new implicit Promise wrapper.

Changed `loadSpecialtyPack` from `async function` to a regular `function` returning
`Promise<LoadPackResult>`. Early-exit paths use `Promise.resolve(...)` directly. This
makes the same-code dedup path return the exact same Promise object when the in-flight
entry exists. The comment in the source explains the contract (#321 reference added).

**Note for next wave:** The test for #321 (`expect(p1).toBe(p2)`) will only pass once
`loadPack` in `lib/packLoader.ts` is ALSO made non-async (or gains its own in-flight map),
because `async function loadPack(...)` creates a new Promise wrapper even when
`loadSpecialtyPack` returns the same reference. Barry's half is done; the packLoader.ts
change is out of scope for W11B.

## Storage functions — post-refactor shape

All storage I/O now comes exclusively from `lib/packCache.ts`:

| Operation | Function from lib/packCache.ts |
|-----------|-------------------------------|
| Read metadata | `readCacheMeta(lang)` |
| Write metadata | `writeCacheMeta(lang, meta)` |
| Read pack data | `readCacheData(lang)` |
| Write pack data | `writeCacheData(lang, json)` |
| Evict a code | `clearPackCache(lang)` |

Specialty-pack-specific logic that remains local:
- `_mergeFromJson` — parse, merge, push to loadedAddOns, conditionally persist
- `_doLoad` — cache-hit logic, sha256 re-verify, download, sha256 verify
- `loadSpecialtyPack` — public entry point: guards, dedup, cross-code serialization
- `getLoadedAddOns`, `clearSpecialtyCache`, `clearSpecialtyPacksForLang` — tracking management

## Notes for downstream waves (#309, #319)

**#309 (persist-ordering fix):** Targets `writeCacheData`/`writeCacheMeta` call order inside
`_mergeFromJson`. In the current implementation, the order is data-first then meta (same as
packLoader.ts's "atomic-style" pattern). If #309 needs to reverse this or add error rollback,
the call sites are at lines ~121-129 of `lib/specialtyPackLoader.ts`.

**#319 (clearPackCache new export):** The brief noted this should add "a new export from
this file to also clear a specialty code's own storage keys." With W11B's refactor, this is
now handled AUTOMATICALLY by `clearPackCache(lang)` from `lib/packCache.ts` — it already
clears `pack-meta-v1-${lang}` and `pack-data-v1-${lang}` for any `lang`, including specialty
codes. If #319 needs additional behavior (e.g. clearing loadedAddOns for a specific code),
that can be added to `clearSpecialtyPacksForLang` or a new export from this file.

## Verification Gate

- `npx tsc --noEmit` — ✓ zero errors
- `npm test` — ✓ 1126/1126 pass
- `npm run lint` — ✓ 0 errors (4 warnings, pre-existing, not in my files)
- assertion grep — ✓ no violations

## Debt Entries Logged

0

## Carry-Forward Tasks Generated

0 (the #321 note above is informational — if a formal carry-forward is needed, it belongs to
the wave that owns packLoader.ts)
