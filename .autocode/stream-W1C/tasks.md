# Stream W1C Task State

### Task #155 | product | severity 6
**What:** Gate `app/stats/page.tsx` behind `isProEnabled(flags.analytics, licenseType)`. Import `useSettingsStore` to get `licenseType`. Import `getFeatureFlags` and `isProEnabled` from `lib/featureFlags`. Add gate at top of page component: if `!isProEnabled(flags.analytics, licenseType)` render a Pro upgrade prompt (matching the pattern in other gated surfaces) instead of the stats view. Wire `flags.analytics` from `getFeatureFlags()`.
**Why:** BRAND.md lists Analytics as Pro-only. The `analytics` feature flag exists in `lib/featureFlags.ts:35` but is never wired to `app/stats/page.tsx` — every free user sees the stats page. Owner decision 2026-07-01: gate it. Without this the flag is a dead symbol and free users have access to a Pro feature.
**File:** `app/stats/page.tsx`, `app/stats/page.test.tsx`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no implementation-scope keywords in What
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — 2 new test cases: (1) free user sees upgrade prompt, (2) Pro user sees stats. Also test analytics flag=false shows prompt even for Pro.
**Done when:** Free users (licenseType="free") see an upgrade prompt on `/stats`. Pro users see full stats. Flag=false blocks even Pro users. `app/stats/page.test.tsx` has ≥2 new gate test cases. `npm test` passes with no coverage regression.
**Owner:** Architecture Agent

---

### Task #158 | tests | severity 3
**What:** Replace 6 redundant `expect(screen.getByX(...)).toBeDefined()` patterns with bare calls or specific value assertions. Locations: `app/learn/page.test.tsx` lines 96, 97, 105, 106 and `app/stats/page.test.tsx` lines 69, 83. `screen.getByText()` and `screen.getByTestId()` already throw if absent — `.toBeDefined()` adds zero signal. Use specific text/value assertions where a meaningful check is possible; otherwise use bare `screen.getByText('...')`.
**Why:** Kaizen — pseudocode assertions pass when the implementation is wrong. Rule 5 requires tests that fail with wrong output.
**File:** `app/learn/page.test.tsx`, `app/stats/page.test.tsx`
**Severity:** 3 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, test cleanup
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** The fixes ARE the tests.
**Done when:** Neither file has `.toBeDefined()` wrapping a `getBy*` result. `npm test` passes.
**Owner:** QA Agent

NOTE: Run #155 first. After #155 adds gate tests and modifies app/stats/page.test.tsx, fix the redundant .toBeDefined() patterns. Search for patterns rather than relying on exact line numbers.
