# Stream W11C — Completion Summary

**Agent:** Charles
**Wave:** 11
**Stream:** W11C
**Date:** 2026-07-10

---

## Tasks closed

- **#318** — Fixed stale USED BY header in `lib/langRegistry.ts`: removed `app/settings/page.tsx`, `app/learn/page.tsx`, `app/study/page.tsx` (grep confirms none import directly); added `lib/specialtyPackLoader.ts` (imports `SPECIALTY_PACKS` directly).
- **#301** — Removed dead `getSpecialtyPacks` function from `lib/langRegistry.ts`. Orphaned since Task #278 rewrote `LanguageGrid.tsx` to filter `SPECIALTY_PACKS` directly. Forced downstream: removed the import and the test block from `tests/langRegistry.test.ts`.
- **#317** — Changed `isSpecialtyPackCode` to also check `.ready` (see details below).
- **#313** — Updated `isReadySpecialtyPackCode` doc comment: changed "should delegate here" (framing delegation as pending) to "delegates to this function for its specialty-pack loadability gate, replacing its former inline SPECIALTY_PACKS.some(...) check (Task #266)".

## Tasks NOT completed

None. All four tasks reached COMPLETE status.

## Debt entries logged

0

## Carry-forward tasks generated

0

---

## #317 Fix Details (for next wave's #312 builder)

**What changed:** `isSpecialtyPackCode` itself was modified — no new export added.

**Before:**
```typescript
export function isSpecialtyPackCode(s: string): boolean {
  return SPECIALTY_PACKS.some(sp => sp.code === s);
}
```

**After:**
```typescript
/**
 * Returns true iff s is a registered AND ready specialty pack code.
 * Used by purchaseAddOn as the sole code-validity gate before persisting into
 * purchasedAddOns (which has no removal path). Requiring .ready prevents a
 * registered-but-not-yet-shipped pack from being purchased and permanently stored.
 */
export function isSpecialtyPackCode(s: string): boolean {
  return SPECIALTY_PACKS.some(sp => sp.code === s && sp.ready);
}
```

**Why modified in-place rather than adding a new export:** `isSpecialtyPackCode` is used solely by `purchaseAddOn` in `store/entitlementStore.ts`. Its pre-existing semantics ("is this a registered specialty code?") implied purchase-validity, so strengthening it in-place is cleaner than adding a parallel `isReadySpecialtyPackCode`-like export — that function already exists and serves loadability checks. The function name accurately describes the new behavior: a code that isn't ready isn't a valid specialty pack code for any purchase/persistence purpose.

**What #312's `lib/importBackup.ts` fix should call:**
`isSpecialtyPackCode(code)` from `@/lib/langRegistry` — this now checks both registration AND `.ready`, making it the correct gate for any code that's about to be persisted with no removal path. `isReadySpecialtyPackCode` is also equivalent and could be used instead; the two functions are now identical in implementation and differ only in their documented use cases.

---

## Verification Gate Result

| Check | Result | Notes |
|-------|--------|-------|
| `npx tsc --noEmit` | ✓ PASS | Zero TypeScript errors |
| `npm test` | ✓ PASS | 1133 tests, 55 files — all passed |
| `npm run lint` | ✗ FAIL — NOT CAUSED BY W11C | 1 error in `hooks/useLangPack.ts` (off-limits — parallel agent's WIP change added `Date.now()` inside hook body, violating `react-hooks/purity`). My changes introduced zero lint errors. |
| Assertion quality gate | ✓ PASS | No unsuppressed existence-only assertions |

The lint failure is from another parallel agent's in-progress modification to `hooks/useLangPack.ts` (off-limits per W11C brief). The committed HEAD version of `hooks/useLangPack.ts` passes lint cleanly. The agent owning that file must fix the `react-hooks/purity` violation before `/advance` can be run.
