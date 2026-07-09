# Adam — Stream W8A — Wave 8 — 2026-07-09

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W8A | #263 #264 #265 #286 #288 #290

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #263 — clearEntitlement never clears specialty cache on deactivation
2. /task #286 — purchaseAddOn's name/comment imply verified purchase recording; it has neither
3. /task #288 — purchaseAddOn / Zustand persist last-write-wins race across tabs
4. /task #264 — specialtyPackLoader same-code and cross-code concurrent-load races
5. /task #265 — sha256 verification silently skipped when manifest entry absent (fail-open)
6. /task #290 — file header claims "Pure functions only" but performs I/O and mutates module state

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W8A
[✓] #263 — clearEntitlement never clears specialty cache   ← done
[→] #286 — purchaseAddOn is an unverified stub   ← starting now
[ ] #288 — Zustand persist race across tabs
[ ] #264 — concurrent-load races in loadSpecialtyPack
[ ] #265 — sha256 verification skippable
[ ] #290 — file header lies about purity

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
store/entitlementStore.ts
lib/specialtyPackLoader.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
lib/packLoader.ts
components/LanguageGrid.tsx
lib/constants.ts
lib/entitlement.ts
lib/langRegistry.ts
store/migrations.ts
tests/langRegistry.test.ts
lib/language.ts
lib/packTypes.ts

## Task Definitions

### Task #263: Fix security: clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearS

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
clearEntitlement resets purchasedAddOns to [] but never calls clearSpecialtyCache()/clearSpecialtyPacksForLang(). A license deactivation mid-session leaves already-merged specialty content fully accessible in memCache for the rest of the session; loadedAddOns never resyncs with the store. at store/entitlementStore.ts:clearEntitlement:111.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at store/entitlementStore.ts:clearEntitlement:111
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F003 — severity 7 — security

---

### Task #286: Fix requirements: purchaseAddOn's name and its own comment imply a verified purchase-recording function; the

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
purchaseAddOn's name and its own comment imply a verified purchase-recording function; the implementation has no Promise return, no payment token, no verification, and has zero production callers anywhere, even as a stub. at store/entitlementStore.ts:purchaseAddOn:140.
NEW

**Acceptance Criteria:**
- [ ] Fix requirements issue at store/entitlementStore.ts:purchaseAddOn:140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F026 — severity 5 — requirements

---

### Task #288: Fix async: Zustand's persist middleware writes localStorage from in-memory state at call time, not me

**File:** store/entitlementStore.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Zustand's persist middleware writes localStorage from in-memory state at call time, not merged against the on-disk value. Two browser tabs racing on purchaseAddOn for different specialty codes causes the second tab's write to silently overwrite and drop the first tab's purchase. at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at store/entitlementStore.ts:purchaseAddOn (Zustand persist):140
- [ ] Audit passes: bash scripts/deep-audit.sh store/entitlementStore.ts

**Source:** Audit finding F028 — severity 6 — async

---

### Task #264: Fix async: Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before eit

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P2
**Status:** OPEN

**What:**
Two race conditions: same-code concurrent loads both pass loadedAddOns.includes before either pushes (duplicate merge); cross-code concurrent loads sharing a base language each read the base pack independently after their own await, and whichever memCache.merge() resolves last silently discards the other's merge while getLoadedAddOns() reports both as loaded. No locking, mutex, or CAS exists anywhere in this module. at lib/specialtyPackLoader.ts:loadSpecialtyPack:67.
NEW

**Acceptance Criteria:**
- [ ] Fix async issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:67
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F004 — severity 7 — async

---

### Task #265: Fix security: sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.p

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P1
**Status:** OPEN

**What:**
sha256 verification is skipped entirely, with no fail-closed else branch, when manifest?.packs?.[lang] is absent for the requested specialty code. Arbitrary content is parsed and merged into the base pack's in-memory cache with zero integrity check. at lib/specialtyPackLoader.ts:loadSpecialtyPack:45.
NEW

**Acceptance Criteria:**
- [ ] Fix security issue at lib/specialtyPackLoader.ts:loadSpecialtyPack:45
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F005 — severity 8 — security

---

### Task #290: Fix code-quality: The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack

**File:** lib/specialtyPackLoader.ts
**Complexity:** ⚡ Direct — 1 file, single-scope fix
**Owner:** —
**Blocked by:** Nothing
**Priority:** P3
**Status:** OPEN

**What:**
The file header claims 'Pure functions only - no React, no Zustand', but loadSpecialtyPack performs fetch() I/O, console.error() side effects, and mutates module-level loadedAddOns via push/splice/length-reset. at lib/specialtyPackLoader.ts:N/A (file header):1.
NEW

