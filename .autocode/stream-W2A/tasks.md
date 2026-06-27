# Stream W2A Task State

### Task #077 | security | severity 5
**What:** Remove `"fr"`, `"de"`, `"pt"` from `ALL_PACK_CODES` and `LANG_CONFIG_MAP` in `lib/langRegistry.ts` — these are forward-looking stubs for languages with no content yet. The placeholder LANG_CONFIG_MAP entries fail the strengthened assertions added in Task #062.
**Why:** Task #062 tightened `tests/langRegistry.test.ts` to verify that every registered code has a real config. The right fix for an Italian-only product is to remove the unbuilt language stubs entirely, not to add fake configs. `ALL_PACK_CODES` should only list languages with real packs. When fr/de/pt packs are ready to ship, re-add them with real configs.
**File:** `lib/langRegistry.ts`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, removal only
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — removal only. After change: verify no other file references `"fr"`, `"de"`, or `"pt"` as pack codes: `grep -rn '"fr"\|"de"\|"pt"' --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "\.test\."`.
**Test required:** None beyond existing #062 assertions — removing the stubs is what makes those tests pass. Run `npm test -- tests/langRegistry.test.ts` to confirm all assertions green.
**Done condition:** `grep -n '"fr"\|"de"\|"pt"' lib/langRegistry.ts` returns zero hits. `npm test tests/langRegistry.test.ts` passes with zero failures. Verification gate green.
**Owner:** Security Agent

---

### Task #068 | security | severity 5
**What:** Decide whether `ALL_PACK_CODES` (security allowlist) and loadable packs (`ready: true`) should be separate sets — currently they are not
**Why:** `ALL_PACK_CODES` = all 5 registered codes including `ready: false` langs. The `loadPack` guard validates against ALL_PACK_CODES, making `es/fr/de/pt` "loadable" (guard passes, CDN rejects). If the design intent is that unready packs should be rejected early (before a network attempt), a `READY_PACK_CODES` subset should be used in the guard. If the intent is that all registered codes are valid security-wise (CDN is the content gate), current behavior is correct. Requires owner decision. See Escalation Queue item #4.
**File:** `lib/langRegistry.ts`
**Severity:** 5 | **DoD Tier:** 3
**Complexity:** ⚡ Direct — 1 file, no package boundary, owner decision + conditional guard change
**Blocked by:** Owner decision (Escalation Queue item #4) | **Blocks:** Nothing
**Risk:** Medium — changing ALL_PACK_CODES semantics affects guard behavior in three files
**Test required (write first):** After owner decision: test that `loadPack("fr", null)` returns the expected result for an unready pack.
**Done condition:** Owner decision recorded in cto.md. Implementation matches decision. Verification gate green.
**Owner:** Security Agent

---

### Task #064 | code-quality | severity 4
**What:** Change `getInstalledPacks()` return type from `string[]` to `PackCode[]` in `lib/packLoader.ts:306`
**Why:** The JSDoc states memCache is exclusively populated via `loadPack()` which validates against ALL_PACK_CODES — the values are guaranteed to be PackCodes. `string[]` forces every caller to re-validate or cast. Rule 6: honest types.
**File:** `lib/packLoader.ts:306`
**Severity:** 4 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 1 file, no package boundary, type annotation only
**Blocked by:** Task #059 | **Blocks:** Nothing
**Risk:** Low — type-only change; no runtime behavior change
**Test required (write first):** No new test needed. `npx tsc --noEmit` must pass with the updated return type.
**Done condition:** `grep -n "getInstalledPacks" lib/packLoader.ts` shows `PackCode[]` return type. Verification gate green.
**Owner:** Architecture Agent

---

### Task #065 | code-quality | severity 4
**What:** Extract `isValidPackCode(s: string): s is PackCode` type guard into `lib/langRegistry.ts` and replace the four inline `(ALL_PACK_CODES as readonly string[]).includes(x)` casts
**Why:** The same unsafe cast pattern appears at `lib/packLoader.ts:182`, `lib/packLoader.ts:318`, `store/entitlementStore.ts:70`, and `lib/importBackup.ts:119`. Four independent copies, four independent failure points. Rule of Three is cleared — extract. A single tested helper is the right abstraction.
**File:** `lib/langRegistry.ts` (add helper); `lib/packLoader.ts:182,318`; `store/entitlementStore.ts:70`; `lib/importBackup.ts:119`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (langRegistry, packLoader, entitlementStore, importBackup)
**Blocked by:** Task #059 | **Blocks:** Nothing
**Risk:** Low — behavior-identical refactor
**Test required (write first):** `tests/langRegistry.test.ts` — add: `isValidPackCode("it")` → true; `isValidPackCode("xx")` → false; `isValidPackCode("")` → false; `isValidPackCode("../evil")` → false.
**Done condition:** `grep -n "isValidPackCode" lib/langRegistry.ts` returns a hit. `grep -rn "as readonly string\[\]" lib/packLoader.ts lib/importBackup.ts store/entitlementStore.ts` returns no hits. Verification gate green.
**Owner:** Architecture Agent

---
