# Stream W1B Brief — /advance Wave 1 — 2026-06-26

## Your Role
You are a child CTO executing Wave 1, Stream B of a parallel /advance session.
Work exclusively on the files listed in "Files You Own". MUST NOT modify any other file.

## STREAM_ID
Your STREAM_ID is: W1B
Your stream's tasks.md has been pre-populated at `.autocode/stream-W1B/tasks.md`.

## Execution Order
Run in this exact order (blockers first):

1. Skill({ skill: "task", args: "#013" })  — Make rateCard + saveActiveSession atomic in srsStore
2. Skill({ skill: "task", args: "#004" })  — Fix silent IPC failure — updateInterruptConfig
3. Skill({ skill: "task", args: "#005" })  — Fix silent IPC failure — snoozeInterrupt
4. Skill({ skill: "task", args: "#006" })  — Fix silent catch — notification plugin in InterruptHandler
5. Skill({ skill: "task", args: "#056" })  — Add test for setTargetLangCode in lib/constants.ts
6. Skill({ skill: "task", args: "#058" })  — Replace static USED BY list with grep reference

## Files You Own (edit ONLY these)
lib/tauri.ts
components/InterruptHandler.tsx
store/srsStore.ts
app/study/page.tsx
lib/constants.ts
tests/srsStore.test.ts

## Off-Limits Files (DO NOT MODIFY — owned by other streams this wave)
hooks/useLangPack.ts                  (W1A)
lib/langRegistry.ts                   (W1A)
lib/packLoader.ts                     (W1A)
tests/packLoader.test.ts              (W1A)
tests/langRegistry.test.ts            (W1A)
tests/useLangPack.test.ts             (W1A)
lib/importBackup.ts                   (W1C)
app/settings/page.tsx                 (W1C)
lib/entitlement.ts                    (W1C)
store/entitlementStore.ts             (W1C)
components/EntitlementValidator.test.tsx  (W1C)
tests/entitlement.test.ts             (W1C)
lib/srs.ts                            (W1D)
app/decks/                            (W1D)
vitest.config.ts                      (W1D)

## Task Definitions

### Task #013 | Make rateCard + saveActiveSession atomic in srsStore
**Severity:** 8 — CRITICAL | **File(s):** `store/srsStore.ts:95-101`, `app/study/page.tsx:207-237`
**DoD Tier:** 2

`rateCard` (line 95-99) and `saveActiveSession` (line 101) are two separate Zustand `set()` calls. In `handleRate` (study/page.tsx:207-237), they are called sequentially: `rateCard(...)` at line 208, then `saveActiveSession(...)` at line 225. If the process crashes or the tab closes between these two calls, the card is rated but the session position is not updated — creating a state where the card was graded but the session resumes from the wrong position (the card will be graded again on resume).

**Changes required:**
1. `store/srsStore.ts` — add a new combined action `rateCardAndSaveSession(cardId: string, grade: Grade, session: ActiveSession): void` that performs a single `set()` call updating both `cards` and `activeSession` atomically:
   ```ts
   rateCardAndSaveSession: (cardId, grade, session) => {
     const prev = get().getProgress(cardId);
     const next = scheduleCard(prev, grade);
     set((s) => ({ cards: { ...s.cards, [cardId]: next }, activeSession: session }));
   },
   ```
   Add this to the `SRSState` interface.
2. `app/study/page.tsx:207-237` — replace the sequential `rateCard(currentCard.id, grade)` + `saveActiveSession({...})` calls with a single `rateCardAndSaveSession(currentCard.id, grade, { ... })`.
3. Keep `rateCard` and `saveActiveSession` as individual actions (they are used separately in other contexts), but `handleRate` must use only the atomic version.

**Test required (write first):**
- `tests/srsStore.test.ts` — add: after `rateCardAndSaveSession("card-1", "good", session)`, both `useSRSStore.getState().cards["card-1"]` and `useSRSStore.getState().activeSession` are updated in one tick. Assert the card's `reps` is incremented AND `activeSession.position` matches the session argument — both in the same snapshot.

**Done condition:** `grep -n "rateCard\b" app/study/page.tsx` shows only `rateCardAndSaveSession` in `handleRate`. `rateCard` standalone is not called in `handleRate`. Verification gate green.

---

### Task #004 | Fix silent IPC failure — updateInterruptConfig error must surface
**Severity:** 8 — CRITICAL | **File(s):** `lib/tauri.ts:58`
**DoD Tier:** 3-4

`updateInterruptConfig()` at line 58 calls `invoke(…).catch(() => {})` — silently discarding errors. If this IPC call fails, the user changes interrupt settings but the Rust scheduler ignores the change and continues firing. The user's setting appears to take effect but does not.

