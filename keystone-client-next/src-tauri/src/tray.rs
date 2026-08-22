use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App,
};

use crate::window;

const TRAY_SHOW: &str = "show";
const TRAY_OPEN_WEB: &str = "open_web";
const TRAY_EXIT: &str = "exit";

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id(TRAY_SHOW, "Show / Open").build(app)?;
    let open_web = MenuItemBuilder::with_id(TRAY_OPEN_WEB, "Open Web").build(app)?;
    let exit = MenuItemBuilder::with_id(TRAY_EXIT, "Exit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show, &open_web, &exit])
        .build()?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("KeystoneClient Next")
        .on_menu_event(|app, event| match event.id().as_ref() {
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

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{TRAY_EXIT, TRAY_OPEN_WEB, TRAY_SHOW};

    #[test]
    fn tray_menu_ids_are_scoped_commands() {
        assert_eq!(TRAY_SHOW, "show");
        assert_eq!(TRAY_OPEN_WEB, "open_web");
        assert_eq!(TRAY_EXIT, "exit");
    }
}
