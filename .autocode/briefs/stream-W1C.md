# Stream W1C Brief — /advance Wave 1 — 2026-06-26

## Your Role
You are a child CTO executing Wave 1, Stream C of a parallel /advance session.
Work exclusively on the files listed in "Files You Own". MUST NOT modify any other file.

## STREAM_ID
Your STREAM_ID is: W1C
Your stream's tasks.md has been pre-populated at `.autocode/stream-W1C/tasks.md`.

## Execution Order
Run in this exact order (blockers first):

1. Skill({ skill: "task", args: "#071" })  — Fix Rule 3 upward import in lib/importBackup.ts
2. Skill({ skill: "task", args: "#063" })  — Fix truthy check on data.srs in importBackup
3. Skill({ skill: "task", args: "#007" })  — Fix silent catch — FileReader in settings/page.tsx
4. Skill({ skill: "task", args: "#074" })  — Sanitize deactivateLicense error string
5. Skill({ skill: "task", args: "#053" })  — Extract duplicate error strings to named constants
6. Skill({ skill: "task", args: "#054" })  — Add render-based mount test for EntitlementValidator
7. Skill({ skill: "task", args: "#070" })  — Add @deprecated JSDoc to ALL_KNOWN_PACKS re-export
8. Skill({ skill: "task", args: "#055" })  — Restrict reset() helper type to state-only fields

## Files You Own (edit ONLY these)
lib/importBackup.ts
app/settings/page.tsx
lib/entitlement.ts
store/entitlementStore.ts
components/EntitlementValidator.test.tsx
tests/entitlement.test.ts
tests/importBackup.test.ts  ← create new file for #071 and #063 tests

## Off-Limits Files (DO NOT MODIFY — owned by other streams this wave)
hooks/useLangPack.ts                  (W1A)
lib/langRegistry.ts                   (W1A)
lib/packLoader.ts                     (W1A)
tests/packLoader.test.ts              (W1A)
tests/langRegistry.test.ts            (W1A)
tests/useLangPack.test.ts             (W1A)
lib/tauri.ts                          (W1B)
components/InterruptHandler.tsx       (W1B)
store/srsStore.ts                     (W1B)
app/study/page.tsx                    (W1B)
lib/constants.ts                      (W1B)
tests/srsStore.test.ts                (W1B)
lib/srs.ts                            (W1D)
app/decks/                            (W1D)
vitest.config.ts                      (W1D)

## Task Definitions

### Task #071 | architecture | severity 7
**What:** Fix Rule 3 upward import in `lib/importBackup.ts:14` — extract `migrateSrsStore` call out of the utilities layer
**Why:** Rule 3 stop-the-line violation. `lib/importBackup.ts:14` imports `@/store/migrations` — a Utilities-layer file importing from the Services layer. The fix is to move the migration dependency: either (a) pass `migratedSrs` data in via parameter from the caller (store layer), or (b) extract the migration step to a pure `lib/` function that doesn't import from `store/`. Option (a) is simpler: the caller of `parseBackup` (in `app/settings/page.tsx`) already has access to the store; it can call `migrateSrsStore` separately after `parseBackup` returns the raw data.
**File:** `lib/importBackup.ts:14`, `app/settings/page.tsx` (caller)
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Full**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Medium — backup import flow must be tested end-to-end after refactor. Regression risk: `parseBackup` signature change affects the caller.
**Test required (write first):** `tests/importBackup.test.ts` — add import-graph assertion: `lib/importBackup.ts` must not contain the string `"@/store"`. Existing backup round-trip tests must still pass.
**Done condition:** `grep -n "@/store" lib/importBackup.ts` returns zero hits. Verification gate green.
**Owner:** Architecture Agent

---

### Task #063 | security | severity 7
**What:** Fix truthy check on `data.srs` in `lib/importBackup.ts:67` — validate it is a non-null object
**Why:** `if (!data.srs)` allows `data.srs = 42` (truthy non-object) to pass. `migrateSrsStore(42, 0)` is then called with a number from an untrusted JSON boundary. Rule 3: validate at boundaries. Must be `typeof data.srs !== "object" || data.srs === null`.
**File:** `lib/importBackup.ts:67`
**Severity:** 7 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — tightens boundary validation; no behavior change for well-formed backups
**Test required (write first):** `tests/importBackup.test.ts` — add: `parseBackup({ _version: 1, srs: 42, entitlement: {} })` → `{ ok: false }`. `parseBackup({ _version: 1, srs: "hello", entitlement: {} })` → `{ ok: false }`.
**Done condition:** New tests pass. `grep -n "typeof data.srs" lib/importBackup.ts` returns a hit. Verification gate green.
**Owner:** Security Agent

