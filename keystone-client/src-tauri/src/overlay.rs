use serde::Serialize;
use serde_json::Value;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, MutexGuard,
};
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static OVERLAY_ACTIVE: AtomicBool = AtomicBool::new(false);
static SHORTCUT_CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
static REGISTRATION_STATE: Mutex<OverlayRegistrationState> =
    Mutex::new(OverlayRegistrationState::new());
pub const DEFAULT_OVERLAY_SHORTCUT: &str = "Ctrl+Shift+K";

#[derive(Debug, PartialEq)]
struct OverlayWindowFlags {
    always_on_top: bool,
    skip_taskbar: bool,
    request_focus: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayShortcutStatus {
    enabled: bool,
    shortcut: String,
    registered: bool,
    last_error: Option<String>,
}

#[derive(Debug, Clone)]
struct RegisteredBinding {
    shortcut: Shortcut,
}

#[derive(Debug)]
struct OverlayRegistrationState {
    enabled: bool,
    shortcut: String,
    registered: Option<RegisteredBinding>,
    last_error: Option<String>,
}

impl OverlayRegistrationState {
    const fn new() -> Self {
        Self {
            enabled: false,
            shortcut: String::new(),
            registered: None,
            last_error: None,
        }
    }

    fn status(&self) -> OverlayShortcutStatus {
        OverlayShortcutStatus {
            enabled: self.enabled,
            shortcut: if self.shortcut.is_empty() {
                DEFAULT_OVERLAY_SHORTCUT.to_string()
            } else {
                self.shortcut.clone()
            },
            registered: self.registered.is_some(),
            last_error: self.last_error.clone(),
        }
    }
}

fn registration_state() -> MutexGuard<'static, OverlayRegistrationState> {
    REGISTRATION_STATE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn overlay_window_flags() -> OverlayWindowFlags {
    OverlayWindowFlags {
        always_on_top: true,
        skip_taskbar: true,
        request_focus: false,
    }
}

fn parse_shortcut(value: &str) -> Result<Shortcut, String> {
    let shortcut = value
        .parse::<Shortcut>()
        .map_err(|error| format!("Invalid overlay shortcut: {error}"))?;
    if shortcut.mods == Modifiers::empty() {
        return Err("The overlay shortcut must include at least one modifier.".to_string());
    }
    Ok(shortcut)
}

fn register(app: &tauri::AppHandle, shortcut: Shortcut) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if should_toggle_for_shortcut_event(event.state) {
                let _ = toggle(app);
            }
        })
        .map_err(|error| format!("Could not register the overlay shortcut: {error}"))
}

fn should_toggle_for_shortcut_event(state: ShortcutState) -> bool {
    state == ShortcutState::Pressed && !SHORTCUT_CAPTURE_ACTIVE.load(Ordering::SeqCst)
}

pub fn begin_shortcut_capture() {
    SHORTCUT_CAPTURE_ACTIVE.store(true, Ordering::SeqCst);
}

pub fn end_shortcut_capture() {
    SHORTCUT_CAPTURE_ACTIVE.store(false, Ordering::SeqCst);
}

pub fn validate_shortcut(app: &tauri::AppHandle, shortcut_value: String) -> Result<(), String> {
    let shortcut = parse_shortcut(&shortcut_value)?;
    let matches_registered = registration_state()
        .registered
        .as_ref()
        .is_some_and(|current| current.shortcut.id() == shortcut.id());
    if matches_registered {
        return Ok(());
    }

    app.global_shortcut()
        .register(shortcut)
        .map_err(|error| format!("Could not use the overlay shortcut: {error}"))?;
    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|error| format!("Could not finish checking the overlay shortcut: {error}"))
}

fn set_registration_error(error: String) -> String {
    registration_state().last_error = Some(error.clone());
    error
}

pub fn setup(app: &tauri::AppHandle, settings: Result<Value, String>) {
    let (enabled, shortcut) = match settings {
        Ok(settings) => (
            settings
                .get("overlayEnabled")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            settings
                .get("overlayShortcut")
                .and_then(Value::as_str)
                .unwrap_or(DEFAULT_OVERLAY_SHORTCUT)
                .to_string(),
        ),
        Err(error) => {
            let mut state = registration_state();
            state.shortcut = DEFAULT_OVERLAY_SHORTCUT.to_string();
            state.last_error = Some(error);
            return;
        }
    };

    if configure(app, enabled, shortcut.clone()).is_err() {
        let mut state = registration_state();
        state.enabled = enabled;
        state.shortcut = shortcut;
    }
}

pub fn status() -> OverlayShortcutStatus {
    registration_state().status()
}

