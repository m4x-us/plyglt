# Stream W1A Task State

### Task #544: Fix requirements: server push floor has no matching ceiling — overstates card count on backlog days

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
buildNotificationPayload floors the announced count at INTERRUPT_SESSION_FLOOR(6) via Math.max but applies no ceiling; on any backlog day where cardCount exceeds INTERRUPT_SESSION_CAP(8), the push announces more cards than the client session (capped at 8 in app/study/page.tsx) can ever deliver. Empirically demonstrated by the shipped test tests/pushDueEstimate.test.ts:107-112 (cardCount:9 producing body "9 cards ready"), reachable by any real user with a backlog above 8, including the vacation-return scenario BRAND.md explicitly names.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F011 — severity 7 — requirements

---

---

### Task #545: Fix requirements: server push overstates card count on a brand-new user's first interrupt

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
For a genuinely zero-history new Pro signup (near-due pool empty by definition, no FSRS reviews yet), buildNotificationPayload still announces "6 cards ready" unconditionally, but the real session (useStudySession.ts mount effect) delivers at most INTERRUPT_SESSION_MAX_NEW(3) cards via flex-introduction, or 0 in a fully-exhausted edge case — reachable on 100% of new Pro users' first interrupt, the exact opposite-direction divergence from Task #544.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:buildNotificationPayload:89
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F012 — severity 7 — requirements

---

---

### Task #546: Fix code-quality: doc comment overclaims the client's floor as an unconditional guarantee

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Doc comment states as settled fact "the client guarantees every interrupt session holds at least INTERRUPT_SESSION_FLOOR cards", contradicted by the client's own test (hooks/useStudySession.test.ts, "stops at the catalog's edge without padding duplicates when supply runs out below the floor") which proves the client itself accepts sub-floor sessions as correct. Doc-comment overclaim, root cause distinct from the functional defects in F011/F012.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:71
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F013 — severity 3 — code-quality

---

---

### Task #548: Fix code-quality: doc comment hedges the exhaustion case but not the overflow case

**File:** supabase/functions/send-interrupt-notifications/dueEstimate.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The doc comment's "the session the tap opens genuinely holds at least that many cards (catalog permitting)" hedges only the too-few (exhaustion) case; it never acknowledges the too-many (overflow) case documented in Task #544, a second distinct doc-accuracy gap in the same paragraph.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dueEstimate.ts:module doc comment:79
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dueEstimate.ts

**Source:** Audit finding F015 — severity 3 — code-quality

---

---

### Task #549: Fix code-quality: dispatch.ts header comment not revisited despite increased send volume

**File:** supabase/functions/send-interrupt-notifications/dispatch.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
dispatch.ts's sequential-processing header comment was not revisited despite this diff structurally increasing dispatch volume by removing the zero-estimate skip.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/dispatch.ts:module header comment:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/dispatch.ts

**Source:** Audit finding F016 — severity 2 — code-quality

---

---

### Task #550: Fix code-quality: removed skippedNoCards field loses observability into fabricated-floor sends

**File:** supabase/functions/send-interrupt-notifications/types.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Removing the zero-estimate skip (and the skippedNoCards field) removes the only signal distinguishing "sent because of real content" from "sent because the floor fabricated a number"; the two materially different `sent` outcomes can no longer be distinguished in any future dispatch summary or observability dashboard, and the only kill switch (PUSH_DISPATCH_ENABLED) is all-or-nothing.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at supabase/functions/send-interrupt-notifications/types.ts:skippedNoCards field removal:0
- [ ] Audit passes: bash scripts/deep-audit.sh supabase/functions/send-interrupt-notifications/types.ts

**Source:** Audit finding F017 — severity 3 — code-quality

---

---

