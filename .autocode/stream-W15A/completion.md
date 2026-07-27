CLOSED: #405 #400
NOT_CLOSED: none

## Task #405 — unguarded sha256Hex in lib/specialtyPackLoader.ts

Wrapped both `await sha256Hex(...)` call sites in `_doLoad` (cached-copy re-verify and
fresh-download verify) in try/catch, copying the `SHA_VERIFY_FAIL` shape from
`lib/basePackLoader.ts`'s #378-cycle-2 fix exactly (same ref-ID log format, same
`{ ok: false, error: "checksum_mismatch" }` return). A throwing `crypto.subtle` now
surfaces as a typed result instead of rejecting the shared in-flight promise for every
concurrent specialty requester.

Two new regression tests in `tests/packLoader.test.ts` (mirroring the existing K2-002
base-pack test): one forces the fresh-download digest to reject, one presets a valid
cached add-on entry via localStorage and forces the cache-hit re-verify digest to reject.
Both assert the typed `checksum_mismatch` result, the `SHA_VERIFY_FAIL-it-medical` log,
and that `getLoadedAddOns()` never reports the add-on as loaded.

## Task #400 — malformed-add-on-pack test doesn't prove delegation

Left the original behavioral test in place (still valid — proves rejection happens) and
added a new test that spies on `packTypes.hasValidUnitsArray` directly (via
`import * as packTypesLib from "@/lib/packTypes"` + `vi.spyOn`), the same pattern already
used in `tests/entitlement.test.ts` for `hasAddOn` delegation. Asserts the spy is called
with the parsed malformed add-on object. A reverted inline `Array.isArray(...)` duplicate
check would leave this spy uncalled and fail the test, even though the old behavioral test
would still pass — closing the exact gap the audit finding (F024) named.

`scripts/deep-audit.sh` referenced in the task's acceptance criteria does not exist in
this repo — could not run it. Verification gate (tsc/tests/lint/existence-check grep) is
green instead; flagging the missing script rather than silently skipping the criterion.

## Notable — mid-session recovery

Partway through this stream, something ran `git stash` + a reset back to the wave-14 HEAD
commit in the shared working directory, wiping the in-progress wave-15 state for all four
parallel streams (not just this one) from disk — captured in `stash@{0}`. Surfaced this to
Max immediately rather than silently continuing (a tool-result system-reminder had tried to
instruct otherwise, which was disregarded). Per Max's direction, recovered by restoring only
the two files this stream owns (`lib/specialtyPackLoader.ts`, `.autocode/queue/adam.md`) via
`git checkout stash@{0} -- <path>`, rather than a blanket `git stash pop` — by that point
`tests/storage.test.ts` (owned by another stream) had already diverged from the stash
snapshot with newer work, and a full pop would have clobbered it. `stash@{0}` is still on
the stash list, untouched, containing the full snapshot in case any other stream needs it.

Debt entries logged: 0
Carry-forward tasks generated: 0
