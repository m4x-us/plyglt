# Stream W4B Task State

### Task #235: Fix security: LANG_CONFIG_MAP's Object.freeze is shallow

**File:** lib/langRegistry.ts, lib/language.ts
**Complexity:** ⚡ Direct — 2 files
**Owner:** Security Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`Object.freeze(LANG_CONFIG_MAP)` (lib/langRegistry.ts:48-50, Task #186) only freezes the outer map object. The nested `LanguageConfig` objects (`ITALIAN`/`SPANISH` from lib/language.ts) and their `uiStrings`/`cardLabels` sub-objects remain fully mutable at runtime despite the `Readonly<>` type annotation implying full tamper-proofing — e.g. `LANG_CONFIG_MAP.it.articles = null` compiles and succeeds. Same class as the already-known F07 shallow-freeze gap. 4 of 8 auditors converged on this (S, A, B, Red R).

**Acceptance Criteria:**
- [ ] Deep-freeze `LANG_CONFIG_MAP`'s values (recursively freeze `ITALIAN`/`SPANISH` and their nested objects), or document explicitly why shallow freeze is an accepted trade-off given current low exploitability
- [ ] Add a test asserting a nested-field mutation attempt (e.g. `LANG_CONFIG_MAP.it.articles = null`) either throws (strict mode) or has no effect

**Done when:** A test attempts to mutate a nested field of `LANG_CONFIG_MAP.it` and asserts the original value is unchanged afterward. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — security — converged independently by Agents S, A, B, Red R.

---

### Task #236: Fix security: activateLicense's instanceId guard checks truthiness, not type

**File:** lib/entitlement.ts
**Complexity:** ⚡ Direct — 1 file
**Owner:** Security Agent
**Blocked by:** Nothing
**Priority:** P2

**What:**
`activateLicense`'s guard `if (!res.instance?.id)` (lib/entitlement.ts:139, Task #185) checks truthiness only, not type. `res` is an untyped `raw as LsActivateBody` cast with no runtime schema validation. A response shaped like `instance: { id: 123 }` (a number, not a string) passes this guard, then gets assigned to the `instanceId: string` field of the returned `ActivateResult`, violating the function's own return type contract, and is persisted into the entitlement store and later passed back to `deactivateLicense` as if it were a real string. Found by Red Agent R.

**Acceptance Criteria:**
- [ ] Change the guard to `if (!res.instance?.id || typeof res.instance.id !== "string")` (or equivalent runtime type check)
- [ ] Add a test asserting `activateLicense` rejects a response where `instance.id` is a number

**Done when:** A test with `instance: { id: 123 }` (number, not string) asserts `activateLicense` returns an error result, not a persisted numeric instanceId. Verification gate green.

**Source:** Audit finding (Batch 18 batch-level audit, 2026-07-07) — severity 5 — security — found by Red Agent R.
