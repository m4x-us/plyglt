# Stream W1B Task State

### Task #028 | Extract exportBackup logic to lib/exportBackup.ts
**Severity:** 4 | **File(s):** `app/settings/page.tsx:114-145` (inline in page)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 3 files (app/settings/page.tsx, lib/exportBackup.ts, tests/exportBackup.test.ts)

The export logic (`handleExport` function) is currently embedded in the settings page. It directly reads store state and constructs a JSON blob. This is a service-layer concern, not a route concern. Extracting it allows independent testing and future reuse (e.g. auto-backup on schedule).

**Changes required:**
1. Create `lib/exportBackup.ts` — move the export payload construction logic into `exportBackup(srsState, entitlementState, langPair: string): string` that returns the JSON string. The DOM manipulation (create `<a>`, click, revoke) stays in the settings page or hook.
2. `app/settings/page.tsx` / `hooks/useExportImport.ts` (from #026) — call `exportBackup()` from `lib/exportBackup.ts`.

**Test required (write first):**
- `tests/exportBackup.test.ts` — `exportBackup(srsState, entitlementState, "en-it")` returns a parseable JSON string containing `_version: 2`, `langPair: "en-it"`, and `srs.cards`.

**Done condition:** `lib/exportBackup.ts` exists. `tests/exportBackup.test.ts` passes. Verification gate green.

---

### Task #026 | Extract Section, Toggle, and schedule DnD UI from app/settings/page.tsx (Rule 1)
**Severity:** 5 | **File(s):** `app/settings/page.tsx` (516 lines — 3.4× the 150-line route limit)
**DoD Tier:** 2
**Complexity:** 🔧 Full — "extract" keyword, 5 files (app/settings/page.tsx, components/settings/Section.tsx, components/settings/Toggle.tsx, hooks/useExportImport.ts, hooks/useLicenseActivation.ts)

`app/settings/page.tsx` is 516 lines — the worst file-size violation in the codebase. It contains at least four extractable concerns:
- `Section` and `Toggle` UI primitives (search for their inline definitions)
- Export/import logic (`handleExport`, `handleImportFile`, related state)
- License activation/deactivation/validation logic (already in `lib/entitlement.ts` — the page has 90 lines of UI state machine for this)
- DnD schedule UI

**Changes required:**
1. `components/settings/Section.tsx` — extract the `Section` UI primitive.
2. `components/settings/Toggle.tsx` — extract the `Toggle` UI primitive.
3. `hooks/useExportImport.ts` — extract `handleExport`, `handleImportFile`, and the `dataStatus` state into a hook. Call `exportBackup()` from `lib/exportBackup.ts` (created in #028).
4. `hooks/useLicenseActivation.ts` — extract `handleActivate`, `handleValidate`, `handleDeactivate`, `licenseInput`, `licenseStatus` state into a hook. All Tauri IPC calls (invoke) MUST be wrapped in try/catch with ERR-ref logging.
5. `app/settings/page.tsx` — consume the extracted hooks and components. Target: ≤ 150 lines.

**Test required (write first):**
- `components/settings/Toggle.test.tsx` — renders label, fires `onChange` when clicked.
- `hooks/useExportImport.test.ts` — `handleExport` creates a download link (mock `document.createElement`). `handleImportFile` calls `parseBackup` on the file content.

**Done condition:** `app/settings/page.tsx` ≤ 150 lines. All extracted files exist. Verification gate green.
