mod bridge;
mod state;
mod tray;
mod window;

use bridge::CoreBridgeError;
use serde_json::Value;
use state::CoreBridgeState;
use tauri::Manager;

#[tauri::command]
async fn core_request(
    app: tauri::AppHandle,
    state: tauri::State<'_, CoreBridgeState>,
    command: String,
    payload: Value,
) -> Result<Value, CoreBridgeError> {
    let core = state.inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || core.request(command, payload))
        .await
        .map_err(|_| CoreBridgeError {
            code: "BRIDGE_TASK_FAILED".to_string(),
            message: "The Python bridge task could not be completed.".to_string(),
        })?;
    if result.is_ok() {
        tauri::async_runtime::spawn_blocking(move || tray::refresh_from_core(&app));
    }
    result
}

#[tauri::command]
fn open_web(app: tauri::AppHandle) -> Result<(), CoreBridgeError> {
    window::open_web(&app)
}

#[tauri::command]
fn open_releases(app: tauri::AppHandle) -> Result<(), CoreBridgeError> {
    window::open_releases(&app)
}

#[tauri::command]
fn open_raiderio_character(
    app: tauri::AppHandle,
    region: String,
    realm: String,
    name: String,
) -> Result<(), CoreBridgeError> {
    window::open_raiderio_character(&app, &region, &realm, &name)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    window::exit_app(&app);
}

#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) -> Result<(), CoreBridgeError> {
    window::hide_to_tray(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show_main_window(app);
        }))
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            app.manage(CoreBridgeState::new(app.handle().clone()));
            tray::setup_tray(app)?;
            window::setup_window_lifecycle(app.handle());
            window::apply_start_minimized(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_request,
            open_web,
            open_releases,
            open_raiderio_character,
            exit_app,
            hide_to_tray
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