**Changes required:**
1. `lib/tauri.ts:52-59` — change `updateInterruptConfig` to `async` and await the invoke. On failure, log the error with a unique ref ID and re-throw so callers can surface it:
   ```ts
   export async function updateInterruptConfig(
     enabled: boolean,
     intervalHours: number,
     mandatory: boolean
   ): Promise<void> {
     if (!isTauri) return;
     const result = await invoke("update_interrupt_config", { enabled, intervalHours, mandatory });
     if (result === null) {
       const ref = `ERR-IPC-${Date.now()}`;
       console.error(`[${ref}] update_interrupt_config IPC failed — Rust scheduler not updated`);
       throw new Error(`Interrupt config IPC failed (${ref})`);
     }
   }
   ```
2. `components/InterruptHandler.tsx:21-23` — the `useEffect` that calls `updateInterruptConfig` must catch the thrown error and surface it to the user (e.g. set a store error state or console.error with the ref). At minimum: wrap in try/catch, log the ref. Do not swallow.

**Test required (write first):**
- `tests/tauri.test.ts` — add: when `invoke` returns null (mocked), `updateInterruptConfig(true, 1, false)` rejects with an error message containing `"IPC failed"`.

**Done condition:** `lib/tauri.ts:58` no longer has `.catch(() => {})`. Verification gate green.

---

### Task #005 | Fix silent IPC failure — snoozeInterrupt error must surface
**Severity:** 8 — CRITICAL | **File(s):** `lib/tauri.ts:64`
**DoD Tier:** 3-4

`snoozeInterrupt()` at line 64 calls `invoke(…).catch(() => {})`. If IPC fails, the user presses Snooze but interrupts continue firing.

**Changes required:**
1. `lib/tauri.ts:62-65` — same pattern as #004. Make async, await invoke, on null result log with ref ID and re-throw.
2. `app/study/page.tsx:331-334` — the Snooze button calls `snoozeInterrupt(snoozeMinutes)` without awaiting. Change to `await snoozeInterrupt(snoozeMinutes)` inside the existing async arrow and wrap in try/catch to display a user-visible error (e.g. a console.error with ref ID and optionally a transient UI message).

**Test required (write first):**
- `tests/tauri.test.ts` — add: when `invoke` returns null, `snoozeInterrupt(5)` rejects with an error message containing `"IPC failed"`.

**Done condition:** `lib/tauri.ts:64` no longer has `.catch(() => {})`. Verification gate green.

---

### Task #006 | Fix silent catch — notification plugin in InterruptHandler
**Severity:** 6 | **File(s):** `components/InterruptHandler.tsx:73`
**DoD Tier:** 2
**Complexity: Direct**

The `catch {}` block at line 73 discards notification-plugin errors without logging. The comment says "Non-fatal" which is correct, but Rule 8 requires every error to get a unique timestamped ref ID.

**Changes required:**
1. `components/InterruptHandler.tsx:73-75` — change:
   ```ts
   } catch {
     // Non-fatal: notifications unavailable
   }
   ```
   to:
   ```ts
   } catch (err) {
     console.error(`[ERR-NOTIF-${Date.now()}] Notification plugin error:`, err);
   }
   ```

**Test required (write first):**
- `tests/tauri.test.ts` — add: when the notification plugin import throws, the error ref is logged (spy on `console.error`, assert it was called with a string matching `ERR-NOTIF-`).

**Done condition:** `grep -n "catch {" components/InterruptHandler.tsx` returns zero hits. Verification gate green.

---

### Task #056 | Add test for setTargetLangCode in lib/constants.ts
**Severity:** 3 — Low | **File(s):** `lib/constants.ts:setTargetLangCode:24`, `tests/srsStore.test.ts`
**DoD Tier:** 1
**Complexity: Direct**

Task #002 WorldClass accepted gap (-2 pts). When `lib/constants.ts` was created in Task #002, `getTargetLangCode` received 4 tests and `setTargetLangCode` received none. The asymmetry is visible in a pure-utility file where both functions are trivially testable.

**Changes required:**
1. `tests/srsStore.test.ts` — add a `describe("lib/constants — setTargetLangCode")` block:
   - `setTargetLangCode("fr")` writes `"en-fr"` under `LANG_PAIR_KEY` in `localStorage`.
   - `setTargetLangCode("it")` writes `"en-it"`.
   - Round-trip: `setTargetLangCode("fr")` then `getTargetLangCode()` returns `"fr"`.
   - SSR guard: calling `setTargetLangCode` when `window` is `undefined` does not throw.

**Test required (write first):** This task IS the tests.

