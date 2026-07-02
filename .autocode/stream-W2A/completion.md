# Stream W2A Completion — Adam — 2026-07-02 (Wave 2)

## Task #175 — Extract shared pack types to lib/packTypes.ts

### Tasks closed: [175]
### Tasks NOT completed: none
### Debt entries logged: 0
### Carry-forward tasks generated: 0

### Files modified
- `lib/packTypes.ts` — new file; exports `PackMeta`, `Manifest`, `Pack`, `LoadPackResult` with Rule 2 header
- `lib/packLoader.ts` — removed 4 exported type definitions; added `import type` + `export type` from `@/lib/packTypes`; removed now-unused `import type { Unit }` from `@/content/types`; `CachedPackMeta` kept private (unexported, only used inside packLoader)
- `lib/specialtyPackLoader.ts` — changed `import type { Pack, LoadPackResult, Manifest }` source from `@/lib/packLoader` to `@/lib/packTypes`

### Notes
Callers that previously imported types from `lib/packLoader` continue to work unchanged — packLoader re-exports all 4 types via `export type { ... } from "@/lib/packTypes"`. The type circular dependency is fully eliminated: specialtyPackLoader no longer imports anything from packLoader; packLoader imports only runtime functions from specialtyPackLoader.

### Verification Gate (Wave 2 pack type extraction brief 2026-07-02)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 902 tests pass ✓
- `lib/packTypes.ts` exists with 4 exported type definitions ✓
- `specialtyPackLoader.ts` imports types from `@/lib/packTypes`, not `@/lib/packLoader` ✓
- `packLoader.ts` imports types from `@/lib/packTypes`, not `@/lib/specialtyPackLoader` ✓

---

# Stream W2A Completion — Adam — 2026-06-27 (Wave 1)

## Tasks Closed

All 4 tasks reached COMPLETE status.

### #077 — Remove fr/de/pt stubs (sev 5) — COMPLETE
- Removed fr, de, pt entries from LANGUAGE_REGISTRY in lib/langRegistry.ts
- Narrowed PackCode union from `"it" | "es" | "fr" | "de" | "pt"` to `"it" | "es"`
- Updated tests/langRegistry.test.ts:
  - `'LANG_CONFIG_MAP["fr"], ["de"], ["pt"] are not the Spanish config'` → replaced with `"fr, de, pt are absent from LANG_CONFIG_MAP"` (assert undefined)
  - `"every element of ALL_PACK_CODES is within the PackCode allowlist"` → updated allowlist to `["it", "es"]` with size 2
- All 13 langRegistry tests pass (previously 2 intentionally failing — now all green)
- Collateral fix: tests/entitlement.test.ts:93 referenced `ALL_PACK_CODES[2]!` (was "fr", now undefined). File not owned by any W2 window — made minimal fix (index-based to code-aware check). Pre-existing warning on line 16 unchanged.

### #068 — ALL_PACK_CODES vs READY_PACK_CODES decision (sev 5) — COMPLETE
**Decision: Option B — READY_PACK_CODES for loadPack guard.**
Reasoning: After #077, ALL_PACK_CODES = ["it", "es"]. "es" has `ready: false`. Letting `loadPack("es")` hit the CDN and 404 is wasteful and misleading. Failing fast with `invalid_lang` gives callers a useful discriminant. evictPack keeps ALL_PACK_CODES so any registered code can be cleaned up.

Changes:
- lib/langRegistry.ts: added `READY_PACK_CODES` (currently ["it"])
- lib/packLoader.ts: loadPack guard now uses `READY_PACK_CODES.some(c => c === lang)` instead of ALL_PACK_CODES cast; evictPack uses `isValidPackCode(lang)` (ALL_PACK_CODES)
- tests/packLoader.test.ts: added test — `loadPack("es", null)` → `{ ok: false, error: "invalid_lang" }`, no fetch

### #064 — getInstalledPacks() return type PackCode[] (sev 4) — COMPLETE
- lib/packLoader.ts: changed return type from `string[]` to `PackCode[]`; cast `Array.from(memCache.keys()) as PackCode[]` justified by JSDoc invariant
- Updated JSDoc to reference READY_PACK_CODES
- npx tsc --noEmit: zero errors

### #065 — isValidPackCode() type guard (sev 4) — COMPLETE
- lib/langRegistry.ts: added `export function isValidPackCode(s: string): s is PackCode`
- lib/packLoader.ts: import updated to `{ READY_PACK_CODES, isValidPackCode, type PackCode }` (ALL_PACK_CODES no longer imported)
- lib/importBackup.ts: replaced `(ALL_PACK_CODES as readonly string[]).includes(c)` with `isValidPackCode(c)`
- store/entitlementStore.ts: replaced `(FREE_PACK_CODES as readonly string[]).includes(lang)` with `FREE_PACK_CODES.some(c => c === lang)` (different semantic — no isValidPackCode)
- tests/langRegistry.test.ts: added isValidPackCode describe block (8 tests)

## Tasks NOT Completed
None.

## Debt Entries Logged
0 new debt entries. A004–A026 from #060 remain in tasks.md from W1A.

## Carry-Forward Tasks Generated
0 new tasks.

## Verification Gate
- `npx tsc --noEmit`: 0 errors
- `npm test`: 394/394 pass (previously 2 intentional failures now fixed by #077)
- `npm run lint`: 0 errors (1 pre-existing warning in tests/entitlement.test.ts)
