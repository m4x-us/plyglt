// interrupt.rs — Owns the proactive interrupt engine. Defines InterruptState with fields:
//   enabled, interval_secs, mandatory, snooze_until_secs, last_triggered_secs, auto_opened,
//   wake_enabled, unlock_enabled, idle_enabled, idle_threshold_secs.
// Runs a 30-second background poll thread that emits "interrupt:fire" to the JS frontend when
// the interval has elapsed and no snooze is active. The four OS-trigger fields (wake_enabled,
// unlock_enabled, idle_enabled, idle_threshold_secs) are stored here and consumed by
// os_events.rs — wiring landed in Tasks #187–#190. Exposes five Tauri IPC commands:
// update_interrupt_config (7 positional params — see InterruptConfig below for the
// documented contract shape pending a future migration), snooze_interrupt,
// enter_mandatory_mode, exit_mandatory_mode, and mark_interrupt_fired.
// Registered by lib.rs; called from the JS side by components/InterruptHandler.tsx via invoke().
//
// Clock semantics (Task #524, docs/INTERRUPT_ARCHITECTURE.md §3–§4): `last_triggered_secs` is
// the "last real content was shown" clock, not "last time we checked." `mark_interrupt_fired` is
// the ONLY thing that advances it — a scheduled poll tick or an OS-event check-in ("interrupt:fire"
// emitted) does not, by itself, cost the user their next interval. The JS layer calls
// mark_interrupt_fired only once it actually shows a session with real content (wired in Task
// #526, a later wave) — until that wave lands, "interrupt:fire" check-ins can recur every poll
// tick without anything advancing the clock, which is the intended "check every 30s, only the
// interval-elapsed AND a real fire counts" behavior, not a bug. `interval_elapsed` is the single
// shared gate every trigger path (scheduled poll here, wake/unlock/idle in os_events.rs) uses —
// OS events are check-in moments against this same gate, never an independent trigger authority.

use std::{
    panic,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const POLL_SECS: u64 = 30;
/// Default idle threshold — mirrors IDLE_THRESHOLD_DEFAULT_MINUTES = 15 in store/migrations.ts.
const IDLE_THRESHOLD_DEFAULT_SECS: u64 = 900; // 15 × 60

pub struct InterruptState {
    pub enabled: bool,
    pub interval_secs: u64,
    pub mandatory: bool,
    pub snooze_until_secs: u64,
    pub last_triggered_secs: u64,
    /// True when the window was raised automatically by an interrupt (hide on exit).
    pub auto_opened: bool,
    pub wake_enabled: bool,
    pub unlock_enabled: bool,
    pub idle_enabled: bool,
    pub idle_threshold_secs: u64,
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// True when at least `interval_secs` has elapsed since `last_triggered`. `interval_secs == 0`
/// is treated as "never fire" — mirrors the scheduled poll's pre-#524 standalone
/// `if interval_secs == 0 { return; }` guard, folded into one shared gate. The single source of
/// truth for "has the schedule's interval elapsed" — used by the scheduled poll below AND by
/// every wake/unlock/idle detector in os_events.rs (Task #524), so OS events can never fire more
/// often than the configured schedule permits.
pub fn interval_elapsed(now: u64, last_triggered: u64, interval_secs: u64) -> bool {
    interval_secs > 0 && now.saturating_sub(last_triggered) >= interval_secs
}

impl Default for InterruptState {
    fn default() -> Self {
        Self {
            enabled: false,
            // 90 minutes (Task #531) — unified with mobile's push_tokens.interrupt_interval_minutes
            // default (supabase/migrations/20260808000000_push_tokens.sql). Over a 13-hour waking
            // window (8am–9pm) that's ≈8.7 interrupts/day, landing in BRAND.md's 6–10/day target;
            // the prior 3-hour default undershot at ≈4.3/day. See docs/INTERRUPT_ARCHITECTURE.md §7.
            interval_secs: 90 * 60,
            mandatory: false,
            snooze_until_secs: 0,
            // Start far in the past so first check fires immediately once enabled.
            last_triggered_secs: now_secs().saturating_sub(3600 * 24),
            auto_opened: false,
            wake_enabled: true,
            unlock_enabled: true,
            idle_enabled: true,
            idle_threshold_secs: IDLE_THRESHOLD_DEFAULT_SECS,
        }
    }
}

/// Spawn the background poll thread.  Called once from `setup`.
pub fn start(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(POLL_SECS));

        let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
            let now = now_secs();

            let (enabled, interval_secs, mandatory, snooze_until, last_triggered) = {
                let Ok(st) = state.lock() else { return };
                (
                    st.enabled,
                    st.interval_secs,
                    st.mandatory,
                    st.snooze_until_secs,
                    st.last_triggered_secs,
                )
            };

            if !enabled { return; }
            if now < snooze_until { return; }
            if !interval_elapsed(now, last_triggered, interval_secs) { return; }

            // Does NOT advance last_triggered_secs here (Task #524) — this is a check-in, not a
            // fire with content. Only mark_interrupt_fired (called by the JS layer once it
            // actually shows a session) advances the clock. See module header and
            // docs/INTERRUPT_ARCHITECTURE.md §3.

            // Frontend receives `mandatory: bool` and decides whether to show
            // a notification (false) or raise the window in mandatory mode (true).
            // DND and "already on study page" checks happen in the frontend.
            let _ = app.emit("interrupt:fire", mandatory);
        }));

        if result.is_err() {
            eprintln!("[plyglt] interrupt poll: recovered from panic, will retry next cycle");
        }
    });
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Mirrors the InterruptConfig interface in lib/tauriInterrupt.ts — single source of truth
/// for the interrupt-config contract shape. Defined here for documentation and future
/// migration; the IPC wire format currently uses positional params (flat object on the JS side).
/// When tests/tauri.test.ts and components/InterruptHandler.test.tsx migrate to the object
/// form, the command signature can switch to `config: InterruptConfig` (Task #216).
#[allow(dead_code)]
pub struct InterruptConfig {
    pub enabled: bool,
    pub interval_hours: f32,
    pub mandatory: bool,
    pub wake_enabled: bool,
    pub unlock_enabled: bool,
    pub idle_enabled: bool,
    pub idle_threshold_minutes: u32,
}

