# Barry — Stream W12B — Wave 12 — 2026-07-11

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W12B | #297 #302 #309 #319

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Prior Wave Changes — Read Before Starting

`lib/packLoader.ts` and `lib/specialtyPackLoader.ts` were both substantially changed last
wave (Wave 11). Read the current file state before writing anything — do not assume the
code looks like it did before Wave 11.

- **Adam (Wave 11)** added `seedMemCache(lang, units)` to `lib/packLoader.ts`, called from
  `hooks/useLangPack.ts`'s static-pack path — this is what makes Italian's `memCache["it"]`
  entry exist at all despite Italian being served from bundled static content. Your #297
  needs to describe this in the module header (the header currently still says Italian's
  early-return means `loadPack('it',...)` never runs — that's now stale, since
  `seedMemCache` populates `memCache` for Italian too, just not via `loadPack` itself).
  Adam also added a `console.error` to `evictPack` for specialty codes (Task #325, not
  something you need to touch).
- **Barry (Wave 11)** deleted
  `lib/specialtyPackLoader.ts`'s duplicated cache I/O layer (`getStorage`, read/write
  meta/data helpers) and replaced them with imports from `lib/packCache.ts`
  (`readCacheMeta`, `writeCacheMeta`, `readCacheData`, `writeCacheData`, `clearPackCache`).
  Also fixed a non-null-assertion race in `_mergeFromJson` (Task #310) and converted
  `loadSpecialtyPack` from `async function` to a plain function returning a `Promise`
  (prep work toward Task #321, not fully closed — #321 belongs to a different stream this
  wave). Your #309 (persist-ordering safety in `_mergeFromJson`) and #319 (a new export
  enumerating pruned specialty codes) both land in this already-refactored function — read
  the current `_mergeFromJson`/`_doLoad` bodies in full before changing them.

## Your Tasks (run in this exact order)
1. /task #297 — packLoader.ts's module header is stale (needs to describe seedMemCache + Italian's real memCache path)
2. /task #302 — false-positive [ERR-LANG-CONFIG-UNKNOWN] log once a specialty code becomes the active target language
3. /task #309 — _mergeFromJson's data-then-meta persistence isn't atomic; a partial write orphans unverified cached data
4. /task #319 — clearPackCache doesn't clear a specialty pack's own persisted storage keys

**Order note:** Do #309 before #319 — #319 needs a new/extended export from
`lib/specialtyPackLoader.ts` that enumerates specialty codes pruned by
`clearSpecialtyPacksForLang`, and it's easier to add that export once #309's persistence
fix is already in place in the same function area, rather than editing around it twice.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W12B
[✓] #297 — packLoader.ts header truthfulness   ← done
[→] #302 — false-positive lang-config error log   ← starting now
[ ] #309 — _mergeFromJson persistence ordering
[ ] #319 — clearPackCache specialty storage-key gap

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/packLoader.ts
lib/language.ts
lib/specialtyPackLoader.ts
lib/packCache.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
store/entitlementStore.ts
lib/featureFlags.ts
components/LanguageGrid.tsx
lib/packTypes.ts
tests/packLoader.test.ts
hooks/useLangPack.test.ts
lib/importBackup.ts
tests/entitlement.test.ts

## Task Definitions

### Task #297: Fix code-quality: The header states 'the structure is in place for when content arrives', without disclosing

**File:** lib/packLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The header states 'the structure is in place for when content arrives', without disclosing that the Italian early-return means loadPack('it',...) is never called in the running app, so the described structure cannot function for the base language every documented specialty-pack example targets. Violates Rule 2. at lib/packLoader.ts:module header:24.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/packLoader.ts:module header:24
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packLoader.ts

**Source:** Audit finding F003 — severity 6 — code-quality

**Note:** As of Wave 11, this finding's premise is partly stale — `seedMemCache` (added by
Adam, Wave 11, Task #296) now populates `memCache["it"]` from the static-pack path, so
Italian's `memCache` entry does exist, just not via a `loadPack('it',...)` call. Describe
the real current behavior accurately — don't just delete the caveat, correct it.

