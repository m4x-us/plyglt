# Stream W12D — Wave 12 Completion

## Tasks closed

| Task | File(s) changed | Change |
|------|----------------|--------|
| #312 | `lib/importBackup.ts`, `tests/importBackup.test.ts` | Added `isSpecialtyPackCode` filter to `purchasedAddOns` — a hand-edited backup JSON can no longer inject arbitrary add-on codes. Import updated; 3 new tests (registered code passes, unregistered filtered, non-string always filtered). `tests/importBackup.test.ts` gains `vi.mock("@/lib/langRegistry")` using `importOriginal` pattern so `isValidPackCode` (existing tests) is unaffected. Total: 33 tests. |
| #311 | `hooks/useLangPack.test.ts` | Line 103: `.toBeDefined()` → `.toHaveLength(1)` (deterministic mock returns exactly 1 unit). Line 104: removed `.toBeDefined()` on `units[0]` (redundant — line 105 asserts `id === "es-u01"`). Line 117: added `// existence-check:` comment on the Italian static-pack `toBeGreaterThan(0)` assertion (non-deterministic curriculum count). |
| #314 | `tests/entitlement.test.ts` | Seam test's happy-path now asserts `expect(mockInvoke).toHaveBeenCalledWith("verify_addon_receipt", { code: "it-medical", receiptToken: "tok_seam_receipt" })` — deleting the receipt-verification block makes this fail. |
| #315 | `tests/entitlement.test.ts` | Same seam test also asserts `expect(vi.mocked(isSpecialtyPackCode)).toHaveBeenCalledWith("it-medical")` — deleting the code-validation branch makes this fail. |

## Regression fixed (collateral from Wave 11 Task #300)

`components/LanguageGrid.test.tsx` had `vi.mock("@/lib/entitlement", () => ({ PRICING: ... }))` — a factory-only mock that hid all real exports including `hasAddOn`. Wave 11's Task #300 made `entitlementStore.ts` import `hasAddOn` from `lib/entitlement`, causing 5 LanguageGrid specialty-pack tests to fail with "No 'hasAddOn' export is defined on the mock." Fixed by switching to the `importOriginal` spread pattern (`{ ...actual, PRICING: ... }`). File is not in Wave 12D's owned-files list but is not off-limits; SCTS requires all tests to pass.

## Verification gate results

- `npm test` — 1137 passed (55 files) ✓
- `npm run lint` — 0 errors (2 pre-existing warnings in files not owned by this stream) ✓
- grep gate — clean ✓
- `npx tsc --noEmit` — **1 pre-existing error** in `components/LanguageGrid.tsx:90`: `Type '(code?: string | undefined) => void' is not assignable to type 'MouseEventHandler<HTMLButtonElement>'`. File is in the off-limits list (last modified wave 8, unrelated to this wave). Cannot fix. Carry-forward.

## Debt entries logged: 0
## Carry-forward tasks generated: 1

**Carry-forward:** `components/LanguageGrid.tsx:90` — `onClick={onUpgradeClick}` type mismatch (`(code?: string) => void` vs `MouseEventHandler<HTMLButtonElement>`). Pre-existing. Needs a wave where `components/LanguageGrid.tsx` is in-scope.
