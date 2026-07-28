# Barry — Stream W25B — Wave 25 — 2026-07-28

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions:
— Barry | W25B | #489 #490

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

You (this same worker identity, prior wave) already landed Task #488 in Wave 24, which rewrote
entitlementCrossTabSync.ts's doc comment to name both tested failure sources (getItem-throws,
migrate()-throws) explicitly and scope the "confirmed with a live regression test" claim
accordingly. Both of today's tasks are follow-up doc-reconciliation work on that same comment —
read the CURRENT state of the file first; a lot of #489/#490's raw material may already be
addressed by #488's rewrite. Don't assume the original finding text describes the file as it
exists today — verify against the actual current doc comment before deciding what's left to fix.

## Your Tasks (run in this exact order)
1. /task #489 — Fix code-quality: entitlementCrossTabSync's Task #482 comment justifies keeping dead code via a generality the file's own header disclaims
2. /task #490 — Fix code-quality: entitlementCrossTabSync's "confirmed with a live regression test" claim overstates what the cited test actually proves

STATUS BOARD RULE — MANDATORY: After every completed /task, print your current status board:

Barry — W25B
[✓] #489 — header vs comment contradiction   ← done
[→] #490 — "confirmed with a test" overclaim   ← starting now

Then proceed to the next task.

## Files You Own (edit ONLY these)
store/entitlementCrossTabSync.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/importBackup.ts
tests/importBackup.test.ts

## Task Definitions

### Task #489: Fix code-quality: entitlementCrossTabSync's Task #482 comment justifies keeping dead code via a generality the file's own header disclaims

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Task #488 (COMPLETE — Wave 24 already rewrote most of the relevant doc comment)
**Priority:** P3

**What:**
The module header states this module is "USED BY: store/entitlementStore.ts ONLY" and warns that calling it twice for the same store key duplicates listeners. The Task #482 comment justifies leaving the dead reject-branch in place by citing possible future reuse of this module "with a non-Zustand or differently-configured rehydrate function." A module whose own header discloses exactly one caller cannot justify unreachable code by invoking a generality its own header disclaims two paragraphs above. at store/entitlementCrossTabSync.ts (header block vs Task #482 inline comment).

**Acceptance Criteria:**
- [ ] Reconcile the header's single-caller claim with the doc comment's multi-caller justification — either the header's scope claim is updated to reflect genuine intended reuse, or the doc comment's justification is narrowed to something consistent with a single-caller module
- [ ] No behavior change required unless Task #488 also changes something here

**Source:** Cycle-10 audit finding F005 — severity 5 — Rule 20 violation.

---

### Task #490: Fix code-quality: entitlementCrossTabSync's "confirmed with a live regression test" claim overstates what the cited test actually proves

**File:** store/entitlementCrossTabSync.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Blocked by:** Task #488 (COMPLETE — Wave 24 already rewrote the doc comment to name both tested failure sources explicitly; verify whether this task's remaining scope is already closed by that rewrite before doing new work)
**Priority:** P3

**What:**
The Task #482 doc comment states the dead-branch claim is "confirmed with a live regression test." The cited test exercises only one failure injection (`getItem` rejects, no `onRehydrateStorage`); zustand's actual catch-all also applies to `migrate()` throwing, `merge()` throwing, and `setItem()` re-persist rejecting, none of which the test triggers. The word "confirmed" attached to the full blanket claim rather than the narrower tested sub-case is not literally true. at store/entitlementCrossTabSync.ts (Task #482 comment block).

**Acceptance Criteria:**
- [ ] Narrow the doc comment's claim to name specifically which failure path the cited test covers, rather than implying full coverage of every path that funnels into zustand's swallowed catch
- [ ] If Wave 24's Task #488 rewrite already lists both tested failure sources (getItem-throws, migrate()-throws) by name and no longer makes a blanket "any rejection path" claim, this task may already be substantively closed — confirm explicitly by re-reading the current comment, and if so, mark this complete with a note explaining why, rather than rewriting a comment that's already accurate. There may still be a residual gap: `merge()` throwing and `setItem()` re-persist rejecting are two more zustand paths into the same swallowed catch that neither #482 nor #488 tested — decide whether those are worth a mention or a further tracked-debt note.

**Source:** Cycle-10 audit finding F006 — severity 4.

## When You Finish
Write your completion summary to .autocode/stream-W25B/completion.md, beginning with:

CLOSED: #489 #490
NOT_CLOSED: none

(or the appropriate variant). Then prose detail. Then tell Max: "Barry is done."

— Barry | W25B | #489 #490
