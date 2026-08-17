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
