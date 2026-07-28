CLOSED: #488 #491
NOT_CLOSED: none

## #488 — entitlementCrossTabSync's Task #482 fix didn't cover the real migrate()-throws failure path

Task #482 proved (with a live regression test against the real zustand dependency) that
`persist.rehydrate()` swallows a `storage.getItem()` throw rather than propagating it as a
rejected promise — because zustand's `hydrate()` terminal `.catch` calls
`postRehydrationCallback?.(void 0, e)`, a no-op when no `onRehydrateStorage` is registered
(true for all three real stores in this app). But that test used a synthetic probe store
with no `migrate` option configured, leaving the other real failure source into the same
swallowed `.catch` — a `migrate()` throw — untested. This was not hypothetical:
`store/migrations.ts`'s `migrateSrsStore`/`migrateEntitlementStore`/`migrateSettingsStore`
all throw `Missing ... migration to version X` by design (CLAUDE.md §4: "Throwing on a
missing migration step is intentional — silent fallbacks would corrupt user data"), and all
three real stores register a `migrate` function per that convention.

**Verified against the real zustand source** (`node_modules/zustand/esm/middleware.mjs`
lines 390–438): `options.migrate(...)` is invoked synchronously inside a `.then()` callback
of the `getItem` promise chain. A synchronous throw there propagates as a rejection through
the chain and lands in the same terminal `.catch` as the `getItem`-throw case — so it is
swallowed identically, never surfacing as a rejected `persist.rehydrate()` promise.

**New test** (`tests/entitlementCrossTabSync.test.ts`, "Task #488" describe block): builds a
probe store at `version: 2` with a stored blob at `version: 1` and a `migrate` function that
throws the exact `Missing ... migration to version X` shape used by the real stores, against
the real (non-mocked) `zustand`/`persist`/`createJSONStorage`. Asserts
`useProbeStore.persist.rehydrate()` resolves (not rejects) — confirmed: it resolves, proving
the migrate-throw case is swallowed identically to the getItem-throw case. Ran this test in
isolation first (`-t "Task #488"`) before running the full file, to confirm it genuinely
exercises the real dependency rather than depending on the other tests' setup.

**Decision (acceptance criterion 2):** the acceptance criteria offered two options — surface
the failure some other way (e.g. `store/migrations.ts`'s `migrate*Store` functions catching
and logging internally before rethrowing), or document this as an accepted trade-off with
the same rigor as the `getItem` case. `store/migrations.ts` is not in this stream's "Files
You Own" list (owned by another window) — editing it is out of scope for W24B. Chose the
documentation path: updated the module's doc comment in
`store/entitlementCrossTabSync.ts` to (a) explicitly state both failure sources are now
proven-swallowed via live regression tests, (b) name this as an accepted trade-off with the
same reasoning shape as the pre-existing `getItem` trade-off (client-only honour-system
entitlement model, decision 2026-06-24; the failure requires either a corrupted stored
version or another tab writing a newer app version, both rare), and (c) point at the root
fix's actual scope (`store/migrations.ts`) so a future window with that ownership has a
concrete starting point instead of rediscovering this from scratch. Logged the gap as
tracked debt in `.autocode/debt.md` (2026-07-28, Task #488, severity 5) rather than leaving
it only as an inline comment — closes the Rule 23c "shipped without being filed as tracked
debt" half of the finding, not just the Rule 8 diagnosability half.

**Acceptance criterion 3** (scope the "confirmed with a live regression test" claim to what
is actually tested): the doc comment previously made this claim referring only to the
`getItem` case implicitly (Task #482's own test). Rewrote it to name both tested failure
sources explicitly by task number, so the claim is now accurate rather than overclaiming
blanket coverage of "any real rejection path."

**For #489/#490 (deferred, not mine this wave):** the doc comment now states plainly which
two failure sources are tested and swallowed, and where the root-fix scope boundary sits
(`store/migrations.ts`, a different module) — #489's header/doc-comment reconciliation and
#490's overclaim-narrowing should both be straightforward reads of the updated comment
rather than requiring new investigation.

## #491 — triggerRehydrate's `instanceof Promise` check misclassified non-native thenables

`if (result instanceof Promise)` at the async/sync branch point treated any thenable that
isn't literally an instance of the global `Promise` constructor (a custom Promise-like
object, or a Promise from a different realm/polyfill) as synchronous — calling `done()`
immediately and resetting `rehydrateInFlight = false` while real async work was still
pending, silently breaking the module's dedup/queue guarantee for that call. This directly
contradicted the module's own doc comment, which describes `rehydrate` (typed `() =>
unknown`) as "not tied to Zustand specifically" and intended for reuse with "a non-Zustand
or differently-configured rehydrate function." Not exercised by any current caller — zustand
returns a native Promise — so this was a latent gap, not an active production bug, per the
task's own framing.

**Fix:** added a structural (duck-typed) `isThenable(value): value is PromiseLike<unknown>`
helper — checks for a non-null object/function with a callable `.then` — and replaced the
`instanceof Promise` check with it. This is the "broaden the check" branch of the acceptance
criteria (chosen over narrowing the doc comment's generality claim), since the doc comment's
stated generality is a deliberate design intent for this reusable primitive, not incidental
wording to walk back.

**New test** (`tests/entitlementCrossTabSync.test.ts`, "Task #491" describe block): a
`rehydrate` double returns a custom object exposing only `.then` — explicitly asserted `not
instanceof Promise` in the test itself, so the test can't silently degrade into exercising a
real Promise. Drives the same dedup → in-flight → requeue → settle sequence as the existing
Task #304/#347 tests, proving the guarantee holds end-to-end for a non-native thenable.

**Deletion Test performed exactly as the acceptance criteria's spirit implies** (proving the
new test actually exercises the fixed line): temporarily reverted `isThenable(result)` back
to `result instanceof Promise`, ran the new test in isolation — failed exactly as predicted
(`expected "vi.fn()" to be called 1 times, but got 2 times` — the custom thenable was
misclassified as synchronous, so the second storage event started a new rehydrate
immediately instead of queuing). Restored the file immediately after and confirmed byte-
identical via `diff` against a backup taken before the revert.

## Verification Gate

- `npx tsc --noEmit` — clean, zero errors.
- `npm run lint` — 0 errors, 3 pre-existing warnings, all in files outside this stream's
  ownership (`app/page.tsx`, `hooks/useExportImport.ts`, `hooks/useExportImport.test.ts`).
- `npm test` — 66 test files, 1446 tests, all passing. No unrelated failures this wave.
- Existence-check grep gate — clean for `tests/entitlementCrossTabSync.test.ts`.

Debt entries logged: 1 (`.autocode/debt.md`, 2026-07-28, Task #488, severity 5 — root-fix
scope is `store/migrations.ts`, a different module's ownership).
Carry-forward tasks generated: 0 (documentation-path resolution chosen per acceptance
criteria; #489/#490 were already planned as separate deferred tasks, not newly created here).
