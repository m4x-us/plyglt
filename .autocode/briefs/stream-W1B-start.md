# Barry — Stream W1B — Wave 1 — 2026-06-26

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #028 #026

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #028  — Extract exportBackup logic to lib/exportBackup.ts
2. /task #026  — Extract Section, Toggle, and schedule DnD UI from app/settings/page.tsx (Rule 1)

CRITICAL EXECUTION ORDER: You MUST complete #028 before starting #026.
Task #026 creates hooks/useExportImport.ts which calls exportBackup() from lib/exportBackup.ts.
If you write useExportImport.ts before lib/exportBackup.ts exists, the import will fail.

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W1B
[✓] #028 — Extract exportBackup logic to lib/exportBackup.ts   ← done
[→] #026 — Extract Section, Toggle, settings page split         ← starting now

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
app/settings/page.tsx
lib/exportBackup.ts             ← new file to create
components/settings/Section.tsx ← new file to create
components/settings/Toggle.tsx  ← new file to create
hooks/useExportImport.ts        ← new file to create
hooks/useLicenseActivation.ts   ← new file to create

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
app/learn/page.tsx              ← W1A owns this
app/study/page.tsx              ← W1A owns this
store/srsStore.ts               ← W1A owns this
components/UnitRow.tsx          ← W1A owns this
lib/cardLabels.ts               ← W1A owns this
components/Stat.tsx             ← W1A owns this
lib/srs.ts                      ← W1C owns this
lib/answerCheck.ts              ← W1C owns this
lib/language.ts                 ← W1C owns this
components/StudyCard.tsx        ← W1C owns this
lib/featureFlags.ts             ← W1D owns this
next.config.ts                  ← W1D owns this
components/InterruptHandler.tsx ← W1D owns this

## Task Definitions

### Task #028 | Extract exportBackup logic to lib/exportBackup.ts
**Severity:** 4 | **File(s):** `app/settings/page.tsx:114-145` (inline in page)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/settings/page.tsx, lib/exportBackup.ts, tests/exportBackup.test.ts)

The export logic (`handleExport` function) is embedded in the settings page. It reads store state and constructs a JSON blob — a service-layer concern, not a route concern.

**Changes required:**
1. Create `lib/exportBackup.ts` — move the export payload construction logic into:
   ```ts
   export function exportBackup(
     srsState: SRSState,
     entitlementState: EntitlementState,
     langPair: string
   ): string
   ```
   Returns the JSON string. The DOM manipulation (create `<a>`, click, revoke) stays in the hook.
   
   IMPORTANT: The magic number `_version: 2` must be replaced with `_version: CURRENT_BACKUP_VERSION`
   imported from `lib/importBackup.ts` (known sev-5 finding from prior audit). Read importBackup.ts
   to find CURRENT_BACKUP_VERSION.

2. `app/settings/page.tsx` — replace inline handleExport with a call to exportBackup() for now.
   (The hook extraction happens in #026.)

**Test required (write first):**
- `tests/exportBackup.test.ts`:
  - `exportBackup(srsState, entitlementState, "en-it")` returns parseable JSON
  - Result contains `_version: CURRENT_BACKUP_VERSION`
  - Result contains `langPair: "en-it"`
  - Result contains `srs.cards` key

**Done condition:** `lib/exportBackup.ts` exists. `tests/exportBackup.test.ts` passes. No magic `_version: 2` literal in exportBackup.ts. Verification gate green.

---

### Task #026 | Extract Section, Toggle, and schedule DnD UI from app/settings/page.tsx (Rule 1)
**Severity:** 5 | **File(s):** `app/settings/page.tsx` (516 lines — 3.4× the 150-line route limit)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 5 files

app/settings/page.tsx at 516 lines is the worst file-size violation in the codebase. Extract:

**Changes required:**
1. `components/settings/Section.tsx` — extract the Section UI primitive (search the file for its inline definition).
2. `components/settings/Toggle.tsx` — extract the Toggle UI primitive (also inline in settings page).
3. `hooks/useExportImport.ts` — extract `handleExport`, `handleImportFile`, and the `dataStatus` state:
   - Call `exportBackup()` from `lib/exportBackup.ts` (you created this in #028)
   - All FileReader logic goes here
4. `hooks/useLicenseActivation.ts` — extract `handleActivate`, `handleValidate`, `handleDeactivate`, `licenseInput`, and `licenseStatus` state:
   - CRITICAL: All Tauri IPC calls (invoke) MUST be wrapped in try/catch with ERR-ref logging.
     Pattern: `catch (err) { console.error(\`[ERR-LICENSE-${Date.now()}] ...\`, err); setLicenseStatus(...) }`
   - Known sev-7 finding: if invoke throws, licenseStatus stays stuck in {type:"loading"} with no user feedback.
     Fix this while extracting — the hook should always resolve licenseStatus to a non-loading state.
   - Known sev-6 finding: licenseKey and instanceId captured from Zustand at mount time may be null
     if persist middleware hasn't hydrated yet. Use `useEntitlementStore.getState()` inside the effect
     instead of reading from the component's reactive state.
5. `app/settings/page.tsx` — consume the extracted hooks and components. Target: ≤ 150 lines.

**Test required (write first):**
- `components/settings/Toggle.test.tsx` — renders label, fires onChange when clicked.
- `hooks/useExportImport.test.ts` — handleExport creates a download link (mock document.createElement). handleImportFile calls parseBackup on file content.

**Done condition:** `app/settings/page.tsx` ≤ 150 lines. All extracted files exist. Verification gate green.

## Agent Memories

### Architecture Agent Memory

---
agent: architect
last-updated: 2026-06-26
---

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2.

**Layer structure (top → bottom):**
- `app/` — Route pages (must stay ≤ 150 lines)
- `components/` — UI components with co-located `.test.tsx`
- `hooks/` — React hooks
- `store/` — Zustand stores
- `lib/` — Pure utilities

**Open findings in app/settings/page.tsx (your primary target):**
- sev:7 — `handleActivate:59` + `handleValidate:78` — no try/catch around invoke calls. If invoke throws, licenseStatus stays stuck in {type:"loading"}, UI permanently disabled with no user feedback. Fix this while extracting to useLicenseActivation.ts.
- sev:7 — `handleLaunchAtLogin:102` — no try/catch. setLaunchAtLogin fires before Tauri call. If enableAutostart/disableAutostart throws, toggle already flipped, UI permanently out of sync with OS. Fix while extracting.
- sev:6 — `useEffect:44` — licenseKey and instanceId captured from Zustand at mount time. persist middleware may not have hydrated. Use useEntitlementStore.getState() inside effect.
- sev:5 — `handleExportBackup:121` — `_version:2` is a magic number. Should be CURRENT_BACKUP_VERSION from importBackup.ts. Fix in #028 — exportBackup.ts should import this constant.
- sev:4 — console.error calls at lines 49, 155, 186 missing MODULE_CODE-TIMESTAMP ref ID format.
- Rule 8 — `reader.onerror:154` — DOMException on target.error never read or logged.

**All known silent-catch violations in settings page:**
These are the patterns your useLicenseActivation.ts hook must NOT repeat. Every catch MUST:
1. Bind the error: `catch (err)` (not `catch {}`)
2. Log with a ref: `console.error(\`[ERR-X-${Date.now()}]\`, err)`
3. Update UI state so the user knows something failed

## When You Finish
Write your completion summary to .autocode/stream-W1B/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Barry is done." (or describe what's incomplete).

— Barry | W1B | #028 #026