#[tauri::command]
pub fn update_interrupt_config(
    state: tauri::State<'_, Arc<Mutex<InterruptState>>>,
    enabled: bool,
    interval_hours: f32,
    mandatory: bool,
    wake_enabled: bool,
    unlock_enabled: bool,
    idle_enabled: bool,
    idle_threshold_minutes: u32,
) {
    match state.lock() {
        Ok(mut st) => {
            st.enabled = enabled;
            st.interval_secs = (interval_hours * 3600.0) as u64;
            st.mandatory = mandatory;
            st.wake_enabled = wake_enabled;
            st.unlock_enabled = unlock_enabled;
            st.idle_enabled = idle_enabled;
            st.idle_threshold_secs = u64::from(idle_threshold_minutes) * 60;
        }
        Err(e) => {
            eprintln!("[plyglt] update_interrupt_config: mutex poisoned — config NOT applied: {e}");
        }
    }
}

/// Pure core of `snooze_interrupt` — separated so it's testable without a live `tauri::State`
/// (this codebase has no existing pattern for constructing one in unit tests — see
/// os_events.rs's pure-guard-function test convention, followed here for interrupt.rs too).
fn apply_snooze(state: &Arc<Mutex<InterruptState>>, now: u64, minutes: u32) {
    if let Ok(mut st) = state.lock() {
        st.snooze_until_secs = now + u64::from(minutes) * 60;
        // Task #524: no longer touches last_triggered_secs. Snooze is purely a "don't fire
        // before X" hold — mark_interrupt_fired is the only thing that advances the clock now.
        // If the interval had already elapsed before the snooze, the schedule resumes
        // immediately once snooze_until_secs passes rather than getting a bonus fresh interval.
    }
}

#[tauri::command]
pub fn snooze_interrupt(
    state: tauri::State<'_, Arc<Mutex<InterruptState>>>,
    minutes: u32,
) {
    apply_snooze(&state, now_secs(), minutes);
}

/// Pure core of `mark_interrupt_fired` — see `apply_snooze`'s doc comment for why this is
/// factored out of the `#[tauri::command]` wrapper.
fn mark_fired_now(state: &Arc<Mutex<InterruptState>>, now: u64) {
    if let Ok(mut st) = state.lock() {
        st.last_triggered_secs = now;
    }
}

/// The ONLY writer of `last_triggered_secs` (Task #524). Called by the JS layer once it has
/// actually shown a session with real content — never on a bare check-in, never on an empty
/// due-count. Wiring the caller side (components/InterruptHandler.tsx) is Task #526, a later
/// wave; this command exists and is safe to call starting now.
#[tauri::command]
pub fn mark_interrupt_fired(state: tauri::State<'_, Arc<Mutex<InterruptState>>>) {
    mark_fired_now(&state, now_secs());
}