pub fn configure(
    app: &tauri::AppHandle,
    enabled: bool,
    shortcut_value: String,
) -> Result<OverlayShortcutStatus, String> {
    let shortcut = parse_shortcut(&shortcut_value).map_err(set_registration_error)?;
    let mut state = registration_state();

    if !enabled {
        let was_active = is_active();
        if was_active {
            restore_normal_window(app).map_err(|error| {
                state.last_error = Some(error.clone());
                error
            })?;
        }

        if let Some(current) = &state.registered {
            if let Err(error) = app.global_shortcut().unregister(current.shortcut) {
                let message = format!("Could not unregister the overlay shortcut: {error}");
                if was_active {
                    let _ = enable(app);
                }
                state.last_error = Some(message.clone());
                return Err(message);
            }
        }

        state.enabled = false;
        state.shortcut = shortcut_value;
        state.registered = None;
        state.last_error = None;
        return Ok(state.status());
    }

    if state
        .registered
        .as_ref()
        .is_some_and(|current| current.shortcut.id() == shortcut.id())
    {
        state.enabled = true;
        state.shortcut = shortcut_value;
        state.last_error = None;
        return Ok(state.status());
    }

    register(app, shortcut).map_err(|error| {
        state.last_error = Some(error.clone());
        error
    })?;

    if let Some(current) = &state.registered {
        if let Err(error) = app.global_shortcut().unregister(current.shortcut) {
            let rollback = app.global_shortcut().unregister(shortcut);
            let message = match rollback {
                Ok(()) => format!("Could not replace the overlay shortcut: {error}"),
                Err(rollback_error) => format!(
                    "Could not replace the overlay shortcut: {error}; cleanup also failed: {rollback_error}"
                ),
            };
            state.last_error = Some(message.clone());
            return Err(message);
        }
    }

    state.enabled = true;
    state.shortcut = shortcut_value;
    state.registered = Some(RegisteredBinding { shortcut });
    state.last_error = None;
    Ok(state.status())
}

pub fn is_active() -> bool {
    OVERLAY_ACTIVE.load(Ordering::SeqCst)
}

pub fn enable(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window unavailable".to_string())?;
    let flags = overlay_window_flags();

    window.unminimize().map_err(|error| error.to_string())?;
    window
        .set_focusable(false)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(flags.always_on_top)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(flags.skip_taskbar)
        .map_err(|error| error.to_string())?;
    debug_assert!(!flags.request_focus);
    window.show().map_err(|error| error.to_string())?;

    OVERLAY_ACTIVE.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn disable(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window unavailable".to_string())?;

    window.hide().map_err(|error| error.to_string())?;
    reset_window_flags(&window)?;

    OVERLAY_ACTIVE.store(false, Ordering::SeqCst);
    Ok(())
}

fn restore_normal_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window unavailable".to_string())?;
    reset_window_flags(&window)?;
    window.show().map_err(|error| error.to_string())?;
    OVERLAY_ACTIVE.store(false, Ordering::SeqCst);
    Ok(())
}

fn reset_window_flags(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_focusable(true)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(false)
        .map_err(|error| error.to_string())
}

pub fn toggle(app: &tauri::AppHandle) -> Result<(), String> {
    if is_active() {
        disable(app)
    } else {
        enable(app)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        begin_shortcut_capture, end_shortcut_capture, is_active, overlay_window_flags,
        parse_shortcut, registration_state, should_toggle_for_shortcut_event, status, Modifiers,
        Ordering, ShortcutState, OVERLAY_ACTIVE,
    };

    #[test]
    fn overlay_never_requests_focus() {
        let flags = overlay_window_flags();

        assert!(flags.always_on_top);
        assert!(flags.skip_taskbar);
        assert!(!flags.request_focus);
    }

    #[test]
    fn overlay_shortcut_requires_a_modifier() {
        assert!(parse_shortcut("K").is_err());
        assert!(parse_shortcut("Ctrl+Shift").is_err());

        let shortcut = parse_shortcut("Ctrl+Shift+K").unwrap();
        assert!(shortcut.mods.contains(Modifiers::CONTROL));
        assert!(shortcut.mods.contains(Modifiers::SHIFT));
    }

    #[test]
    fn overlay_status_has_safe_defaults() {
        let mut state = registration_state();
        state.enabled = false;
        state.shortcut.clear();
        state.registered = None;
        state.last_error = None;
        drop(state);

        let status = status();
        assert!(!status.enabled);
        assert_eq!(status.shortcut, "Ctrl+Shift+K");
        assert!(!status.registered);
        assert_eq!(status.last_error, None);
    }

    #[test]
    fn overlay_state_can_be_toggled() {
        OVERLAY_ACTIVE.store(false, Ordering::SeqCst);

        assert!(!is_active());

        OVERLAY_ACTIVE.store(true, Ordering::SeqCst);

        assert!(is_active());
    }

    #[test]
    fn overlay_shortcut_is_ignored_while_recording() {
        end_shortcut_capture();
        assert!(should_toggle_for_shortcut_event(ShortcutState::Pressed));
        assert!(!should_toggle_for_shortcut_event(ShortcutState::Released));

        begin_shortcut_capture();
        assert!(!should_toggle_for_shortcut_event(ShortcutState::Pressed));

        end_shortcut_capture();
        assert!(should_toggle_for_shortcut_event(ShortcutState::Pressed));
    }
}
