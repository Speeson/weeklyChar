mod bridge;
mod state;
mod tray;
mod window;

use bridge::CoreBridgeError;
use serde_json::Value;
use state::CoreBridgeState;
use tauri::Manager;

#[tauri::command]
fn core_request(
    state: tauri::State<'_, CoreBridgeState>,
    command: String,
    payload: Value,
) -> Result<Value, CoreBridgeError> {
    state.request(command, payload)
}

#[tauri::command]
fn open_web(app: tauri::AppHandle) -> Result<(), CoreBridgeError> {
    window::open_web(&app)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    window::exit_app(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show_main_window(app);
        }))
        .setup(|app| {
            app.manage(CoreBridgeState::new(app.handle().clone()));
            tray::setup_tray(app)?;
            window::setup_window_lifecycle(app.handle());
            window::apply_start_minimized(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_request, open_web, exit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
