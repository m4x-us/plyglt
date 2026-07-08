# Adam — Stream W6A — Wave 6 — 2026-07-08

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W6A | #252 #253 #257

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #252 — Fix clearPackCache having no atomicity protection across its two storage removals
2. /task #253 — Fix evictPack not clearing specialty-pack merge state
3. /task #257 — Fix dead-code assignment with a misleading copy-pasted comment

**Why this order:** All three touch lib/packLoader.ts, forcing them into one sequential stream regardless of parallelization preference. #252 and #253 are the two substantive fixes; #257 is a trivial one-line cleanup, run last to avoid merge noise ahead of the real fixes.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W6A
[✓] #252 — Fix clearPackCache atomicity   ← done
[→] #253 — Fix evictPack specialty-cache gap   ← starting now
[ ] #257 — Remove dead-code assignment

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/packLoader.ts
lib/specialtyPackLoader.ts
tests/packLoader.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/srsStore.ts
lib/introduction.ts
tests/srsStore.test.ts
store/migrations.ts

## Task Definitions

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

## Agent Memories

## Architecture Agent Memory (relevant excerpt)

This file (lib/packLoader.ts) has now been touched across 3 consecutive remediation cycles (Tasks #239, #248, #251), each time leaving exactly one sibling instance of a fixed bug unfixed elsewhere. Before closing #252 and #253, grep the ENTIRE file (and lib/specialtyPackLoader.ts) for every other call site of `clearPackCache`/`evictPack`/`loadedAddOns` to confirm you haven't left a sibling gap — this is the specific pattern the last 2 audit cycles kept finding, and this wave exists specifically to close the last 2 known instances of it. Line numbers in the task text (e.g. "line 191", "lines 97-101") were correct as of the last audit read but may drift slightly if earlier tasks in your queue change line counts — search by function name/content, not just line number, when line numbers don't match exactly.

## When You Finish
Write your completion summary to .autocode/stream-W6A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W6A | #252 #253 #257
