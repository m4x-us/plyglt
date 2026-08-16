CLOSED: #606
NOT_CLOSED: none

## Task #606 (severity 9, data-loss) — lib/storage.ts's failsafe + late-merge reconciliation

Read `lib/storage.ts` and `tests/storage.test.ts` in full before writing anything, per
the brief. Confirmed the root cause exactly as described: `useIsHydrated`'s
`HYDRATION_FAILSAFE_MS` (3000ms) failsafe can flip `hydrated` to `true` before real
Tauri file-store hydration finishes; a write-performing consumer gated on that lenient
signal (e.g. `hooks/useStudySession.ts`'s mount-fill effect calling `introduceCard()`)
can write a fresh record into a map-shaped field (`introductions`) against the
pre-hydration empty default; when real hydration finishes late, Zustand's shallow
top-level `setState` merge replaces the WHOLE `introductions` field with the real
persisted map from disk (which correctly doesn't know about the live write yet); and
the existing late-merge reconciliation, designed for scalar fields, "restored" the live
write by blanket-replacing the field with the single-record pre-hydration snapshot —
discarding every other real persisted entry the user has ever accumulated.

### Fix — both angles from the brief, both shipped

**1. Root-cause fix (primary): `useIsHydratedStrict` export.** Extracted the existing
`useSyncExternalStore` subscription (the part of `useIsHydrated` that reflects ONLY
real `persist.hasHydrated()`) into a shared internal `useRealHydrated` helper, and
added a new public export, `useIsHydratedStrict(store)`, that returns that value
directly — never the failsafe fallback. `useIsHydrated` itself is otherwise unchanged
(still returns `hydrated || failsafeExpired`; the failsafe still exists and is still
correct for READ-gating consumers). Documented explicitly in the new export's own
JSDoc: a consumer that WRITES new persisted state should gate on this, not the lenient
`useIsHydrated()`.

**I did not wire this into the actual write-gating call site**, since it lives in
`hooks/useStudySession.ts`, off-limits to me this wave (Adam's stream owns it,
explicitly noted as read-only reference). **I read the file anyway to confirm the
exact call site**, since the brief asked for that reasoning to be stated clearly
rather than guessed at:

- `hooks/useStudySession.ts:112` — `const hydrated = useIsHydrated(useSRSStore);`
- `hooks/useStudySession.ts:172` (inside the mount-fill effect) — `if (!hydrated) return;`
  — this is the exact write-gate that races ahead of real hydration.

This gate was itself added by a **prior** wave (Task #587, Wave 5) specifically to
close a version of this same race — but it gates on the lenient `useIsHydrated`, so it
inherits the exact failsafe-vs-real-hydration gap this task's root cause describes.
**Carry-forward for the next stream/wave touching `hooks/useStudySession.ts`:** change
line 112 to `const hydrated = useIsHydratedStrict(useSRSStore);` (import from
`@/lib/storage`, already imported there for the plain `useIsHydrated`). This one-line
swap, now that the export exists, closes the write-race at its root — the mount-fill
effect would simply wait for real hydration instead of proceeding on the failsafe. I
did not make this change myself; it requires editing an off-limits file.

**2. Defense in depth: map-aware late-merge reconciliation.** For any top-level field
whose `snapshotAtExpiry`/`preMerge`/`postMerge` values are all plain objects (added an
`isPlainObject` guard — excludes arrays and null, scoped to one level of nesting per
the brief), the reconciliation no longer does `clobbered[key] = preMerge[key]` (whole-
field replace). Instead it computes a sub-key diff between `preMerge[key]` and
`snapshotAtExpiry[key]` (i.e. exactly what the live write added or changed during the
failsafe window) and overlays only those sub-keys onto `postMerge[key]` (the real,
fully-hydrated value) — `clobbered[key] = {...postMerge[key], ...subDiff}`. Scalar
fields are untouched — they still take the original whole-field-replace path,
verified by a dedicated regression test (below) proving the two paths coexist
correctly on a mixed-shape store. Deliberately does not handle sub-key *deletions*
(a sub-key present in the snapshot but removed by the live write) — out of scope per
the brief ("keep this scoped") and not the shape of the reported bug (introduceCard
only ever adds/updates a record, never removes one).

### Tests

Added 3 new tests in `tests/storage.test.ts`, in a new describe block
(`"late real-hydration merge reconciliation — map-shaped fields (Task #606,
severity-9 data-loss regression)"`):

1. **The exact brief-specified scenario**, run with real fake timers letting the real
   failsafe elapse (not mocking `persist.hasHydrated()` directly): starts with an empty
   `introductions` map, lets the failsafe fire, writes one record during the window,
   then simulates real late hydration completing with a *larger* real persisted map
   (2 different entries) — asserts the final state contains BOTH the pre-existing real
   entries AND the write made during the window.
2. A regression guard proving the map-field diff branch doesn't regress the pre-existing
   scalar-field path (mixed-shape store, one scalar + one map field, only the scalar
   field touched).
3. Confirms a map-shaped field the user never wrote to during the window is left
   completely untouched (no spurious reconciliation).

Also relocated the existing `makeFullStore` test-store factory from being local to the
`"late real-hydration merge reconciliation (#435)"` describe block to module scope, so
both that block and the new one can share it — zero behavior change, verified by
running the full file before and after: same 22 pre-existing tests, same assertions,
all still passing.

**Live Deletion Test run** (not traced by hand): reverted the map-aware diff logic back
to the original `clobbered[key] = preMerge[key]` blanket replace, ran the new test
suite — the primary scenario test failed with exactly the described symptom
(`introductions` equal to `{cardA: ...}` only, `cardX`/`cardY` — the real persisted
history — silently gone). Restored the fix, re-ran, all 25 tests (22 original + 3 new)
passed again.

### Verification gate — all green

- `npx tsc --noEmit` — clean
- `npx eslint lib/storage.ts tests/storage.test.ts` — 0 errors
- `npx vitest run tests/storage.test.ts` — 25/25 passed
- Full `npm test` — **1993/1993 passed, 101/101 files.** (Confirms no other stream's
  concurrent work was disrupted, and that no other test anywhere in the suite depended
  on the pre-fix reconciliation behavior.)

`git status` showed several other files modified by concurrent streams (as expected
this wave) — none of them mine, none touched, no `git stash` used.

Debt entries logged: 0
Carry-forward tasks generated: 1 (documented above, not filed as a numbered task per
the brief's own instructions — this is a coordination note for the stream/wave that
next touches `hooks/useStudySession.ts`, not new scope of my own)

No files outside `lib/storage.ts` and `tests/storage.test.ts` were touched.

Barry is done.

— Barry | W6B | #606
