CLOSED: #417 #418 #421
NOT_CLOSED: none

## #417 — hasValidUnitsArray had no test constructing a malformed card

Added a dedicated describe block, "hasValidUnitsArray — per-card element-shape checks
(Task #417)", to `tests/packTypes.test.ts`: one malformed card per validated field (id,
type, prompt, accepted, tags, tier), plus null-card, primitive-card, and
one-bad-card-among-several cases. Each test constructs an otherwise fully-valid unit so
only the card-validation callback can be the cause of the `false` result. Verified the
Deletion Test criterion directly: temporarily replaced the callback with `return true;`,
confirmed exactly these 9 new tests fail (and only these), then restored the original file.

## #418 — hasValidUnitsArray never cross-checked unitCount/cardCount against real lengths

`hasValidUnitsArray` now rejects a pack whose `unitCount` doesn't equal `units.length`, or
whose `cardCount` doesn't equal the true sum of every unit's `cards.length`. Updated the
function's doc comment (previously an explicit "Does NOT validate: unitCount/cardCount
cross-totals" line — now describes what it validates).

`tests/packTypes.test.ts`'s `fakePack()` helper now derives `unitCount`/`cardCount`
defaults from the actual `units` array passed in (safely tolerating malformed/non-array
`units` since several existing tests intentionally pass those) instead of hardcoding 0/0 —
this is what kept all 29 pre-existing tests passing unchanged under the new stricter
check; only the new, explicit mismatch tests override the counts on purpose. Added a
dedicated "unitCount/cardCount cross-check (Task #418)" describe block: exact-match
passes; too-high and too-low unitCount/cardCount each rejects; a correct per-unit cards
array but wrong SUM across multiple units rejects; a correct sum across multiple units
passes.

### Cross-stream impact — flagging clearly, did not fix myself

This change has real, expected blast radius **outside my owned files**, in two other
streams' actively in-progress work this wave:

- **`tests/packLoader.test.ts`** (owned by Adam, W17A, off-limits to me) — its `fakePack()`
  /`fakeAddOnPack()`/`fakeAddOnBusinessPack()` fixtures declare `unitCount`/`cardCount` as
  arbitrary placeholder numbers (e.g. `unitCount: 1, cardCount: 1, units: []`) that were
  never meant to reflect the (empty) `units` array — harmless before this task, since
  nothing cross-checked it. Under the new, correct, required validator, `loadPack` now
  rejects these fixtures (parse_error), which cascades into ~44 test failures unrelated
  to what those tests actually exercise (caching, eviction, sha256, merge arithmetic).
- **`tests/specialtyPackLoader.test.ts`** (owned by Charles, W17C, explicitly off-limits
  to me in this brief) — same root cause, ~6 test failures.

I confirmed this is the mechanism by isolating: `tests/packTypes.test.ts` and
`tests/srsStore.test.ts` (my owned scope) are 100% green in isolation, `npx tsc --noEmit`
is clean repo-wide, and `npm run lint` is 0 errors repo-wide. I did not edit either test
file — both are explicitly owned by other windows actively in-progress on
`lib/packLoader.ts` / `lib/specialtyPackLoader.ts` right now (the exact "shared working
tree" risk this multi-window setup already had one incident with — see cto.md's Wave 15
note). The mechanical fix on their side is small: make each fixture pack's declared
`unitCount`/`cardCount` match its actual `units` array (e.g. mirror the
`tests/packTypes.test.ts` auto-derivation approach I used, or simply set the placeholder
counts to 0 to match `units: []`) — but that edit belongs in their files, at a time that
doesn't collide with their own in-flight work.

**Also observed, not caused by me**: a full `npm test` run during this session showed
additional, fluctuating failures in `components/LanguageGrid.test.tsx`,
`tests/entitlement.test.ts`, and `tests/purchaseAddOnGuards.test.ts` — none of which I
touched this wave (`store/entitlementStore.ts`, `lib/featureFlags.ts` are off-limits to me
here). These are consistent with Adam's concurrent #414/#424 work
(`store/entitlementStore.ts`) landing mid-session. Noting this so the full-suite red isn't
misattributed entirely to #418 when the batch audit runs — by the time all four W17
streams have landed and reconciled, the fixture-count issue above should be the only
piece that needs an explicit follow-up if Adam/Charles haven't already absorbed it while
finishing their own tasks.

## #421 — srsStore.ts bypassed lib/constants.ts's sole-authorized-caller rule

`store/srsStore.ts`'s module-init `_activeLangPair` now calls `getLangPair()` from
`lib/constants.ts` instead of reimplementing its SSR guard + `"en-it"` fallback inline via
direct `window.localStorage.getItem(LANG_PAIR_KEY)`. This also means the call site now
inherits `getLangPair()`'s try/catch error handling (a storage read failure previously had
no guard here at all). `grep -rn "localStorage" store/srsStore.ts` returns zero hits,
satisfying the acceptance criterion exactly. `tests/srsStore.test.ts` (65 tests) passes
unchanged — nothing in that suite mocks the module-init path directly, so no test updates
were needed.

Debt entries logged: 0
Carry-forward tasks generated: 0 — the #418 fixture-consistency fix belongs to Adam
(tests/packLoader.test.ts) and Charles (tests/specialtyPackLoader.test.ts) directly, not
filed as a new task since it's a mechanical consequence of a batch that hasn't finished
landing yet, not a new independent finding.
