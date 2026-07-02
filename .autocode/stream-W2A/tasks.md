# Stream W2A Task State

### Task #175 | architecture | severity 5
**What:** Break the circular type dependency between `lib/packLoader.ts` and `lib/specialtyPackLoader.ts`. Currently `specialtyPackLoader.ts:9` does `import type { Pack, LoadPackResult, Manifest } from "@/lib/packLoader"` while `packLoader.ts:32` does `import { loadSpecialtyPack, clearSpecialtyCache } from "@/lib/specialtyPackLoader"`. Extract the shared type definitions (`Pack`, `PackMeta`, `Manifest`, `LoadPackResult`, `CachedPackMeta`) to a new `lib/packTypes.ts` module. Update both files to import types from `lib/packTypes.ts` instead.
**Why:** `import type` prevents a runtime cycle but the design is fragile — any refactor of the shared types requires coordinating both files. Extracting to `lib/packTypes.ts` eliminates the cycle completely and makes the type contract explicit.
**File:** `lib/packTypes.ts` (new), `lib/packLoader.ts`, `lib/specialtyPackLoader.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files, type extraction
**Blocked by:** #173 | **Blocks:** Nothing
**Test required:** No new tests needed — type extraction is structural. All 902 existing tests pass (no behavior change).
**Done when:** `lib/packTypes.ts` exists with all 5 shared type definitions and a Rule 2 header. Neither `packLoader.ts` nor `specialtyPackLoader.ts` imports types from each other. Verification gate green.
**Owner:** Architecture Agent
