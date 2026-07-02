# Charles — Stream W1C — Wave 1 — 2026-07-01

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Charles | W1C | #177

You are Charles, a CTO working on a specific task in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #177  — Remove stale monthly pricing mocks from 3 page test files

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Charles — W1C
[✓] #177 — Remove stale monthly pricing mocks from 3 page test files   ← done

Then tell Max: "Charles is done."

## Files You Own (edit ONLY these)
app/page.test.tsx
app/settings/page.test.tsx
app/study/page.test.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/utils.ts
lib/packLoader.ts
lib/specialtyPackLoader.ts
app/stats/page.tsx
components/StatsProGate.tsx
components/StatsProGate.test.tsx

## Task Definitions

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

## Agent Memories

## QA Agent Memory (all 84 lines)

# QA Agent Memory — plyglt

## Test Framework
Vitest 4 with vi.mock, vi.fn, vi.spyOn. @testing-library/react for hook tests.
Test command: `npm test`. Coverage: `npm test -- --coverage`.

## Test Count and Coverage (CONFIRMED run 10 — 2026-07-01)
- **897 tests across 49 test files** (confirmed after Tasks #154, #155, #157, #158, #120, #121)
- vitest.config.ts now excludes `tests/e2e/**` — Playwright E2E runs separately via `npm run test:e2e`
- Coverage thresholds: lines=84, funcs=79, branches=81, stmts=82
- All thresholds met. Thresholds only ever increase — never lower.

## Key context for Task #177
Monthly pricing was removed in Task #120. `lib/checkout.ts` now exports only `CHECKOUT_URLS.annual` and `PRICING.annual`. The `monthly` key no longer exists.

Three page test files still contain vi.mock blocks with stale `monthly` references:
- `app/page.test.tsx` — mocks `CHECKOUT_URLS.monthly` and/or `PRICING.monthly`
- `app/settings/page.test.tsx` — mocks `CHECKOUT_URLS.monthly` and/or `PRICING.monthly`
- `app/study/page.test.tsx` — mocks `CHECKOUT_URLS.monthly` and/or `PRICING.monthly`

The done-when grep command: `grep -r "monthly" app/page.test.tsx app/settings/page.test.tsx app/study/page.test.tsx` must return zero hits.

CRITICAL: After removing the mock keys, run `npm test` to confirm all 897 tests still pass. The removal should be purely additive-negative (deletion only) — no test logic should need to change.

## Verification Gate
```bash
npx tsc --noEmit        # zero TypeScript errors
npm test                # all tests pass + all coverage thresholds met
npm run lint            # zero lint errors
```

## When You Finish
Write your completion summary to .autocode/stream-W1C/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Charles is done."

— Charles | W1C | #177
