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
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only HTTPS URLs may be opened".to_string());
    }
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
