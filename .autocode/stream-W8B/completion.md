Tasks closed: #270 #271 #276 #278
Tasks NOT completed: none
Debt entries logged: 0
Carry-forward tasks generated: 0

## Summary

**Task #270 — evictPack orphans specialty-pack loadedAddOns when evicting base pack**

Finding was stale. Task #260 (prior wave) already fixed this by having `clearPackCache` call
`clearSpecialtyPacksForLang(lang)` directly. `evictPack("it")` → `clearPackCache("it")` →
`clearSpecialtyPacksForLang("it")` is the live code path. The existing test `#253: evicting
the base pack also removes its specialty add-ons from getLoadedAddOns` (specialty pack merge
path describe block) covers this exactly. No additional code change required.

**Task #271 — evictPack silent no-op on specialty code**

Root cause: `isValidPackCode("it-medical")` returns false (specialty codes are not in
`READY_PACK_CODES`), so `evictPack` returned immediately with no signal. Added a `console.warn`
that names the specialty code and the correct base language to evict instead. Detection uses
`SPECIALTY_PACKS.find(sp => sp.code === lang)` (already imported). Test added in
`tests/packLoader.test.ts` (`evictPack — allowlist validation` describe block) verifying
the warning message contains both the specialty code and the base language.

**Task #276 — no feature flag gates specialty-pack UI**

Added `specialtyPacksEnabled = process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS !== "false"` inside
the LanguageGrid component body (per-render, not module-level — so vi.stubEnv works in tests).
Consistent with featureFlags.ts parseFlag convention: feature is on by default, disabled only
when explicitly set to "false". Wrapped the specialty packs section with
`{specialtyPacksEnabled && specialtyPacks.length > 0 && ...}`. Test added (State 6, #276) in
`components/LanguageGrid.test.tsx` verifying the section is hidden when the flag is "false".

**Task #278 — undocumented base-lang-ownership assumption**

Root cause: the specialtyPacks computation iterated `LANGUAGE_REGISTRY.filter(isPackUnlocked).flatMap(getSpecialtyPacks)`,
which assumes a user can never own a specialty add-on without the base language being unlocked.
This holds today because Italian is always free, but is not structurally enforced.

Fix: switched to `SPECIALTY_PACKS.filter(sp => isPackUnlocked(sp.baseLang) || hasAddOn(sp.code))`.
Each specialty pack appears exactly once (no deduplication needed — SPECIALTY_PACKS is a flat
registry). An owned add-on is now never hidden regardless of base language lock state.

Updated `components/LanguageGrid.test.tsx`:
- vi.mock factory gains `SPECIALTY_PACKS: mockSpecialtyPacks` (vi.hoisted mutable array)
- All 5 specialty pack tests updated from `vi.mocked(getSpecialtyPacks).mockReturnValue` to
  `mockSpecialtyPacks.push(...)` (now using the actual code path)
- State 4 test title updated to reflect the two required conditions for hiding (base not unlocked
  AND not purchased)
- State 7 (#278) added: purchased add-on visible when base lang not unlocked

Verification gate: tsc --noEmit ✓ | npm test 1092/1092 ✓ | npm run lint 0 errors ✓ | assert grep gate ✓
