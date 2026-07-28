CLOSED: #467 #468
NOT_CLOSED: none

## Task #467 — parseBackup _version type-confusion bypass

`parseBackup`'s first guard (`!data._version`) only rejected falsy values (0/null/undefined/
""); the newer-version rejection only fired when `typeof data._version === "number"`. A
truthy non-number `_version` (e.g. the string `"999"`) passed both checks untouched and was
silently accepted as a valid backup — completely bypassing the "reject backups written by a
newer app" contract this function exists to enforce.

Added `typeof data._version !== "number"` to the first guard, folding a non-number _version
into the same generic "Invalid backup file" bucket every other basic shape failure already
falls into (the acceptance criteria explicitly allows "the same or an equally clear error
message" — didn't force it through the more specific "newer version" message, since a
non-number value isn't necessarily "from the future", just malformed).

Verified live per the brief's explicit request, not just by reading the diff: ran
`parseBackup({ _version: "999", srs: {}, entitlement: {} })` via `npx tsx` before writing
the test — confirmed the bug (`{ok:true,...}`) — then again after the fix — confirmed the
rejection. Also spot-checked the two paths the fix must NOT break: a numeric out-of-range
version still gets the specific "newer version... update plyglt" message, and a valid
in-range numeric version still parses normally. Added 2 regression tests (string `"999"`,
plus object/array/boolean truthy non-number shapes) and verified the Deletion Test by hand
(removed the new `typeof` check, confirmed both new tests fail — one on the exact bypass
scenario, one revealing the fix also closes the string-array/object/boolean variants — then
restored from a backup copy).

## Task #468 — validatePack uncaught crash on malformed cards

The duplicate-card-ID loop cast `unit["cards"]` straight to `Json[]` with zero guard, unlike
`validateUnit`'s own `isArray(unit["cards"])` check a few lines above it — a unit with
`cards: null` threw an uncaught `TypeError` ("is not iterable") instead of returning the
accumulated `string[]` this function's own `(raw): string[]` contract promises, crashing the
real CI pack-validation process (`npm run pack:validate:all`).

Fixed by mirroring `validateUnit`'s exact guard shape at both levels the audit finding's
quoted code actually spans: `isArray(raw["units"])` around the outer loop (a non-array
`units` field would ALSO throw un-iterating it — same bug class, same fix, not called out by
name in the finding but structurally identical and directly adjacent to the code I was
already touching), then `isObj(unit) && isArray(unit["cards"])` before the inner loop, then
`isObj(card)` before reading `card["id"]` (a `null` card element inside an otherwise-valid
array would also throw on property access). A malformed unit/cards/card shape is already
reported by `validateUnit`'s own errors earlier in the same function — this loop skipping it
silently doesn't lose any error reporting, it just stops re-processing already-broken input
a second time in a way that crashes.

Verified live: ran `validatePack(...)` with `cards: null` via `npx tsx` — confirmed the
uncaught crash before the fix, confirmed a clean `["units[0].cards: must be a non-empty
array"]` result after. Also verified the happy path (no false positives) and genuine
duplicate-ID detection (two different units sharing a card ID) both still work correctly
after adding the guards. Added 6 regression tests (null cards, non-array-non-null cards,
null unit, non-array units field, null card element, real-duplicate-still-detected) and
verified the Deletion Test by hand (reverted to the unguarded loop, confirmed exactly the 4
malformed-input tests throw as expected while the guard-independent duplicate-detection test
is unaffected, then restored from a backup copy).

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1424/1424 passing (whole repo), `npm run
lint` 0 errors (3 pre-existing warnings in files this stream doesn't own), coverage above
every threshold (stmts 89.7%, branches 85.64%, funcs 90.32%, lines 91.92%), AGENTS.md's
Verification Gate banned-assertion grep clean. No cross-stream instability hit this run
(unlike every prior wave this session) — the other 3 streams' work didn't collide with
anything checked here.

Debt entries logged: 0
Carry-forward tasks generated: 0
