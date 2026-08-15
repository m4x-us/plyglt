# Stream W1B Task State

### Task #535: Fix code-quality: two independent INTERRUPT_SESSION_FLOOR=6 literals have no mechanical sync guard

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Two independent `INTERRUPT_SESSION_FLOOR=6` literals exist (`lib/queue.ts:21` and `supabase/functions/send-interrupt-notifications/dueEstimate.ts:87`), synced only by a comment instruction, with no test asserting equality between them. AGENTS.md names a hardcoded value that should be derived from a single source of truth as a stop-the-line pattern; currently the values match so there is no live-today incorrect outcome.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_FLOOR const:21
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F002 — severity 4 — code-quality

---

---

### Task #538: Fix requirements: #533 never-empty backstop bypasses the stranded-pause invariant

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
The final never-completely-empty backstop calls `introduceNext()` with no `canIntroduceNewCard` check of any kind, bypassing `strandedAcrossDays` entirely; contradicts BRAND.md's wrong-answer-rules table (new-card introductions pause until the stranded card stabilizes). Confirmed pre-existing from Task #533, not newly introduced by this diff, but Batch 23's wider interrupt fill surface makes this path newly more reachable in production, and no test covers the stranded+empty-near-due combination. Independently found by A, V (validator-coverage), R.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect Task #533 backstop:159
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F005 — severity 6 — requirements

---

---

### Task #539: Fix requirements: computeDue's flex-fallback can promise a stranded-blocked new card

**File:** hooks/useInterruptConfig.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
computeDue's zero-supply flex-fallback (lines 60-73) sets `newCardDue=1` via a raw `getNewCards()` check with no `canIntroduceNewCard`/`strandedAcrossDays` check at all; `getNewCards` (store/srsStore.ts:180-187) only filters on FSRS progress and prerequisites, never on introduction-pause state. This lets computeDue fire an interrupt promising new-card content during a stranded pause that useStudySession's own normal-cap path (line 129, `canIntroduceNewCard(today)`) would refuse to honor. CLAUDE.md's own documentation ("gated on the stranded-pause check") is accurate only for the useStudySession while-loop, not this caller. Independently found by V and R.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useInterruptConfig.ts:computeDue flex-fallback branch:60
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useInterruptConfig.ts

**Source:** Audit finding F006 — severity 5 — requirements

---

---

### Task #541: Fix edge-case: near-due over-fetch heuristic is not a mathematically proven bound

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The near-due over-fetch heuristic (`INTERRUPT_SESSION_FLOOR + sessionIds.size`) is not a mathematically proven bound if already-included cards are interleaved rather than clustered at the front of getNearDueCards' sorted pool; untested edge case, low real-world likelihood.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useStudySession.ts:mount effect near-due fill:147
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F008 — severity 3 — edge-case

---

---

### Task #547: Fix code-quality: 8-card ceiling comment's arithmetic is wrong

**File:** lib/queue.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Comment claims the 8-card ceiling is "approximately the top of the 45-90s window at 8-15s/card", which is arithmetically false by the file's own numbers: 8 cards times 15s/card equals 120 seconds, 33% beyond the stated 90-second ceiling; only true at roughly 11.25s/card, a figure never stated.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/queue.ts:INTERRUPT_SESSION_CAP comment:23
- [ ] Audit passes: bash scripts/deep-audit.sh lib/queue.ts

**Source:** Audit finding F014 — severity 2 — code-quality

---

---

### Task #551: Fix requirements: no daily ceiling on flex-introduced new cards across multiple same-day interrupts

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
`canIntroduceNewCard(today, Number.MAX_SAFE_INTEGER)` disables the daily aggregate new-card cap for the rest of the day (store/srsStore.ts:312-319's `introducedTodayCount>=maxPerDay` check effectively never trips), not just for the current session; across multiple interrupt sessions in one day with a persistently empty near-due pool (the default state for any new user with zero FSRS reviews), up to INTERRUPT_SESSION_MAX_NEW(3) new cards can be flex-introduced in every session that day with no cross-session ceiling, directly contradicting BRAND.md's "one new card introduced per day at steady state" framing for the exact new-user population this feature targets first.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:135
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F018 — severity 6 — requirements

---

---

### Task #554: Fix edge-case: sync cards merge can silently overwrite a just-recorded local review (pre-existing, out of Batch 23 scope)

**File:** hooks/useSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
Cards merge can silently overwrite a just-recorded local review with stale server data in a specific race window; file not touched by Batch 23's diff and unrelated caller-context code, flagged as informational only, out of scope for this batch's verdict.
NEW

**Acceptance Criteria:**
- [ ] Fix edge-case issue at hooks/useSync.ts:cards merge:104
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useSync.ts

**Source:** Audit finding F021 — severity 2 — edge-case

---

---

### Task #561: Fix code-quality: 6-card floor is not an unconditional guarantee when the near-due pool is empty (expectation-alignment note, matches ratified spec)

**File:** hooks/useStudySession.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The 6-card floor is not an unconditional guarantee: when the near-due pool is empty and INTERRUPT_SESSION_MAX_NEW(3) is hit, a session ships with exactly 3 cards, not 6. Confirmed by Contract Verifier K to match BRAND.md's own ratified hedge ("never more than 3 per session... until the pipeline refills") — not a functional defect, included per the low-severity preservation rule as an expectation-alignment note rather than a bug.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at hooks/useStudySession.ts:mount effect isInterrupt fill loop:136
- [ ] Audit passes: bash scripts/deep-audit.sh hooks/useStudySession.ts

**Source:** Audit finding F028 — severity 2 — code-quality

---

---

