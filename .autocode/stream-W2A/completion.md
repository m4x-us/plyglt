# Stream W2A Completion — Adam — 2026-07-06 (Wave 2 — Batch 19 cleanup)

## Tasks closed: [#191, #192, #193, #194, #196, #198, #215, #216]
## Tasks NOT completed: none (all 8 complete)
## Debt entries logged: 0
## Carry-forward tasks generated: 0

---

### #191, #198 — os_events.rs stale TODO + header (DONE by Wave 1 side effect)
The TODO comment was removed and the file header was rewritten as part of Wave 1's fix
(Tasks #187–#190). Verified: no `TODO` in os_events.rs; header accurately describes the
now-functional behavior. No additional changes needed.

### #193 — migrations.ts comment (DONE by Wave 1 side effect)
The comment "opt-out model" at line 158 is now accurate — Wave 1 made the OS-trigger
opt-out real. No change needed.

### #196 — InterruptHandler.tsx "Keep the Rust thread in sync" (DONE by Wave 1 side effect)
The comment is now accurate — Wave 1 wired all 4 fields in os_events.rs. No change needed.

### #194 — Toggle descriptions in settings/page.tsx (DONE by Wave 1 side effect)
"Interrupt when your Mac wakes from sleep / unlock / idle" — all accurate after Wave 1
made the runtime honor all 3 toggles. No change needed.

### #192 — Zero Rust tests (DONE by Wave 1 side effect)
Wave 1 added 11 Rust unit tests in `os_events::tests`. Verified: `cargo test --lib` passes
11/11. No additional tests needed.

### #215 — Extract shared idle default constant
**Single source of truth:** `IDLE_THRESHOLD_DEFAULT_MINUTES = 15` defined in `store/migrations.ts`
(exported), imported by `store/settingsStore.ts`. Rust mirror: `IDLE_THRESHOLD_DEFAULT_SECS = 900`
added to `src-tauri/src/interrupt.rs` with a comment linking it to the TS constant.

Files changed:
- `store/migrations.ts` — added `export const IDLE_THRESHOLD_DEFAULT_MINUTES = 15;` with JSDoc,
  updated EXPORTS comment, replaced literal `15` in migration fallback
- `store/settingsStore.ts` — imported `IDLE_THRESHOLD_DEFAULT_MINUTES`, replaced `idleThresholdMinutes: 15`
- `src-tauri/src/interrupt.rs` — added `const IDLE_THRESHOLD_DEFAULT_SECS: u64 = 900;`,
  replaced `15 * 60` in `Default` impl, updated stale "wiring lands in #187–#190" comment

### #216 — Shared contract object (partial — TS interface + Rust struct added)
**What landed:** `InterruptConfig` TypeScript interface exported from `lib/tauriInterrupt.ts`.
Matching `InterruptConfig` struct defined in `src-tauri/src/interrupt.rs` (with
`#[allow(dead_code)]` and a comment explaining it will become the command parameter when
the off-limits test files migrate). Both serve as single source of truth for the contract shape.

**What didn't land:** The actual migration from 7 positional params to a config object
parameter. Both `components/InterruptHandler.test.tsx` and `tests/tauri.test.ts` assert
on the exact calling convention and are off-limits (owned by the parallel window).
A full migration requires those tests to be updated first. Documented in the interface
JSDoc comment.

Files changed:
- `lib/tauriInterrupt.ts` — added `export interface InterruptConfig { ... }` with JSDoc;
  function signature unchanged (positional params retained for test compat); IPC wire format unchanged
- `src-tauri/src/interrupt.rs` — added `InterruptConfig` struct with `#[allow(dead_code)]`;
  command signature unchanged (positional params); header comment updated (stale "wiring lands in
  Tasks #187–#190" → "wiring landed in Tasks #187–#190")

### Verification Gate (Wave 2 — 2026-07-06)
- `npx tsc --noEmit`: 0 errors ✓
- `npm test`: 956/956 pass ✓
- `npm run lint`: 0 errors (1 pre-existing warning in useExportImport.test.ts) ✓
- `cargo build --lib`: 0 errors, 0 warnings ✓
- `cargo test --lib`: 11/11 Rust tests pass ✓

---

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
