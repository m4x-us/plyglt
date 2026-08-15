# Stream W3B Task State

### Task #564: Fix requirements: announcedDue = Math

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
announcedDue = Math.max(totalDue, INTERRUPT_SESSION_FLOOR) floors the desktop notification count but never caps it at INTERRUPT_SESSION_CAP (8). totalDue sums FSRS-due cards across the whole catalog and is genuinely unbounded, so on a backlog day the notification can announce e.g. 40 cards ready while the session that actually opens is capped at 8 -- the exact defect class Task #544 already fixed on the server side, left unfixed on this client sibling. No test in InterruptHandler.test.tsx exercises totalDue greater than CAP. at components/InterruptHandler.tsx:passive-notification body construction:183.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:passive-notification body construction:183
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F003 — severity 7 — requirements

---

---

### Task #570: Fix requirements: markInterruptFired() and recordInterruptGateEvent({eventType: fired, 

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
markInterruptFired() and recordInterruptGateEvent({eventType: fired, ...}) are both called unconditionally in the passive (non-mandatory) branch, before the notification-permission check determines whether a notification is actually shown. If permission is denied or never granted, sendNativeNotification is never invoked, yet the Rust cooldown clock has already been advanced and a fired event has already been written to the shared cross-device interrupt_gate_events table -- suppressing or delaying future interrupts on this and every other device the user owns, for a fire the user never actually saw. Any user who has denied notification permission is affected today, and the effect is silent. InterruptHandler.test.tsx's does-not-send-when-permission-refused test only asserts sendNativeNotification was not called, never asserting on markInterruptFired or recordInterruptGateEvent. at components/InterruptHandler.tsx:passive interrupt-fire branch:134.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at components/InterruptHandler.tsx:passive interrupt-fire branch:134
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F009 — severity 8 — requirements

---

---

### Task #580: Fix code-quality: The notification body (Cards ready) unconditionally implies content is ready, but docs section 10

**File:** components/InterruptHandler.tsx
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The notification body (Cards ready) unconditionally implies content is ready, but docs section 10.4 documents a case (stranded pause combined with an empty near-due pool) where the session opened by the notification may genuinely be empty. Pre-existing limitation, not newly introduced by this batch, but still a live, undocumented-in-code gap between the notification copy and the actual guarantee. at components/InterruptHandler.tsx:native notification body text:0.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at components/InterruptHandler.tsx:native notification body text:0
- [ ] Audit passes: bash scripts/deep-audit.sh components/InterruptHandler.tsx

**Source:** Audit finding F019 — severity 2 — code-quality

---

---

