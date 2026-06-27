# Derek — Stream W1D — Wave 1 — 2026-06-26

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Derek | W1D | #029

You are Derek, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #029  — Add feature flag system (Rule 4)

STATUS BOARD RULE — MANDATORY: After completing your task, print your status board:

Derek — W1D
[✓] #029 — Add feature flag system   ← done

## Files You Own (edit ONLY these)
lib/featureFlags.ts             ← new file to create
next.config.ts
components/InterruptHandler.tsx

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/learn/page.tsx              ← W1A owns this
app/study/page.tsx              ← W1A owns this
store/srsStore.ts               ← W1A owns this
components/UnitRow.tsx          ← W1A owns this
lib/cardLabels.ts               ← W1A owns this
components/Stat.tsx             ← W1A owns this
app/settings/page.tsx           ← W1B owns this
lib/exportBackup.ts             ← W1B owns this
components/settings/Section.tsx ← W1B owns this
components/settings/Toggle.tsx  ← W1B owns this
hooks/useExportImport.ts        ← W1B owns this
hooks/useLicenseActivation.ts   ← W1B owns this
lib/srs.ts                      ← W1C owns this
lib/answerCheck.ts              ← W1C owns this
lib/language.ts                 ← W1C owns this
components/StudyCard.tsx        ← W1C owns this

## Task Definitions

### Task #029 | Add feature flag system (Rule 4)
**Severity:** 5 | **File(s):** `lib/` (new file), `next.config.ts`, `components/InterruptHandler.tsx`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "new feature" keyword, 4 files (lib/featureFlags.ts, next.config.ts, components/InterruptHandler.tsx, tests/featureFlags.test.ts)

No feature flag system exists. Rule 4: every new feature must be toggleable off. This blocks shipping the proactive interruption engine, vacation mode, analytics, and any Pro feature safely behind a flag.

**Changes required:**

1. Create `lib/featureFlags.ts`:
   ```ts
   export interface FeatureFlags {
     interruptEngine: boolean;
     vacationMode: boolean;
     analytics: boolean;
   }

   export function getFeatureFlags(): FeatureFlags {
     return {
       interruptEngine: process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE !== "false",
       vacationMode: process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE !== "false",
       analytics: process.env.NEXT_PUBLIC_FLAGS_ANALYTICS !== "false",
     };
   }
   ```
   Flag default: TRUE when env var is absent (feature on by default). Explicit "false" turns it off.
   This matches Next.js static replacement via NEXT_PUBLIC_ prefix.

2. `next.config.ts` — read the current file first (it is only 10 lines). Add a comment documenting the flag env vars:
   ```ts
   // Feature flags — set to "false" to disable:
   // NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE — proactive desktop interrupt sessions
   // NEXT_PUBLIC_FLAGS_VACATION_MODE    — redistribute overdue cards on return
   // NEXT_PUBLIC_FLAGS_ANALYTICS        — session timing and retention metrics
   ```
   Do not restructure next.config.ts beyond adding this comment block.

3. `components/InterruptHandler.tsx` — read the current file first (101 lines). Gate the interrupt listener registration behind the flag:
   ```ts
   import { getFeatureFlags } from "@/lib/featureFlags";

   export function InterruptHandler() {
     const flags = getFeatureFlags();
     if (!flags.interruptEngine) return null;
     // ... existing interrupt listener logic
   }
   ```
   Add the flag check as the FIRST thing in the component body, before any hooks.
   IMPORTANT: Do not break the existing IPC listener logic. The known sev-4 finding in this file
   (validateLicense .then() has no .catch()) should be noted in debt.md if you see it but
   do NOT fix it — that's a separate task. Stay in scope.

**Test required (write first):**
- `tests/featureFlags.test.ts`:
  ```ts
  // Test with env var absent → default true
  it("interruptEngine defaults to true when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE;
    expect(getFeatureFlags().interruptEngine).toBe(true);
  });

  // Test explicit "false" → false
  it("interruptEngine is false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = "false";
    expect(getFeatureFlags().interruptEngine).toBe(false);
    delete process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE;
  });

  // Test getFeatureFlags returns all required flags
  it("getFeatureFlags returns all required FeatureFlags fields", () => {
    const flags = getFeatureFlags();
    expect(typeof flags.interruptEngine).toBe("boolean");
    expect(typeof flags.vacationMode).toBe("boolean");
    expect(typeof flags.analytics).toBe("boolean");
  });
  ```

**Done condition:** `lib/featureFlags.ts` exists. `tests/featureFlags.test.ts` passes (all 3 assertions). `components/InterruptHandler.tsx` reads the flag and returns null when disabled. Verification gate green.

## Agent Memories

### Architecture Agent Memory

---
agent: architect
last-updated: 2026-06-26
---

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Desktop app via Tauri; web routes via Next.js App Router.

**Layer rule for lib/featureFlags.ts:**
- `lib/` is the pure utilities layer. lib/featureFlags.ts must NOT import from store/, hooks/, or components/.
- It CAN import from nothing (no dependencies needed — just reads process.env).
- Callers (components, hooks, routes) import from lib/featureFlags.ts, not the reverse.

**Open finding in components/InterruptHandler.tsx:**
- sev:4 — `validateLicense .then()` has no `.catch()` — unhandled rejection on IPC error.
  LOG THIS IN .autocode/stream-W1D/debt.md but do NOT fix it. It is out of scope for #029.
  Format: `| 2026-06-27 | Task #029 | async | components/InterruptHandler.tsx | validateLicense .then() has no .catch() — unhandled rejection on IPC error | 4 | Direct | Out of scope for #029 — stay focused |`

**Next.js static replacement note:**
NEXT_PUBLIC_ env vars are inlined at build time by Next.js. getFeatureFlags() will return
compile-time constants in production builds — not runtime reads. This is intentional and correct
for feature flags. Tests run in Node.js (vitest) where process.env is mutable, so the test
pattern (set env, call function, assert, delete env) works correctly.

**Rule 4 — Feature flag system** (codebase-wide open finding):
Your task closes this codebase-wide gap. After #029, every future feature (interrupt engine,
vacation mode, analytics) has a path to ship behind a flag. The interruptEngine flag you create
is the first real consumer.

## When You Finish
Write your completion summary to .autocode/stream-W1D/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Derek is done." (or describe what's incomplete).

— Derek | W1D | #029
