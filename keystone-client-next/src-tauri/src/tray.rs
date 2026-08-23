use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};

use crate::{state::CoreBridgeState, window};

const TRAY_SYNC: &str = "sync_now";
const TRAY_SHOW: &str = "show";
const TRAY_OPEN_WEB: &str = "open_web";
const TRAY_EXIT: &str = "exit";

#[derive(Debug, Clone, PartialEq)]
struct TrayMenuModel {
    language: String,
    connected: String,
    status: String,
    sync_enabled: bool,
}

struct TrayMenuState {
    model: Mutex<TrayMenuModel>,
    connected: MenuItem<tauri::Wry>,
    status: MenuItem<tauri::Wry>,
    sync: MenuItem<tauri::Wry>,
    show: MenuItem<tauri::Wry>,
    open_web: MenuItem<tauri::Wry>,
    exit: MenuItem<tauri::Wry>,
}

impl TrayMenuState {
    fn apply(&self, model: TrayMenuModel) {
        let es = model.language != "en";
        let _ = self.connected.set_text(&model.connected);
        let _ = self.status.set_text(&model.status);
        let _ = self
            .sync
            .set_text(if es { "Sincronizar ahora" } else { "Sync now" });
        let _ = self.sync.set_enabled(model.sync_enabled);
        let _ = self.show.set_text(if es {
            "Abrir KeystoneClient"
        } else {
            "Open KeystoneClient"
        });
        let _ = self
            .open_web
            .set_text(if es { "Abrir Web" } else { "Open Web" });
        let _ = self.exit.set_text(if es { "Salir" } else { "Exit" });
        *self.model.lock().expect("tray model lock poisoned") = model;
    }
}

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let initial = anonymous_model("es");
    let title = MenuItemBuilder::with_id("title", "KeystoneClient")
        .enabled(false)
        .build(app)?;
    let connected = MenuItemBuilder::with_id("connected", &initial.connected)
        .enabled(false)
        .build(app)?;
    let status = MenuItemBuilder::with_id("status", &initial.status)
        .enabled(false)
        .build(app)?;
    let sync = MenuItemBuilder::with_id(TRAY_SYNC, "Sincronizar ahora")
        .enabled(false)
        .build(app)?;
    let show = MenuItemBuilder::with_id(TRAY_SHOW, "Abrir KeystoneClient").build(app)?;
    let open_web = MenuItemBuilder::with_id(TRAY_OPEN_WEB, "Abrir Web").build(app)?;
    let exit = MenuItemBuilder::with_id(TRAY_EXIT, "Salir").build(app)?;
    let title_separator = PredefinedMenuItem::separator(app)?;
    let status_separator = PredefinedMenuItem::separator(app)?;
    let action_separator = PredefinedMenuItem::separator(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[
            &title,
            &title_separator,
            &connected,
            &status,
            &status_separator,
            &sync,
            &show,
            &open_web,
            &action_separator,
            &exit,
        ])
        .build()?;

    app.manage(TrayMenuState {
        model: Mutex::new(initial),
        connected,
        status,
        sync,
        show,
        open_web,
        exit,
    });

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("packaged KeystoneClient icon must be available")
                .clone(),
        )
        .menu(&menu)
        .tooltip("KeystoneClient")
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_SYNC => force_sync(app),
            TRAY_SHOW => window::show_main_window(app),
            TRAY_OPEN_WEB => {
                let _ = window::open_web(app);
            }
            TRAY_EXIT => window::exit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::show_main_window(&tray.app_handle());
            }
        })
        .build(app)?;

    refresh_from_core(app.handle());
    Ok(())
}

pub fn refresh_from_core(app: &AppHandle) {
    let Some(core) = app.try_state::<CoreBridgeState>() else {
        return;
    };
    if let Ok(system) = core.request("system.get_state".to_string(), json!({})) {
        apply_model(app, menu_model(&system));
    }
}

pub fn update_sync_event(app: &AppHandle, event: &str, data: &Value) {
    if !event.starts_with("sync.") {
        return;
    }
    let Some(state) = app.try_state::<TrayMenuState>() else {
        return;
    };
    let mut model = state
        .model
        .lock()
        .expect("tray model lock poisoned")
        .clone();
    let sync_data = if event == "sync.completed" {
        data.get("status").unwrap_or(data)
    } else {
        data
    };
    let sync_state = if event == "sync.error" {
        "error"
    } else {
        sync_data
            .get("state")
            .and_then(Value::as_str)
            .unwrap_or("idle")
    };
    model.status = sync_status_text(sync_state, &model.language);
    drop(state);
    apply_model(app, model);
}

