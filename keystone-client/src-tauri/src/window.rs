use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

use crate::{bridge::CoreBridgeError, state::CoreBridgeState};

const MAIN_WINDOW: &str = "main";
const WEB_URL: &str = "https://keystonesync.esgarpe.dev";
const RELEASES_URL: &str = "https://github.com/Speeson/weeklyChar/releases";
const RAIDER_IO_BASE_URL: &str = "https://raider.io/characters";
pub const CLOSE_REQUESTED_EVENT: &str = "keystone://close-requested";

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

pub fn hide_to_tray(app: &AppHandle) -> Result<(), CoreBridgeError> {
    let window = main_window(app).ok_or_else(|| CoreBridgeError {
        code: "WINDOW_NOT_FOUND".to_string(),
        message: "The KeystoneClient window is unavailable.".to_string(),
    })?;
    window.hide().map_err(|_| CoreBridgeError {
        code: "WINDOW_HIDE_FAILED".to_string(),
        message: "KeystoneClient could not be minimized to the tray.".to_string(),
    })
}

pub fn setup_window_lifecycle(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = app_handle.emit(CLOSE_REQUESTED_EVENT, ());
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

pub fn open_releases(app: &AppHandle) -> Result<(), CoreBridgeError> {
    app.opener()
        .open_url(RELEASES_URL, None::<&str>)
        .map_err(|_| CoreBridgeError {
            code: "OPEN_RELEASES_FAILED".to_string(),
            message: "Could not open KeystoneClient releases.".to_string(),
        })
}

pub fn open_raiderio_character(
    app: &AppHandle,
    region: &str,
    realm: &str,
    name: &str,
) -> Result<(), CoreBridgeError> {
    let url = raiderio_character_url(region, realm, name)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| CoreBridgeError {
            code: "OPEN_RAIDERIO_FAILED".to_string(),
            message: "Could not open the Raider.IO character profile.".to_string(),
        })
}

fn raiderio_character_url(
    region: &str,
    realm: &str,
    name: &str,
) -> Result<String, CoreBridgeError> {
    let region = region.trim().to_ascii_lowercase();
    if !matches!(region.as_str(), "eu" | "us" | "kr" | "tw" | "cn") {
        return Err(invalid_raiderio_character());
    }
    let realm = validated_url_component(realm)?;
    let name = validated_url_component(name)?;
    Ok(format!("{RAIDER_IO_BASE_URL}/{region}/{realm}/{name}"))
}

fn validated_url_component(value: &str) -> Result<String, CoreBridgeError> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 100 || value.chars().any(char::is_control) {
        return Err(invalid_raiderio_character());
    }

    let mut encoded = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(*byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    Ok(encoded)
}

fn invalid_raiderio_character() -> CoreBridgeError {
    CoreBridgeError {
        code: "INVALID_RAIDERIO_CHARACTER".to_string(),
        message: "Character region, realm or name is invalid.".to_string(),
    }
}

pub fn exit_app(app: &AppHandle) {
    if let Some(state) = app.try_state::<CoreBridgeState>() {
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
    use super::{raiderio_character_url, CLOSE_REQUESTED_EVENT, WEB_URL};

    #[test]
    fn packaged_window_is_frameless() {
        let config = include_str!("../tauri.conf.json");
        let value: serde_json::Value = serde_json::from_str(config).unwrap();
        assert_eq!(value["app"]["windows"][0]["decorations"], false);
        assert_eq!(CLOSE_REQUESTED_EVENT, "keystone://close-requested");

        for icon in value["bundle"]["icon"].as_array().unwrap() {
            let path =
                std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(icon.as_str().unwrap());
            assert!(path.is_file(), "missing packaged icon: {}", path.display());
        }

        let build_script = include_str!("../build.rs");
        assert!(build_script.contains("cargo:rerun-if-changed=icons/icon.ico"));
    }

    #[test]
    fn web_url_is_scoped_to_keystonesync() {
        assert_eq!(WEB_URL, "https://keystonesync.esgarpe.dev");
    }

    #[test]
    fn raiderio_url_is_scoped_and_percent_encoded() {
        assert_eq!(
            raiderio_character_url("EU", "Dun Modr", "Auralis").unwrap(),
            "https://raider.io/characters/eu/Dun%20Modr/Auralis"
        );
        assert_eq!(
            raiderio_character_url("eu", "Ragnaros", "N\u{e1}dia").unwrap(),
            "https://raider.io/characters/eu/Ragnaros/N%C3%A1dia"
        );
    }

    #[test]
    fn raiderio_url_rejects_untrusted_regions_and_empty_components() {
        assert!(raiderio_character_url("https", "realm", "name").is_err());
        assert!(raiderio_character_url("cn", "realm", "name").is_ok());
        assert!(raiderio_character_url("eu", "", "name").is_err());
        assert!(raiderio_character_url("eu", "realm", "\n").is_err());
    }
}
