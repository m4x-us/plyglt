// Prevents a terminal window from appearing on Windows in release builds.
// TEMPORARILY DISABLED (Task #166 live Windows VM investigation, 2026-08-12) — a real console
// is needed to see tray.rs's new diagnostic eprintln! output while chasing the unresponsive
// tray icon bug, since release builds otherwise send stderr nowhere visible. Same open
// question already logged for the devtools Cargo feature (v0.1.0-beta.8): re-enable once
// this investigation concludes, or feature-gate both out of the real signed production build.
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    plyglt_lib::run();
}
