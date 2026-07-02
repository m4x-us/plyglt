# Stream W1A Task State

### Task #173 | architecture | severity 7
**What:** Extract duplicated `sha256Hex()` and `packUrl()` helpers that exist identically in both `lib/packLoader.ts` and `lib/specialtyPackLoader.ts` into `lib/utils.ts`. The `sha256Hex(text: string): Promise<string>` implementation at `packLoader.ts:94-100` and `specialtyPackLoader.ts:21-27` is byte-for-byte identical. The `packUrl(lang: string): string` at `packLoader.ts:141-143` and `specialtyPackLoader.ts:17-19` is byte-for-byte identical. Remove both from both source files and add one canonical copy to `lib/utils.ts`. Update all callers to import from `lib/utils.ts`.
**Why:** SCTS Poka-Yoke — a security-critical sha256 hash function with two independent copies is a stop-the-line violation. Task #156 extracted the specialty pack logic but copied these helpers instead of consolidating them. Any future divergence between the two copies would be undetectable.
**File:** `lib/utils.ts`, `lib/packLoader.ts`, `lib/specialtyPackLoader.ts`
**Severity:** 7 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 3 files, extraction refactor
**Blocked by:** Nothing | **Blocks:** #175
**Test required:** Yes — `tests/packLoader.test.ts` must still pass (no behavior change). Add one test to `tests/utils.test.ts` or equivalent pinning that `sha256Hex("abc")` returns `"ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f490f9e673c3eca08"` (known-answer test vector) so the Web Crypto stub alignment is verified.
**Done when:** `grep -n "sha256Hex\|packUrl" lib/packLoader.ts lib/specialtyPackLoader.ts` shows only import statements, not implementations. Both functions implemented exactly once in `lib/utils.ts`. All 897 tests pass. Verification gate green.
**Owner:** Architecture Agent
