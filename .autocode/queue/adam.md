---
status: done
agent: adam
stream: W1A
wave: 1
---

# Adam — Stream W1A — Wave 1 — 2026-07-01

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #173

You are Adam, a CTO working on a specific task in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #173  — Extract sha256Hex + packUrl helpers to lib/utils.ts

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W1A
[✓] #173 — Extract sha256Hex + packUrl helpers to lib/utils.ts   ← done

Then tell Max: "Adam is done."

## Files You Own (edit ONLY these)
lib/utils.ts
lib/packLoader.ts
lib/specialtyPackLoader.ts
tests/utils.test.ts  (for the sha256Hex known-answer test vector)

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/stats/page.tsx
components/StatsProGate.tsx
components/StatsProGate.test.tsx
app/page.test.tsx
app/settings/page.test.tsx
app/study/page.test.tsx

## Task Definitions

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

## Agent Memories

## Architecture Agent Memory (first 150 lines)

# Architecture Agent Memory — plyglt

## Stack
Next.js 16.2.9, React 19, Zustand 5, Tauri 2 (desktop + web). TypeScript throughout.

## Layer Structure (dependencies flow strictly down)
- `app/` — Next.js routes. LIMIT: ≤150 lines. All pages within limit: page=107, study=150, learn=130, stats=146, settings=150.
- `components/` — React UI components. All within limits.
- `hooks/` — Custom React hooks. Own session management contract.
- `store/` — Zustand stores (srsStore, settingsStore, entitlementStore). Imports from lib/.
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.
- `content/` — Static card data and type definitions.

## Key Files and Blast Radius
High blast-radius (many importers — touch carefully):
1. `store/srsStore.ts` — 20 files
2. Entitlement cluster (`lib/entitlement.ts` + `lib/checkout.ts` + `store/entitlementStore.ts`) — 26 files combined
3. `lib/langRegistry.ts` — 20 importers
4. `lib/packLoader.ts` — 5 importers
5. `lib/srs.ts` — 13 importers
6. `lib/tauri.ts` — 8 importers (151 lines — note only)
7. `lib/constants.ts` — 8 importers

## Important Modules (as of Batch 9 COMPLETE)
- `lib/utils.ts` — pure utilities; exports `localDateStr(d?)` for local-time ISO date strings. Used by useStudySession, lib/queue.ts.
- `lib/packLoader.ts` — 5 importers. RULE 1 RESOLVED (Task #156): reduced 426→363 lines. Specialty pack logic extracted to `lib/specialtyPackLoader.ts`.
- `lib/specialtyPackLoader.ts` — NEW (Task #156). Handles specialty pack merge path.

## M2 Readiness State (Batch 10)
- LS store: LIVE — Task #120 COMPLETE. Real annual checkout URL. Monthly pricing removed; annual-only ($34.99/yr). CHECKOUT_URLS.monthly removed; only CHECKOUT_URLS.annual exists.
- Task #121 COMPLETE: real ed25519 pubkey in tauri.conf.json.

## NEW FINDINGS RUN 9 (2026-07-01) — CURRENT SPRINT CONTEXT
1. **POKA-YOKE VIOLATION: duplicate sha256Hex** — `lib/packLoader.ts:94` and `lib/specialtyPackLoader.ts:21` define identical `sha256Hex(text)` implementations. Must be extracted to `lib/utils.ts`. THIS IS YOUR TASK.
2. **POKA-YOKE VIOLATION: duplicate packUrl** — `lib/packLoader.ts:141` and `lib/specialtyPackLoader.ts:17` define identical `packUrl(lang)` functions. Same fix.
3. **TYPE-CIRCULAR DEPENDENCY** — `lib/specialtyPackLoader.ts:9` imports `Pack`, `LoadPackResult`, `Manifest` types from `lib/packLoader.ts`; `lib/packLoader.ts:32` imports functions from `lib/specialtyPackLoader.ts`. This is a separate Task #175 that BLOCKS on YOUR task completing first.

## Critical Rule: lib/ must never import from store/, hooks/, components/, or app/.
## lib/utils.ts is a pure utility module — keep it free of framework dependencies.

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done."

— Adam | W1A | #173
