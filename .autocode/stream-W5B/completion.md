Tasks closed: #248
Tasks NOT completed: none
Debt entries logged: 0
Carry-forward tasks generated: 0

## Summary

**Task #248 — Fix packLoader shape-validation coverage**

The 5 `JSON.parse(...) as Pack` sites in `lib/packLoader.ts:loadPack`:

| Site | Location | Description | Was guarded before? |
|------|----------|-------------|---------------------|
| 1 | sha256-verified cache hit | Hash passes, pack served from cache | ✗ No |
| 2 | No-manifest offline-serve-as-is | No hash check, pack served from cache | ✗ No |
| 3 | Offline fallback (HTTP error) | Stale cache on non-200 response | ✓ Yes |
| 4 | Offline fallback (network error) | Stale cache on network throw | ✓ Yes |
| 5 | Fresh download | After sha256 passes on new fetch | ✓ Yes |

**Changes:**

- `lib/packLoader.ts`: Added `validatePackShape(pack: Pack): boolean` helper (checks `Array.isArray(pack.units)`). Applied at all 5 sites. Sites 1 and 2 now evict the malformed cache entry and return `{ ok: false, error: "parse_error" }`. Sites 3, 4, 5 updated to call `validatePackShape()` instead of the inline `!Array.isArray(pack.units)` — single source of truth, zero behavior change.

- `tests/packLoader.test.ts`: Added `"loadPack — shape-validation at all cache-hit paths (Task #248)"` describe block with two tests:
  - SHA256-verified hit: seeds malformed pack whose sha256 matches the manifest (so hash passes), asserts `ok:false, error:"parse_error"`, confirms no fetch was issued, confirms eviction.
  - No-manifest hit: seeds malformed pack with `units:null` and `null` manifest, asserts `ok:false, error:"parse_error"`, confirms no fetch, confirms eviction.

Verification gate: tsc --noEmit ✓ | npm test 1020/1020 ✓ | npm run lint 0 errors ✓ | assert grep gate ✓
