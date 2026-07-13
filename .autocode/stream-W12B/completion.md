# Stream W12B — Completion Summary

**Agent:** Barry
**Wave:** 12
**Date:** 2026-07-12

## Tasks Closed

- **#297** — Fix stale module header in lib/packLoader.ts: COMPLETE
- **#302** — Fix false-positive [ERR-LANG-CONFIG-UNKNOWN] log in lib/language.ts: COMPLETE
- **#309** — Fix _mergeFromJson data-then-meta persistence ordering: COMPLETE
- **#319** — Fix clearPackCache to also clear specialty pack storage keys: COMPLETE

## Tasks NOT Completed

None.

## What Was Done

### Task #297 — packLoader.ts header truthfulness

Updated lines 20-28 of the module header. The stale text said "the specialty path never
executes — the structure is in place for when content arrives." Now reads:

```
 * Italian is served from statically-bundled content, bypassing loadPack entirely —
 * useLangPack.ts calls seedMemCache("it", units) so that memCache["it"] exists and the
 * specialty-pack precondition (memCache.has(baseLang)) can be satisfied. SPECIALTY_PACKS
 * is currently empty, so the specialty branch never executes yet — it is ready for when
 * registered specialty pack content arrives. See seedMemCache below.
```

This correctly describes that:
- Italian bypasses loadPack entirely (via static-pack path in useLangPack.ts)
- seedMemCache populates memCache["it"] so the specialty-pack precondition IS satisfiable
- SPECIALTY_PACKS is still empty (nothing fires yet), but the architecture is fully wired

### Task #302 — False-positive lang-config error log

**Root cause:** `getLanguageConfig("it-medical")` reached the error branch because "it-medical"
is not in `LANGUAGE_MAP` (which only contains "it" and "es").

**Why not import SPECIALTY_PACKS from langRegistry.ts:**
`langRegistry.ts` already imports `ITALIAN` and `SPANISH` from `language.ts` — adding the
reverse import would create a circular dependency (language.ts → langRegistry.ts → language.ts).

**Fix:** Structural check in `getLanguageConfig`: extract the portion before the first hyphen
and look it up in `LANGUAGE_MAP`. If found, return that config silently. Only log the error
for codes where even the base portion isn't in LANGUAGE_MAP.

```ts
const hyphen = code.indexOf("-");
if (hyphen !== -1) {
  const baseConfig = LANGUAGE_MAP[code.slice(0, hyphen)];
  if (baseConfig) return baseConfig;
}
```

**New test:** `tests/language.test.ts` — "returns base language config for specialty pack codes
without logging an error" — spies on console.error, calls getLanguageConfig("it-medical"),
asserts cfg === ITALIAN and no error logged.

### Task #309 — _mergeFromJson persistence ordering

**Root cause:** data written before meta. If a crash occurs between the two writes, the
resulting orphaned-data-without-meta state is unsafe: `_doLoad`'s offline fallback path
(`!addOnManifestEntry && cachedData`) serves orphaned bytes with zero sha256 verification.

**Fix:** Swapped write order to meta-first in `_mergeFromJson` (`lib/specialtyPackLoader.ts`):

```ts
// meta FIRST, then data
await writeCacheMeta(lang, { version, sha256, cachedAt });
await writeCacheData(lang, json);
```

With meta-first: a crash between the two writes leaves meta-without-data. On next load:
`readCacheData` returns null → `cacheVersionMatches = false` → offline stale-cache path
is unreachable (`cachedData` is null). Clean re-download.

**New tests:** `tests/specialtyPackLoader.test.ts`:
- `#309: writes meta key before data key` — spies on localStorage.setItem, verifies
  writeOrder = ["meta", "data"] (not ["data", "meta"])
- `#309: meta-without-data orphan triggers re-download` — seeds storage with only meta
  (no data), verifies loadPack re-downloads successfully

### Task #319 — clearPackCache specialty storage-key gap

**Root cause:** `clearPackCache("it")` called `clearSpecialtyPacksForLang("it")` which removed
"it-medical" from `loadedAddOns` (in-memory tracking) but didn't clear the storage keys
`pack-meta-v1-it-medical` / `pack-data-v1-it-medical`. Those orphaned bytes would be served
from cache on the next load without re-verifying against the current manifest's sha256.

**Fix (two files):**

1. **`lib/specialtyPackLoader.ts`** — `clearSpecialtyPacksForLang` now returns `string[]`
   (the list of pruned codes). Previously returned `void`. The return value is the pruned
   specialty codes so the caller can target their storage keys.

2. **`lib/packCache.ts`** — `clearPackCache` now uses the return value:
   ```ts
   const prunedCodes = clearSpecialtyPacksForLang(lang);
   if (prunedCodes.length > 0) {
     await Promise.allSettled(
       prunedCodes.flatMap(code => [
         getStorage().removeItem(CACHE_META_PREFIX + code),
         getStorage().removeItem(CACHE_DATA_PREFIX + code),
       ])
     );
     // ... log failures per code/keyType
   }
   ```

**New tests:** `tests/specialtyPackLoader.test.ts`:
- `#319: evicting the base pack also clears the specialty pack's persisted storage keys` —
  seeds storage with specialty keys, loads specialty pack, evicts base pack, asserts keys null
- `#319: evicting the base pack when specialty pack was never loaded leaves storage unchanged`
  — specialty pack never loaded (not in loadedAddOns), storage keys remain (will be sha256-
  verified on next session's load)

## New Export for Task #326

**Function:** `clearSpecialtyPacksForLang(baseLang: string): string[]`  
**File:** `lib/specialtyPackLoader.ts`  
**Old signature:** `(baseLang: string): void`  
**New signature:** `(baseLang: string): string[]`  
**Return value:** Array of specialty pack codes (e.g. `["it-medical"]`) that were removed from
`loadedAddOns` because their `baseLang` matched the evicted pack. Empty array if none were tracked.

**Usage for #326:** `store/entitlementStore.ts`'s `clearEntitlement` can call
`clearSpecialtyPacksForLang(baseLang)` to enumerate the specialty codes to evict from memCache
on license deactivation, then call `clearPackCache(code)` for each returned code (or simply
call `clearPackCache(baseLang)` which already invokes `clearSpecialtyPacksForLang` internally
and handles storage eviction). If #326 only needs to clear in-memory state (not storage),
it can call `clearSpecialtyPacksForLang` directly without going through `clearPackCache`.

## Cross-Wave TS Error (NOT caused by Barry)

`components/LanguageGrid.tsx(90,17)` has a pre-existing TS error introduced by a parallel wave
(another agent modified this off-limits file). Confirmed by stashing Barry's changes and
re-running `npx tsc --noEmit` — the error persisted. Barry cannot fix it (LanguageGrid.tsx is
off-limits). The owning wave must resolve it.

## Verification Gate

- `npx tsc --noEmit` — ✗ 1 pre-existing cross-wave error in components/LanguageGrid.tsx (off-limits, not caused by Barry)
- `npm test` — ✓ 1141/1141 pass (56 test files; 5 new tests added across language.test.ts and specialtyPackLoader.test.ts)
- `npm run lint` — ✓ 0 errors, 1 pre-existing warning in hooks/useExportImport.test.ts (not Barry's file)
- assertion grep — ✓ no violations

## Debt Entries Logged

0

## Carry-Forward Tasks Generated

0 (the #326 note above is informational for the next wave's builder, documented in New Export section)