---

### Task #007 | Fix silent catch — FileReader in settings/page.tsx
**Severity:** 5 | **File(s):** `app/settings/page.tsx:178`
**DoD Tier:** 2
**Complexity: Direct**

The `reader.onload` callback at line 152 wraps its body in try/catch. The catch at line 178 shows a user-visible error message (good), but the raw error is discarded with no logging, making silent read failures invisible in support contexts.

**Changes required:**
1. `app/settings/page.tsx:178-180` — change `catch {` to `catch (err) {` and add `console.error(`[ERR-IMPORT-${Date.now()}]`, err);` before the `setDataStatus` call.
2. Add `reader.onerror` handler below the `reader.onload` assignment (currently absent). On error: log with ref ID, set `dataStatus` to `{ type: "error", message: "Could not read the file." }`.

**Test required (write first):**
- Add a unit test to `tests/importBackup.test.ts` asserting that an `onerror` on the FileReader is handled — document as a note in the test file for now; full coverage comes in Batch 2 (#020).

**Done condition:** `grep -n "catch {" app/settings/page.tsx` returns zero hits. `reader.onerror` is defined. Verification gate green.

---

### Task #074 | security | severity 4
**What:** Sanitize `deactivateLicense` error string before returning to UI — `lib/entitlement.ts:207`
**Why:** `deactivateLicense` returns `res.error` directly from raw Lemon Squeezy API response body to the caller, which renders it to the user. LS errors can include key-identifying information (e.g., `"Instance not found for key XXXX-XXXX..."`). The `catch` block at line 197 already avoids this, but the `!res.deactivated` branch at line 207 does not.
**File:** `lib/entitlement.ts:207`
**Severity:** 4 | **DoD Tier:** 2
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** Low — replace one string with a safe fallback.
**Test required (write first):** `tests/entitlement.test.ts` — add: when LS API returns `deactivated:false` with `error:"Instance not found for key XXXX"`, `result.error` does not contain `"XXXX"` and equals the generic `"Deactivation was declined by the server."`.
**Done condition:** `grep -n "res.error" lib/entitlement.ts` returns zero hits in the return statement. Verification gate green.
**Owner:** Security Agent

---

### Task #053 | Extract duplicate error string literals in lib/entitlement.ts to named constants
**Severity:** 3 — Low | **File(s):** `lib/entitlement.ts`
**DoD Tier:** 1
**Complexity: Direct**

SCTS Poka-Yoke: `"Activation request failed — check your connection."` appears twice in `activateLicense` — once in the catch block and once in the null-body guard. `"Deactivation failed — check your connection."` appears twice in `deactivateLicense` — same pattern. Four string literals, two unique strings, zero named constants. A typo fix requires four edits instead of one.

**Changes required:**
1. `lib/entitlement.ts` — add two constants at module scope (after imports, before function definitions):
   ```ts
   const ERR_ACTIVATE_NETWORK = "Activation request failed — check your connection." as const;
   const ERR_DEACTIVATE_NETWORK = "Deactivation failed — check your connection." as const;
   ```
2. Replace all four inline string literals with their respective constants.

**Test required (write first):**
- `tests/entitlement.test.ts` — add four assertions pinning each call site to the constant value: (1) when `invoke` throws in `activateLicense`, the returned `error` equals `ERR_ACTIVATE_NETWORK`; (2) when the null-body guard fires in `activateLicense`, same; (3) when `invoke` throws in `deactivateLicense`, the returned `error` equals `ERR_DEACTIVATE_NETWORK`; (4) when the null-body guard fires in `deactivateLicense`, same. Import the constants from `lib/entitlement.ts` — do not hardcode the string in the test.

**Done condition:** `grep -n '"Activation request failed\|"Deactivation failed' lib/entitlement.ts` returns zero hits. `grep -n "ERR_ACTIVATE_NETWORK\|ERR_DEACTIVATE_NETWORK" lib/entitlement.ts` returns hits on constants and all four usage sites. Verification gate green.

---

### Task #054 | Add render-based mount test for EntitlementValidator component wiring
**Severity:** 3 — Low | **File(s):** `components/EntitlementValidator.test.tsx`
**DoD Tier:** 1

The `useEffect(() => { void runEntitlementValidation(useEntitlementStore.getState); }, [])` wiring in `EntitlementValidator.tsx` is exercised only by calling `runEntitlementValidation` directly. The component mount path — that rendering `<EntitlementValidator/>` actually invokes `runEntitlementValidation` with the production store getter — is unverified. A refactor that passes `null` or a stale closure would not be caught.

**Changes required:**
1. `components/EntitlementValidator.test.tsx` — add a test that:
   - Spies on `runEntitlementValidation` with `vi.spyOn`.
   - Renders `<EntitlementValidator/>` via `render()`.
   - Asserts the spy was called exactly once.
   - Asserts it was called with `useEntitlementStore.getState` (the production getter, not `null` or a stub).
   Clean up the spy in `afterEach`.

**Test required:** This task IS the test.

**Done condition:** `npm test -- EntitlementValidator` passes with the new render-based assertion. The test uses `render(<EntitlementValidator/>)`, not a direct function call. Verification gate green.

---

### Task #070 | code-quality | severity 2
**What:** Add `@deprecated` JSDoc to the `ALL_KNOWN_PACKS` re-export in `store/entitlementStore.ts:27`
**Why:** `ALL_KNOWN_PACKS` is a backward-compat alias for `ALL_PACK_CODES`. Without `@deprecated`, IDE autocomplete surfaces it as a live API with no hint to migrate. Note: Task #057 (W1A) covers the distinct re-export alias in `hooks/useLangPack.ts` — this is a separate alias in a separate file.
**File:** `store/entitlementStore.ts:26-27`
**Severity:** 2 | **DoD Tier:** 1
**Complexity: Direct**
**Blocked by:** Nothing | **Blocks:** Nothing
**Risk:** None — JSDoc comment only
**Test required (write first):** `grep -n "@deprecated" store/entitlementStore.ts` must return a hit.
**Done condition:** `grep -n "@deprecated" store/entitlementStore.ts` returns a hit adjacent to the `ALL_KNOWN_PACKS` export line. Verification gate green.
**Owner:** Architecture Agent

---

### Task #055 | Restrict reset() helper type in tests/entitlement.test.ts to state-only fields
**Severity:** 2 — Low | **File(s):** `tests/entitlement.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

The `reset()` helper is typed as `Partial<ReturnType<typeof store>>` where `store = () => useEntitlementStore.getState()`. The return type includes all action methods (`setEntitlement`, `clearEntitlement`, `isPackUnlocked`, `markValidated`, etc.). This makes `reset({ isPackUnlocked: () => true })` type-valid — Zustand's `setState` would silently merge it and overwrite the real action with a stub, potentially corrupting other tests with no type error.

**Changes required:**
1. `tests/entitlement.test.ts` — define a state-only type using `Pick`:
   ```ts
   type EntitlementStateOnly = Pick<EntitlementState,
     "licenseKey" | "instanceId" | "licenseType" | "unlockedPacks" |
     "validUntil" | "lastValidated"
   >;
   ```
2. Change the `reset` helper's parameter type from `Partial<ReturnType<typeof store>>` to `Partial<EntitlementStateOnly>`.

**Test required (write first):**
- Add a comment block above the `reset` helper: `// STATE ONLY — action methods are excluded to prevent silent store corruption. See Task #055.`
- Verify the type narrowing: `npx tsc --noEmit` must error if `reset({ isPackUnlocked: () => true })` is passed (add as a `// @ts-expect-error` line to confirm the error is present, then remove the call).

**Done condition:** `grep -n "Partial<ReturnType" tests/entitlement.test.ts` returns zero hits. `npx tsc --noEmit` passes with the narrowed type. Verification gate green.

---

## Agent Memories

## Security Agent Memory (first 100 lines)

agent: security
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Auth / entitlement model:** Client-only. No server-side purchase verification. Entitlement state lives in Zustand and is mutable via DevTools. Owner decision: intentional for offline-first architecture. The Lemon Squeezy integration (`lib/entitlement.ts`) calls the LS API for activation/deactivation.

**Backup/restore:** `lib/importBackup.ts` handles full state import. Validation is thorough — regex, allowlist, `isFinite()` checks before any state mutation. Backup can restore paid entitlement without server re-verification (accepted risk).

**Trust boundaries:**
- Web: browser localStorage is user-controlled; URL parameters and stored values must be validated
- Desktop (Tauri): Rust process runs the interrupt scheduler; JS/Rust IPC errors must be surfaced
- No server trust boundary — all logic is client-side by design

**Key files in your stream:**
- `lib/importBackup.ts` — backup import with validation (upward import violation to fix)
- `lib/entitlement.ts` — Lemon Squeezy activation/deactivation (error sanitization needed)
- `store/entitlementStore.ts` — entitlement state (deprecated re-export to annotate)
- `app/settings/page.tsx` — settings UI including backup import (FileReader silent catch to fix)
- `components/EntitlementValidator.tsx` — entitlement check on load (mount test needed)

**Accepted risks (do NOT re-raise):**
- Client-only entitlement — mutable via DevTools, no HMAC (intentional)
- Backup import can restore paid entitlement without LS re-verification (intentional)

**Resolved findings:**
- Task #009: `console.warn` leaking raw LS error in EntitlementValidator — RESOLVED 2026-06-26.

**Open findings relevant to this stream:**
- `lib/importBackup.ts:14` — Rule 3 upward import (`@/store/migrations`). Stop-the-line violation.
- `lib/importBackup.ts:67` — truthy check `if (!data.srs)` allows non-null non-object to pass boundary.
- `lib/entitlement.ts:207` — `deactivateLicense` returns raw LS `res.error` to UI. Key-identifying info exposure.
- `app/settings/page.tsx:178` — FileReader `catch {}` discards error. Rule 8 violation.
- `store/entitlementStore.ts:26-27` — `ALL_KNOWN_PACKS` re-export has no `@deprecated` annotation.
- `tests/entitlement.test.ts` — `reset()` helper accepts action methods (type too wide).

## QA Agent Memory (first 100 lines)

agent: qa
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Test framework:** Vitest 4 with `vi.mock`, `vi.fn`, `vi.spyOn`. Config in `vitest.config.ts`.
**Test locations:** All tests live under `tests/` (flat, not co-located).
**Current test count:** 310 tests across 16 test files.
**Coverage baseline (2026-06-26):** stmts=83.49%, branches=80.23%, functions=80.82%, lines=85.37%.

**Open findings relevant to this stream:**
- `components/EntitlementValidator.tsx` — no co-located test file (Rule 14 violation). Task #054 adds the mount test.
- `tests/entitlement.test.ts` — `reset()` helper typed too broadly (Task #055).
- `tests/entitlement.test.ts` — `activateLicense` ok:true path entirely untested (happy path of primary business function). Note: not in this stream's tasks but be careful not to break it.
- `lib/entitlement.ts:53` — extract ERR_ACTIVATE_NETWORK / ERR_DEACTIVATE_NETWORK and pin in tests (Task #053).

**Mock quality:** `vi.mock("@/lib/tauri")` in `entitlement.test.ts` — correct; tests real parsing logic.

**Critical paths touching your files:**
- `parseBackup → useSRSStore.setState → getDueCards` — restore path (no seam test currently).
- Entitlement grant logic — `licenseType` + `unlockedPacks[]` interaction.

**Recurring QA anti-pattern to avoid:** Vacuous `toBeTruthy()` assertions on string or object values. Use exact value assertions.

## Done When
All 8 tasks complete when each Skill({ skill: "task" }) call confirms done-when met.
Write your completion summary to `.autocode/stream-W1C/completion.md`:

```
Tasks closed: [list task numbers that reached COMPLETE status]
Tasks NOT completed: [list task number + done-when condition that failed]
Debt entries logged: [count of rows appended to your .autocode/stream-W1C/debt.md]
Carry-forward tasks generated: [count of new ### Task # blocks added to your tasks.md]
```
