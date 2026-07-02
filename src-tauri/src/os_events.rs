// os_events.rs — macOS OS-event listeners for plyglt. Detects three system transitions and emits
// "interrupt:fire" for each: system wake (sleep-gap heuristic), screen unlock (CGSession lock-state
// polling via runtime dlsym lookup), and idle→active return (CGEventSource idle-time polling). All
// three share the same enabled/snooze guard and a per-tick single-fire guard before emitting, and
// reset last_triggered_secs so the interval-timer poll in interrupt.rs does not double-fire. Runs
// on a single named background thread started at app startup. Non-macOS platforms are a documented
// no-op; Batch 15 covers Windows/Linux.
// Imports: crate::interrupt::{InterruptState, now_secs}. Used by: lib.rs.

use std::ffi::c_void;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::interrupt::{InterruptState, now_secs};

/// Poll interval for OS-event detection — shorter than the 30 s interrupt poll for responsiveness.
const OS_POLL_SECS: u64 = 5;

/// If consecutive polls are separated by more than this, the system almost certainly slept and woke.
/// 90 s = 18× OS_POLL_SECS — a single extremely-slow tick would need to stall for 90 s to
/// trigger a false positive.  Background system wakes (Time Machine, iCloud) can still trigger
/// this; users relying on DnD to suppress overnight interruptions must configure DnD hours.
const WAKE_THRESHOLD_SECS: u64 = 90;

/// Idle threshold: 15 minutes of no HID input is treated as "user left".
// TODO #163: replace IDLE_THRESHOLD_SECS with st.idle_threshold_secs once the configurable
// field is added to InterruptState. The state lock block already reads the guard fields; just
// add idle_threshold_secs to that destructure.
const IDLE_THRESHOLD_SECS: f64 = 900.0; // 15 × 60

// ── macOS C API declarations ───────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos_ffi {
    use std::ffi::c_void;

    // CGEventSourceSecondsSinceLastEventType and CGSessionCopyCurrentDictionary are public
    // CoreGraphics symbols.  kCGSessionScreenIsLocked is declared in headers but not reliably
    // exported as a linker symbol across all macOS versions, so we resolve it at runtime via
    // dlsym (see resolve_screen_is_locked_key below).
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        /// Seconds since the last HID input event of the given type.
        /// state_id = 1 (kCGEventSourceStateHIDSystemState),
        /// event_type = u32::MAX (kCGAnyInputEventType).
        pub fn CGEventSourceSecondsSinceLastEventType(state_id: u32, event_type: u32) -> f64;

        /// Returns a retained CFDictionaryRef describing the current console session.
        /// Contains the screen-lock boolean. Caller must release via CFRelease.
        pub fn CGSessionCopyCurrentDictionary() -> *mut c_void;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFDictionaryGetValue(
            dict: *const c_void,
            key: *const c_void,
        ) -> *const c_void;

        /// Returns the underlying Boolean value. CFBoolean maps to `unsigned char` (not C `_Bool`).
        pub fn CFBooleanGetValue(boolean: *const c_void) -> u8;

        /// Decrements the retain count; frees the object when it reaches zero.
        pub fn CFRelease(cf: *const c_void);
    }

    /// Runtime lookup for kCGSessionScreenIsLocked.
    ///
    /// The constant IS declared in CoreGraphics headers but is not reliably exported as a
    /// linker symbol in all macOS versions.  dlsym with RTLD_DEFAULT finds it at runtime.
    /// Returns null when absent — unlock detection degrades gracefully; wake and idle continue.
    pub fn resolve_screen_is_locked_key() -> *const c_void {
        extern "C" {
            fn dlsym(handle: *mut c_void, symbol: *const u8) -> *mut c_void;
        }
        unsafe {
            let rtld_default = (-2isize) as *mut c_void; // RTLD_DEFAULT on Darwin
            let addr = dlsym(rtld_default, b"kCGSessionScreenIsLocked\0".as_ptr());
            if addr.is_null() {
                return std::ptr::null();
            }
            // dlsym returns the address OF the symbol.  kCGSessionScreenIsLocked is a CFStringRef
            // (itself a pointer), so one dereference gives us the CFStringRef value.
            *(addr as *const *const c_void)
        }
    }
}

// ── Thread-safe CFStringRef wrapper ───────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
/// Newtype that lets a resolved CFStringRef pointer cross thread boundaries.
///
/// Safety contract: only used for framework constants that live in the framework's data section
/// for the entire process lifetime and are never mutated.  kCGSessionScreenIsLocked satisfies
/// both requirements.
struct SendableCFStringRef(*const c_void);

#[cfg(target_os = "macos")]
// Safety: kCGSessionScreenIsLocked is a read-only constant; concurrent reads are safe.
unsafe impl Send for SendableCFStringRef {}
#[cfg(target_os = "macos")]
unsafe impl Sync for SendableCFStringRef {}

// ── Public entry point ─────────────────────────────────────────────────────────────────────────