**Acceptance Criteria:**
- [ ] Fix code-quality issue at lib/specialtyPackLoader.ts:N/A (file header):1
- [ ] Audit passes: bash scripts/deep-audit.sh lib/specialtyPackLoader.ts

**Source:** Audit finding F030 — severity 3 — code-quality

---

## Agent Memories

## Security Agent Memory (first 100 lines)
# Security Agent Memory — plyglt

## Trust Boundaries
1. Lemon Squeezy API response (via Tauri IPC) → `lib/entitlement.ts` — `raw as LsActivateBody` structural cast only; field-presence checks guard happy path but do not reject unexpected types.
2. User-supplied license key → `hooks/useLicenseActivation.ts:21` → forwarded to LS API. After Task #098: length cap (200 chars) + alphanumeric+hyphen allowlist.
3. Persisted Zustand store (localStorage / Tauri store) → hydrated without runtime type validation; used in pack-unlock decisions.
4. Pack JSON from network → `lib/packLoader.ts` — SHA-256 verified before use. Integrity check is correct and robust.
5. Tauri IPC commands → `lib/tauri.ts:invoke()` — cmd is always a hardcoded string literal; Tauri backend uses `generate_handler![]` allowlist. No injection surface.
6. Update manifest from endpoint → `src-tauri/tauri.conf.json:46` — REAL ed25519/minisign pubkey in place (Task #121 COMPLETE).

## Intentional Design (do not raise as findings)
- Client-only entitlement — honor-system, no server-side verification. Decision 2026-06-24.
- No webhook endpoint — manual key activation by design.
- Interrupt engine ungated (free users can enable) — owner decision 2026-06-29.
- Spanish pack (es.json) hidden by ready:false — intentional; content not ready.

Relevant open note (Batch 12 audit, this wave's source): S1/S2 in this file already flagged
`purchaseAddOn` accepting unvalidated codes and the specialty-pack sha256-skip gap as dormant
risk while SPECIALTY_PACKS was empty — that dormancy argument is explicitly NOT a valid reason
to reduce severity; the standard applies to the code as written. Fix both for real in #265/#286.

## Architect Agent Memory (first 100 lines)
# Architecture Agent Memory — plyglt

## Layer Structure (dependencies flow strictly down)
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.
- `store/` — Zustand stores (srsStore, settingsStore, entitlementStore). Imports from lib/.

## Key Files and Blast Radius
- Entitlement cluster (`lib/entitlement.ts` + `lib/checkout.ts` + `store/entitlementStore.ts`) — 26 files combined importers. Touch carefully.

## Specialty Pack Architecture (Batch 12)
- `store/entitlementStore.ts` — owns `purchasedAddOns: string[]`, `hasAddOn(code)`, `purchaseAddOn(code)` (currently an idempotent no-op stub — this is exactly what #286 fixes), `clearEntitlement` (currently does NOT clear specialty cache — this is exactly what #263 fixes).
- `lib/specialtyPackLoader.ts` — Task #156: extracted from packLoader.ts (116 lines then; has grown since). Owns `loadedAddOns` module-level array, `loadSpecialtyPack()`, `getLoadedAddOns()`, `clearSpecialtyPacksForLang()`.

## Notes for this wave
This is the remediation wave following the first-ever standalone audit of Batch 12 (2026-07-09,
8-agent parallel review, FAIL verdict, severity 8). All 7 scored auditors independently converged
on: entitlement enforcement for specialty packs exists nowhere in the data layer, only in a UI
onClick gate. Your 6 tasks here are NOT that root-cause fix (that's Task #261, deferred — blocked
on Task #262 which lands in stream W8C this same wave) — they are adjacent, independently real
defects found in the same two files: entitlementStore.ts's own bookkeeping integrity
(clearEntitlement, purchaseAddOn, the persist race) and specialtyPackLoader.ts's own robustness
(concurrent-load races, the sha256 skip-when-manifest-absent gap, and a false file-header claim).
Fix each on its own merits — don't try to wire in the cross-cutting entitlement-gate fix yourself;
that's explicitly out of scope for this stream and lands in Task #261 next wave.

Two tasks are already deferred to next wave BECAUSE of what you do here — do not start them:
#285 and #287 are blocked on your #286 (purchaseAddOn rewrite) landing first, since they validate
against/build on whatever new (likely async) signature you give it. Leave a clear comment or
completion note describing purchaseAddOn's new contract so next wave's builder can pick it up.

## When You Finish
Write your completion summary to .autocode/stream-W8A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Also note in that file: the exact new signature/contract of purchaseAddOn after #286 (e.g.
"now async, returns Promise<boolean>, takes (code, receiptToken)") — the next wave's stream
touching #285/#287 needs this to build against the real contract, not guess at it.

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W8A | #263 #264 #265 #286 #288 #290