**Done condition:** `grep -n "setTargetLangCode" tests/srsStore.test.ts` returns ≥4 hits. Verification gate green.

---

### Task #058 | Replace static USED BY list in lib/constants.ts header with grep reference
**Severity:** 2 — Low | **File(s):** `lib/constants.ts:9-10`
**DoD Tier:** 1
**Complexity: Direct**

Task #002 WorldClass accepted gap (-1 pt). The Rule 2 header in `lib/constants.ts` contains a hardcoded `USED BY:` importer list. This list silently goes stale whenever a new consumer is added without updating the header — the defect that Rule 2 headers are meant to prevent.

**Changes required:**
1. `lib/constants.ts:9-10` — replace:
   ```ts
   // USED BY: store/srsStore.ts, hooks/useLangPack.ts,
   //          app/learn/page.tsx, app/settings/page.tsx, app/page.tsx
   ```
   with:
   ```ts
   // USED BY: grep -r "from \"@/lib/constants\"" --include="*.ts" --include="*.tsx" .
   ```
   This makes the header self-maintaining: the grep command always returns the current live importer list.

**Test required (write first):**
- `tests/srsStore.test.ts` — add an import-graph seam test: the string `"USED BY: store/srsStore"` must NOT appear in `lib/constants.ts` (regression guard against the static list being restored).

**Done condition:** `grep -n "USED BY: store/srsStore" lib/constants.ts` returns zero hits. `grep -n "grep -r" lib/constants.ts` returns a hit. Verification gate green.

---

## Agent Memories

## Architect Agent Memory (first 150 lines)

agent: architect
last-updated: 2026-06-26
runs: 2

### Codebase Model

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Desktop app wrapped in Tauri; web routes served via Next.js App Router.

**Layer structure (top → bottom):**
- `app/` — Route pages (must stay ≤ 150 lines)
- `components/` — UI components with co-located `.test.tsx`
- `hooks/` — React hooks. Key: `useLangPack.ts`
- `store/` — Zustand stores. Key: `srsStore.ts` (9 importers), `settingsStore.ts`, `entitlementStore.ts`
- `lib/` — Pure utilities. Key: `tauri.ts`, `constants.ts`
- `content/` — Card data and types

**Blast-radius ranking:**
1. `lib/srs.ts` — 11 importers
3. `store/srsStore.ts` — 9 importers (highest in this stream)
4. `lib/storage.ts` — 7 importers
5. `lib/language.ts` — 6 importers

**Open findings relevant to this stream:**
- `lib/tauri.ts:46,58,64` — Rule 8 violation: `.catch(() => {})` silently swallows Tauri IPC errors. Severity HIGH for update_interrupt_config and snooze_interrupt.
- `components/InterruptHandler.tsx:29` — Rule 8 violation: `validateLicense .then()` has no `.catch()`. Unhandled rejection on IPC error.
- `components/InterruptHandler.tsx:73` — bare catch {}. Rule 8 violation.
- Upward import (RESOLVED Task #002): srsStore.ts imported from useLangPack.ts — fixed. Constants now in lib/constants.ts.
- Task #002 WorldClass gaps: `setTargetLangCode` untested (Task #056), USED BY list static (Task #058).
- `store/srsStore.ts:95-101` + `app/study/page.tsx:207-237` — rateCard and saveActiveSession not atomic. Data-loss risk on crash between calls.

**Silent catch pattern:** Found in at least 5 locations. Pattern: `.catch(() => {})` or `catch {}`. Every catch must propagate to UI state or log with `{MODULE}_{CODE}-{TIMESTAMP}` ref ID.

**Error Ref ID format:** `{MODULE}_{CODE}-{TIMESTAMP}` (e.g., `ERR-IPC-1719427200000`, `ERR-NOTIF-1719427200001`).

**Tauri IPC contract:**
- All IPC commands must be wrapped in try/catch or async/await with rejection handling.
- If invoke throws or returns null: log with ref ID + re-throw. Never swallow.
- `isTauri` guard: all tauri.ts functions must no-op safely when `!isTauri`.

**Zustand atomicity rule:**
- Multiple store mutations that must be consistent must use a single `set()` call.
- Never call multiple `set()` calls sequentially when a crash between them would corrupt persisted state.

## Done When
All 6 tasks complete when each Skill({ skill: "task" }) call confirms done-when met.
Write your completion summary to `.autocode/stream-W1B/completion.md`:

```
Tasks closed: [list task numbers that reached COMPLETE status]
Tasks NOT completed: [list task number + done-when condition that failed]
Debt entries logged: [count of rows appended to your .autocode/stream-W1B/debt.md]
Carry-forward tasks generated: [count of new ### Task # blocks added to your tasks.md]
```
