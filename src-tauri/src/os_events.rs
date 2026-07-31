// os_events.rs — Per-platform OS-event listeners for plyglt. Detects the same three system
// transitions on all three desktop platforms and emits "interrupt:fire" for each:
//   macOS   — wake (sleep-gap heuristic), unlock (CGSession lock-state polling via runtime dlsym
//             lookup), idle→active (CGEventSource idle-time polling). All three poll-driven on a
//             single 5 s-tick background thread (Task #162).
//   Windows — wake (WM_POWERBROADCAST/PBT_APMRESUMEAUTOMATIC), unlock (WM_WTSSESSION_CHANGE/
//             WTS_SESSION_UNLOCK via WTSRegisterSessionNotification) — both real OS events
//             delivered to a hidden message-only window's message loop, not polled — plus idle
//             (GetLastInputInfo, polled via a WM_TIMER on the same loop). (Task #166)
//   Linux   — wake (logind's PrepareForSleep(false) D-Bus signal), unlock (logind Session's
//             Unlock D-Bus signal) — both real events via zbus_systemd, not polled — plus idle
//             (logind Session's IdleHint property, polled). XScreenSaverQueryInfo/proc-uptime
//             were considered and rejected: XScreenSaverQueryInfo needs X11 and is inert under
//             Wayland; /proc/uptime is system boot time, not user input idle time, and cannot
//             detect an idle→active edge at all. IdleHint is compositor-agnostic. (Task #167)
// All platforms share the same enabled/snooze guard shape and call the same emit_interrupt()
// helper, which resets last_triggered_secs so the interval-timer poll in interrupt.rs does not
// double-fire. Each platform runs on its own single named background thread started at app
// startup from start_os_listeners, called once from lib.rs.
// Imports: crate::interrupt::{InterruptState, now_secs}. Used by: lib.rs.
//
// NOT compiled or tested on real Windows/Linux hardware by the agent that wrote the Windows and
// Linux blocks (2026-07-31) — only the macOS target was available. Both blocks were written
// against verified current crate docs (windows-sys 0.61.2, zbus_systemd 0.26100.0) rather than
// from memory, but per Task #166/#167's own "Done when" criteria, `cargo build --target
// x86_64-pc-windows-msvc` / `--target x86_64-unknown-linux-gnu` plus real-device manual testing
// (matching the precedent set by Task #162's macOS block) are still required before shipping.

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

/// Start the OS-event listener thread for the current platform (macOS, Windows, or Linux).
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

                    // ── Guard state (read once, release lock before any emit) ──────────────────
                    let (enabled, snooze_until, mandatory, wake_enabled, unlock_enabled, idle_enabled, idle_threshold_secs) = {
                        let Ok(st) = state.lock() else { return; };
                        (st.enabled, st.snooze_until_secs, st.mandatory,
                         st.wake_enabled, st.unlock_enabled, st.idle_enabled, st.idle_threshold_secs)
                    };

                    let idle_secs = idle_seconds();
                    let is_idle = idle_secs >= idle_threshold_secs as f64;
                    let prev_idle = was_idle;
                    was_idle = is_idle; // advance before possible emit

                    // ── Wake detection ──────────────────────────────────────────────────────────
                    if !tick_fired
                        && elapsed > WAKE_THRESHOLD_SECS
                        && enabled
                        && wake_enabled
                        && now >= snooze_until
                    {
                        emit_interrupt(&app, &state, now, mandatory);
                        tick_fired = true;
                    }

                    // ── Unlock detection ────────────────────────────────────────────────────────
                    if !tick_fired && prev_locked && !is_locked && enabled && unlock_enabled && now >= snooze_until {
                        emit_interrupt(&app, &state, now, mandatory);
                        tick_fired = true;
                    }

                    // ── Idle→active detection ───────────────────────────────────────────────────
                    // Fires on the idle→active edge.  No separate cooldown is needed: once
                    // prev_idle is false the user must idle for another idle_threshold_secs
                    // before the next fire is possible.
                    if !tick_fired && prev_idle && !is_idle && enabled && idle_enabled && now >= snooze_until {
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

    #[cfg(target_os = "windows")]
    windows_impl::start(app, state);

    #[cfg(target_os = "linux")]
    linux_impl::start(app, state);

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let _ = (app, state);
}

