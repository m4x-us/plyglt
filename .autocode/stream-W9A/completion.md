# Stream W9A — Wave 9 — Completion

**Agent:** Adam  
**Wave:** 9  
**Date:** 2026-07-09  
**Tasks:** #261 #266 #268 #272

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #261 | COMPLETE | Wired entitlement enforcement into the data layer for specialty packs. `loadSpecialtyPack` now takes `purchasedAddOns: string[]` as 4th param and returns `{ ok: false, error: "invalid_lang" }` before any fetch when the code isn't in `purchasedAddOns`. `loadPack` passes `options?.purchasedAddOns ?? []` through. `hooks/useLangPack.ts` reads `purchasedAddOns` from `useEntitlementStore` and passes it into `loadPack`, with `purchasedAddOns` in the `useEffect` dep array so a new purchase triggers a re-load. |
| #272 | COMPLETE | Folded into #261: replaced `SPECIALTY_PACKS.find(...)!` with a guarded check that returns `{ ok: false, error: "invalid_lang" }` instead of throwing a raw TypeError if called without the base pre-check. |
| #268 | COMPLETE | Updated `evictPack` doc comment: removed false claim "any registered code can be evicted"; now explicitly documents that specialty pack codes are rejected (units live merged inside the base memCache entry) and callers must evict the base language pack instead. |
| #266 | COMPLETE | Replaced inline `SPECIALTY_PACKS.some(sp => sp.code === lang && sp.ready)` in `lib/packLoader.ts:269` with `isReadySpecialtyPackCode(lang)` from `lib/langRegistry.ts`. Added `isReadySpecialtyPackCode` to the import. Updated the `@/lib/langRegistry` mock in `tests/packLoader.test.ts` to also override `isReadySpecialtyPackCode` (necessary because the function closes over the module-scope `SPECIALTY_PACKS` binding, not the mocked export — a live-binding subtlety in ES module mocking). |

Tasks NOT completed: none

Debt entries logged: 0

Carry-forward tasks generated: 0

---

## Files Changed

- `lib/specialtyPackLoader.ts` — `loadSpecialtyPack` gains `purchasedAddOns: string[]` 4th param; spec-not-found guard replaces `.find()!`; entitlement check before base-pack-not-loaded check; doc comment updated (#261, #272)
- `lib/packLoader.ts` — `isReadySpecialtyPackCode` added to import (#266); `options.purchasedAddOns?: string[]` added to `loadPack` options; inline specialty check replaced with `isReadySpecialtyPackCode(lang)` (#266); `purchasedAddOns` threaded through to `loadSpecialtyPack` (#261); `evictPack` doc comment corrected (#268)
- `hooks/useLangPack.ts` — `useEntitlementStore` imported; `purchasedAddOns` selected from store; `loadPack` call updated to pass `{ purchasedAddOns }`; `purchasedAddOns` added to `useEffect` dep array (#261)
- `tests/packLoader.test.ts` — All existing specialty pack test calls updated to pass `purchasedAddOns`; langRegistry mock extended to also override `isReadySpecialtyPackCode` (#266 live-binding fix); two new #261 tests added (not-entitled → `invalid_lang` before fetch; options-omitted → same)
- `hooks/useLangPack.test.ts` — Three `toHaveBeenCalledWith` assertions updated to include `{ purchasedAddOns: [] }` (#261)
- `tests/srsStore.test.ts` — Non-null assertion added to `errorSpy.mock.calls[0]![0]!` (pre-existing TS error from another wave's addition)

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors ✓
- `npm test` — 1113/1113 passing ✓ (+21 vs Wave 8)
- `npm run lint` — 0 errors (1 pre-existing warning in unrelated file) ✓
- Assertion quality grep gate — clean ✓

---

## New loadPack / loadSpecialtyPack Contract (for Tasks #282, #283, #284)

### `lib/specialtyPackLoader.ts — loadSpecialtyPack`

```typescript
export async function loadSpecialtyPack(
  lang: string,
  memCache: PackMemCache,
  manifest: Manifest | null,
  purchasedAddOns: string[],   // ← NEW 4th parameter
): Promise<LoadPackResult>
```

**Early-return order:**
1. Spec not found in SPECIALTY_PACKS → `{ ok: false, error: "invalid_lang" }` (#272)
2. `!purchasedAddOns.includes(lang)` → `{ ok: false, error: "invalid_lang" }` (#261)
3. `!memCache.has(spec.baseLang)` → `{ ok: false, error: "base_pack_not_loaded" }`
4. `loadedAddOns.includes(lang)` → idempotency path → `{ ok: true, pack: memCache.get(baseLang) }`
5. In-flight dedup → same-code concurrent calls share one promise
6. `_doLoad(...)` → fetch + sha256 + parse + merge

### `lib/packLoader.ts — loadPack`

```typescript
export async function loadPack(
  lang: string,
  manifest: Manifest | null,
  options?: {
    forceRedownload?: boolean;
    purchasedAddOns?: string[];   // ← NEW optional option
  }
): Promise<LoadPackResult>
```

`options?.purchasedAddOns ?? []` is passed as the 4th arg to `loadSpecialtyPack`.
When `purchasedAddOns` is omitted (or `undefined`), defaults to `[]` → specialty packs always rejected.
Base pack loads (`READY_PACK_CODES`) are unaffected — `purchasedAddOns` is only threaded into the specialty branch.

### `hooks/useLangPack.ts` (the real UI entry point)

```typescript
const purchasedAddOns = useEntitlementStore(state => state.purchasedAddOns);
// ...
.then((manifest) => loadPack(targetLang, manifest, { purchasedAddOns }))
// dep array: [targetLang, lang, purchasedAddOns]
```

For tasks #282/#283/#284: write tests against `loadPack` with `purchasedAddOns` matching real
purchased codes. A code in `purchasedAddOns` that is also in `SPECIALTY_PACKS` with `ready:true`
and has the base pack loaded will proceed to `_doLoad`. Omitting `purchasedAddOns` simulates
an unauthenticated caller and always returns `invalid_lang` for specialty codes.

---

## Architecture Notes

**Layer compliance:** `hooks/useLangPack.ts` importing from `@/store/entitlementStore` is correct — hooks/ may import from store/. No upward imports introduced.

**Why `"invalid_lang"` for not-entitled:** `lib/packTypes.ts` is off-limits (owned by another stream) and has no `"not_entitled"` discriminant. `"invalid_lang"` is the closest semantic match: the pack IS in the registry but invalid for this specific user who hasn't purchased it. User-facing message: "Pack not available." — correct for an unpurchased add-on.

**ES module live-binding subtlety (#266):** `isReadySpecialtyPackCode` in `lib/langRegistry.ts` references the module-scope `SPECIALTY_PACKS` constant, not the exported binding. When `tests/packLoader.test.ts` mocks `@/lib/langRegistry` by spreading `...actual` and overriding `SPECIALTY_PACKS`, the function closure still sees the original frozen empty array. The fix: also override `isReadySpecialtyPackCode` in the mock with a fresh arrow function that reads the mutable `mockSpecialtyPacks` array directly.

**Cross-stream fixes:** Two pre-existing TypeScript errors from other waves' uncommitted changes were fixed:
- `tests/srsStore.test.ts:178` — `[0]![0]!` non-null assertion (from another wave adding a test)
- `hooks/useLangPack.test.ts` — three `toHaveBeenCalledWith` assertions updated to include `{ purchasedAddOns: [] }` (consequence of W9A's hook change)
