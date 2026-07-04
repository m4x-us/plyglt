# Stream W1B Task State

### Task #163 | feature | severity 5
**What:** Add OS trigger toggle controls to interrupt settings. Extend `InterruptConfig` in `store/settingsStore.ts` with 4 new fields: `wakeEnabled: boolean` (default true), `unlockEnabled: boolean` (default true), `idleEnabled: boolean` (default true), `idleThresholdMinutes: number` (default 15). Bump `SETTINGS_VERSION` and add migration. Wire all 4 through the `update_interrupt_config` IPC command (extend its payload type in `src-tauri/src/interrupt.rs` and `lib/tauriInterrupt.ts`). Add 3 toggle rows and an idle-threshold number input to the interrupt section in `app/settings/page.tsx`.
**Why:** Users need control over which triggers fire. Some may not want interruptions on every wake; others may prefer only scheduled interruptions. Without controls, all 3 new OS triggers fire permanently with no opt-out.
**File:** `store/settingsStore.ts`, `store/migrations.ts`, `app/settings/page.tsx`, `lib/tauriInterrupt.ts`, `src-tauri/src/interrupt.rs`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 5 files, new settings + migration
**Blocked by:** #162 | **Blocks:** #164
**Test required:** Yes — settings store migration test for new fields, component tests for new toggle rows.
**Done when:** `InterruptConfig` has 4 new fields with correct defaults. `SETTINGS_VERSION` bumped + migration adds them. Settings page renders 3 toggles + idle threshold input. `update_interrupt_config` payload includes new fields. `npm test` passes. `cargo build` compiles. `store/migrations.ts` tests cover v→v+1 migration for the new fields.
**Owner:** Architecture Agent

