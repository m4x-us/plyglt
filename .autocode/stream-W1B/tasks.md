# Stream W1B Task State

### Task #053 | tests | severity 3
**What:** Fix StudyCard test quality: remove redundant `toBeDefined` at line 104 and add one behavioral test for the `wasClose=true` render path
**Why:** `toBeDefined` after `getByText` is cargo-cult — `getByText` throws on miss, so the assertion adds no signal. The `wasClose=true` → yellow border + `closeFeedback` string render path has zero test coverage.
**Complexity:** ⚡ Direct — 1 file, no package boundary, test cleanup + 1 new behavioral test
**Blocked by:** Nothing
**Blocks:** Nothing
**Owner:** QA Agent
**Spawned from:** Debt register 2026-06-27 — added to Batch 6 per owner decision
**Done when:** `grep -n "toBeDefined" components/StudyCard.test.tsx` returns 0 hits. A test for `wasClose=true` exists and passes. Verification gate green.
