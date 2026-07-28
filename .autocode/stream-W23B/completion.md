CLOSED: #480
NOT_CLOSED: none

## #480 — validatePack's dedup loop still collided on empty/whitespace-only card ids

Task #478's fix (`if (!isString(id)) continue;`) only replicated half of `validateCard`'s
own compound id check. Two cards both with `id: ""` (or `id: " "`, whitespace-only) both
pass `isString()` — they're genuinely strings — so both still entered the `ids` Set as
the identical dedup key, reproducing the exact garbled `"Duplicate card IDs: "` (nothing
readable after the colon) output #478 was supposed to eliminate entirely.

Fix in `scripts/validatePack.ts`: the dedup guard now mirrors `validateCard`'s exact
compound check —

```ts
if (!isString(id) || id.trim() === "") continue;
```

— instead of the type-check-only half `#478` shipped.

## Tests

Added two new cases to `tests/validatePack.test.ts` (empty-string id, whitespace-only
id), each constructing a unit with two cards sharing the same blank id and asserting the
garbled duplicate line is absent.

Also closed the separate F010 finding in the same task: updated the two *existing* #478
tests (missing id, non-string id) — previously absence-only (`errors.some(...).toBe(false)`)
— to additionally assert `validateCard`'s own per-card id error
(`"units[0].cards[0].id: missing or empty string"`) is still present for BOTH cards. An
absence-only assertion can't distinguish "the dedup guard correctly suppressed the
garbled line" from "the dedup loop silently stopped running/being reached at all" — both
would make the garbled-line assertion pass for entirely different (and in the second
case, wrong) reasons. All 4 tests (2 existing + 2 new) now use this same
dual-assertion shape.

**Deletion Test**: temporarily reverted the fix back to #478's type-check-only guard,
ran the two new tests — both failed as expected (`expected true to be false`, i.e. the
garbled duplicate line WAS present), confirming they genuinely exercise the fixed line.
Restored the file immediately after; re-verified `tsc --noEmit` clean and all 24 tests
in the file passing again.

Full verification gate: `tsc --noEmit` clean for my two owned files (one unrelated
error in `lib/importBackup.ts`, explicitly off-limits to me this wave, owned by another
concurrent window mid-edit — confirmed by filtering it out and re-checking). `npm run
lint` 0 errors (3 pre-existing warnings, all in other streams' files).
`tests/validatePack.test.ts`: 24/24 passing. Existence-check grep gate clean.

Debt entries logged: 0
Carry-forward tasks generated: 0