---

### Task #302: Fix error-handling: Once a specialty code becomes the active target language, this logs a false-positive [ERR-

**File:** lib/language.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Once a specialty code becomes the active target language, this logs a false-positive [ERR-LANG-CONFIG-UNKNOWN] error on every render for a legitimately registered specialty pack code. at lib/language.ts:getLanguageConfig:117.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/language.ts:getLanguageConfig:117
- [ ] Audit passes: bash scripts/deep-audit.sh lib/language.ts

**Source:** Audit finding F008 — severity 3 — error-handling

---

### Task #309: Fix security: _mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-writ

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
_mergeFromJson persists data then meta as separate awaits in one try/catch; a partial-write failure can leave orphaned data-without-meta on disk. A later load with no manifest entry available merges the orphaned cachedData with zero hash verification anywhere in the call path. at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:_doLoad (_mergeFromJson persistence):241
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F015 — severity 7 — security

---

### Task #319: Fix edge-case: Doc comment claims an evicted base pack can never have its merge state left dangling; fals

**File:** Multiple — see What (lib/packCache.ts's clearPackCache needs to also clear each pruned specialty code's own persisted storage keys, which requires a new or extended export from lib/specialtyPackLoader.ts to enumerate specialty codes pruned by clearSpecialtyPacksForLang)
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Doc comment claims an evicted base pack can never have its merge state left dangling; false with respect to platform storage. Each specialty pack has its own persisted storage keys separate from the in-memory merge, and clearPackCache never clears them. at lib/packCache.ts:clearPackCache:129.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at lib/packCache.ts:clearPackCache:129
- [ ] Audit passes: bash scripts/deep-audit.sh lib/packCache.ts

**Source:** Audit finding F025 — severity 5 — edge-case

**Downstream dependency:** Task #326 (currently deferred, will be re-evaluated next wave) is
blocked on the specific export you add here — `store/entitlementStore.ts`'s
`clearEntitlement` needs to enumerate a deactivated user's specialty codes and evict them
from memCache too. Document the exact name and signature of whatever export you add in your
completion.md — #326's builder reads it via STREAM_HISTORY next wave.

---

## Agent Memories

## Architect Agent Memory (relevant excerpt)
`lib/packLoader.ts` — 5 importers, the base pack load/evict/cache path shared by every
language. `lib/specialtyPackLoader.ts` — extracted from packLoader.ts (Task #156) to keep
Rule 1's 250-line limit; handles specialty pack download, sha256 verification, and unit
merge into the base pack's in-memory cache. Must remain pure (no React, no Zustand).
`lib/packCache.ts` owns the generic cache I/O layer (readCacheMeta/writeCacheMeta/
readCacheData/writeCacheData/clearPackCache) that both packLoader.ts and
specialtyPackLoader.ts now share (as of Wave 11's #299 dedup).

## Security Agent Memory (relevant excerpt)
S2 (run 7): lib/packLoader.ts's specialty pack merge path skips SHA-256 when manifest
unavailable. Unlike base packs, add-on packs (at the time) had no platform-storage cache.
Since Wave 8-9 (#269), specialty packs DO now persist to their own storage keys — but #309
(your task) is about the write-ordering safety of that persistence, and #319 is about
clearPackCache never clearing those same keys on eviction. These two findings are about the
same specialty-pack storage layer from opposite ends (write-safety vs. clear-completeness).

## Notes for this wave
This is the fifth remediation wave following the Batch 12 audit. Two of your tasks (#297,
#319) directly affect what future waves read — #297's corrected header and #319's new
export are both referenced by other deferred/future tasks. Be precise in your completion.md.

## When You Finish
Write your completion summary to .autocode/stream-W12B/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Also note in that file: the exact name/signature of any new export #319 adds to
lib/specialtyPackLoader.ts — Task #326's builder needs this next wave.

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W12B | #297 #302 #309 #319
