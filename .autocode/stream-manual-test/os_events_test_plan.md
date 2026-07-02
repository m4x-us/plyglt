# Manual Test Plan — os_events.rs (Task #162)

**File under test:** `src-tauri/src/os_events.rs`  
**Fires event:** `interrupt:fire` (same payload as the 30-second poll: `mandatory: bool`)  
**Precondition for all tests:** App is running, Pro features enabled, interrupts enabled (`enabled = true`), no active snooze.

---

## Setup

1. Build and run the Tauri app in dev mode:
   ```bash
   npm run tauri dev
   ```
2. Open the browser devtools console inside the Tauri window (right-click → Inspect or use the WebView inspector).
3. Add a listener for the event so you can see fires:
   ```js
   const { listen } = window.__TAURI__.event;
   await listen('interrupt:fire', (e) => console.log('interrupt:fire', e.payload, new Date().toISOString()));
   ```
4. Enable interrupts in the app UI (Settings → Interrupts → Enable).

---

## Test 1 — Wake Detection

**What it tests:** Sleep-gap heuristic. If `now - last_poll_secs > 90s`, the system likely slept and woke.

**Steps:**
1. With app running, put the Mac to sleep (Apple menu → Sleep, or close lid).
2. Wake the Mac (open lid or press a key).
3. Wait up to 10 seconds.

**Expected:** `interrupt:fire` appears in the console within 10 seconds of wake.

**Notes:**
- The OS-event poll thread sleeps in 5-second increments. After wake, the next tick detects the gap.
- Threshold is 90 seconds; sleeping for less than ~90 s (e.g. quick lid close/open) will NOT fire. Sleep for at least 2 minutes for a reliable test.
- If the system was snoozed before sleep, the fire will be suppressed. Clear snooze before testing.

---

## Test 2 — Screen Unlock Detection

**What it tests:** CGSession `kCGSessionScreenIsLocked` transition from true → false.

**Steps:**
1. With app running, lock the screen (Ctrl+Cmd+Q or Apple menu → Lock Screen).
2. Enter your password to unlock.
3. Wait up to 10 seconds.

**Expected:** `interrupt:fire` appears in the console within 10 seconds of unlocking.

**Notes:**
- The poll thread checks every 5 seconds. Unlock fires on the first tick after the transition.
- If `kCGSessionScreenIsLocked` was not exported by this macOS runtime (older or future macOS), unlock detection is silently disabled. Wake and idle will still fire. Check the app logs: if `resolve_screen_is_locked_key()` returned null, no unlock fires will occur — this is expected and not a bug.
- To verify whether lock detection is active: add a temporary `println!` in `screen_is_locked` and check the Tauri dev server logs.

---

## Test 3 — Idle→Active Detection

**What it tests:** HID idle time exceeds 900 s (15 minutes), then drops below IDLE_THRESHOLD_SECS when the user returns.

**Steps (full):**
1. Leave the Mac completely untouched for 15 minutes (no keyboard, mouse, or trackpad input).
2. Press any key or move the mouse.
3. Wait up to 10 seconds.

**Expected:** `interrupt:fire` appears in the console within 10 seconds of returning.

**Steps (accelerated — for quick verification during development):**
1. Temporarily reduce `IDLE_THRESHOLD_SECS` in `os_events.rs` to `30.0` (30 seconds).
2. Rebuild: `cd src-tauri && cargo build`
3. Run dev app, wait 30 seconds without input.
4. Press a key.
5. `interrupt:fire` fires within 10 seconds.
6. Revert `IDLE_THRESHOLD_SECS` to `900.0` after verification.

**Notes:**
- After an idle→active fire, a 120-second cooldown (`IDLE_COOLDOWN_SECS`) suppresses the next one. Walking away and coming back again within 2 minutes will NOT fire again — this is expected.
- The `CGEventSourceSecondsSinceLastEventType(1, u32::MAX)` call tracks all HID input. Mouse movement counts as activity.

---

## Test 4 — Guard: Snooze Suppression

**What it tests:** OS events respect the snooze guard.

**Steps:**
1. Snooze the interrupt engine from the app UI (e.g. snooze 30 minutes).
2. Trigger any of the three OS events above (wake, unlock, idle→active).
3. Wait 10 seconds.

**Expected:** `interrupt:fire` does NOT fire while snooze is active.

---

## Test 5 — Guard: Disabled State

**What it tests:** OS events respect the `enabled = false` guard.

**Steps:**
1. Disable interrupts in Settings.
2. Trigger any of the three OS events above.
3. Wait 10 seconds.

**Expected:** `interrupt:fire` does NOT fire.

---

## Test 6 — No Double-Fire After OS Event

**What it tests:** `last_triggered_secs` is updated on OS-event fire, preventing the 30-second interval timer from firing immediately afterward.

**Steps:**
1. Note the time when an OS event fires (e.g. wake).
2. Watch the console for the next 35 seconds.

**Expected:** Only ONE `interrupt:fire` event fires (the OS event). The 30-second poll does NOT fire a second time within the interval window.

---

## Failure Mode Notes

| Symptom | Likely cause |
|---------|-------------|
| No fires at all | Interrupts not enabled in settings; check `update_interrupt_config` was called |
| Unlock never fires | `kCGSessionScreenIsLocked` not exported in this macOS version; this is expected — wake + idle still work |
| Idle fires immediately on startup | `CGEventSourceSecondsSinceLastEventType` returning large value at startup; `was_idle` starts as `false`, so transition detection prevents false fires |
| Double fires on wake | Interval timer and OS event firing simultaneously; confirm `last_triggered_secs` is being updated by `emit_interrupt` |
| Panic log in console | Check Tauri dev logs for `[plyglt] os_events: recovered from panic` — investigate the panic source |