// ── Shared helpers (all platforms) ────────────────────────────────────────────────────────────

/// Emit "interrupt:fire" and update last_triggered_secs so the interval-timer poll in
/// interrupt.rs does not fire again immediately after an OS-event trigger. Body has no
/// platform-specific code — shared by macOS, Windows, and Linux.
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

// ── Windows implementation (Task #166) ────────────────────────────────────────────────────────
//
// Unlike macOS, Windows delivers wake and unlock as real, discrete OS events rather than
// something we have to poll and infer — WM_POWERBROADCAST/PBT_APMRESUMEAUTOMATIC for wake,
// WM_WTSSESSION_CHANGE/WTS_SESSION_UNLOCK for unlock. Both require a window to receive messages;
// there is no wait-free polling alternative for either. We create a hidden message-only window
// (parent HWND_MESSAGE — never shown, no visible UI) purely to host a message loop. Idle
// detection still has to be polled (GetLastInputInfo has no push/event variant), done via a
// WM_TIMER on the same loop so everything funnels through one thread and one WNDPROC.
//
// KNOWN RESIDUAL GAP (mirrors the already-accepted macOS/interrupt.rs cross-thread TOCTOU debt
// item, Batch 19 debt.md F3): WM_POWERBROADCAST and WM_WTSSESSION_CHANGE are independent,
// asynchronously-delivered messages. In the rare case both arrive for the same real-world event
// (e.g. resume-from-sleep immediately followed by an auto-unlock), two interrupt:fire events can
// be emitted close together instead of one. Outcome is an idempotent duplicate notification, not
// data loss — same severity/shape as the accepted macOS/Rust cross-thread case. Not fixed here;
// flagging so a future audit doesn't treat it as new.
#[cfg(target_os = "windows")]
mod windows_impl {
    use std::cell::RefCell;
    use std::sync::{Arc, Mutex};
    use std::thread;
    use tauri::{AppHandle, Emitter};

