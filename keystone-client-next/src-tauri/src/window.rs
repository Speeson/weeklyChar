use serde_json::{json, Value};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

use crate::{bridge::CoreBridgeError, state::CoreBridgeState};

const MAIN_WINDOW: &str = "main";
const WEB_URL: &str = "https://keystonesync.esgarpe.dev";

pub fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn setup_window_lifecycle(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let minimize_on_close = app_handle
                .try_state::<CoreBridgeState>()
                .and_then(|state| setting_bool(&state, "minimizeOnClose").ok())
                .unwrap_or(false);
            if minimize_on_close {
                api.prevent_close();
                if let Some(window) = main_window(&app_handle) {
                    let _ = window.hide();
                }
            }
        }
    });
}

pub fn apply_start_minimized(app: &AppHandle) {
    let start_minimized = app
        .try_state::<CoreBridgeState>()
        .and_then(|state| setting_bool(&state, "startMinimized").ok())
        .unwrap_or(false);
    if start_minimized {
        if let Some(window) = main_window(app) {
            let _ = window.hide();
        }
    }
}

pub fn open_web(app: &AppHandle) -> Result<(), CoreBridgeError> {
    app.opener()
        .open_url(WEB_URL, None::<&str>)
        .map_err(|_| CoreBridgeError {
            code: "OPEN_WEB_FAILED".to_string(),
            message: "Could not open KeystoneSync Web.".to_string(),
        })
}

pub fn exit_app(app: &AppHandle) {
    if let Some(state) = app.try_state::<CoreBridgeState>() {
        let _ = state.request("sync.stop".to_string(), json!({}));
        state.shutdown();
    }
    app.exit(0);
}

fn setting_bool(state: &CoreBridgeState, key: &str) -> Result<bool, CoreBridgeError> {
    let settings = state.request("settings.get".to_string(), json!({}))?;
    Ok(settings
        .as_object()
        .and_then(|map| map.get(key))
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::WEB_URL;

    #[test]
    fn web_url_is_scoped_to_keystonesync() {
        assert_eq!(WEB_URL, "https://keystonesync.esgarpe.dev");
    }
}
