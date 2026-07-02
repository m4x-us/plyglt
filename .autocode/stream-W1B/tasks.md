# Stream W1B Task State

### Task #174 | architecture | severity 6
**What:** `app/stats/page.tsx` is 158 lines — 8 lines over the ≤150 app route limit. Task #155 (analytics Pro gate) added an early-return block (lines 17–24) that pushed the file over the limit. Extract the "not Pro" fallback UI to a new component `components/StatsProGate.tsx` and render it from `app/stats/page.tsx` in place of the inline block.
**Why:** Rule 1 — app routes must stay ≤150 lines. Stop-the-line. The stats page is the only app route currently over the limit.
**File:** `app/stats/page.tsx`, `components/StatsProGate.tsx` (new)
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 2 files, component extraction
**Blocked by:** Nothing | **Blocks:** Nothing
**Test required:** Yes — `app/stats/page.test.tsx` must still pass. Add a co-located `components/StatsProGate.test.tsx` with ≥1 test confirming the upgrade prompt renders when Pro is not active.
**Done when:** `wc -l app/stats/page.tsx` ≤ 150. `components/StatsProGate.tsx` exists with a Rule 2 header. `components/StatsProGate.test.tsx` exists with ≥1 test. Verification gate green.
**Owner:** Architecture Agent
