# Stream W10A — Wave 10 — Completion

**Agent:** Adam  
**Wave:** 10  
**Date:** 2026-07-10  
**Tasks:** #269

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #269 | COMPLETE | Added platform storage persistence to `loadSpecialtyPack`. Specialty packs now have their own `pack-data-v1-{code}` / `pack-meta-v1-{code}` keys in the same `"pack-cache"` store as base packs. Page reloads no longer require re-fetching the add-on. |

Tasks NOT completed: none  
Debt entries logged: 0  
Carry-forward tasks generated: 0

---

## Files Changed

- `lib/specialtyPackLoader.ts` — Added storage layer (createPlatformStorage import, singleton, read/write/clear helpers, CachedPackMeta interface, CACHE_META/DATA_PREFIX constants). Extracted `_mergeFromJson` helper (parse + merge + optional persist). Rewrote `_doLoad` to check storage before fetching, persist after successful download, and serve stale cache as offline fallback. Added `_storage = null` to `clearSpecialtyCache` for test isolation.
- `tests/packLoader.test.ts` — Added 5 new tests in a `"specialty pack — storage persistence (#269)"` describe block.

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1120/1120 passing ✓ (+7 vs Wave 9)
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file) ✓
- Assertion quality grep gate — clean ✓

---

## Implementation Details

### Storage key convention (shared with packLoader.ts)

```
pack-data-v1-it-medical   ← specialty pack JSON bytes
pack-meta-v1-it-medical   ← { version, sha256, cachedAt }
pack-data-v1-it           ← base pack JSON (owned by packLoader.ts)
pack-meta-v1-it           ← base pack meta (owned by packLoader.ts)
```

Same Tauri Store file (`"pack-cache"`) / same localStorage origin — no separate store needed.

### _doLoad flow (new)

1. Read `pack-meta-v1-{lang}` + `pack-data-v1-{lang}` from storage in parallel
2. **Cache hit** (version matches AND manifest entry present): re-verify sha256 → parse/merge → return
3. **Cache hit, no manifest entry** (offline): serve cache as-is (was already verified on write)
4. **Hash mismatch** (corrupted cache): evict, null out cachedData (A003), fall through to download
5. **Version mismatch or no cache**: fall through to download
6. **No manifest entry + no cache**: log ADDON_NO_MANIFEST, return `checksum_mismatch` (fail-closed)
7. **Download success**: verify sha256, parse, merge, persist via `_mergeFromJson(…, manifestEntry)`
8. **Download failure + stale cache**: serve stale (offline fallback)

### _mergeFromJson (new helper)

Unified parse + merge + optional-persist tail. `manifestEntry !== null` → persist to storage. Used by both the cache-hit path (null = already persisted) and the download path (non-null = fresh bytes).

### A003 (specialty packs)

After evicting an integrity-failed cache entry, `cachedData` is set to `null` so the stale-cache offline-fallback branch cannot serve the same corrupt bytes. Mirrors packLoader.ts's identical pattern.

### clearSpecialtyCache

Now also sets `_storage = null` to reset the storage singleton. Required for test isolation: `beforeEach` in packLoader.test.ts calls `clearCacheForTesting()` which calls `clearSpecialtyCache()` — without the null reset, tests that pre-seed storage keys could observe state from a prior test's singleton.

### New tests (5)

| Test | What it proves |
|------|---------------|
| `#269: persists specialty pack to storage` | Happy path: after load, `pack-data-v1-it-medical` = ADD_ON_PACK_JSON and meta has correct version + sha256 |
| `#269: serves from storage on reload` | Cache hit path: after clearCacheForTesting(), second session makes 0 fetches |
| `#269: evicts corrupted specialty cache and re-fetches` | Hash mismatch eviction + re-fetch |
| `#269: stale specialty cache as offline fallback` | Version-mismatch cache serves when download fails with 503 |
| `#269: A003 — integrity-failed cache not served as offline fallback` | Evicted cache can't reach stale-cache path |
