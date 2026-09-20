use std::sync::atomic::{AtomicBool, Ordering};

static OVERLAY_ENABLED: AtomicBool = AtomicBool::new(false);

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
    use super::{is_enabled, Ordering, OVERLAY_ENABLED};

    #[test]
    fn overlay_state_can_be_toggled() {
        OVERLAY_ENABLED.store(false, Ordering::SeqCst);

        assert!(!is_enabled());

        OVERLAY_ENABLED.store(true, Ordering::SeqCst);

        assert!(is_enabled());
    }
}
