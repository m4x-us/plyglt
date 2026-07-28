CLOSED: #492
NOT_CLOSED: none

## Task #492 — validatePack blank-id dedup gap (F008, design decision)

**Decision: documented why relying solely on validateCard's separate per-card check is
sufficient** — did NOT add a separate "duplicate blank id" tracking mechanism.

Reasoning: every card with a blank/missing/non-string id, no matter how many share the
same pack, is already reported individually and precisely by `validateCard`'s own check
(`units[i].cards[j].id: missing or empty string`) via `validateUnit`'s loop — one error
per offending card, each pointing at its own exact location. Folding N such cards into a
single generic `"Duplicate card IDs: <blank>"` aggregate in the dedup loop would be
*strictly worse*, not better: it collapses N independently-actionable, precisely-located
errors into one vague line with no location information at all — exactly the class of
"confusing CI noise" Task #478 was filed to eliminate in the first place. A blank id
isn't a real identifier colliding with another real identifier; it's simply absent, so
"duplicate" is the wrong frame for it — "missing", which `validateCard` already reports
per-card, is the correct one. No signal is actually lost by skipping blank ids in this
specific loop; it's already reported, more usefully, elsewhere in the same
`validatePack()` call.

Added a substantial comment at the skip site in `scripts/validatePack.ts` explaining this
reasoning in full, so a future reader doesn't have to re-derive it or assume it's an
oversight.

Added 2 tests to `tests/validatePack.test.ts` per the acceptance criteria:
1. **3 cards sharing a blank id** (`id: ""` × 3, satisfying the "3+" requirement): asserts
   no garbled `"Duplicate card IDs:"` aggregate appears, AND all 3 cards are still
   individually reported at their own distinct paths
   (`units[0].cards[0/1/2].id: missing or empty string`) — proving the design decision is
   complete and intentional, not a partial 2-card-only fix.
2. **A blank id alongside a genuine duplicate in the same pack**: guards against a future
   fix accidentally broadening the skip to swallow real duplicate-id detection too (e.g.
   by skipping the whole card instead of just excluding the blank id as a dedup key) —
   asserts both `"Duplicate card IDs: dupe"` and the blank card's own per-card error are
   present together.

Verified the Deletion Test: temporarily reverted the skip to
`const id = (card["id"] as string) ?? ""` (reproducing the pre-#478 unguarded-cast
behavior), confirmed the new 3-card test failed with the exact garbled-aggregate
regression it exists to catch, then restored and reconfirmed all 26 tests green.
`git diff scripts/validatePack.ts` after restoring shows only the intended documentation
addition — no residue from the temporary revert.

Verification: `npx tsc --noEmit` clean (two confirmed unrelated pre-existing/concurrent
errors in off-limits files from other windows, unchanged, not touched). ESLint clean.
`tests/validatePack.test.ts`: 26/26 passing. No banned pseudocode assertions added.
Re-ran the real CLI against both shipped pack files
(`public/packs/it.json` — 63 units/3680 cards, `public/packs/es.json` — 12 units/593
cards) to confirm the production validator path is unaffected — both still pass.

Debt entries logged: 0
Carry-forward tasks generated: 0
