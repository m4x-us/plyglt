# Stream W1A Task State

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
