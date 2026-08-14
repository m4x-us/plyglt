// license.rs — Owns Lemon Squeezy license management IPC commands: ls_activate_license,
// ls_validate_license, ls_deactivate_license (all POST to the LS /v1/licenses API), and
// open_url (opens an HTTPS URL in the system browser, rejecting non-HTTPS schemes).
// Registered by lib.rs; called from the JS side by hooks/useLicenseActivation.ts and
// components/EntitlementValidator.tsx via invoke().

const LS_BASE: &str = "https://api.lemonsqueezy.com/v1/licenses";

#[tauri::command]
pub async fn ls_activate_license(license_key: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    client
        .post(format!("{LS_BASE}/activate"))
        .form(&[("license_key", license_key.as_str()), ("instance_name", "plyglt")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ls_validate_license(
    license_key: String,
    instance_id: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    client
        .post(format!("{LS_BASE}/validate"))
        .form(&[("license_key", license_key.as_str()), ("instance_id", instance_id.as_str())])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ls_deactivate_license(
    license_key: String,
    instance_id: String,
) -> Result<bool, String> {
    let res = reqwest::Client::new()
        .post(format!("{LS_BASE}/deactivate"))
        .form(&[("license_key", license_key.as_str()), ("instance_id", instance_id.as_str())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Deactivation failed: HTTP {}", res.status()));
    }
    Ok(true)
}

/// Open a URL in the system default browser. Only HTTPS URLs are accepted.
///
/// Every supported platform must have an explicit branch here — before the iOS
/// branch existed, an iOS call fell through all the desktop cfg blocks and
/// returned Ok(()) having done nothing, which surfaced as a silently dead
/// "Sign in with Apple" button on the first real-device TestFlight build
/// (Task #522, 2026-08-14). The final `allow(unreachable_code)` Err is the
/// guard against that class of bug recurring on a future platform (Android,
/// Task #172): better an explicit error string than a silent no-op success.
#[tauri::command]
pub fn open_url(url: String, app: tauri::AppHandle) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only HTTPS URLs may be opened".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        let _ = app;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
        let _ = app;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        let _ = app;
        return Ok(());
    }
    // iOS has no shell to spawn — open via UIApplication, which hands the URL
    // to Safari (or the system default handler). Must run on the main thread.
    #[cfg(target_os = "ios")]
    {
        app.run_on_main_thread(move || {
            use objc2_foundation::{NSDictionary, NSString, NSURL};
            use objc2_ui_kit::UIApplication;
            let Some(mtm) = objc2::MainThreadMarker::new() else {
                eprintln!("[ERR-OPENURL-NOTMAIN] run_on_main_thread landed off the main thread");
                return;
            };
            let ns_url = NSURL::URLWithString(&NSString::from_str(&url));
            let Some(ns_url) = ns_url else {
                eprintln!("[ERR-OPENURL-PARSE] NSURL rejected URL");
                return;
            };
            let ui_app = UIApplication::sharedApplication(mtm);
            unsafe {
                ui_app.openURL_options_completionHandler(&ns_url, &NSDictionary::new(), None);
            }
        })
        .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("open_url is not implemented for this platform".to_string())
}
