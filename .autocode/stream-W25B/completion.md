CLOSED: #489 #490
NOT_CLOSED: none

Read the current state of `store/entitlementCrossTabSync.ts` first, per the brief's own
instruction, since Wave 24's Task #488 already rewrote much of this doc comment. Confirmed
both findings' raw material was still present in the current text (not already resolved by
#488) before doing new work.

## #489 — header's single-caller claim contradicted the doc comment's multi-caller justification

The module header states `USED BY: store/entitlementStore.ts ONLY` and warns that a second
`createCrossTabSync` call for the same store key duplicates listeners — a clear single-caller
declaration. The `createCrossTabSync` doc comment (surviving from Task #482, untouched by
#488's rewrite) justified keeping the async-reject branch by citing "reuse of this module
with a non-Zustand or differently-configured rehydrate function" — a multi-caller framing the
header explicitly disclaims two paragraphs above.

**Also found:** Task #491's `isThenable` comment (added Wave 24) quoted this exact same
generality claim ("intended for reuse with a non-Zustand or differently-configured rehydrate
function") as part of its own justification. Fixing only the main docblock would have left
that comment citing a claim I was about to narrow away — updated both for consistency.

**Fix (narrowed the doc comment's justification, per the brief's instruction not to require a
header change):** rewrote the "branch is kept anyway" paragraph so both retained reasons
apply entirely within the module's one real caller's own future — (1) entitlementStore.ts
could later register an `onRehydrateStorage` callback that itself throws inside zustand's own
final `.catch` handler (a genuine rejection path, since nothing catches a throw from inside
that handler), and (2) a future zustand version could change `hydrate()`'s internal error
handling. Neither requires a second caller. Explicitly noted that the `rehydrate` parameter's
`() => unknown` typing exists because Task #463 extracted this logic to be decoupled from
`EntitlementState`'s fields — not to advertise an active multi-caller plan — and that the
header's `USED BY` line is the line to update first if a second caller is ever actually
added. Rewrote `isThenable`'s comment (Task #491) the same way: its correctness requirement
now derives from the parameter's typed contract and the single real caller's future, not from
a reuse-by-other-callers claim.

**No behavior change** — matches the acceptance criteria ("no behavior change required unless
Task #488 also changes something here"; it didn't touch this section). Confirmed via
`tsc --noEmit` (clean) and the full `tests/entitlementCrossTabSync.test.ts` suite (14/14
passing, unchanged from before this wave).

## #490 — "confirmed with a live regression test" claim overstated coverage

Re-read the current comment before deciding scope, per the brief's explicit instruction: Wave
24's Task #488 rewrite already names both tested failure sources (`storage.getItem()`
throwing, `migrate()` throwing) by task number rather than making a blanket "any rejection
path" claim — so the core overclaim the finding originally described was already closed.
Confirmed this explicitly rather than rewriting an already-accurate comment.

**Residual gap identified per the acceptance criteria's own follow-up prompt:** re-verified
against `node_modules/zustand/esm/middleware.mjs`'s `hydrate()` (lines 390–438) that the same
promise chain also calls `options.merge(...)` and, when migrated, a re-persisting `setItem()`
— both upstream of the identical terminal `.catch`, so a throw from either would be swallowed
the same way, and neither is exercised by Task #482's or #488's tests. Checked whether any
real store passes a custom `merge` option (`grep -n "merge:" store/*.ts` — none), so the
`merge()` path uses zustand's default shallow-merge, which doesn't throw for well-typed
state — low risk. The re-persisting `setItem()` path (e.g. localStorage quota exceeded) is a
more realistic, genuinely untested gap.

**Decision:** did not add a third live-regression test this task — P3/severity 4, and the
task's own framing scopes this as "reconcile the existing claim's precision," not "expand
test coverage" (a `setItem()`-throws regression test would need to drive zustand into the
migrated-and-repersisting branch specifically, a heavier setup than this task's stated
scope). Instead: added an explicit "Residual gap" paragraph to the doc comment naming both
untested paths and their relative risk, so the "confirmed" claim stays scoped to exactly what
it tests rather than implying blanket coverage of the whole swallowed-`.catch` surface. Logged
the `setItem()` re-persist gap as tracked debt (severity 4) in `.autocode/debt.md`, matching
Task #488's precedent of not leaving a known gap as only an inline comment.

## Verification Gate

- `npx tsc --noEmit` — clean, zero errors.
- `npm run lint` — 0 errors, 3 pre-existing warnings, all in files outside this stream's
  ownership (`app/page.tsx`, `hooks/useExportImport.ts`, `hooks/useExportImport.test.ts`).
- `npm test` — 66 test files, 1446 tests, all passing. No unrelated failures.
- Existence-check grep gate — clean for `store/entitlementCrossTabSync.ts`.

Both tasks were documentation-only (no production code paths changed) per their own
acceptance criteria, so no Deletion Test was applicable — verified via unchanged test-pass
counts before and after (14/14 in the owned test file, 1446/1446 overall).

Debt entries logged: 1 (`.autocode/debt.md`, 2026-07-28, Task #490, severity 4 — `merge()`/
`setItem()` re-persist paths into the same swallowed catch, untested).
Carry-forward tasks generated: 0.
