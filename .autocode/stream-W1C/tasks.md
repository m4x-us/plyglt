# Stream W1C Task State

### Task #177 | tests | severity 2
**What:** Remove stale monthly pricing mock references from 3 page test files. `app/page.test.tsx`, `app/settings/page.test.tsx`, and `app/study/page.test.tsx` still mock `CHECKOUT_URLS.monthly` and `PRICING.monthly` in their vi.mock setup blocks. These mocks are no longer needed since monthly was removed in Task #120. Clean them up to prevent future developer confusion.
**Why:** Poka-Yoke — stale mocks assert that `monthly` exists as a key, which contradicts the annual-only checkout enforced in `tests/entitlement.test.ts` and `tests/checkout.test.ts`. A developer reading the mock would incorrectly assume monthly pricing still exists.
**File:** `app/page.test.tsx`, `app/settings/page.test.tsx`, `app/study/page.test.tsx`
**Severity:** 2 | **DoD Tier:** 1
**Complexity:** 🔧 Full — 3 files, mock cleanup
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** No — removal of stale mocks. Existing tests must still pass.
**Done when:** `grep -r "monthly" app/page.test.tsx app/settings/page.test.tsx app/study/page.test.tsx` returns zero hits. All 897 tests pass. Verification gate green.
**Owner:** QA Agent