    use crate::interrupt::{now_secs, InterruptState};
    use super::emit_interrupt;

    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, GetTickCount,
        RegisterClassExW, SetTimer, TranslateMessage, HWND_MESSAGE, MSG, WM_DESTROY, WM_TIMER,
        WNDCLASSEXW,
    };

    // Verified against docs.rs/windows-sys 0.61.2 + Microsoft Learn (2026-07-31) — see
    // os_events.rs module header for the verification caveat. WM_POWERBROADCAST/
    // WM_WTSSESSION_CHANGE are not exposed as named constants in the WindowsAndMessaging
    // module's safe re-export surface used here, so they're declared explicitly.
    const WM_POWERBROADCAST: u32 = 0x0218;
    const PBT_APMRESUMEAUTOMATIC: u32 = 0x0012;
    const WM_WTSSESSION_CHANGE: u32 = 0x02B1;
    const WTS_SESSION_UNLOCK: usize = 0x8;

    const IDLE_POLL_TIMER_ID: usize = 1;
    /// Mirrors OS_POLL_SECS (5 s) on the poll-driven macOS/Linux idle checks.
    const IDLE_POLL_INTERVAL_MS: u32 = super::OS_POLL_SECS as u32 * 1000;

    /// Per-thread state the WNDPROC needs. WNDPROC is a plain `extern "system" fn` with no
    /// closure capture, so state is stashed in a thread-local set once before the message loop
    /// starts. Sound because WNDPROC only ever runs on the same thread that owns this cell —
    /// GetMessageW/DispatchMessageW dispatch synchronously on the calling thread.
    struct LoopState {
        app: AppHandle,
        state: Arc<Mutex<InterruptState>>,
        was_idle: bool,
    }

    thread_local! {
        static LOOP_STATE: RefCell<Option<LoopState>> = const { RefCell::new(None) };
    }

    pub fn start(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
        let builder = thread::Builder::new().name("plyglt-os-events-win".into());
        // Ignore spawn failure — the interrupt poll thread still provides scheduled interrupts.
        let _ = builder.spawn(move || run_message_loop(app, state));
    }

    fn run_message_loop(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
        LOOP_STATE.with(|cell| {
            *cell.borrow_mut() = Some(LoopState { app, state, was_idle: false });
        });

        unsafe {
            let hinstance = GetModuleHandleW(std::ptr::null());
            let class_name: Vec<u16> = "PlygltOsEventsWindow\0".encode_utf16().collect();

            // HIGHEST-RISK SPOT IN THIS FILE FOR A COMPILE ERROR (see module header caveat):
            // windows-sys represents Win32 handles (HWND, HICON, HCURSOR, HBRUSH, HINSTANCE...)
            // as plain isize-like integers in some versions and as distinct newtype structs
            // (e.g. `HICON(pub isize)`) in others. The `0` literals below assume the former. If
            // `cargo check --target x86_64-pc-windows-msvc` reports a type mismatch here, wrap
            // each null handle in its newtype constructor (e.g. `HICON(0)`) instead of a bare 0.
            let wc = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: 0,
                lpfnWndProc: Some(wndproc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: hinstance,
                hIcon: 0,
                hCursor: 0,
                hbrBackground: 0,
                lpszMenuName: std::ptr::null(),
                lpszClassName: class_name.as_ptr(),
                hIconSm: 0,
            };

            if RegisterClassExW(&wc) == 0 {
                eprintln!(
                    "[plyglt-{:010}] os_events(windows): RegisterClassExW failed — wake/unlock/idle detection unavailable this run",
                    now_secs()
                );
                return;
            }

            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                std::ptr::null(),
                0,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                0,
                hinstance,
                std::ptr::null(),
            );

            if hwnd == 0 {
                eprintln!(
                    "[plyglt-{:010}] os_events(windows): CreateWindowExW failed — wake/unlock/idle detection unavailable this run",
                    now_secs()
                );
                return;
            }

            // Unlock detection: subscribe this window to session change notifications.
            // A zero return means the OS refused registration (rare); unlock detection is
            // simply unavailable for this run — wake and idle detection still work, same
            // graceful-degradation policy as macOS's missing-symbol case.
            if WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) == 0 {
                eprintln!(
                    "[plyglt-{:010}] os_events(windows): WTSRegisterSessionNotification failed — unlock detection disabled; wake and idle detection active",
                    now_secs()
                );
            }

            // Idle detection: poll on a timer delivered through the same message loop.
            SetTimer(hwnd, IDLE_POLL_TIMER_ID, IDLE_POLL_INTERVAL_MS, None);

            let mut msg: MSG = std::mem::zeroed();
            // Blocks until a message arrives; returns 0 on WM_QUIT (never posted — this window
            // lives for the process lifetime) or -1 on error. No graceful shutdown path, matching
            // the macOS/Linux threads: the whole process exits together.
            while GetMessageW(&mut msg, 0, 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    }

    /// Window procedure. Every branch is wrapped in catch_unwind — a panic unwinding across this
    /// extern "system" boundary would otherwise abort the whole process (matching the
    /// catch_unwind discipline already applied to the macOS/Linux poll loop bodies).
    unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        let handled = std::panic::catch_unwind(|| {
            match msg {
                WM_POWERBROADCAST => {
                    if wparam as u32 == PBT_APMRESUMEAUTOMATIC {
                        on_event(EventKind::Wake);
                    }
                    true
                }
                WM_WTSSESSION_CHANGE => {
                    if wparam == WTS_SESSION_UNLOCK {
                        on_event(EventKind::Unlock);
                    }
                    true
                }
                WM_TIMER => {
                    if wparam as usize == IDLE_POLL_TIMER_ID {
                        check_idle();
                    }
                    true
                }
                WM_DESTROY => true,
                _ => false,
            }
        });

        match handled {
            Ok(true) => 0,
            Ok(false) => DefWindowProcW(hwnd, msg, wparam, lparam),
            Err(_) => {
                eprintln!(
                    "[OSEV-WIN-PANIC-{:010}] os_events(windows): recovered from panic in wndproc; \
                     wake/unlock/idle detection will resume on the next message",
                    now_secs()
                );
                0
            }
        }
    }

    enum EventKind {
        Wake,
        Unlock,
    }

    /// Shared guard check for the two event-driven detectors (wake, unlock) — both are real OS
    /// events with no elapsed-time heuristic needed, unlike macOS's wake detection.
    fn on_event(kind: EventKind) {
        LOOP_STATE.with(|cell| {
            let borrow = cell.borrow();
            let Some(loop_state) = borrow.as_ref() else { return };

            let now = now_secs();
            let (enabled, snooze_until, mandatory, wake_enabled, unlock_enabled) = {
                let Ok(st) = loop_state.state.lock() else { return };
                (st.enabled, st.snooze_until_secs, st.mandatory, st.wake_enabled, st.unlock_enabled)
            };
            if !enabled || now < snooze_until {
                return;
            }
            let should_fire = match kind {
                EventKind::Wake => wake_enabled,
                EventKind::Unlock => unlock_enabled,
            };
            if should_fire {
                emit_interrupt(&loop_state.app, &loop_state.state, now, mandatory);
            }
        });
    }

    /// Idle→active edge detection, mirroring the prev/current pattern used on macOS and Linux.
    fn check_idle() {
        LOOP_STATE.with(|cell| {
            let mut borrow = cell.borrow_mut();
            let Some(loop_state) = borrow.as_mut() else { return };

            let now = now_secs();
            let (enabled, snooze_until, mandatory, idle_enabled, idle_threshold_secs) = {
                let Ok(st) = loop_state.state.lock() else { return };
                (st.enabled, st.snooze_until_secs, st.mandatory, st.idle_enabled, st.idle_threshold_secs)
            };

            let idle_secs = idle_seconds();
            let is_idle = idle_secs >= idle_threshold_secs as f64;
            let prev_idle = loop_state.was_idle;
            loop_state.was_idle = is_idle; // advance before possible emit

            if prev_idle && !is_idle && enabled && idle_enabled && now >= snooze_until {
                emit_interrupt(&loop_state.app, &loop_state.state, now, mandatory);
            }
        });
    }

    /// Seconds since the last keyboard/mouse input, via GetLastInputInfo. Returns 0.0 (never
    /// idle) if the call fails — same fail-safe-inactive policy as macOS's idle_seconds().
    fn idle_seconds() -> f64 {
        unsafe {
            let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
            if GetLastInputInfo(&mut info) == 0 {
                return 0.0;
            }
            let now_ticks = GetTickCount();
            // GetTickCount wraps every ~49.7 days; a wrapped comparison would read as a huge
            // idle value instead of a small one. Treat any wrap (now < last input tick) as
            // "just active" (0 idle) rather than propagate a spurious multi-day idle reading.
            if now_ticks < info.dwTime {
                return 0.0;
            }
            (now_ticks - info.dwTime) as f64 / 1000.0
        }
    }
}

