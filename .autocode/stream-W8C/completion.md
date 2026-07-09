# Stream W8C — Wave 8 — Batch 12 Audit Remediation (#262 #267 #280 #291)
**Date:** 2026-07-09
**Agent:** Charles
**Status:** COMPLETE
**Verification gate at close:** tsc=0 errors · 53/53 test files · 1082 tests pass · lint=0 errors

## Tasks closed
- #262 — Fix setTargetLangCode/getTargetLangCode hyphen truncation (lib/constants.ts)
- #267 — Fix hasAddOn pure function doc comment (lib/entitlement.ts)
- #280 — Add isReadySpecialtyPackCode + clarify isSpecialtyPackCode doc comment (lib/langRegistry.ts)
- #291 — Add LanguageGrid.tsx to langRegistry.ts USED BY header (lib/langRegistry.ts)

## What was done

### #262 — getTargetLangCode hyphen truncation (P1)

**Bug:** `getTargetLangCode()` used `pair.split("-")[1]` which returns only the segment immediately after the first hyphen. For `setTargetLangCode("it-medical")`, the stored value is `"en-it-medical"`, but `split("-")[1]` returned `"it"` — silently discarding `"-medical"`.

**Fix:** Replaced with `indexOf("-")` to split on the first hyphen only and take everything after it:
```typescript
const sepIdx = pair.indexOf("-");
return sepIdx === -1 ? "it" : (pair.slice(sepIdx + 1) || "it");
```

Round-trip now works for all target codes: `"it"` → `"en-it"` → `"it"` ✓, `"it-medical"` → `"en-it-medical"` → `"it-medical"` ✓. The no-hyphen malformed case (`"en"`) still returns `"it"` (existing test preserved).

Note: Regression test for hyphenated round-trip should be added in `tests/srsStore.test.ts` (tests the current `getTargetLangCode` tests). Not added here as that file is not in the owned file list.

### #267 — hasAddOn doc comment (P2)

The existing doc comment was minimal: "Returns true if the given specialty pack code has been purchased as an add-on." It did not explain:
- That this is the canonical pure implementation
- That `store/entitlementStore.ts` should delegate here rather than duplicate the logic
- That the intended use case is non-React contexts (lib/ modules, scripts)

Updated to a full JSDoc comment documenting all three points. No code changes — doc improvement only.

### #280 — isReadySpecialtyPackCode (P3)

**Gap:** `isSpecialtyPackCode` checks any readiness state but `packLoader.ts`'s inline `SPECIALTY_PACKS.some(sp => sp.code === lang && sp.ready)` is the actual loadability check. No named function existed for the ready-only check, so packLoader reimplemented it inline (F006 finding).

**Fix:**
1. Added `isReadySpecialtyPackCode(s: string): boolean` — the named counterpart to READY_PACK_CODES for specialty packs. Mirrors the loadability contract packLoader's inline check uses.
2. Updated `isSpecialtyPackCode` doc comment to explicitly say "Does NOT check .ready — use isReadySpecialtyPackCode for loadability checks."

`lib/packLoader.ts` (off-limits in this wave) should be updated by another agent to use `isReadySpecialtyPackCode` instead of the inline reimplementation.

### #291 — langRegistry.ts USED BY header (P3)

Added `components/LanguageGrid.tsx` to the USED BY list. It directly imports `LANGUAGE_REGISTRY` and `getSpecialtyPacks`.

## Debt entries logged: 0
## Carry-forward tasks generated: 0
## Note: packLoader.ts inline reimplementation (F006) should be updated to use isReadySpecialtyPackCode — deferred to next wave.
