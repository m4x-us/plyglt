CLOSED: #478 #476
NOT_CLOSED: none

## Task #478 — validatePack dedup-loop unchecked id cast (C8-F05)

`scripts/validatePack.ts`'s Task #468 dedup loop had `const id = card["id"] as string;`
with no runtime guard — two cards both missing/with a non-string `id` collided as the
same dedup key (the raw `undefined`/non-string value used directly as a `Set<string>`
key), producing a garbled `"Duplicate card IDs: "` line with nothing readable after the
colon. Fixed by checking `isString(id)` and `continue`-ing past any card whose id isn't
a real string, before ever touching `ids`/`duplicates`. No error reporting is lost — a
missing/non-string id is already reported by `validateCard`'s own check via
`validateUnit`'s loop earlier in the same `validatePack` call.

Added 2 tests to `tests/validatePack.test.ts`: two cards both with `id: undefined`, and
two cards both with `id: 42` — asserting no `"Duplicate card IDs:"` line appears in
either case. Verified the Deletion Test by temporarily reverting to the unguarded cast:
both new tests failed as expected (`expected true to be false`), then restored and
reconfirmed all 22 tests green.

## Task #476 — non-discriminating string fixtures in validatePack.test.ts (C8-F03)

Two of the six existing Task #468 regression tests used a JS string
(`"not-an-array"`) as their "malformed, non-array" fixture for `unit.cards` and
`pack.units`. Strings are iterable via `for...of` (yielding characters) and never throw,
so neither test actually exercised the `isArray` guard's throw-prevention path — both
tests stayed green whether or not the corresponding guard existed (confirmed personally
via the Deletion Test below, matching the audit's own mutation-testing finding).

Replaced both fixtures with genuinely non-iterable, non-array, non-null values per the
acceptance criteria's own suggestion:
- `unit.cards: "not-an-array"` → `unit.cards: 42` (a number — not iterable at all).
- `pack.units: "not-an-array"` → `pack.units: {}` (a plain object — no `Symbol.iterator`).

Verified the Deletion Test for both, exactly as instructed: temporarily removed
`isArray(unit["cards"])` from the dedup loop's inner guard — the updated `cards: 42` test
failed with `TypeError: unit.cards is not iterable`, confirming it now genuinely
exercises the guard. Restored, then temporarily removed `isArray(raw["units"])` from the
dedup loop's outer guard — the updated `units: {}` test failed with
`TypeError: raw.units is not iterable`. Restored both; `git diff scripts/validatePack.ts`
after all reverts shows only the intended #478 change, confirming no residue.

Verification: `npx tsc --noEmit` clean (two confirmed unrelated pre-existing/concurrent
errors in off-limits files from other windows, unchanged from prior waves, not touched).
ESLint clean. `tests/validatePack.test.ts`: 22/22 passing. No banned pseudocode
assertions added. Re-ran the real CLI (`npx tsx scripts/validatePack.ts`) against both
shipped pack files (`public/packs/it.json` — 63 units/3680 cards,
`public/packs/es.json` — 12 units/593 cards) to confirm the production validator path is
unaffected — both still pass.

Debt entries logged: 0
Carry-forward tasks generated: 0
