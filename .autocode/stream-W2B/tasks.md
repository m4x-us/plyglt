# Stream W2B Task State

### Task #210: Fix reliability: out-of-range idleThresholdMinutes can fail Rust u32 deserialization and silently drop the entire bundled IPC call.

**File:** app/settings/page.test.tsx (verification only — root cause is fixed by #209's clamp; see note)
**Complexity:** ⚡ Direct — 1 file, regression test only, no Full trigger keywords
**Owner:** Architecture Agent
**Blocked by:** #209
**Priority:** P2
**Status:** OPEN

**What:**
A NaN or fractional idleThresholdMinutes value would fail Rust's u32 deserialization and reject the entire bundled 7-parameter update_interrupt_config IPC call, silently dropping other unrelated valid changes (e.g. wakeEnabled) submitted in the same call, at onChange handler → updateInterruptConfig → update_interrupt_config:110. Root cause is closed by #209's input clamp (app/settings/page.tsx) — this task is the regression-test verification that the clamp actually prevents the blast-radius failure, not a separate 3-file implementation.
NEW

**Acceptance Criteria:**
- [ ] Fix reliability issue at onChange handler → updateInterruptConfig → update_interrupt_config:110
- [ ] Add a regression test proving a NaN/negative typed value never reaches updateInterruptConfig/invoke once #209 lands

**Source:** Audit finding F025 — severity 6 — reliability

---

---

### Task #213: Fix test-quality: no test exercises an out-of-range or invalid idleThresholdMinutes value.

**File:** tests/
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** QA Agent
**Blocked by:** #209, #211, #212
**Priority:** P3
**Status:** OPEN

**What:**
No test anywhere in the diff exercises an out-of-range or invalid idleThresholdMinutes value (e.g. negative, fractional, or > 120), at tests/:n/a — missing test:0.
NEW

**Acceptance Criteria:**
- [ ] Fix test-quality issue at tests/:n/a — missing test:0
- [ ] Add tests covering negative, fractional, and >120 idleThresholdMinutes inputs once #209/#211/#212 land

**Source:** Audit finding F028 — severity 3 — test-quality

---

---

