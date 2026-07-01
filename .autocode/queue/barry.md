---
status: done
agent: barry
stream: W1B
wave: 1
---

# Barry — Stream W1B — Wave 1 — 2026-07-01

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #154

You are Barry, a CTO working on a specific task in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #154  — Delete InterruptHandler.tsx:39-56 (stop-the-line)

STATUS BOARD RULE — MANDATORY: After completing /task #154, print:

Barry — W1B
[✓] #154 — Delete InterruptHandler.tsx:39-56   ← done

Then tell Max: "Barry is done."

## Files You Own (edit ONLY these)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/settings/page.tsx
components/NotificationPermissionGate.tsx
app/stats/page.tsx
app/stats/page.test.tsx
app/learn/page.test.tsx
lib/packLoader.ts
lib/specialtyPackLoader.ts
tests/packLoader.test.ts
tests/langRegistry.test.ts

## Task Definitions

### Task #154 | code | severity 8
**What:** Delete `components/InterruptHandler.tsx` lines 39–56 — the duplicate license revalidation block (`needsValidation()` check + `validateLicense()` call + `markValidated()`/`touchValidated()` branches). `EntitlementValidator.tsx` already runs identical logic on mount in `app/layout.tsx`. When both components mount simultaneously, Zustand reads `needsValidation()` as true for both before either effect's `touchValidated()` propagates — producing two concurrent Lemon Squeezy API calls on every app launch when validation is due.
**Why:** SCTS Andon cord — two concurrent LS API calls on every launch when validation is due. Could exhaust LS rate limits, create duplicate validation events, and masks the responsibility boundary (`EntitlementValidator.tsx` owns revalidation). Stop-the-line.
**File:** `components/InterruptHandler.tsx`, `components/InterruptHandler.test.tsx`
**Severity:** 8 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file (+ test), deletion only
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — `InterruptHandler.test.tsx` must add a test verifying the component does NOT call `validateLicense` on mount.
**Done when:** `components/InterruptHandler.tsx` contains no `needsValidation`, `validateLicense`, `markValidated`, or `touchValidated` import or call. `components/InterruptHandler.test.tsx` has a new assertion that renders `<InterruptHandler />` and asserts `validateLicense` was NOT called. `npm test` passes.
**Owner:** Architecture Agent

## Agent Memories

### Architecture Agent Memory (first 150 lines)
Stack: Next.js 16.2.9, React 19, Zustand 5, Tauri 2. TypeScript throughout.

Layer rules (strictly enforced):
- app/ → components/ → hooks/ → store/ (peer of lib/) → lib/ → content/
- lib/ must NEVER import from store/, hooks/, components/, or app/
- Never import @tauri-apps/api directly — route through lib/tauri.ts only

Critical context for this task:
- `components/EntitlementValidator.tsx` — mounted in app/layout.tsx. OWNS all license revalidation. Contains needsValidation() + validateLicense() + touchValidated() logic. This is the single source of truth. Do NOT touch this file.
- `components/InterruptHandler.tsx` — currently 124 lines. Lines 39-56 duplicate the exact same needsValidation/validateLicense/markValidated/touchValidated flow. Both components mount simultaneously → both read needsValidation()=true before either touchValidated() propagates → two concurrent LS API calls.
- `lib/featureFlags.ts:isProEnabled` — the single combinator for Pro-gated features. Used by InterruptHandler.tsx. Keep this usage.

What to delete (lines 39-56 of InterruptHandler.tsx):
The block begins with something like `const needsValidation = useEntitlementStore(state => state.needsValidation)` and includes a useEffect that calls `validateLicense()` then `markValidated()` or `touchValidated()`. Delete ALL of: the needsValidation selector, the validateLicense import/usage, and the useEffect block. Keep everything else in InterruptHandler.tsx (the interrupt:fire subscription, DND check, mandatory mode, tray listener).

Test pattern to add (verify validateLicense NOT called on mount):
```tsx
import { vi } from 'vitest'
import * as entitlement from 'lib/entitlement'

it('does not call validateLicense on mount', async () => {
  const spy = vi.spyOn(entitlement, 'validateLicense')
  render(<InterruptHandler />)
  await waitFor(() => {/* mounted */})
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
```

Done-when verification commands:
```bash
grep -n "needsValidation\|validateLicense\|markValidated\|touchValidated" components/InterruptHandler.tsx
# Must return 0 results
npm test -- --reporter=verbose 2>&1 | tail -20
```

## When You Finish
Write your completion summary to .autocode/stream-W1B/completion.md:
  Tasks closed: [#154 if done-when passes]
  Tasks NOT completed: [list + reason if any]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max: "Barry is done."

— Barry | W1B | #154
