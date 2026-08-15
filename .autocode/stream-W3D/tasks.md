# Stream W3D Task State

### Task #578: Fix error-handling: A negative cardCount (malformed upstream data) fails the ===0 branch and silently clamps to FLOOR (6

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
A negative cardCount (malformed upstream data) fails the ===0 branch and silently clamps to FLOOR (6) via Math.max with no logging of the anomaly. Latent, not currently reachable: computeDueEstimate only increments a counter and never produces a negative value today. at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:0.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F017 — severity 2 — error-handling

---

---

### Task #579: Fix tests: docs section 10

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
docs section 10.1's INTERRUPT_FLEX_DAILY_MAX=9 table entry has no mechanical cross-check against lib/queue.ts's real derivation, unlike FLOOR and CAP which tests/interruptFloorSync.test.ts does mechanically verify. A third place the constant is documented with no automated guard against drift. at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX:0.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at lib/queue.ts:INTERRUPT_FLEX_DAILY_MAX:0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F018 — severity 4 — tests

---

---

### Task #585: Fix error-handling: lib/queue

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
lib/queue.ts silently drops stale or mismatched card ids with no logging. Low severity, pre-existing pattern not introduced by this batch. at lib/queue.ts:buildQueue (stale/mismatched id handling):0.
NEW

**Acceptance Criteria:**
- [ ] Fix error-handling issue at lib/queue.ts:buildQueue (stale/mismatched id handling):0
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F024 — severity 2 — error-handling

---

---

### Task #586: Fix async: inFlightSyncPromise is not keyed by userId

**File:** hooks/useSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
inFlightSyncPromise is not keyed by userId. A sign-out followed immediately by sign-in as a different user could misattribute an in-flight sync's result to the wrong account. Low probability, informational; the surrounding comment does not discuss this case. at hooks/useSync.ts:inFlightSyncPromise:0.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useSync.ts:inFlightSyncPromise:0
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useSync.ts

**Source:** Audit finding F025 — severity 3 — async

---

---