/// Start the OS-event listener thread.  On non-macOS platforms this is a documented no-op;
/// platform-specific implementations for Windows and Linux are planned for Batch 15.
pub fn start_os_listeners(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
    #[cfg(target_os = "macos")]
    {
        let locked_key = SendableCFStringRef(macos_ffi::resolve_screen_is_locked_key());
        if locked_key.0.is_null() {
            // Log once at startup so operators know unlock detection is unavailable.
            eprintln!(
                "[plyglt-{:010}] os_events: kCGSessionScreenIsLocked unavailable in this \
                 runtime — unlock detection disabled; wake and idle detection active",
                now_secs()
            );
        }

        let builder = thread::Builder::new().name("plyglt-os-events".into());
        // Ignore spawn failure — the interrupt poll thread still provides scheduled interrupts.
        let _ = builder.spawn(move || {
            let mut last_poll_secs = now_secs();
            let mut was_locked = false; // previous screen-lock state
            let mut was_idle = false;   // previous idle-above-threshold state

            loop {
                thread::sleep(Duration::from_secs(OS_POLL_SECS));

                // Each tick fires at most ONE interrupt regardless of how many detectors trigger.
                // Without this guard, a lid-open (sleep+lock→wake+unlock) emits two rapid-fire
                // events in the same 5 s tick, which can cause overlapping sessions in the frontend.
                // OS events intentionally bypass interval_secs — a wake or unlock should always
                // interrupt regardless of the configured schedule.  last_triggered_secs is reset
                // (preventing a double-fire from the interval poll) but not checked here.
                let mut tick_fired = false;

                // All FFI calls and state logic are wrapped together so a panic in either the
                // unsafe OS APIs OR the state update logic is caught by the same recovery handler.
                // Without this, a bad CGSession pointer would kill the thread permanently.
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let now = now_secs();

                    // ── State updates before emit ───────────────────────────────────────────────
                    // Update tracking variables BEFORE calling emit_interrupt so that if emit
                    // panics (e.g., Mutex poisoned, AppHandle gone), the transition is not
                    // re-detected on the next tick.
                    let elapsed = now.saturating_sub(last_poll_secs);
                    last_poll_secs = now; // always advance, whether or not wake fires

                    let is_locked = screen_is_locked(&locked_key);
                    let prev_locked = was_locked;
                    was_locked = is_locked; // advance before possible emit

                    let idle_secs = idle_seconds();
                    let is_idle = idle_secs >= IDLE_THRESHOLD_SECS;
                    let prev_idle = was_idle;
                    was_idle = is_idle; // advance before possible emit

                    // ── Guard state (read once, release lock before any emit) ──────────────────
                    let (enabled, snooze_until, mandatory) = {
                        let Ok(st) = state.lock() else { return; };
                        (st.enabled, st.snooze_until_secs, st.mandatory)
                    };

                    // ── Wake detection ──────────────────────────────────────────────────────────
                    if !tick_fired
                        && elapsed > WAKE_THRESHOLD_SECS
                        && enabled
                        && now >= snooze_until
                    {
                        emit_interrupt(&app, &state, now, mandatory);
                        tick_fired = true;
                    }

                    // ── Unlock detection ────────────────────────────────────────────────────────
                    if !tick_fired && prev_locked && !is_locked && enabled && now >= snooze_until {
                        emit_interrupt(&app, &state, now, mandatory);
                        tick_fired = true;
                    }

                    // ── Idle→active detection ───────────────────────────────────────────────────
                    // Fires on the idle→active edge.  No separate cooldown is needed: once
                    // prev_idle is false the user must idle for another IDLE_THRESHOLD_SECS
                    // (15 min) before the next fire is possible.
                    if !tick_fired && prev_idle && !is_idle && enabled && now >= snooze_until {
                        emit_interrupt(&app, &state, now, mandatory);
                        // tick_fired = true; — kept for symmetry if a 4th detector is ever added
                    }
                }));

                if result.is_err() {
                    eprintln!(
                        "[OSEV-PANIC-{:010}] os_events: recovered from panic in poll loop; \
                         wake/unlock/idle detection will resume next tick",
                        now_secs()
                    );
                }
            }
        });
    }

    // Non-macOS: suppress unused-variable warnings.
    // Windows/Linux OS-event hooks are planned for Batch 15.
    #[cfg(not(target_os = "macos"))]
    let _ = (app, state);
}

// ── Private helpers ────────────────────────────────────────────────────────────────────────────

/// Emit "interrupt:fire" and update last_triggered_secs so the interval-timer poll in
/// interrupt.rs does not fire again immediately after an OS-event trigger.
#[cfg(target_os = "macos")]
fn emit_interrupt(
    app: &AppHandle,
    state: &Arc<Mutex<InterruptState>>,
    now: u64,
    mandatory: bool,
) {
    if let Ok(mut st) = state.lock() {
        st.last_triggered_secs = now;
    }
    let _ = app.emit("interrupt:fire", mandatory);
}

/// Returns true when the macOS console session reports the screen is locked.
///
/// Takes `&SendableCFStringRef` so callers avoid raw-pointer temporaries in closure bodies
/// (which block the `Send` bound on `thread::spawn`).  When the key pointer is null (symbol
/// not exported by this runtime), always returns false — unlock detection is disabled but
/// wake and idle detection continue.
#[cfg(target_os = "macos")]
fn screen_is_locked(key: &SendableCFStringRef) -> bool {
    use macos_ffi::*;
    if key.0.is_null() {
        return false;
    }
    unsafe {
        let dict = CGSessionCopyCurrentDictionary();
        if dict.is_null() {
            return false;
        }
        // Read the boolean value.  CFRelease MUST run in all code paths that reach this point.
        let val = CFDictionaryGetValue(dict as *const c_void, key.0);
        let locked = !val.is_null() && CFBooleanGetValue(val) != 0;
        // Release dict unconditionally — CFBooleanGetValue does not retain val, so only dict
        // needs releasing.  This is safe because val's lifetime is bounded by dict's.
        CFRelease(dict as *const c_void);
        locked
    }
}

/// Returns seconds since the last HID input event (keyboard, mouse, trackpad, etc.).
/// Returns 0.0 on any error — prevents spurious idle→active fires.
#[cfg(target_os = "macos")]
fn idle_seconds() -> f64 {
    // kCGEventSourceStateHIDSystemState = 1; kCGAnyInputEventType = u32::MAX
    unsafe { macos_ffi::CGEventSourceSecondsSinceLastEventType(1, u32::MAX) }
}
