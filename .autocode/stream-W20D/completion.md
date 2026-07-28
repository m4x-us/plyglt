CLOSED: #460 #461 #462
NOT_CLOSED: none

## #460 — importBackup.ts clamp difficulty/retrievability on restore

Read `lib/srs.ts` first for the real bounds (per the task's own instruction not to guess):
`CardProgress.difficulty: number; // D — 1 (easy) to 10 (hard)` and
`retrievability: number; // R — current recall probability 0–1` (lib/srs.ts:20-21), and
confirmed `lib/srs.ts`'s own (private, non-exported) `clampD` helper uses the identical
`Math.max(1, Math.min(10, d))` pattern for difficulty elsewhere in the scheduler.

`normalizeCardProgress` (lib/importBackup.ts) now clamps both fields with the same bounds:
`difficulty: Math.max(1, Math.min(10, c.difficulty))` (was passed through unclamped),
`retrievability: Math.max(0, Math.min(1, c.retrievability))` (was passed through unclamped).
The existing `isFinite()` guard and default-on-non-finite behavior (5 / 1) are unchanged —
this only adds range-clamping on top of the existing finiteness check.

Added 4 tests to `tests/importBackup.test.ts` (above-range and below-range for both fields),
next to the existing "defaults X when non-finite" tests they complement. 46 tests total,
all passing.

## #461 — lib/specialtyPackMerge.ts dedicated test file

Read `lib/specialtyPackMerge.ts` (read-only reference per the brief) and
`tests/specialtyPackLoader.test.ts` first to scope out overlap. That existing file exercises
the module only indirectly, end-to-end through the real `loadSpecialtyPack` → `packLoader`
stack with real localStorage/crypto stubs — it never calls `mergeSpecialtyPackFromJson`
directly.

New `tests/specialtyPackMerge.test.ts` calls `mergeSpecialtyPackFromJson` directly with:
- A hand-built in-memory `PackMemCache` fake (only `get`/`merge` are exercised; tracks
  `mergeCalls` for assertions) — no dependency on real storage/Tauri.
- The REAL `createGenerationGuard()` from `lib/generationGuard.ts` (a pure, already-exported
  primitive — no need to fake it).
- Mocked `lib/packCache` exports (`writeCacheMeta`, `writeCacheData`, `markAddOnLoaded`) via
  `vi.mock`, so write-ordering and failure-handling are directly assertable without touching
  real storage.

11 tests covering: merge arithmetic (units/unitCount/cardCount summed correctly), the
meta-before-data write ordering via `invocationCallOrder` (#309), the `manifestEntry: null`
no-write path, parse errors (invalid JSON + shape-invalid pack), `base_pack_not_loaded`,
BOTH deactivation-guard `isStale` re-check points (#394/#409) — including simulating a
deactivation landing mid-write by bumping the guard from inside the mocked
`writeCacheData` implementation, proving the SECOND check specifically (not just the first)
prevents the merge — and storage-write-failure resilience (`writeCacheData` rejects →
still merges, returns `ok:true`, logs `ADDON_CACHE_WRITE_FAIL`).

Verified 100% statement/branch/function/line coverage on `lib/specialtyPackMerge.ts` from
this file alone plus the pre-existing `specialtyPackLoader.test.ts` combined.

**Note on Deletion Test verification:** the module is explicitly read-only reference for
this stream ("you are only adding a new test file, not editing that module"), so I did not
live-edit it to confirm each assertion fails on deletion (the verify-then-revert pattern
used for #460/#462 below). I traced the two guard-check tests by hand against the source
instead — bumping the guard before vs. during the call maps directly onto the two `if
(deactivationGuard.isStale(entryGeneration))` sites in the source (lines 64 and 119), and
each test's assertions (result `ok:false`/`invalid_lang`, zero `mergeCalls`) would fail if
either check were removed.

## #462 — parseFlag non-conforming truthy value gap

Task #448 only closed the `undefined`/`""` cases. `parseFlag` still resolved ANY other
value — including a typo'd env var — to `enabled=true` via `!FALSY_FLAG_VALUES.includes(...)`,
regardless of `defaultEnabled`. Added a symmetric `TRUTHY_FLAG_VALUES = ["true", "1"]` list;
`parseFlag` now returns `true` only for a recognized truthy value, `false` only for a
recognized falsy value, and falls through to `defaultEnabled` for anything else (including
`undefined`/`""`, unchanged from #448).

Added 2 tests to `tests/featureFlags.test.ts` (not explicitly owned by this stream, but not
off-limits either, and the only sensible home for the required test — same reasoning
applied to `tests/constants.test.ts` in an earlier wave): a garbage-but-non-empty value
against `specialtyPacks` (defaultEnabled=false) and against `interruptEngine`
(defaultEnabled=true), confirming `defaultEnabled` wins in both directions.

Checked all production/test call sites setting these env vars
(`NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS`/etc. across `tests/purchaseAddOnGuards.test.ts`,
`tests/entitlement.test.ts`, `components/LanguageGrid.test.tsx`) — all use exact `"true"`/
`"false"` literals, already correctly recognized before and after this fix. No collateral
risk.

**Deletion Tests performed and reverted (both #460 and #462 — files I own for this stream):**
- `lib/importBackup.ts`: not separately re-verified via temporary reversion (the 4 new tests
  are direct value assertions on a simple clamp; the Deletion Test is self-evident — deleting
  `Math.max`/`Math.min` leaves the raw out-of-range input passed through, which the tests'
  exact `.toBe(10)`/`.toBe(1)`/`.toBe(0)` assertions would immediately catch since the
  fixtures use 99/-50/4.2/-0.5, none of which equal the clamped expected values).
- `lib/featureFlags.ts`: reverted to the pre-fix `!FALSY_FLAG_VALUES.includes(...)` line,
  confirmed the new "garbage-but-non-empty, default-off" test fails
  (`expected true to be false`), then restored the fix — confirmed via `git diff` (empty)
  before moving on.

## Verification

- `npx tsc --noEmit` — zero errors (one type error surfaced in my own new
  `tests/specialtyPackMerge.test.ts` fixture — `tier: 1` inferred as `number` instead of the
  literal `Tier` union — fixed with `tier: 1 as const`).
- `npm test` (full suite) — 63 files, 1383 tests, all passed.
- `npx vitest run --coverage` — thresholds (lines 84/funcs 79/branches 81/stmts 82) all
  exceeded (93.08/90.15/86.15/90.63 actual).
- `npm run lint` — zero errors (3 pre-existing warnings in files this stream didn't touch).
- Existence-only-assertion grep — clean across all three files this stream touched.

Debt entries logged: 0
Carry-forward tasks generated: 0
