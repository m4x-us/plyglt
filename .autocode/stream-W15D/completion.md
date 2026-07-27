CLOSED: #382
NOT_CLOSED: none

## Summary

Fixed the stale "SPECIALTY_PACKS is currently empty" claim in the three remaining files
flagged by audit finding F006 (lib/packLoader.ts's own copy was already corrected during
Task #378's remediation and is out of scope here).

- **tests/purchaseAddOnGuards.test.ts:12** — corrected the mocking-rationale comment: it
  claimed `SPECIALTY_PACKS is Object.freeze([])`. In fact it holds one entry (it-medical,
  ready:false); the ready gate, not emptiness, keeps `isSpecialtyPackCode("it-medical")`
  false. Updated to match lib/packLoader.ts's corrected wording and clarified that the
  test mocks `isSpecialtyPackCode` (not the array) to reach guards past the code check.
- **hooks/useLangPack.test.ts:49** — corrected "SPECIALTY_PACKS is empty in the base
  registry" to reflect the same one-entry/ready-gate reality.
- **.autocode/agents/security.md** — corrected three findings (S1, S2, S3) that each
  described the specialty-pack path as dormant "because SPECIALTY_PACKS is empty" /
  `Object.freeze([])`. All three now state the accurate reason: the array has one entry
  (it-medical) and it is `ready:false`, so the ready gate — not an empty array — keeps the
  path inactive. S3's separate "purchaseAddOn is an intentional stub" note was left as-is
  (different claim, not in scope for this task).

## Verification

- `bash scripts/deep-audit.sh` referenced in the acceptance criteria does not exist in
  this repo (no match anywhere under the project). Ran the actual Verification Gate
  instead, scoped to files touched:
  - `npx vitest run tests/purchaseAddOnGuards.test.ts hooks/useLangPack.test.ts` — 2 files,
    44 tests, all passed.
  - `npx tsc --noEmit` — zero errors.
  - `npm run lint` — zero errors (6 pre-existing warnings, all in files I did not touch).

Debt entries logged: 0
Carry-forward tasks generated: 0
