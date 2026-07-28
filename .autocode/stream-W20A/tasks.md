# Stream W20A Task State

### Task #455: Fix Verification Gate: 29 pre-existing banned-assertion violations make the widened grep gate fail literally

**File:** components/Stat.test.tsx, components/StudyDoneScreen.test.tsx, components/BuyModal.test.tsx, components/InterruptHandler.test.tsx, components/DifficultyBar.test.tsx, components/UnitRow.test.tsx, components/StudyCard.test.tsx, components/StudyResumePrompt.test.tsx, components/LevelSection.test.tsx, components/settings/Section.test.tsx, components/settings/Toggle.test.tsx, hooks/useStudySession.test.ts
**Complexity:** 🔧 Full — 12 files, mechanical but repo-wide
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Task #450 widened AGENTS.md's Verification Gate grep from `tests/`-only to the whole repo. Run exactly as written, it returns 29 hits across these 12 files — meaning the gate is currently RED by its own unconditional wording ("Run this before closing any batch of work. All four must be green"). Each hit is either a `.toBeDefined()`/`.toBeTruthy()`/`.not.toBeNull()`/`.toBeGreaterThan(0)` on a computed value with no `// existence-check:` justification. Most are `screen.getByText(...).toBeDefined()` (stylistically redundant since RTL's query already throws on absence — low risk) but a few (`StudyCard.test.tsx:118/128`, `UnitRow.test.tsx:51`) assert genuinely computed values and are higher-risk per the Deletion Test. at AGENTS.md:39 (the gate command that currently fails).

**Acceptance Criteria:**
- [ ] Every flagged assertion either replaced with a value-specific `.toBe()`/`.toEqual()`/`.toStrictEqual()`, or annotated with an inline `// existence-check: [reason]` only where the value is genuinely non-deterministic
- [ ] Running AGENTS.md's Verification Gate grep command exactly as written returns zero hits
- [ ] `.autocode/agents/cto.md`'s Batch Audit Log updated to reflect a verified-green gate, not just a closed task

**Source:** Cycle-6 audit finding F1 — severity 9 (CRITICAL) — convergence 1/8 (Agent K, contract verifier) — process/audit-trail integrity. Supersedes the 2026-07-28 debt.md row logged by Task #450/W19D.

---

### Task #466: Add mechanical CI enforcement of AGENTS.md's Verification Gate banned-assertion grep

**File:** .github/workflows/ci.yml
**Complexity:** ⚡ Direct — 1 file, single-scope addition
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
Task #455 (cycle-6 finding F1) exists because the Verification Gate's banned-assertion grep is prose-only in AGENTS.md — nothing mechanically runs it. `.github/workflows/ci.yml` currently runs `npm audit`, `tsc --noEmit`, lint, tests, build, and pack validation, but never AGENTS.md's own grep command. This is the actual root cause of how the gate went red without anyone noticing: the "all four gates must be green" rule has always relied on a human or an agent remembering to run it by hand. Root-cause fix per Max's explicit instruction: mechanical enforcement, not honor system. at .github/workflows/ci.yml:37.

**Acceptance Criteria:**
- [ ] A new CI step runs AGENTS.md's exact banned-assertion grep command (or an equivalent script) and fails the job (non-zero exit) if it finds any unjustified hit
- [ ] The step is added AFTER Task #455's fixes land (either same-wave same-commit, or explicitly sequenced) so CI does not immediately start failing on the pre-existing 29 hits this task didn't cause
- [ ] A comment in ci.yml notes this step is the mechanical enforcement of AGENTS.md's Verification Gate, so the two files don't drift apart again
- [ ] Verified by pushing/simulating a PR that reintroduces one banned assertion and confirming CI fails on it

**Source:** Cycle-6 audit finding F1 follow-up — severity 7 — owner-directed (Max, 2026-07-28): "We should be mechanically enforcing things instead of relying on the honor system." Companion to Task #455 — that task clears the existing debt, this task prevents it from silently recurring.

---
