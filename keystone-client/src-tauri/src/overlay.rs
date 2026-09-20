use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

static OVERLAY_ENABLED: AtomicBool = AtomicBool::new(false);
pub const OVERLAY_SHORTCUT: &str = "Ctrl+Shift+K";

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

pub fn enable(_app: &tauri::AppHandle) -> Result<(), String> {
    OVERLAY_ENABLED.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn disable(_app: &tauri::AppHandle) -> Result<(), String> {
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
    use super::{is_enabled, Ordering, OVERLAY_ENABLED, OVERLAY_SHORTCUT};

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
