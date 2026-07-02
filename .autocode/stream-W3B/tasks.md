# Stream W3B Task State

### Task #161 | architecture | severity 5
**What:** Extract the 5 interrupt-specific exports from `lib/tauri.ts` into a new `lib/tauriInterrupt.ts`: `updateInterruptConfig`, `snoozeInterrupt`, `enterMandatoryMode`, `exitMandatoryMode`, `updateTrayBadge`. Add Rule 2 header to `lib/tauriInterrupt.ts`. Update callers (`components/InterruptHandler.tsx`, `app/settings/page.tsx`) to import from `@/lib/tauriInterrupt`. Grep for any other callers: `grep -r "updateInterruptConfig\|snoozeInterrupt\|enterMandatoryMode\|exitMandatoryMode\|updateTrayBadge" --include="*.ts" --include="*.tsx" . | grep -v node_modules`. If `lib/tauri.ts` re-exports them for backwards compatibility, add a note that the re-exports will be removed in a future cleanup.
**Why:** `lib/tauri.ts` is at 151 lines. Task #162 will add OS-trigger IPC calls (enableWakeTrigger, enableUnlockTrigger, setIdleThreshold) — without extraction, `lib/tauri.ts` exceeds 200 lines. Extract interrupt IPC into its own module now.
**File:** `lib/tauri.ts`, `lib/tauriInterrupt.ts` (new), `components/InterruptHandler.tsx`, `app/settings/page.tsx`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (1 new), refactor
**Blocked by:** #159 | **Blocks:** #162
**Test required:** No behavior change — `npm test` passing is the test (all existing InterruptHandler + settings tests must pass).
**Done when:** `lib/tauriInterrupt.ts` exists with Rule 2 header and all 5 exports. `lib/tauri.ts` ≤ 145 lines. No interrupt-specific imports from `lib/tauri.ts` in callers (or clearly marked re-exports). `npm test` passes.
**Owner:** Architecture Agent
