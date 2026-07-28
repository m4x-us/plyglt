CLOSED: #445 #447 #443
NOT_CLOSED: none

## Task #445 — fetch timeout / AbortController

Added an `AbortController` + `setTimeout(20_000ms)` at all 3 fetch call sites
(`lib/basePackLoader.ts`'s `loadBasePackFromStorageOrNetwork`, `lib/specialtyPackLoader.ts`'s
`_doLoad`, `lib/packLoader.ts`'s `fetchManifest`), wired via `signal:` and released in a
`finally` block. Deliberately did NOT add new error-handling logic: a timeout abort surfaces
as a rejected fetch, which flows straight into each site's EXISTING catch block (already
returns a typed `{ ok: false, ... }` result or falls back to stale cache) — the "never
rejects" invariant every one of these functions already had is preserved automatically,
since aborting just makes an already-handled failure path fire sooner instead of never.

Three regression tests (one per call site, in `tests/packLoader.test.ts` ×2 and
`tests/specialtyPackLoader.test.ts` ×1) use `vi.useFakeTimers()` + a fetch stub that listens
for the abort signal and rejects with a `DOMException("AbortError")`, then
`vi.advanceTimersByTimeAsync(20_000)` to fire the timeout deterministically without a real
20-second wait. Each proves both the typed failure result AND that a subsequent call for the
same language/manifest succeeds normally (the in-flight cache entry was released, not left
permanently pending).

## Task #447 — specialtyPackLoader.ts 400-line split

Extracted the parse-verify-merge-persist "commit" step (formerly the private `_mergeFromJson`)
into a new `lib/specialtyPackMerge.ts`, following the `store/entitlementStore.ts` →
`store/entitlementAddOns.ts` (Task #412) pattern exactly: the extracted
`mergeSpecialtyPackFromJson` receives the caller's `GenerationGuard` instance as a parameter
rather than importing or owning one, so the new module has no dependency on
`specialtyPackLoader.ts`'s other module-scope state (the `inFlight` map, etc.) — mirroring
`entitlementAddOns.ts`'s narrow-parameter-types approach to avoid a circular/type dependency
back on its only caller. `specialtyPackLoader.ts` dropped from 442 to 351 lines; the new file
is 131 lines. `_doLoad` keeps ownership of fetch/cache-hit orchestration and integrity
verification (deciding WHERE bytes come from); the new module owns only the commit step once
verified bytes are in hand — a clean split mirroring `basePackLoader.ts` vs the code that
calls into it. All 114 existing tests across both test files pass unchanged (no test file
changes were needed for this task — the public API surface `loadSpecialtyPack` didn't
change). Updated `CLAUDE.md`'s module list with the new file's role and corrected the
`specialtyPackLoader.ts` entry and the `packTypes.ts` "imported by" list to include it.

## Task #443 — hasValidUnitsArray prerequisites check

Added a check to `hasValidUnitsArray`'s per-card validation: `card.prerequisites`, when
present, must be an array of strings (mirroring the existing `unit.prerequisiteUnits`/
`card.tags` `Array.isArray` checks). Kept it OPTIONAL (unlike `prerequisiteUnits`) since
`Card.prerequisites` is declared `prerequisites?: string[]` in `content/types.ts` — absence
is valid, only a present-but-malformed value is rejected. Traced the exact live crash this
closes: `lib/srs.ts:206`'s `card.prerequisites?.length` guard is fooled by a non-empty
STRING value (strings have a truthy `.length` too), so a pack with e.g.
`prerequisites: "c0"` would pass that guard and reach line 207's
`card.prerequisites.every(...)`, which strings don't have — a `TypeError` in the live FSRS
new-card queue (`store/srsStore.ts`'s `getNewCards`) and the introduction engine, reachable
via the shipped Italian base pack, not gated behind specialty packs being unready.

5 new tests in `tests/packTypes.test.ts`, following the existing Task #417 per-card
element-shape-check pattern exactly: absent (valid), array-of-strings (valid), empty array
(valid), non-array-but-truthy string (invalid — the exact crash shape), and array containing
a non-string element (invalid). Verified the Deletion Test by hand: temporarily removed the
new check, confirmed the 2 "invalid" tests fail (the 3 "valid" tests correctly still pass,
since they describe currently-legal input either way), then restored from a backup copy and
re-verified.

Did NOT touch `scripts/validatePack.ts`'s `validateUnit`, even though `hasValidUnitsArray`'s
own doc comment says "this is the runtime mirror of scripts/validatePack.ts's validateUnit —
keep the two in sync" — that file is outside this task's explicit 1-file scope
(`lib/packTypes.ts`) and wasn't listed in this stream's file ownership. Flagging below as
debt rather than silently expanding scope.

## Verification

Full gate green across the whole repo: `tsc --noEmit` clean, `npm test` 1365/1365 passing,
`npm run lint` 0 errors (4 pre-existing warnings in files this stream doesn't own), coverage
above every threshold (stmts 90.4%, branches 85.99%, funcs 90.07%, lines 92.84%),
existence-check grep clean.

Hit the same class of transient cross-stream instability as prior waves twice during this
session — `lib/storage.ts` (a file with no dependency on anything I touched) failed
typecheck once, and `lib/constants.ts`/`tests/srsStore.test.ts` (both off-limits to this
stream) failed with a `ReferenceError` once — both confirmed via `git stash` + isolated
re-run to be caused by another window's in-flight, uncommitted edits mid-save, not by
anything in this stream's diff. Both had resolved by the final gate run once the owning
window finished its edit.

Debt entries logged: 1 (`scripts/validatePack.ts`'s `validateUnit` should get the same
`card.prerequisites` check `hasValidUnitsArray` now has, per that function's own
keep-in-sync doc comment — out of this task's 1-file scope)
Carry-forward tasks generated: 0
