Tasks closed: #259
Tasks NOT completed: none
Debt entries logged: 0
Carry-forward tasks generated: 0

## Summary

**Task #259 — Fix forceRedownload's loadedAddOns overwrite gap**

**Root cause:** `loadPack(lang, manifest, { forceRedownload: true })` skips the memory-hit short-circuit (line 171) and cacheValid check (lines 183-187) specifically because forceRedownload is true. This means memCache can already hold a merged specialty pack, but the three download paths — successful download (line 311), HTTP-error offline fallback (line 240), and network-error offline fallback (line 264) — all call `memCache.set(lang, pack)` with a fresh unmerged base pack without pruning `loadedAddOns`. `getLoadedAddOns()` then lies: it reports the specialty code as loaded even though its units are gone from memCache.

**Analysis of all 5 `memCache.set(lang, pack)` call sites:**

| Line | Path | Gap? | Reason |
|------|------|------|--------|
| 204 | sha256-verified cache hit | None | Only reached when NOT forceRedownload (cacheValid requires it); memCache empty at this point → no merged specialty pack possible |
| 214 | No-manifest cache hit | None | Same: NOT forceRedownload required; memCache empty |
| 240 | Offline fallback (HTTP error) | **Yes** | Reached with forceRedownload:true if download fails; merged specialty pack may be in memCache |
| 264 | Offline fallback (network error) | **Yes** | Same as above |
| 311 | Fresh download (success) | **Yes** | The primary case: forceRedownload succeeds, overwrites without pruning |

**Changes:**

- `lib/packLoader.ts`: Added `clearSpecialtyPacksForLang(lang)` before `memCache.set(lang, pack)` at all three download/overwrite sites (lines 240, 264, 311). `clearSpecialtyPacksForLang` was already imported from Task #253. Matches the identical guarantee added to `evictPack` in Task #253.

- `tests/packLoader.test.ts`: Added `#259: force-redownloading a base pack prunes its merged specialty add-on from getLoadedAddOns` inside the `specialty pack merge path` describe block. Loads "it", merges "it-medical", then calls `loadPack("it", fakeAddOnManifest(), { forceRedownload: true })`, asserts `getLoadedAddOns()` no longer contains "it-medical".

Verification gate: tsc --noEmit ✓ | npm test 1028/1028 ✓ | npm run lint 0 errors ✓ | assert grep gate ✓
