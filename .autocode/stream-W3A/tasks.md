# Stream W3A Task State

### Task #562: Fix edge-case: flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 1

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
flexIntroAllowed is computed once via canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) at line 142, then the while loop at 143-149 introduces up to INTERRUPT_SESSION_MAX_NEW (3) cards against that single stale boolean with no per-iteration recheck. Across repeated interrupt sessions in one day this lets the daily flex ceiling of 9 be exceeded by up to 2 cards (concrete trace: normal-cap introduces 1, then three interrupt sessions each re-evaluate flexIntroAllowed against a count still under 9 at 1, 4, 7 and each is granted a full 3-card batch, landing the day total at 10). Consequence is a cognitive-load overshoot against BRAND.md's documented working-memory ceiling, not data loss. Confirmed independently by World-Class Reviewer W (trace), Claim Verifier V (contract analysis), and Naive Reader N. at hooks/useStudySession.ts:mount-fill effect (flexIntroAllowed / while-loop introduction):142.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount-fill effect (flexIntroAllowed / while-loop introduction):142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F001 — severity 6 — edge-case

---

---

### Task #565: Fix code-quality: The #533/#538 never-empty backstop is dead code: introduceNext() is a pure function of (allCardMap, 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The #533/#538 never-empty backstop is dead code: introduceNext() is a pure function of (allCardMap, cards, introductions, introducedIds), none of which change between the while loop's attempts (143-149) and the backstop call, so whenever the backstop's guard is true, the while loop already tried and failed with bit-identical arguments and the backstop is structurally guaranteed to fail again. The surrounding comment and docs/INTERRUPT_ARCHITECTURE.md section 10.4 both describe this as a working, distinct safeguard; it is a no-op. at hooks/useStudySession.ts:never-empty backstop (post-loop fallback):180.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:never-empty backstop (post-loop fallback):180
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F004 — severity 3 — code-quality

---

---

### Task #566: Fix code-quality: flexIntroAllowed is a single boolean that is false for two distinct, undistinguishable reasons -- th

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
flexIntroAllowed is a single boolean that is false for two distinct, undistinguishable reasons -- the stranded-pause invariant and the daily-flex-ceiling being hit -- but the adjacent code comment and docs section 10.4 attribute 100% of the backstop's empty-session outcome to the stranded pause only. Moot in practice given F004, but the comment/doc framing remains factually wrong on its own terms. at hooks/useStudySession.ts:flexIntroAllowed / backstop comment:142.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:flexIntroAllowed / backstop comment:142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F005 — severity 3 — code-quality

---

---

### Task #573: Fix async: useState(initialQueue) only consumes its initializer on true first mount, and the mount-fill effect 

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
useState(initialQueue) only consumes its initializer on true first mount, and the mount-fill effect has an empty dependency array, so it runs once and closes over render-1's data. app/study/page.tsx calls useStudySession before the packLoading early-return, so any component that mounts while a pack is still loading -- es-language sessions, specialty-pack loads, cold push-tap launches -- permanently freezes the queue empty. This regresses the never-completely-empty guarantee for the exact task (#552) that was supposed to have closed this gap: the fix that shipped (adding allCards to a useMemo dependency array) does not address the stale-closure root cause. No test can catch it because every test touching this path mocks useStudySession away. at hooks/useStudySession.ts:mount-time introduce effect (useState(initialQueue)):83.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at hooks/useStudySession.ts:mount-time introduce effect (useState(initialQueue)):83
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F012 — severity 7 — async

---

---

### Task #574: Fix tests: No seam test proves the combined interaction where a normal-cap introduction on session mount consum

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
No seam test proves the combined interaction where a normal-cap introduction on session mount consumes 1 of the 3 available flex slots on an interrupt session. The code looks correct by inspection but the interaction path itself is untested. at hooks/useStudySession.ts:mount effect (normal-cap intro + flex fill interaction):142.
NEW

**Acceptance Criteria:**
- [ ] Fix tests issue at hooks/useStudySession.ts:mount effect (normal-cap intro + flex fill interaction):142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F013 — severity 3 — tests

---

---

### Task #577: Fix security: INTERRUPT_FLEX_DAILY_MAX is enforced via a check-then-act read of in-memory Zustand state with no cr

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
INTERRUPT_FLEX_DAILY_MAX is enforced via a check-then-act read of in-memory Zustand state with no cross-tab or cross-window coordination -- two tabs of the same account can each independently pass canIntroduceNewCard and each flex up to 3 new cards, exceeding the intended daily ceiling beyond even the single-tab overshoot in F001. Real but low-stakes given the client-only honor-system entitlement model already documented in CLAUDE.md section 5 as an accepted, intentional trade-off. at hooks/useStudySession.ts:flexIntroAllowed check-then-act:142.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at hooks/useStudySession.ts:flexIntroAllowed check-then-act:142
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F016 — severity 3 — security

---

---

