//! Typed IPC surface for the Tauri WebView.
//!
//! Commands persist app settings, render isolated previews, and read the host
//! firewall. They never load rules or elevate the process.

use crate::store::{PreviewState, Store};
use serde::Serialize;
use tauri::State;

fn describe(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
pub fn load_state(store: State<'_, Store>) -> Result<Option<PreviewState>, String> {
    store.load().map_err(describe)
}

#[tauri::command]
pub fn save_state(store: State<'_, Store>, payload: PreviewState) -> Result<(), String> {
    store.save(&payload).map_err(describe)
}

#[tauri::command]
pub fn reset_state(store: State<'_, Store>) -> Result<(), String> {
    store.reset().map_err(describe)
}

#[tauri::command]
pub async fn read_system_rules() -> Result<port_guard_desktop::system_rules::Inventory, String> {
    tauri::async_runtime::spawn_blocking(port_guard_desktop::system_rules::read_system_rules)
        .await
        .map_err(describe)
}

#[tauri::command]
pub async fn read_access_logs(
    store: State<'_, Store>,
) -> Result<port_guard_desktop::access_logs::LogSnapshot, String> {
    let path = store.path().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let store = Store::open(path).map_err(describe)?;
        port_guard_desktop::access_logs::read_access_logs(&store).map_err(describe)
    })
    .await
    .map_err(describe)?
}

/// Render the PF anchor body for the given rules. This is preview-only output;
/// it cannot attach the anchor or enable PF.
#[tauri::command]
pub fn preview_policy(payload: PreviewState) -> Result<String, String> {
    if std::env::consts::OS != "macos" {
        return Err("PF 规则预览仅支持 macOS；Windows WFP 尚未接入".into());
    }
    let compiled = crate::store::compiled_policy(&payload).map_err(describe)?;
    Ok(compiled.render())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
    pub arch: String,
    pub database: String,
    pub runtime: String,
}

#[tauri::command]
pub fn app_info(store: State<'_, Store>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        database: store.path().display().to_string(),
        runtime: "tauri-webview".to_string(),
    }
}
