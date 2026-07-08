# Stream W6A Task State

### Task #252: Fix data-loss: clearPackCache has no atomicity protection across its two storage removals

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`clearPackCache(lang)` (lib/packLoader.ts:97-101) is three unguarded sequential statements: `await getStorage().removeItem(META_KEY)`, `await getStorage().removeItem(DATA_KEY)`, `memCache.delete(lang)`. If the second `removeItem` throws (platform storage I/O error, Tauri Store rejection, or a restrictive browser context), `memCache.delete(lang)` never runs, leaving a partially-evicted state: the meta key is gone but the data key and memCache entry remain. This function's own body is pre-existing (untouched by any wave of this batch), but Task #251 added 4 new call sites depending on its correctness, all inside catch blocks with no additional protection of their own. Confirmed blast radius is narrow: the sole caller (`hooks/useLangPack.ts`) has a terminal `.catch()` that logs and shows a friendly error rather than crashing — but the corrupted/stale cache entry silently fails to be fully cleared. Converged independently by Agents K, S, Red R (3 of 8 cycle-4 audit agents).

**Acceptance Criteria:**
- [ ] Wrap `clearPackCache`'s two `removeItem` calls (and the `memCache.delete`) so a failure in one step doesn't prevent the others — e.g. `Promise.allSettled` for the two storage removals, then always run `memCache.delete(lang)` regardless of their outcome, logging a ref ID if either removal failed
- [ ] Add a test simulating a storage `removeItem` throw on the second call and asserting `memCache.delete` still ran (or that the function logs the partial failure rather than leaving it silent)

**Done when:** A test proves `clearPackCache` still clears `memCache` even when one of the two storage `removeItem` calls throws. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — data-loss — converged independently by Agents K, S, Red R.

---

### Task #253: Fix code-quality: evictPack doesn't clear specialty-pack merge state

**File:** lib/packLoader.ts, lib/specialtyPackLoader.ts, tests/packLoader.test.ts
**Complexity:** 🔧 Full — 3 files
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`evictPack(lang)` clears `memCache` and platform storage for `lang`, but never calls `clearSpecialtyCache()` or prunes `loadedAddOns` (both in lib/specialtyPackLoader.ts). If a base pack with a merged specialty add-on is evicted, `loadedAddOns` still reports the specialty code as loaded — a later `loadPack(baseLang)` reload silently omits the specialty merge with no path to re-trigger it (only the test-only `clearCacheForTesting` clears both). This is the same "fixed the named site, missed a caller" class this batch spent 3 cycles closing, in a caller (`evictPack`) nobody re-checked. Currently dormant since `SPECIALTY_PACKS` is empty. Found by Agent W (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] `evictPack` should also prune any `loadedAddOns` entries whose `baseLang` matches the evicted `lang`, and call the equivalent of `clearSpecialtyCache()` scoped to those entries (or clear all of `loadedAddOns` if per-base-lang scoping isn't practical)
- [ ] Add a test: merge a specialty pack into a base pack, evict the base pack, assert the specialty code is no longer in `getLoadedAddOns()`

**Done when:** A test proves evicting a base pack with a merged specialty add-on also removes that add-on from `getLoadedAddOns()`. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — code-quality — found by Agent W.

---

### Task #257: Fix code-quality: dead-code assignment with a misleading copy-pasted comment

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** QA Agent
**Blocked by:** Nothing
**Priority:** P3

**What:**
`lib/packLoader.ts:191`'s `cachedData = null; // A003-style: prevent bytes from reaching stale-cache fallback` has zero effect — the function returns unconditionally on the very next line, so nothing ever reads `cachedData` again in this branch. The comment was copy-pasted from an earlier, genuinely load-bearing instance of this pattern (where the branch falls through to re-download rather than returning immediately). Introduced by Task #251's own edit this cycle, not inherited debt. Found by Agent B (cycle-4 re-audit).

**Acceptance Criteria:**
- [ ] Remove the dead `cachedData = null` assignment and its misleading comment from this specific branch (the one that returns immediately after), leaving the pattern only where it's genuinely load-bearing

**Done when:** `lib/packLoader.ts:191`'s dead assignment is removed; the branch's behavior is unchanged (verified by the existing test suite still passing). Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit cycle 4, 2026-07-08) — severity 4 — code-quality — found by Agent B.
