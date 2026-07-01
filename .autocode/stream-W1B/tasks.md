# Stream W1B Task State

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
