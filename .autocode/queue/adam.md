---
status: done
agent: adam
stream: W2A
wave: 2
---

# Adam — Stream W2A — Wave 2 — 2026-07-02

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W2A | #175

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #175  — Extract shared pack types to lib/packTypes.ts (break circular dependency)

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W2A
[→] #175 — Extract shared pack types to lib/packTypes.ts   ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
lib/packTypes.ts  (new — create this file)
lib/packLoader.ts
lib/specialtyPackLoader.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
src-tauri/src/lib.rs
src-tauri/src/interrupt.rs
src-tauri/src/license.rs

## Task Definitions

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

## Agent Memories

## Architecture Agent Memory (first 150 lines)
# Architecture Agent Memory — plyglt

## Stack
Next.js 16.2.9, React 19, Zustand 5, Tauri 2 (desktop + web). TypeScript throughout.

## Layer Structure (dependencies flow strictly down)
- `app/` — Next.js routes. LIMIT: ≤150 lines. All pages within limit.
- `components/` — React UI components.
- `hooks/` — Custom React hooks.
- `store/` — Zustand stores. Imports from lib/.
- `lib/` — Pure utilities. No React, no Zustand imports. Must NEVER import from store/, hooks/, components/, app/.
- `content/` — Static card data and type definitions.

## Key Files
High blast-radius (touch carefully):
1. `store/srsStore.ts` — 20 importers
2. Entitlement cluster — 26 files combined
3. `lib/langRegistry.ts` — 20 importers
4. `lib/packLoader.ts` — 5 importers
5. `lib/srs.ts` — 13 importers
6. `lib/tauri.ts` — 8 importers
7. `lib/constants.ts` — 8 importers

## Important Modules
- `lib/utils.ts` — pure utilities; exports `localDateStr(d?)`, `sha256Hex(text)`, `packUrl(lang)`.
  After Task #173 (W1A, Wave 1), sha256Hex and packUrl were extracted here from packLoader.ts
  and specialtyPackLoader.ts. Both packLoader.ts:33 and specialtyPackLoader.ts:11 now
  import from "@/lib/utils".

## Prior Wave Changes — Read Before Starting

W1A (Wave 1, Adam) modified these files while closing Task #173:

lib/utils.ts — ADDED sha256Hex(text: string): Promise<string> and packUrl(lang: string): string.
  These were previously defined identically in both packLoader.ts and specialtyPackLoader.ts.
  They now exist only in lib/utils.ts.

lib/packLoader.ts — line 33: changed from `import { packUrl }` (local impl) to
  `import { sha256Hex, packUrl } from "@/lib/utils"`. Removed the local sha256Hex
  and packUrl function bodies. Types still defined here: PackMeta (line 38),
  Manifest (line 47), Pack (line 53), CachedPackMeta (line 66), LoadPackResult (line 154).

lib/specialtyPackLoader.ts — line 9: still imports `Pack, LoadPackResult, Manifest`
  from "@/lib/packLoader". Line 11: imports `sha256Hex, packUrl` from "@/lib/utils".

Your task (#175) is to move the 5 type definitions OUT of packLoader.ts and INTO
the new lib/packTypes.ts file. After you're done:
  - packLoader.ts should import its own types from "@/lib/packTypes"
  - specialtyPackLoader.ts should import types from "@/lib/packTypes" instead of "@/lib/packLoader"
  - CachedPackMeta can remain private (unexported) in packLoader.ts if you prefer,
    OR move it to packTypes.ts — your judgment; it's only used in packLoader.ts.

The 5 types to extract (current locations in packLoader.ts):
  PackMeta    — line 38–45 (exported)
  Manifest    — line 47–51 (exported)
  Pack        — line 53–64 (exported)
  CachedPackMeta — line 66–70 (unexported — used only inside packLoader.ts)
  LoadPackResult — line 154–165 (exported union type)

Rule 2 header required on lib/packTypes.ts (2–3 sentences describing ownership).

## When You Finish
Write your completion summary to .autocode/stream-W2A/completion.md:
  Tasks closed: [list task numbers]
  Tasks NOT completed: [list + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done." (or describe what's incomplete).

— Adam | W2A | #175