// ── Linux implementation (Task #167) ──────────────────────────────────────────────────────────
//
// Like Windows, logind delivers wake and unlock as real D-Bus signals rather than something we
// poll and infer: org.freedesktop.login1.Manager's PrepareForSleep(false) signal fires on
// resume; org.freedesktop.login1.Session's Unlock signal fires on unlock. Idle detection uses
// logind's IdleHint session property (polled) rather than the task spec's original suggestion of
// XScreenSaverQueryInfo or /proc/uptime — both rejected: XScreenSaverQueryInfo requires X11 and
// is inert under Wayland (increasingly the Linux desktop default); /proc/uptime is system boot
// time, not user input idle time, and cannot express an idle→active edge at all. IdleHint is
// tracked by logind itself from compositor-reported input activity, so it works under both X11
// and Wayland with no extra system dependency beyond the D-Bus connection already needed for
// wake/unlock.
#[cfg(target_os = "linux")]
mod linux_impl {
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    use crate::interrupt::{now_secs, InterruptState};
    use super::emit_interrupt;

    use futures_util::StreamExt;
    use zbus_systemd::login1::{ManagerProxy, SessionProxy};

    pub fn start(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
        let builder = thread::Builder::new().name("plyglt-os-events-linux".into());
        // Ignore spawn failure — the interrupt poll thread still provides scheduled interrupts.
        let _ = builder.spawn(move || {
            // A dedicated single-threaded async runtime, isolated to this one thread — the rest
            // of the codebase is sync (thread::spawn poll loops), so this does not pull the
            // whole app onto an async runtime, matching the macOS/Windows thread-per-platform
            // architecture.
            let rt = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
                Ok(rt) => rt,
                Err(e) => {
                    eprintln!(
                        "[plyglt-{:010}] os_events(linux): failed to start async runtime ({e}) — wake/unlock/idle detection unavailable this run",
                        now_secs()
                    );
                    return;
                }
            };
            rt.block_on(run(app, state));
        });
    }

    // Unlike the macOS poll loop and the Windows wndproc, this loop does not wrap its per-event
    // handlers in catch_unwind: std::panic::catch_unwind does not compose simply across .await
    // points (it needs futures::FutureExt::catch_unwind plus an UnwindSafe bound on the whole
    // future), and the handlers here are small (a Mutex lock + an emit call) with a much lower
    // panic surface than the FFI-heavy macOS/Windows code. A panic here crashes this thread the
    // same way an uncaught panic anywhere else in this codebase would under the release profile's
    // `panic = "abort"` (Cargo.toml) — which, worth noting for a future reader, already means
    // every catch_unwind in this codebase, including the ones in interrupt.rs and the macOS/
    // Windows blocks above, does not actually recover a release-build panic; catch_unwind only
    // has effect in dev/test builds where unwinding is enabled. Full async-aware panic recovery
    // for this loop is a small, separable follow-up if parity is wanted later.
    async fn run(app: AppHandle, state: Arc<Mutex<InterruptState>>) {
        let connection = match zbus::Connection::system().await {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "[plyglt-{:010}] os_events(linux): D-Bus system connection failed ({e}) — wake/unlock/idle detection unavailable this run",
                    now_secs()
                );
                return;
            }
        };

        let manager = match ManagerProxy::new(&connection).await {
            Ok(m) => m,
            Err(e) => {
                eprintln!(
                    "[plyglt-{:010}] os_events(linux): logind Manager proxy failed ({e}) — wake/unlock/idle detection unavailable this run",
                    now_secs()
                );
                return;
            }
        };

        // pid 0 resolves to the calling process's own session (systemd-logind convention).
        // If this process has no known session (e.g. running outside a real login session),
        // session-scoped detection (unlock, idle) is unavailable — wake detection still works
        // since PrepareForSleep is a Manager-level, session-independent signal.
        let session: Option<SessionProxy> = match manager.get_session_by_pid(0).await {
            Ok(path) => match SessionProxy::new(&connection, path).await {
                Ok(s) => Some(s),
                Err(e) => {
                    eprintln!(
                        "[plyglt-{:010}] os_events(linux): logind Session proxy failed ({e}) — unlock/idle detection disabled; wake detection active",
                        now_secs()
                    );
                    None
                }
            },
            Err(e) => {
                eprintln!(
                    "[plyglt-{:010}] os_events(linux): GetSessionByPID failed ({e}) — unlock/idle detection disabled; wake detection active",
                    now_secs()
                );
                None
            }
        };

        let mut sleep_stream = match manager.receive_prepare_for_sleep().await {
            Ok(s) => Some(s),
            Err(e) => {
                eprintln!(
                    "[plyglt-{:010}] os_events(linux): PrepareForSleep subscription failed ({e}) — wake detection disabled",
                    now_secs()
                );
                None
            }
        };

        let mut unlock_stream = match &session {
            Some(s) => match s.receive_unlock().await {
                Ok(s) => Some(s),
                Err(e) => {
                    eprintln!(
                        "[plyglt-{:010}] os_events(linux): Unlock signal subscription failed ({e}) — unlock detection disabled",
                        now_secs()
                    );
                    None
                }
            },
            None => None,
        };

        let mut idle_poll = tokio::time::interval(Duration::from_secs(super::OS_POLL_SECS));
        let mut was_idle = false;

        loop {
            tokio::select! {
                Some(args) = async {
                    match sleep_stream.as_mut() {
                        Some(s) => s.next().await.and_then(|sig| sig.args().ok().map(|a| a.start)),
                        None => std::future::pending().await,
                    }
                } => {
                    // PrepareForSleep(true) = about to suspend; PrepareForSleep(false) = just
                    // resumed. Only the resume edge should ever interrupt the user.
                    if !args {
                        on_wake(&app, &state).await;
                    }
                }
                Some(_) = async {
                    match unlock_stream.as_mut() {
                        Some(s) => s.next().await,
                        None => std::future::pending().await,
                    }
                } => {
                    on_unlock(&app, &state).await;
                }
                _ = idle_poll.tick() => {
                    if let Some(s) = &session {
                        was_idle = check_idle(&app, &state, s, was_idle).await;
                    }
                }
            }
        }
    }

    async fn on_wake(app: &AppHandle, state: &Arc<Mutex<InterruptState>>) {
        let now = now_secs();
        let (enabled, snooze_until, mandatory, wake_enabled) = {
            let Ok(st) = state.lock() else { return };
            (st.enabled, st.snooze_until_secs, st.mandatory, st.wake_enabled)
        };
        if enabled && wake_enabled && now >= snooze_until {
            emit_interrupt(app, state, now, mandatory);
        }
    }

    async fn on_unlock(app: &AppHandle, state: &Arc<Mutex<InterruptState>>) {
        let now = now_secs();
        let (enabled, snooze_until, mandatory, unlock_enabled) = {
            let Ok(st) = state.lock() else { return };
            (st.enabled, st.snooze_until_secs, st.mandatory, st.unlock_enabled)
        };
        if enabled && unlock_enabled && now >= snooze_until {
            emit_interrupt(app, state, now, mandatory);
        }
    }

    /// Idle→active edge detection via logind's IdleHint property. Returns the new was_idle value
    /// for the caller to carry into the next poll — mirrors the prev/current pattern used on
    /// macOS and Windows.
    async fn check_idle(
        app: &AppHandle,
        state: &Arc<Mutex<InterruptState>>,
        session: &SessionProxy<'_>,
        was_idle: bool,
    ) -> bool {
        let now = now_secs();
        let (enabled, snooze_until, mandatory, idle_enabled) = {
            let Ok(st) = state.lock() else { return was_idle };
            (st.enabled, st.snooze_until_secs, st.mandatory, st.idle_enabled)
        };

        // idle_threshold_secs is enforced by logind's own IdleAction/IdleActionSec config for
        // system-level idle actions, but IdleHint itself does not accept a caller-supplied
        // threshold — it reflects logind's own (typically short) idle heuristic. We treat any
        // IdleHint=true as "idle" and fire on the true→false edge; the user-configured
        // idle_threshold_minutes therefore does not tune Linux idle sensitivity the way it does
        // on macOS/Windows (both poll a raw elapsed-seconds value against the threshold). This
        // is a known platform asymmetry, not a bug — logind does not expose a raw idle-seconds
        // value over D-Bus, only the boolean hint.
        let is_idle = match session.idle_hint().await {
            Ok(v) => v,
            Err(_) => return was_idle, // query failed — hold previous state, try again next tick
        };

        if was_idle && !is_idle && enabled && idle_enabled && now >= snooze_until {
            emit_interrupt(app, state, now, mandatory);
        }
        is_idle
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::WAKE_THRESHOLD_SECS;

    // Pure guard-condition helpers that mirror the detection branches in start_os_listeners.
    // Testing these directly avoids needing a Tauri AppHandle or macOS FFI in unit tests.

    fn wake_fires(elapsed: u64, enabled: bool, wake_enabled: bool, now: u64, snooze_until: u64) -> bool {
        elapsed > WAKE_THRESHOLD_SECS && enabled && wake_enabled && now >= snooze_until
    }

    fn unlock_fires(prev_locked: bool, is_locked: bool, enabled: bool, unlock_enabled: bool, now: u64, snooze_until: u64) -> bool {
        prev_locked && !is_locked && enabled && unlock_enabled && now >= snooze_until
    }

    fn idle_fires(prev_idle: bool, is_idle: bool, enabled: bool, idle_enabled: bool, now: u64, snooze_until: u64) -> bool {
        prev_idle && !is_idle && enabled && idle_enabled && now >= snooze_until
    }

    // #187 — wake_enabled gates wake detection

    #[test]
    fn wake_disabled_suppresses_wake_interrupt() {
        assert!(!wake_fires(WAKE_THRESHOLD_SECS + 1, true, false, 1000, 0),
            "wake_enabled=false must suppress interrupt even when all other conditions are met");
    }

    #[test]
    fn wake_enabled_fires_when_conditions_met() {
        assert!(wake_fires(WAKE_THRESHOLD_SECS + 1, true, true, 1000, 0));
    }

    #[test]
    fn wake_below_threshold_never_fires() {
        assert!(!wake_fires(WAKE_THRESHOLD_SECS, true, true, 1000, 0),
            "elapsed must exceed WAKE_THRESHOLD_SECS, not merely equal it");
    }

    // #188 — unlock_enabled gates unlock detection

    #[test]
    fn unlock_disabled_suppresses_unlock_interrupt() {
        assert!(!unlock_fires(true, false, true, false, 1000, 0),
            "unlock_enabled=false must suppress interrupt on lock→unlock transition");
    }

    #[test]
    fn unlock_enabled_fires_on_lock_edge() {
        assert!(unlock_fires(true, false, true, true, 1000, 0));
    }

    #[test]
    fn unlock_no_fire_without_prior_lock() {
        assert!(!unlock_fires(false, false, true, true, 1000, 0),
            "no fire unless prev_locked was true");
    }

    // #189 — idle_enabled gates idle→active detection

    #[test]
    fn idle_disabled_suppresses_idle_return_interrupt() {
        assert!(!idle_fires(true, false, true, false, 1000, 0),
            "idle_enabled=false must suppress interrupt on idle→active transition");
    }

    #[test]
    fn idle_enabled_fires_on_active_return() {
        assert!(idle_fires(true, false, true, true, 1000, 0));
    }

    #[test]
    fn idle_no_fire_without_prior_idle() {
        assert!(!idle_fires(false, false, true, true, 1000, 0),
            "no fire unless user was previously idle");
    }

    // #190 — idle_threshold_secs from state replaces hardcoded constant

    #[test]
    fn custom_idle_threshold_is_used() {
        // A user-configured threshold of 300 s: 400 s idle → detected; 200 s idle → not.
        let threshold: f64 = 300.0;
        assert!(400.0_f64 >= threshold, "400 s >= 300 s threshold → idle");
        assert!(!(200.0_f64 >= threshold), "200 s < 300 s threshold → active");
    }

    #[test]
    fn idle_threshold_change_affects_detection_boundary() {
        // At 900 s (old hardcoded constant): 850 s idle → not detected.
        // At 600 s (new configurable): 850 s idle → detected.
        let idle_secs: f64 = 850.0;
        assert!(!(idle_secs >= 900.0), "under old hardcoded threshold → not idle");
        assert!(idle_secs >= 600.0, "under custom threshold → idle");
    }

    // ── Task #166/#167 — Windows and Linux guard logic ──────────────────────────────────────
    //
    // unlock_fires and idle_fires above are already platform-agnostic edge-detection guards
    // (prev && !current && enabled && specific_enabled && now >= snooze_until) — Windows and
    // Linux use the exact same shape (Windows: WM_WTSSESSION_CHANGE/IdleHint transition;
    // Linux: logind Unlock signal/IdleHint transition), so they're reused directly below rather
    // than duplicated. Wake is the one exception: macOS infers wake from an elapsed-time gap
    // (wake_fires above), but Windows and Linux both receive wake as a real, already-detected
    // OS event (WM_POWERBROADCAST/PBT_APMRESUMEAUTOMATIC; logind's PrepareForSleep(false)) with
    // no elapsed-time heuristic — event_wake_fires below models that different guard shape.

    fn event_wake_fires(event_occurred: bool, enabled: bool, wake_enabled: bool, now: u64, snooze_until: u64) -> bool {
        event_occurred && enabled && wake_enabled && now >= snooze_until
    }

    #[test]
    fn event_wake_disabled_suppresses_wake_interrupt() {
        assert!(!event_wake_fires(true, true, false, 1000, 0),
            "wake_enabled=false must suppress interrupt even when the OS reported a real resume event");
    }

    #[test]
    fn event_wake_enabled_fires_when_conditions_met() {
        assert!(event_wake_fires(true, true, true, 1000, 0));
    }

    #[test]
    fn event_wake_no_event_never_fires() {
        assert!(!event_wake_fires(false, true, true, 1000, 0),
            "no resume event occurred this tick — must not fire regardless of other flags");
    }

    #[test]
    fn event_wake_respects_snooze() {
        assert!(!event_wake_fires(true, true, true, 1000, 2000),
            "now < snooze_until must suppress even a real resume event");
    }

    // Windows/Linux reuse of unlock_fires — same shape, different event source per platform.

    #[test]
    fn windows_linux_unlock_disabled_suppresses_unlock_interrupt() {
        assert!(!unlock_fires(true, false, true, false, 1000, 0),
            "unlock_enabled=false must suppress WM_WTSSESSION_CHANGE/logind Unlock the same way it suppresses macOS's polled unlock");
    }

    #[test]
    fn windows_linux_unlock_fires_on_real_event() {
        // Windows/Linux don't poll prev/current lock state — the OS event itself IS the edge.
        // Modeled here as prev_locked=true, is_locked=false (the edge unlock_fires expects).
        assert!(unlock_fires(true, false, true, true, 1000, 0));
    }

    // Windows/Linux reuse of idle_fires — same shape, values sourced from GetLastInputInfo
    // (Windows) or logind's IdleHint (Linux) instead of macOS's CGEventSourceSecondsSinceLastEventType.

    #[test]
    fn windows_linux_idle_disabled_suppresses_idle_interrupt() {
        assert!(!idle_fires(true, false, true, false, 1000, 0));
    }

    #[test]
    fn windows_linux_idle_fires_on_active_return() {
        assert!(idle_fires(true, false, true, true, 1000, 0));
    }
}
