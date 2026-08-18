# AutoCode Severity Trends
| Date | Task | Cycles | Final Severity | Verdict |
|------|------|--------|---------------|---------|
| 2026-06-24 | #001 Delete all lifetime entitlement code | 1 | 7 | FAIL |
| 2026-06-24 | #001 Delete all lifetime entitlement code | 2 | 4 | PASS |
| 2026-06-24 | #001 Delete all lifetime entitlement code | Standalone/3 | 8 | FAIL |
| 2026-07-03 | Batch 1 — Security + Correctness Foundation | 1 | 7 | FAIL |
| 2026-07-03 | Batch 1 re-audit (Task #182 + AGENTS.md + SRS v3) | 1 | 7 | FAIL |
| 2026-07-04 | #164 Add tests for the Task #163 OS trigger settings | 1 | 9 | FAIL |
| 2026-07-07 | Batch 18 — Introduction Engine Remediation + Correctness Hardening | 1 | 9 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit (Tasks #228-245) | 2 | 6 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit cycle 3 (Tasks #246-249) | 3 | 5 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit cycle 4 (Tasks #250-251) | 4 | 5 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit cycle 5 (Tasks #252-257) | 5 | 5 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit cycle 6 (Tasks #258-259) | 6 | 5 | FAIL |
| 2026-07-08 | Batch 18 remediation re-audit cycle 7 (Task #260) | 7 | 4 | FAIL |
| 2026-07-09 | Batch 12 — Specialty Pack Architecture | 1 | 8 | FAIL |
| 2026-07-13 | Batch 12 re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 7 | FAIL |
| 2026-07-15 | Batch 12 third re-audit (7 scored: A/B/S/K/W/V/Red-R + unscored N) | 1 | 8 | FAIL |
| 2026-07-27 | Batch 12 fourth re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 6 | FAIL |
| 2026-07-28 | Batch 12 fifth re-audit (9-agent: A/B/S/N/K/W/V/Red-R, N retried once) | 1 | 7 | FAIL |
| 2026-07-28 | Batch 12 sixth re-audit (8-agent: A/B/S/N/K/W/V/Red-R, K and W each retried once) | 1 | 9 | FAIL |
| 2026-07-28 | Batch 12 seventh re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 6 | FAIL |
| 2026-07-28 | Batch 12 eighth re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 6 | FAIL |
| 2026-07-28 | Batch 12 ninth re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 6 | FAIL |
| 2026-07-28 | Batch 12 tenth re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 7 | FAIL |
| 2026-07-28 | Batch 12 eleventh re-audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 9 | FAIL |
| 2026-07-28 | Batch 19 — first-ever audit (8-agent: A/B/S/N/K/W/V/Red-R) | 1 | 7 | FAIL |
| 2026-07-28 | Batch 19 re-audit cycle 2 (3-agent: A/K/Red-R, verifying Task #506) | 2 | 3 | PASS |
| 2026-08-15 | batch 23 -- Interrupt Session Size Floor (6 cards) + Server Push Cont | 1 | 7 | FAIL |
| 2026-08-15 | batch 23 -- re-audit round 2 (8-agent, post Wave 1+2 remediation) | 1 | 8 | FAIL |
| 2026-08-15 | batch 23 -- re-audit round 3 (8-agent, post Wave 3+4 remediation) | 1 | 8 | FAIL |
| 2026-08-15 | batch 23 -- re-audit round 4 (8-agent, post Wave 5 remediation) | 1 | 9 | FAIL |
| 2026-08-16 | batch 23 -- re-audit round 5 (8-agent, post Wave 6+7 remediation) | 1 | 8 | FAIL |
| 2026-08-17 | batch 23 -- re-audit round 6 (8-agent, post Wave 8 remediation) | 1 | 8 | FAIL |
| 2026-08-17 | batch 23 -- re-audit round 7 (8-agent, post round-6 remediation) | 1 | 8 | FAIL (13/18 findings fixed live same round, 5 capped/logged as debt) |
| 2026-08-17 | batch 23 -- re-audit round 8 (8-agent, post round-7 remediation) | 1 | 7 | FAIL (6 findings fixed live same round -- incl. a real network-timeout false-positive risk and a genuine test-wiring gap -- 2 logged as debt, 1 prior debt entry corrected) |
| 2026-08-17 | batch 23 -- re-audit round 9 (8-agent, post round-8 remediation) | 1 | 7 | FAIL (round-8's own timeout-widening fix reverted after its justification was found factually wrong; 4 more doc-drift siblings fixed; 2 new findings -- a resume-desync bug and a missing Pro-gate -- logged to debt for Max's disposition) |
| 2026-08-17 | batch 23 -- re-audit round 10 (8-agent, post round-9 remediation) | 1 | 4 | FAIL (capped, not reachable today) (round-9's own revert comment made a second false claim -- 5-way convergence -- corrected across 3 files without asserting a new precise-but-wrong number; a second independent tautological-test instance found and fixed; no new severity>=5 findings) |
| 2026-08-17 | batch 23 -- re-audit round 11 (8-agent, post round-10 remediation, agents explicitly forbidden from Edit/Write) | 1 | 7 | FAIL (verified, then fixed live during the same round) (Red Agent R found a genuinely new, previously-undiscovered live bug -- handleRate's "again" requeue unbounded past INTERRUPT_SESSION_CAP in interrupt sessions -- fixed with a Deletion-Tested regression test; 3 sibling test-pin gaps and 3 doc-drift instances also fixed; Pro-gate gap and resumedQueue desync re-confirmed still open, unchanged, now 3 rounds unresolved; 2 new minor items logged to debt) |
| 2026-08-18 | batch 23 -- re-audit round 12 (8-agent, post round-11 remediation, agents forbidden from Edit/Write) | 1 | 6 | FAIL (verified, then fixed live during the same round) (3-way convergence found round 11's own atInterruptCap fix had an unclamped sibling writer -- the resume-accept path -- fixed with a Deletion-Tested regression test; also fixed a genuinely new listener-leak bug in usePushRegistration.ts, closed the 3-round-open resumedQueue/resumedPos desync's higher-severity half, fixed a resumeTotal display mismatch, a CLAUDE.md doc-drift instance, a test-coverage gap, and a file-size cap regression; Pro-gate gap re-confirmed still open, now 4 rounds unresolved, Agent W recommends direct escalation to Max; 2 new minor items logged to debt) |
| 2026-08-18 | batch 23 -- re-audit round 13 (8-agent, post round-12 remediation, agents forbidden from Edit/Write) | 1 | 7 | FAIL (verified, then fixed live during the same round) (6-way convergence found round 12's OWN two fixes never composed -- resumedQueue was CAP-clamped but sibling resumedPos wasn't, reopening the premature-isDone failure mode debt.md had claimed closed -- fixed with a Deletion-Tested regression test, plus a companion page.tsx display fix and a debt.md correction; third consecutive round with a genuinely new real bug found, not just doc/test corrections; Red Agent R found a severity-7 stale-queue-on-navigation bug (push tap/deep link mid-session) deliberately NOT fixed live given the risk to this file's fragile resume/mount-fill logic, logged as a dedicated-task debt item instead; 2-way convergence found 5 sibling unguarded-listener sites sharing round 12's already-fixed defect class, logged as debt; Pro-gate gap now open 5 consecutive rounds -- escalated via a direct structured question per Agent W's explicit recommendation rather than re-logged again) |
| 2026-08-18 | batch 23 -- Pro-gate implemented (owner-directed, post round-13 escalation) | 1 | 5 | RESOLVED (Max answered "Yes, gate it" via a direct structured question; components/InterruptHandler.tsx wired isProEnabled into its early-return, mirroring hooks/usePushRegistration.ts's existing pattern; 3 new gate tests added and Deletion-Tested; 30/30 tests pass) |
| 2026-08-18 | batch 23 -- re-audit round 14 (8-agent, post round-13 + same-day Pro-gate follow-up) | 1 | 6 | FAIL (verified, then fixed live during the same round) (4-way convergence found the Pro-gate's own untouched sibling -- app/settings/page.tsx's Review Reminders toggle had zero Pro-awareness, silently wasting a real OS permission prompt for Free users -- fixed with an upgrade-prompt UI and 5 Deletion-Tested regression tests; 3-way convergence found the server-side push pipeline has zero entitlement awareness and unregisterPushToken had never been called anywhere -- partially fixed (client-side cleanup on gate-loss, closing the common exposure path), deeper server-side gap logged as an architecture-decision debt item; Red Agent R found the Pro-gate made an existing debt item's severity-capping reachability premise stale, sharpened and raised 4->6; a disputed "headline" finding from round 13 was independently re-derived and found to be a no-op, not a bug -- debt.md corrected rather than code changed, and the disputing agent's proposed alternative fix confirmed to be a regression; fourth consecutive round with a real finding, but the character shifted from narrow single-file composition bugs (now exhausted per Agent W) to cross-subsystem gaps found by deliberately widening scope) |
