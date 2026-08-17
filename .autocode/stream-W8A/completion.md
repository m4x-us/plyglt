CLOSED: #627 #628 #632 #637
NOT_CLOSED: none

## Summary

All four tasks closed. Verification Gate green: `npx tsc --noEmit` (0 errors), `npm test` (101 files, 2013 tests, all passing — full repo run, not just my scoped files), `npm run lint` (0 errors, 7 pre-existing warnings in files I did not touch). File-length cap: `app/study/page.tsx` stays at 148 lines (under the 150-line CLAUDE.md cap). No banned existence-only assertions (`.toBeDefined()`/`.toBeTruthy()`/`.not.toBeNull()`/`.toBeGreaterThan(0)`) introduced.

## #627 — collision-vs-addition fix in lib/storage.ts (severity 8, the real bug)

`lib/storage.ts`'s late-hydration reconciliation now checks whether `postVal` (the real, fully-hydrated persisted data) already has the colliding sub-key before taking `preVal[subKey]` (the live pre-hydration write). Only a genuine ADDITION (sub-key absent from `postVal` entirely) is still taken from the live write; a genuine COLLISION (postVal already has real content for that sub-key) now keeps the real persisted value — the `...postVal` spread already supplies it, so a colliding key is simply never added to `subDiff`. Logs a new `[ERR-HYDRATION-LATE-MERGE-COLLISION]` line when a real collision is detected and discarded, distinct from the existing `[ERR-HYDRATION-LATE-MERGE]` line for successful restores.

New regression test in `tests/storage.test.ts`: `"prefers the REAL persisted value over a colliding live write for a sub-key that already has real history, while still preserving a genuine addition with no real counterpart"` — exercises both the collision case (cardA: real history wins over the stale live write) and the addition case (cardC: no real counterpart, live write survives) in the same assertion, plus asserts the new collision log line fires.

**Live Deletion Test performed:** reverted the `hasOwnProperty.call(postVal, subKey)` collision guard back to unconditionally taking `preVal[subKey]` — confirmed the new test failed (cardA read back as the fresh, wrong live-write value instead of its real history) — restored via `cp`/`diff` byte-identical verification.

## #628 — app/study/page.tsx hydration gate design decision (severity 7)

Switched the page's hydration gate from `useIsHydrated` (lenient) alone to `useIsHydrated || packLoading || !useIsHydratedStrict` — i.e. the interactive UI (and therefore every write path: `handleRate` → `commitSession`, `onRate` → `recordIntroductionResult`) is now blocked until BOTH the lenient AND strict signals agree hydration is done.

**Design decision, reasoned explicitly (not silently picked):** considered giving the strict write-gating concern its own separate, more generous timeout distinct from the loading-screen concern. Rejected this — a second timeout that eventually gives up and lets the write proceed anyway just reintroduces the exact same race #627 exists to patch over, at a different elapsed time. Instead: if real hydration genuinely never finishes (a storage failure), the loading screen now stays up indefinitely rather than ever unblocking a write against unhydrated state. Judged this an acceptable trade-off — an app that cannot load its own SRS data should not let the user interact with it at all, rather than silently risking data loss on every rating. Documented this reasoning directly in the code (`app/study/page.tsx`'s comment above the gate).

New regression tests in `app/study/page.test.tsx` (new `describe("hydration gating (Task #628)…")` block): (1) proves the interactive study UI does NOT render — "Loading…" stays up, `study-card` testid absent — when `useIsHydrated=true` (failsafe already elapsed) but `useIsHydratedStrict=false` (real hydration still pending); (2) contrast case proving the UI DOES render once both gates are true. Also fixed the pre-existing mock (`vi.mock("@/lib/storage", …)`) to export `useIsHydratedStrict`, and added a hoisted `hydrationState` object so both signals are independently controllable per test — every pre-existing test defaults both to `true` and is unaffected.

**Live Deletion Test performed:** reverted the gate condition back to `if (!hydrated || packLoading)` (pre-#628 shape) — confirmed the new "stays blocked" test failed (the interactive `StudyCard` rendered instead of the loading screen) — restored via `cp`/`diff` byte-identical verification.

## #632 — useIsHydratedStrict test coverage (severity 4)

Added `describe("useIsHydratedStrict — never resolves via the failsafe (Task #632)", …)` to `tests/storage.test.ts` with two tests: (1) using fake timers, advances past `HYDRATION_FAILSAFE_MS` (and 10x further, to rule out a timing fluke) with `hasHydrated()` never becoming true — asserts `useIsHydratedStrict` stays `false` the whole time while `useIsHydrated` on the identical store flips `true`; (2) confirms `useIsHydratedStrict` does resolve `true` once `onFinishHydration` genuinely fires.

**Live Deletion Test performed:** temporarily changed `useIsHydratedStrict`'s body from `return useRealHydrated(store)` to `return useIsHydrated(store)` (aliasing it to the lenient hook, the exact broken-reimplementation risk this task exists to catch) — confirmed the new contrast test failed (`strict` resolved `true` after the failsafe, same as `lenient`) — restored via `cp`/`diff` byte-identical verification.

## #637 — strengthening two vacuous map-aware-reconciliation tests (severity 4)

Both flagged tests in `tests/storage.test.ts` never wrote to the map-shaped `introductions` field during the failsafe window, so both passed identically whether or not the entire `isPlainObject`/subDiff branch existed.

- `"still restores a live write on a scalar field exactly as before…"` — now also live-writes a genuinely new (non-colliding) map entry (`cardNew`) in the same window as the scalar write, and asserts both the scalar restoration AND the map addition survive together. Deliberately uses a non-colliding key to avoid duplicating #627's dedicated collision test.
- `"does not touch a map-shaped field the user never wrote to during the window"` — now also live-writes a scalar field (`count`) during the window, forcing the reconciliation callback to actually execute `setState(clobbered)` (proven via the scalar restoration + the `ERR-HYDRATION-LATE-MERGE` log assertion), while asserting the never-touched map field passes through exactly as real hydration set it. This proves the field is untouched *because reconciliation correctly skips it*, not merely because reconciliation never ran at all.

**Live Deletion Test performed:** disabled the entire `isPlainObject(...)` branch (short-circuited with `if (false && ...)`) — confirmed the strengthened scalar+map test failed (map addition lost) along with the pre-existing #606/#627 tests, as expected — confirmed the strengthened "untouched field" test still passed (correct: an untouched field must survive regardless of whether the branch exists, since it never reaches that branch either way — its Deletion Test target was "reconciliation genuinely runs," which the scalar-restoration + log assertions inside it independently prove) — restored via `cp`/`diff` byte-identical verification.

## Files touched (all within ownership)

- `lib/storage.ts` — #627 fix, plus (temporarily, then reverted) the #632/#637 Deletion Test edits
- `tests/storage.test.ts` — #627, #632, #637 new/strengthened tests
- `app/study/page.tsx` — #628 fix
- `app/study/page.test.tsx` — #628 new tests, mock fix for `useIsHydratedStrict`

`git status` confirmed throughout the session that only these four files (plus this completion.md and the queue frontmatter) were touched by me; all other modified files in the working tree belong to concurrently running streams (W8B/W8C/W8D) per the brief's off-limits list, and were left untouched.
