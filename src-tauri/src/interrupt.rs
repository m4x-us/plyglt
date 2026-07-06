// interrupt.rs — Owns the proactive interrupt engine. Defines InterruptState with fields:
//   enabled, interval_secs, mandatory, snooze_until_secs, last_triggered_secs, auto_opened,
//   wake_enabled, unlock_enabled, idle_enabled, idle_threshold_secs.
// Runs a 30-second background poll thread that emits "interrupt:fire" to the JS frontend when
// the interval has elapsed and no snooze is active. The four OS-trigger fields (wake_enabled,
// unlock_enabled, idle_enabled, idle_threshold_secs) are stored here and consumed by
// os_events.rs — wiring landed in Tasks #187–#190. Exposes four Tauri IPC commands:
// update_interrupt_config (7 positional params — see InterruptConfig below for the
// documented contract shape pending a future migration), snooze_interrupt,
// enter_mandatory_mode, and exit_mandatory_mode.
// Registered by lib.rs; called from the JS side by components/InterruptHandler.tsx via invoke().

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

impl Default for InterruptState {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_secs: 3 * 3600,
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
            if interval_secs == 0 { return; }
            if now < snooze_until { return; }
            if now.saturating_sub(last_triggered) < interval_secs { return; }

            // Mark triggered before emitting to prevent double-fire if emit is slow.
            if let Ok(mut st) = state.lock() {
                st.last_triggered_secs = now;
            }

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

#[tauri::command]
pub fn snooze_interrupt(
    state: tauri::State<'_, Arc<Mutex<InterruptState>>>,
    minutes: u32,
) {
    let now = now_secs();
    if let Ok(mut st) = state.lock() {
        st.snooze_until_secs = now + u64::from(minutes) * 60;
        // Push last_triggered forward so the interval resets from now.
        st.last_triggered_secs = now;
    }
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
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_closable(false).map_err(|e| e.to_string())?;
    window.set_minimizable(false).map_err(|e| e.to_string())?;
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
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_closable(true).map_err(|e| e.to_string())?;
    window.set_minimizable(true).map_err(|e| e.to_string())?;
    if was_auto {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
