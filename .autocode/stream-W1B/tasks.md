# Stream W1B Task State

### Task #523 | correctness | severity 5
**What:** `hooks/useInterruptConfig.ts`'s `computeDue()` only sums `store/srsStore.ts`'s `getStats(unitCards).due` (cards with `reps > 0 && isDue(now)`). Extend it to also count cards due via `getIntroductionDueCardIds` (the intensive introduction cadence) and qualifying new cards via `getNewCards` — the same content `lib/queue.ts`'s `buildQueue` already pulls in for a session, just missing from the fire-gate.
**Why:** Today, on a day where a user has only an introduction-phase card needing its next appearance (per BRAND.md's "appears every interrupt on Day 1" cadence table) and zero traditional FSRS reviews due, `computeDue()` returns 0 and the interrupt never fires — silently breaking the introduction engine's own cadence promise. See `docs/INTERRUPT_ARCHITECTURE.md` §2.
**File:** `hooks/useInterruptConfig.ts`, `hooks/useInterruptConfig.test.ts` (new or extended)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, single-scope logic fix
**Blocked by:** Nothing | **Blocks:** Nothing (independent of the rest of this batch)
**Done when:** A test proves `computeDue` returns non-zero when the only due content is an introduction-cadence card or a qualifying new card (today's implementation would return 0 for both — this is the Deletion Test). `npx tsc --noEmit`, full test suite, lint all clean.
**Owner:** Architecture Agent
