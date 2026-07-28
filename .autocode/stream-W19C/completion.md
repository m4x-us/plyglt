CLOSED: #448 #444
NOT_CLOSED: none

## Task #448 — parseFlag empty-string handling (F009)

`parseFlag(v, defaultEnabled)` only checked `v === undefined` before falling through to
`defaultEnabled`; `v === ""` skipped that branch and fell through to
`!FALSY_FLAG_VALUES.includes("")` which is always `true`, silently enabling any flag
(including `specialtyPacks`, whose safe default is off) when an env var was set to an
empty string — a realistic misconfiguration (e.g. an unfilled CI template variable).
Fixed by treating `v === "" ` the same as `v === undefined` — both fall through to
`defaultEnabled`.

Added 2 tests to `tests/featureFlags.test.ts`: `specialtyPacks` stays `false` when its env
var is `""` (the acceptance criteria's explicit case), plus a sibling proof that the fix
is generic rather than a `specialtyPacks`-only special case — `interruptEngine` (whose
default is `true`) stays `true` when its env var is `""`, exactly as if it were unset.

## Task #444 — app/stats/page.tsx populated-dashboard coverage (F014)

Test-only, as scoped — no changes to `app/stats/page.tsx`'s logic. Added one test that
populates `hardest` (2 cards), `weakestTags` (2 tags), and `levelStability` (4 levels
spanning the green/yellow/red thresholds, a 100%-clamp case, and the count:0 "No mastered
cards" case) with real, distinguishable data, then asserts:
- Both hardest-card prompts render and both get their real `difficulty` value passed to
  `DifficultyBar` (mocked to a `data-testid="difficulty"` span, asserted via `textContent`
  in call order).
- Both weakest-tag names, counts ("N cards" text), and avg-difficulty values render.
- All 4 retention-bar rows render the correct median/count text, including the
  `count:0` → "No mastered cards" branch.
- The actual rendered bar elements (queried directly from the DOM, not through a mock)
  have the correct CSS color class AND the correct `width` style computed by
  `Math.min(100, (median / 60) * 100)` — including a case that exercises the 100% clamp
  (median 90 → raw 150%).

The color-class assertion required overriding the file's module-level `stabilityColorClass`
mock (previously a plain arrow function hardcoding `"text-green-400"` regardless of
input) with the REAL implementation for just this one test, via `vi.importActual` +
`mockImplementation`, restored in a `finally` block afterward. This meant changing the
mock factory to wrap `stabilityColorClass` in `vi.fn(...)` (it wasn't a proper mock
before, so `vi.mocked(...).mockImplementation` wasn't callable) — a mechanical prerequisite
to actually exercising the real threshold/width logic through the page rather than
testing against a mock that ignores its input entirely.

Also added one more small test for the previously-uncovered `loading` branch (line 22),
since it was a one-line, zero-risk addition directly serving this task's own coverage
goal, not scope creep into an unrelated concern.

Coverage on `app/stats/page.tsx` (scoped to this test file) rose from 40% functions /
66.66% statements (per the finding) to **100% statements / 100% lines / 100% functions /
93.75% branches**. The one remaining uncovered branch (line 68, the "+N more" atRisk
overflow text when `atRisk.length > 5`) is outside this task's scope (hardest/
weakestTags/levelStability) and already has direct atRisk coverage via the pre-existing
`#088` regression test.

Verification: `npx tsc --noEmit` clean. ESLint clean on all 4 touched files. Combined run
of `tests/featureFlags.test.ts` + `app/stats/page.test.tsx`: 33/33 passing. No banned
pseudocode assertions added.

Debt entries logged: 0
Carry-forward tasks generated: 0
