CLOSED: #613
NOT_CLOSED: none

## Task #613 — store/srsStore.ts over the 400-line Rule 1 services cap

Confirmed the finding: `store/srsStore.ts` was 405 lines. Independently confirmed the
brief's own analysis before touching anything — the resumable-session trio
(`getResumableSession`/`peekResumableSession`/`clearExpiredResumableSession`) has no
direct importer anywhere outside `srsStore.ts`; both real call sites
(`hooks/useStudySession.ts`, `app/study/page.tsx`) receive them as injected function
parameters from `useSRSStore()`'s destructured actions, confirmed via
`grep -rn "getResumableSession\|peekResumableSession\|clearExpiredResumableSession"`
across the repo.

### Approach taken

Went with the brief's option (b) — standalone factory taking `(get, set)` — because
it exactly matches an existing, proven pattern already in this codebase:
`store/entitlementAddOns.ts`'s `createPurchaseAddOn(set, get)` (Task #412's extraction
from `entitlementStore.ts`). Reused that same shape rather than inventing a new one:

- New file `store/resumableSession.ts` exports `SESSION_EXPIRY_MS` (was a module-private
  `const` in `srsStore.ts`, now exported since the constant's real implementation lives
  here) and `createResumableSessionActions<TSession>(get, set)`, which returns the
  three actions. Narrow `ResumableSessionGet<TSession>`/`ResumableSessionSetArg<TSession>`
  interfaces (just `{ activeSession: TSession | null }`) mean this module has zero type
  or runtime dependency on `srsStore.ts` — `TSession` is a generic parameter, not an
  import of `ActiveSession`, avoiding a circular import back to the file it was
  extracted from.
- `srsStore.ts` now imports `createResumableSessionActions` and wires it in as
  `...createResumableSessionActions<ActiveSession>(get, set),` inside the store
  creator, replacing the three inline action bodies. The `SRSState` interface still
  declares all three action signatures (required — Zustand's `create<SRSState>()`
  needs the full shape), but the ~21 lines of render-phase-safety rationale comments
  were trimmed to a 4-line pointer at the interface, with the full explanation moved
  to sit next to the real implementation in the new file instead of describing an
  interface stub.
- `ActiveSession` itself (the interface) and every other action/export in
  `srsStore.ts` stayed exactly where they were — this was scoped to only the three
  actions plus their supporting constant, per the brief.

**Public shape is unchanged**: `useSRSStore()` still exposes
`getResumableSession`/`peekResumableSession`/`clearExpiredResumableSession` as before
— no caller anywhere needed to change, confirmed by the full test suite passing
unmodified.

### Result

`store/srsStore.ts`: 405 → **368 lines** (well under the 400-line cap, real margin
for future growth rather than landing exactly at the boundary). New
`store/resumableSession.ts`: 90 lines.

### Tests

This is a pure move/refactor, not a logic restructure — per the brief's own guidance,
no new test coverage was required, and I did not add any. I verified
`tests/srsStore.test.ts`'s `peekResumableSession — pure read, no mutation (Task #597)`
and `clearExpiredResumableSession — explicit purge action (Task #597)` describe blocks
(lines ~954-1017) needed zero changes — neither imports `SESSION_EXPIRY_MS` from
`srsStore.ts` (both that file and `tests/session.test.ts` already define their own
local copy of the 24h-ms literal, confirmed via a repo-wide grep — `SESSION_EXPIRY_MS`
was never exported from `srsStore.ts` in the first place, so nothing external could
have imported it). Did not delete or weaken any existing assertion.

**No live Deletion Test was run** — there's no new assertion to delete-and-confirm-fails
here (matching the brief's own carve-out: "a pure move/refactor doesn't need new
coverage"). Verified behavioral equivalence instead via before/after test-suite parity:
`tests/srsStore.test.ts` + `tests/session.test.ts` — 85/85 passed, identical count and
content to the pre-extraction run.

### Verification gate — all green

- `npx tsc --noEmit` — clean (one transient error in the off-limits
  `tests/seam_studyLoop.test.ts`, confirmed via `git status` to be another stream's
  in-progress edit, resolved on its own by the time of the final full-suite run below —
  not something I touched or needed to fix)
- `npx eslint store/srsStore.ts store/resumableSession.ts tests/srsStore.test.ts` — 0 errors
- `npx vitest run tests/srsStore.test.ts tests/session.test.ts` — 85/85 passed
- Full `npm test` — **2000/2000 passed, 101/101 files**

`git status` showed only my two files (`store/srsStore.ts` modified,
`store/resumableSession.ts` new) plus `tests/seam_studyLoop.test.ts` (another stream's
concurrent work, untouched by me) — nothing unrecognized, no `git stash` used.

Debt entries logged: 0
Carry-forward tasks generated: 0

No files outside `store/srsStore.ts` (owned) and the newly created
`store/resumableSession.ts` (a natural consequence of the extraction the task itself
asked for, not scope creep) were touched. `tests/srsStore.test.ts` was read but not
edited — no change was needed.

Barry is done.

— Barry | W7B | #613
