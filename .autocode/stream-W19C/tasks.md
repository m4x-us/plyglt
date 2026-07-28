# Stream W19C Task State

### Task #448: Fix correctness: parseFlag silently enables a safe-off flag when its env var is set to an empty string

**File:** lib/featureFlags.ts, tests/featureFlags.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
parseFlag(v, defaultEnabled) only returns defaultEnabled when v===undefined; an env var explicitly set to the empty string skips that branch and falls through to enabled=true regardless of the flag's intended safe-off default. No test covers the empty-string case. A deployment config that sets a flag var to an empty string (a realistic misconfiguration, e.g. an unset CI template variable) silently enables an unfinished feature meant to default off. at lib/featureFlags.ts:parseFlag:26.

**Acceptance Criteria:**
- [ ] parseFlag treats an empty-string env var the same as unset (falls through to defaultEnabled)
- [ ] Test: NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS="" yields the flag disabled, same as unset

**Source:** Audit finding F009 — severity 5 — correctness

---

### Task #444: Fix test-coverage: app/stats/page.tsx's entire populated-dashboard render path has zero happy-path test coverage

**File:** app/stats/page.tsx, app/stats/page.test.tsx
**Complexity:** ⚡ Direct — 2 files, no package boundary — write tests against existing code, no production logic change expected
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Every test in app/stats/page.test.tsx drives the page with EMPTY_STATS (hardest:[], weakestTags:[], levelStability:[]) or a Pro-gate-blocked state; even the one exception (seen:10) still zeroes those three arrays. Coverage confirms app/stats/page.tsx sits at 40% function / 66.66% statement coverage, with lines 86-126 — the DifficultyBar-rendering branch, the weakestTags block, and the levelStability retention-bars block (including stabilityColorClass and its width-percentage calculation) — never executing under test. This is the core value-delivery view of the paid Stats page shipping with zero happy-path test coverage — AGENTS.md's Stop-the-Line list explicitly names "any user-visible feature with zero tests covering its happy path." at app/stats/page.tsx:StatsPage:86.

**Acceptance Criteria:**
- [ ] At least one test populates hardest/weakestTags/levelStability with real data and asserts the DifficultyBar, weakestTags, and retention-bar rendering branches all execute and render expected content
- [ ] Coverage on app/stats/page.tsx rises to reflect lines 86-126 being exercised

**Source:** Audit finding F014 — severity 7 — test-coverage/stop-the-line

---
