# Adam — Stream W1A — Wave 1 — 2026-07-01

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #124

You are Adam, a CTO working on a specific task in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #124  — Notification permission onboarding UX

STATUS BOARD RULE — MANDATORY: After completing /task #124, print:

Adam — W1A
[✓] #124 — Notification permission onboarding UX   ← done

Then tell Max: "Adam is done."

## Files You Own (edit ONLY these)
app/settings/page.tsx
components/NotificationPermissionGate.tsx   ← may be new

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
components/InterruptHandler.tsx
components/InterruptHandler.test.tsx
app/stats/page.tsx
app/stats/page.test.tsx
app/learn/page.test.tsx
lib/packLoader.ts
lib/specialtyPackLoader.ts
tests/packLoader.test.ts
tests/langRegistry.test.ts

## Task Definitions

### Task #124 | build | severity 4
**What:** Add a notification permission onboarding explanation to the interrupt engine enable flow. When a user first toggles "Enable review reminders" ON in `app/settings/page.tsx`, show a short explanation before the OS permission dialog fires: "plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this." If the user previously denied permission on macOS, show a graceful fallback: "Enable notifications for plyglt in System Settings → Notifications." (no repeat dialog, just the instruction).
**Why:** Product agent found: "the first time a Pro user enables the interrupt engine, a notification permission dialog appears mid-session with no prior explanation." macOS does not allow re-prompting after a denial. Users who reflexively click "Don't Allow" lose the core Pro differentiator with no recovery path visible in the UI.
**File:** `app/settings/page.tsx`, possibly a new small `components/NotificationPermissionGate.tsx`
**Blocks:** Nothing
**Blocked by:** Nothing
**Risk:** Low — UI-only addition. Does not change Tauri IPC calls.
**Completion gates:** Architecture Agent sign-off
**Done when:** Toggling "Enable review reminders" ON shows an explanation sentence before the OS dialog fires (or inline in the settings card before the toggle if permission has already been granted); `npm test` passes; no Tauri IPC changes.
**Complexity:** ⚡ Direct — 2 files, no package boundary, no implementation-scope keywords in What
**Owner:** Architecture Agent

## Agent Memories

### Architecture Agent Memory (first 150 lines)
Stack: Next.js 16.2.9, React 19, Zustand 5, Tauri 2. TypeScript throughout.

Layer rules (strictly enforced):
- app/ → components/ → hooks/ → store/ (peer of lib/) → lib/ → content/
- lib/ must NEVER import from store/, hooks/, components/, or app/
- store/ must NEVER import from hooks/, components/, or app/
- Never import @tauri-apps/api directly — route through lib/tauri.ts only
- Never call localStorage directly — route through lib/storage.ts only

Key files for this task:
- `app/settings/page.tsx` (150 lines — at the route limit; be surgical)
- `lib/featureFlags.ts` — exports isProEnabled(flagValue, licenseType); licenseType from useSettingsStore
- `lib/tauri.ts` — Tauri gateway; all Tauri API calls route through here
- `components/EntitlementValidator.tsx` — owns license revalidation (do NOT add revalidation here)

Dead zones relevant to this task:
- Push notification permission UI — this IS Task #124 (UX only, no IPC changes)
- `vacationMode` flag — intentional stub, ignore

Voice and tone (BRAND.md):
- No exclamation marks in UI copy
- No filler words ("just", "simply", "quickly")
- Present tense, short sentences, one idea per sentence
- "plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this."
- Fallback: "Enable notifications for plyglt in System Settings → Notifications."

Pattern for checking notification permission state (Tauri):
- `invoke("check_notification_permission")` via lib/tauri.ts
- Or use the browser Notification API: `Notification.permission` ("granted" | "denied" | "default")
- The Tauri notification plugin surfaces this — use lib/tauri.ts as the gateway

app/settings/page.tsx is at 150 lines (route limit). If adding the permission gate pushes past 150 lines, extract the gate UI to a new component (NotificationPermissionGate.tsx). Keep the page component thin.

isProEnabled pattern (Task #118 — verified complete):
```ts
import { getFeatureFlags, isProEnabled } from 'lib/featureFlags'
const flags = getFeatureFlags()
const { licenseType } = useSettingsStore()
if (!isProEnabled(flags.interruptions, licenseType)) { /* show upgrade */ }
```

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md:
  Tasks closed: [#124 if done-when passes]
  Tasks NOT completed: [list + reason if any]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max: "Adam is done."

— Adam | W1A | #124