fn force_sync(app: &AppHandle) {
    let Some(core) = app.try_state::<CoreBridgeState>() else {
        return;
    };
    if core.request("sync.force".to_string(), json!({})).is_err() {
        let Some(state) = app.try_state::<TrayMenuState>() else {
            return;
        };
        let mut model = state
            .model
            .lock()
            .expect("tray model lock poisoned")
            .clone();
        model.status = if model.language == "en" {
            "Status: sync failed"
        } else {
            "Estado: error al sincronizar"
        }
        .to_string();
        apply_model(app, model);
    }
}

fn apply_model(app: &AppHandle, model: TrayMenuModel) {
    if let Some(state) = app.try_state::<TrayMenuState>() {
        state.apply(model);
    }
}

fn menu_model(system: &Value) -> TrayMenuModel {
    let language = system
        .pointer("/settings/lang")
        .and_then(Value::as_str)
        .unwrap_or("es");
    let username = system.pointer("/auth/username").and_then(Value::as_str);
    let authenticated = system
        .pointer("/auth/authenticated")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let sync_state = system
        .pointer("/sync/state")
        .and_then(Value::as_str)
        .unwrap_or("idle");
    let selected = system
        .pointer("/sync/selectedAccounts")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let connected = match (language, authenticated, username) {
        ("en", true, Some(name)) => format!("Connected: {name}"),
        (_, true, Some(name)) => format!("Conectado: {name}"),
        ("en", _, _) => "Not connected".to_string(),
        _ => "Sin conexión".to_string(),
    };
    TrayMenuModel {
        language: language.to_string(),
        connected,
        status: sync_status_text(sync_state, language),
        sync_enabled: authenticated && selected > 0,
    }
}

fn anonymous_model(language: &str) -> TrayMenuModel {
    menu_model(&json!({
        "auth": {"authenticated": false, "username": null},
        "settings": {"lang": language},
        "sync": {"state": "idle", "selectedAccounts": 0}
    }))
}

fn sync_status_text(state: &str, language: &str) -> String {
    let label = match (language, state) {
        ("en", "watching") => "ready",
        ("en", "syncing") => "syncing",
        ("en", "success") => "synchronized",
        ("en", "error") => "error",
        ("en", _) => "idle",
        (_, "watching") => "listo",
        (_, "syncing") => "sincronizando",
        (_, "success") => "sincronizado",
        (_, "error") => "error",
        _ => "en espera",
    };
    if language == "en" {
        format!("Status: {label}")
    } else {
        format!("Estado: {label}")
    }
}

#[cfg(test)]
mod tests {
    use super::{menu_model, sync_status_text, TRAY_EXIT, TRAY_OPEN_WEB, TRAY_SHOW, TRAY_SYNC};
    use serde_json::json;

    #[test]
    fn tray_menu_ids_are_scoped_commands() {
        assert_eq!(TRAY_SYNC, "sync_now");
        assert_eq!(TRAY_SHOW, "show");
        assert_eq!(TRAY_OPEN_WEB, "open_web");
        assert_eq!(TRAY_EXIT, "exit");
    }

    #[test]
    fn tray_uses_packaged_application_icon() {
        let source = include_str!("tray.rs");
        let production = source.split("#[cfg(test)]").next().unwrap();

        assert!(production.contains("default_window_icon()"));
    }

    #[test]
    fn authenticated_menu_model_enables_real_sync() {
        let model = menu_model(&json!({
            "auth": {"authenticated": true, "username": "player"},
            "settings": {"lang": "es"},
            "sync": {"state": "watching", "selectedAccounts": 2}
        }));
        assert_eq!(model.connected, "Conectado: player");
        assert_eq!(model.status, "Estado: listo");
        assert!(model.sync_enabled);
    }

    #[test]
    fn anonymous_english_menu_disables_sync() {
        let model = menu_model(&json!({
            "auth": {"authenticated": false, "username": null},
            "settings": {"lang": "en"},
            "sync": {"state": "idle", "selectedAccounts": 0}
        }));
        assert_eq!(model.connected, "Not connected");
        assert_eq!(model.status, "Status: idle");
        assert!(!model.sync_enabled);
    }

    #[test]
    fn localized_sync_error_is_not_reported_as_idle() {
        assert_eq!(sync_status_text("error", "es"), "Estado: error");
        assert_eq!(sync_status_text("error", "en"), "Status: error");
    }
}
