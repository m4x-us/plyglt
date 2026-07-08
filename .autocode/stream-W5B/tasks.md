# Stream W5B Task State

### Task #248: Fix data-loss: packLoader's shape-validation guard covers only 3 of 5 JSON.parse(...) as Pack sites

**File:** lib/packLoader.ts, tests/packLoader.test.ts
**Complexity:** 🔧 Full — extract shared validator
**Owner:** Architecture Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
Task #239 added an `Array.isArray(pack.units)` shape guard to 3 of 5 `JSON.parse(...) as Pack` sites in `lib/packLoader.ts:loadPack` (the two offline-fallback branches at lines 213/232, and the fresh-download branch at line 263). The two "cache hit" branches — the sha256-verified hit (line 187) and the fully-unverified no-manifest offline-serve-as-is path (line 193) — remain unguarded, violating the module's own documented invariant ("a mismatch is a hard error — no corrupted pack is ever cached or returned," CLAUDE.md §6). This is a pre-existing catalogued pattern (`.autocode/patterns.md`, 2026-06-26) that Task #239 only partially closed. Converged independently by Agents K, A, W, B (4 of 8 re-audit agents).

**Acceptance Criteria:**
- [ ] Extract the shape-validation check into a single shared helper (e.g. `validatePackShape(pack): boolean`) and apply it uniformly at all 5 `JSON.parse(...) as Pack` sites in `loadPack`, not just the 3 currently guarded
- [ ] Add a test that seeds a cached pack with non-array `units` reaching the sha256-verified cache-hit path and asserts the result is rejected, not returned as `ok:true`
- [ ] Add a test for the no-manifest offline-serve-as-is path with the same malformed fixture

**Done when:** All 5 `JSON.parse(...) as Pack` sites in `loadPack` reject non-array `units` via the same shared validator, verified by tests covering each previously-unguarded path. Verification gate green.

**Source:** Audit finding (Batch 18 remediation re-audit, 2026-07-08) — severity 5 — data-loss — converged independently by Agents K, A, W, B.
