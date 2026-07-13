# Stream W12C — Completion Summary

**Agent:** Charles
**Wave:** 12
**Stream:** W12C
**Date:** 2026-07-13

---

## Tasks closed

- **#306** — Added `specialtyPacks: boolean` to `FeatureFlags` interface and `getFeatureFlags()` in `lib/featureFlags.ts`. Updated `components/LanguageGrid.tsx` to import `getFeatureFlags` and read `flags.specialtyPacks` instead of the raw env var inline. This wires the flag through `parseFlag()` so all falsy-value forms ('false', '0', 'off', 'no') are respected.

- **#307** — Replaced the stale comment on `specialtyPacksEnabled` in `components/LanguageGrid.tsx`. Removed the false claim "without requiring a deploy" — `next.config.ts` sets `output:'export'`, which inlines all `NEXT_PUBLIC_*` vars at build time, making runtime flag flipping impossible.

- **#308** — Changed `Props.onUpgradeClick` from `() => void` to `(code?: string) => void`. The locked specialty-pack tile now calls `onUpgradeClick(sp.code)` so callers can identify which pack triggered the callback. The base-language locked tile was wrapped in `() => onUpgradeClick()` (no argument) to satisfy TypeScript — a `() => void` function passed as a prop would otherwise be called with the MouseEvent as the first arg, mismatching the new parameter type.

- **#316** — Strengthened `hasValidUnitsArray` in `lib/packTypes.ts` to validate card element shapes. Previously only checked `unit.id: string` and `unit.cards: array`. Now also validates `unit.name: string` and, for every card element: `id: string`, `type: string`, `prompt: string`, `accepted: array`, `tags: array`, `tier: number`. Added regression test in `tests/packLoader.test.ts` that seeds a pack with valid unit headers but malformed card elements, hashes the JSON to bypass the sha256 gate, and asserts `parse_error`.

- **#321** — Replaced the pseudocode same-code dedup test with two tests:
  1. **Mechanism test** (the real fix): imports `loadSpecialtyPack` from `@/lib/specialtyPackLoader` directly, creates a minimal `PackMemCache` mock, and asserts `p1 === p2` for two concurrent same-code calls. `loadSpecialtyPack` is non-async (Barry, Wave 11) precisely to enable this. `loadPack` is `async` and wraps every result in a new Promise, hiding the reference — the old approach via `loadPack` can never surface this invariant.
  2. **Behavioral test** (kept as regression guard): two concurrent `loadPack("it-medical", ...)` calls → `addonFetchCount === 1` and `getLoadedAddOns()` deduped. Still useful, but cross-code serialization alone also passes it — the mechanism test is the authoritative proof.

## Forced downstream fix

- **`app/stats/page.test.tsx`** — Added `specialtyPacks: true` to all three `getFeatureFlags` mock return values. Required because adding `specialtyPacks: boolean` (required field) to `FeatureFlags` interface caused TypeScript errors in the existing mock objects. This file is not in my owned list but is not off-limits either; the TS error was forced by my #306 interface change.

## Tasks NOT completed

None. All five tasks reached COMPLETE status.

## Debt entries logged

0

## Carry-forward tasks generated

0

---

## Feature flag shape after #306 (for CTO audit log)

`components/LanguageGrid.tsx` now reads:
```typescript
const specialtyPacksEnabled = getFeatureFlags().specialtyPacks;
```

`getFeatureFlags()` returns the full `FeatureFlags` object including:
```typescript
specialtyPacks: parseFlag(process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS)
```

Default when env var is unset: `parseFlag(undefined)` → `true` (feature on). Disabled by setting the env var to any value in `["false", "0", "off", "no"]`.

---

## Verification Gate Result

| Check | Result | Notes |
|-------|--------|-------|
| `npx tsc --noEmit` | ✓ PASS | Zero TypeScript errors |
| `npm test` | ✓ PASS | 1143 tests, 56 files — all passed |
| `npm run lint` | ✓ PASS | Zero errors (one pre-existing warning in `hooks/useExportImport.test.ts` — off-limits, not caused by W12C) |
| Assertion quality gate | ✓ PASS | No unsuppressed existence-only assertions |