#[tauri::command]
pub async fn enter_mandatory_mode(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<InterruptState>>>,
) -> Result<(), String> {
    if let Ok(mut st) = state.lock() {
        st.auto_opened = true;
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    // set_always_on_top/set_closable/set_minimizable are desktop window-chrome APIs with no
    // mobile equivalent (a mobile app has no minimize/close buttons or window stacking to lock
    // — the app IS the screen) — don't exist on the mobile tauri crate at all (Task #522).
    #[cfg(desktop)]
    {
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_closable(false).map_err(|e| e.to_string())?;
        window.set_minimizable(false).map_err(|e| e.to_string())?;
    }
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn exit_mandatory_mode(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<InterruptState>>>,
) -> Result<(), String> {
    let was_auto = {
        let Ok(mut st) = state.lock() else { return Ok(()); };
        let was = st.auto_opened;
        st.auto_opened = false;
        was
    };
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    #[cfg(desktop)]
    {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_closable(true).map_err(|e| e.to_string())?;
        window.set_minimizable(true).map_err(|e| e.to_string())?;
    }
    if was_auto {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Tests (Task #524) ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── interval_elapsed — the shared gate every trigger path now uses ─────────

    #[test]
    fn interval_elapsed_zero_interval_never_fires() {
        assert!(!interval_elapsed(1_000_000, 0, 0), "interval_secs == 0 must mean never fire");
    }

    #[test]
    fn interval_elapsed_before_interval_does_not_fire() {
        assert!(!interval_elapsed(1000, 900, 200), "only 100s elapsed against a 200s interval");
    }

    #[test]
    fn interval_elapsed_exactly_at_boundary_fires() {
        assert!(interval_elapsed(1100, 900, 200), "exactly 200s elapsed must count as elapsed");
    }

    #[test]
    fn interval_elapsed_well_past_interval_fires() {
        assert!(interval_elapsed(5000, 900, 200));
    }

    // ── Scheduled poll's fire guard — mirrors start()'s closure body exactly ───
    // (the same "pure guard-condition helper mirroring the real branches" pattern os_events.rs
    // already uses for its wake/unlock/idle detectors, applied here to the scheduled poll.)

    fn poll_should_fire(enabled: bool, now: u64, snooze_until: u64, last_triggered: u64, interval_secs: u64) -> bool {
        enabled && now >= snooze_until && interval_elapsed(now, last_triggered, interval_secs)
    }

    #[test]
    fn poll_disabled_never_fires_even_when_interval_elapsed() {
        assert!(!poll_should_fire(false, 100_000, 0, 0, 60));
    }

    #[test]
    fn poll_snoozed_suppresses_fire_even_when_interval_elapsed() {
        assert!(!poll_should_fire(true, 1000, 2000, 0, 60), "snooze_until (2000) is still in the future relative to now (1000)");
    }

    #[test]
    fn poll_fires_once_interval_elapsed_and_not_snoozed() {
        assert!(poll_should_fire(true, 1000, 0, 0, 60));
    }

    #[test]
    fn poll_does_not_fire_before_interval_elapsed() {
        assert!(!poll_should_fire(true, 1000, 0, 990, 60), "only 10s elapsed against a 60s interval");
    }

    // ── mark_interrupt_fired is the ONLY writer of last_triggered_secs ─────────

    fn fresh_state(last_triggered_secs: u64) -> Arc<Mutex<InterruptState>> {
        Arc::new(Mutex::new(InterruptState {
            last_triggered_secs,
            ..Default::default()
        }))
    }

    #[test]
    fn mark_fired_now_advances_last_triggered_secs_to_given_time() {
        let state = fresh_state(0);
        mark_fired_now(&state, 12_345);
        assert_eq!(state.lock().unwrap().last_triggered_secs, 12_345);
    }

    #[test]
    fn apply_snooze_sets_snooze_until_but_does_not_touch_last_triggered_secs() {
        // Task #524: a scheduled/OS-triggered check-in that finds nothing due (modeled here as
        // "no call to mark_fired_now") must not change last_triggered_secs. snooze_interrupt is
        // one such non-firing path — verify it leaves the clock untouched.
        let state = fresh_state(500);
        apply_snooze(&state, 1000, 30);
        let st = state.lock().unwrap();
        assert_eq!(st.last_triggered_secs, 500, "snooze must not advance the fire clock");
        assert_eq!(st.snooze_until_secs, 1000 + 30 * 60);
    }

    #[test]
    fn a_check_that_finds_nothing_due_leaves_last_triggered_secs_unchanged() {
        // Simulates a scheduled poll tick (or OS-event check-in) that decides not to fire —
        // nothing in this crate writes last_triggered_secs on that path anymore; only
        // mark_fired_now (invoked by the JS layer on a real fire with content) does.
        let state = fresh_state(777);
        let fires = poll_should_fire(true, 1000, 0, 999_999, 60); // interval nowhere near elapsed
        assert!(!fires);
        assert_eq!(state.lock().unwrap().last_triggered_secs, 777, "no-fire check-in must not touch the clock");
    }
}
