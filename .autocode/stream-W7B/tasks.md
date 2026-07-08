# Stream W7B Task State

### Task #259: Fix data-loss: loadPack's forceRedownload path can silently overwrite a merged specialty pack without pruning loadedAddOns

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`loadPack(lang, manifest, { forceRedownload: true })` skips the memory-hit short-circuit and the `cacheValid` check purely because `forceRedownload` is true, falls through to the network-download block, and unconditionally does `memCache.set(lang, pack)` with the freshly-downloaded, unmerged base pack — overwriting whatever merged pack (base + specialty units) was previously there. `loadedAddOns` is never consulted or pruned in this path, so `getLoadedAddOns()` continues reporting a specialty code as loaded even though its units were just silently dropped from `memCache`. This is the same defect class Task #253 just fixed in `evictPack` (a caller that replaces a base pack's `memCache` entry without pruning `loadedAddOns`), in a different call site. Currently dormant: `SPECIALTY_PACKS` is empty in production and no production caller passes `forceRedownload` yet, but this is public API, already exercised by existing tests, and will silently corrupt user-facing content the moment either a specialty pack ships or a "force refresh" UI feature is wired to this option. Found by Agent A (cycle-5 audit).

**Acceptance Criteria:**
- [ ] `loadPack`'s forceRedownload/fresh-download path should call `clearSpecialtyPacksForLang(lang)` (or equivalent) before `memCache.set(lang, pack)` whenever the pack being replaced could have had a specialty merge applied — matching the same guarantee Task #253 added to `evictPack`
- [ ] Add a test: merge a specialty pack into a base pack, then call `loadPack(baseLang, manifest, { forceRedownload: true })`, and assert `getLoadedAddOns()` no longer reports the specialty code as loaded (consistent with the fresh unmerged pack now in memCache)

**Done when:** A test proves that force-redownloading a base pack with a merged specialty add-on also prunes that add-on from `getLoadedAddOns()`. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 5, 2026-07-08) — severity 5 — data-loss — found by Agent A.
