# Stream W23B Task State

### Task #480: Fix code-quality: validatePack's dedup loop still collides on empty/whitespace-only card ids after Task #478's partial fix

**File:** scripts/validatePack.ts, tests/validatePack.test.ts
**Complexity:** ⚡ Direct — 2 files, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Task #478's fix (`if (!isString(id)) continue;`) closes the undefined/non-string dedup-key collision but does not replicate validateCard's compound check (`!isString(card["id"]) || card["id"].trim() === ""`). Two cards both with `id: ""` both pass `isString("")` (true), collide in the ids Set, and reproduce the exact garbled "Duplicate card IDs: " output Task #478 was supposed to eliminate. A whitespace-only id (" ") survives the same gap. Related, distinct angle (Red Agent R): the `continue` also silently drops ANY invalid-id card from this specific loop with zero record — a real duplicate pair sharing an invalid id shape produces no signal from this check specifically (though validateCard's separate check still reports the shape issue elsewhere). at scripts/validatePack.ts:201.

**Acceptance Criteria:**
- [ ] The dedup guard mirrors validateCard's exact compound check: `isString(id) && id.trim() !== ""`
- [ ] Tests cover two cards both with id:"" and both with id:" " (whitespace-only), asserting no garbled "Duplicate card IDs:" line
- [ ] The new/existing garbled-output tests also assert validateCard's own per-card id errors are still present in the result (not just the absence of the duplicate line), so the test can distinguish "correctly suppressed" from "dedup silently stopped running"

**Source:** Cycle-9 audit finding F002 + F010 — severity 5 — convergence 5/8 (Agents N, B, K, W, Red R) — Rule 23 violation, LIVE (CI validator path).

---
