use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

static OVERLAY_ENABLED: AtomicBool = AtomicBool::new(false);
pub const OVERLAY_SHORTCUT: &str = "Ctrl+Shift+K";

#[derive(Debug, PartialEq)]
struct OverlayWindowFlags {
    always_on_top: bool,
    skip_taskbar: bool,
    request_focus: bool,
}

fn overlay_window_flags() -> OverlayWindowFlags {
    OverlayWindowFlags {
        always_on_top: true,
        skip_taskbar: true,
        request_focus: false,
    }
}

pub fn setup(app: &tauri::AppHandle) -> Result<(), tauri_plugin_global_shortcut::Error> {
    app.global_shortcut()
        .on_shortcut(OVERLAY_SHORTCUT, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = toggle(app);
            }
        })
}

pub fn is_enabled() -> bool {
    OVERLAY_ENABLED.load(Ordering::SeqCst)
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

    OVERLAY_ENABLED.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn disable(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window unavailable".to_string())?;

    window.hide().map_err(|error| error.to_string())?;
    window
        .set_focusable(true)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(false)
        .map_err(|error| error.to_string())?;

    OVERLAY_ENABLED.store(false, Ordering::SeqCst);
    Ok(())
}

pub fn toggle(app: &tauri::AppHandle) -> Result<(), String> {
    if is_enabled() {
        disable(app)
    } else {
        enable(app)
    }
}

#[cfg(test)]
mod tests {
    use super::{is_enabled, overlay_window_flags, Ordering, OVERLAY_ENABLED, OVERLAY_SHORTCUT};

    #[test]
    fn overlay_never_requests_focus() {
        let flags = overlay_window_flags();

        assert!(flags.always_on_top);
        assert!(flags.skip_taskbar);
        assert!(!flags.request_focus);
    }

    #[test]
    fn overlay_shortcut_is_stable() {
        assert_eq!(OVERLAY_SHORTCUT, "Ctrl+Shift+K");
    }

    #[test]
    fn overlay_state_can_be_toggled() {
        OVERLAY_ENABLED.store(false, Ordering::SeqCst);

        assert!(!is_enabled());

        OVERLAY_ENABLED.store(true, Ordering::SeqCst);

        assert!(is_enabled());
    }
}
