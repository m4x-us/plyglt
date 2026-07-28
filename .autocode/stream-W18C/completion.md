CLOSED: #422 #437 #439
NOT_CLOSED: none

## Task #422 — purchasedAddOns dead-wiring documentation (F023)

Chose to document rather than remove: `lib/importBackup.ts`'s `purchasedAddOns`
validation is exercised by 4 existing tests and keeps `BackupEntitlement` a fully
self-consistent, validated shape for `exportBackup`'s round trip — removing it would
strip validation from a field the type still declares, and would touch a structure
that Task #440's `RestorableEntitlement`/`excludePurchasedAddOns` design (in the sibling
file, `hooks/useExportImport.ts`) was specifically built to reference and exclude.
Added a comment at the validation site in `lib/importBackup.ts` (right after the
existing #384/#407 registration-vs-readiness explanation) stating explicitly that no
production caller consumes this field, cross-referencing `excludePurchasedAddOns` and
Task #440's rationale (add-on purchases require a server-verified receipt via
`purchaseAddOn()` and can never be restored from an unsigned backup). No behavior
changed — comment only.

## Task #437 — concurrent-import guard (F064)

Added `importInFlightRef` (a `useRef<boolean>`, not state — must be readable/writable
synchronously before the next render) to `hooks/useExportImport.ts`. `readFile()` now
checks the flag first: if an import is already in flight, it immediately sets
`dataStatus` to a clear error ("Import already in progress. Wait for it to finish, then
try again.") and resolves without touching `FileReader` or either store. Otherwise it
sets the flag and proceeds as before; every exit path inside the `FileReader` handlers
(`onerror`, both early-return branches in `onload`, the success path, and the `catch`
block) now goes through a shared `finish()` closure that clears the flag before
resolving, so the lock always releases regardless of which path completes.

Chose reject-immediately over queuing: deterministic, no extra state machine, and the
user's fix is simply re-selecting the file once the first import finishes — consistent
with the hook's existing style (no queues elsewhere in this file).

3 new tests in `hooks/useExportImport.test.ts`:
1. A second `readFile` call issued synchronously while the first is still in flight is
   rejected with the exact message, and never reaches `parseBackup`; after the first
   completes, the final `dataStatus` correctly reflects the completed (first) import, not
   the transient rejection — proving the outcome is deterministic and correctly
   attributed, per the acceptance criteria's own wording.
2. The in-flight lock releases after completion — a subsequent (non-concurrent) import
   proceeds normally and `parseBackup` is called again.
Also added a `parseBackup` mock-clear to this describe block's `afterEach` — its call
count wasn't being reset between tests before (a pre-existing gap that only became
visible once a test needed an exact call-count assertion).

## Task #439 — PackMemCache.write() async I/O contract-honesty fix (F068)

`PackMemCacheImpl.write()` already had an implementation-level comment explaining its
fire-and-forget `_clearSpecialtyStorageKeys` call, but that comment lives in
`lib/packCache.ts` — invisible to a caller (`lib/specialtyPackLoader.ts`, off-limits to
me this wave) that only ever sees the `PackMemCache` interface in `lib/packTypes.ts`,
which is exactly the finding's complaint. Added a doc comment directly on the `write()`
interface method stating the in-memory write is synchronous but the call also triggers
un-awaited async platform-storage I/O as a side effect, and that a caller doesn't need
to await anything for the in-memory contract but shouldn't assume storage mutations are
done when `write()` returns. Cross-referenced Task #439/F068 in both the interface
comment and the existing implementation comment so they can't drift independently.
Signature left as `void` (not changed to `Promise<void>`) — the async work is
genuinely fire-and-forget and not tied to a promise `write()` could honestly return, so
a signature change would be misleading, not honest; the doc comment is the correct fix.
Zero behavior change — comments only, matching the acceptance criteria's own framing.

Verification: `npx tsc --noEmit` clean. ESLint clean (2 pre-existing warnings unrelated
to my edits, unchanged). Combined run of all 4 owned test files: 99/99 passing. No
banned pseudocode assertions added.

Debt entries logged: 0
Carry-forward tasks generated: 0
