use tauri::{AppHandle, LogicalSize, Manager};

use crate::bridge::CoreBridgeError;

const CANVAS_WIDTH: f64 = 1672.0;
const CANVAS_HEIGHT: f64 = 941.0;
const RATIO: f64 = CANVAS_WIDTH / CANVAS_HEIGHT;
const MIN_FREE_WIDTH: f64 = 940.0;
const MIN_FREE_HEIGHT: f64 = 529.0;
const MIN_LOCKED_WIDTH: f64 = 1281.0;
const MIN_LOCKED_HEIGHT: f64 = 721.0;

fn initial_width(work_width: f64, work_height: f64, scale_factor: f64) -> f64 {
    if scale_factor <= 0.0 || work_width <= 0.0 || work_height <= 0.0 {
        return CANVAS_WIDTH;
    }
    (work_width * 0.8 / scale_factor)
        .min(work_height * 0.8 * RATIO / scale_factor)
        .min(CANVAS_WIDTH)
        .max(MIN_FREE_WIDTH)
        .round()
}

pub fn setup_initial_size(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(Some(monitor)) = window.current_monitor() {
        let area = monitor.work_area().size;
        let width = initial_width(
            area.width as f64,
            area.height as f64,
            monitor.scale_factor(),
        );
        let _ = window.set_size(LogicalSize::new(width, (width / RATIO).round()));
        let _ = window.center();
    }
    #[cfg(windows)]
    install_sizing_hook(&window);
}

pub fn set_aspect_lock(app: &AppHandle, enabled: bool) -> Result<(), CoreBridgeError> {
    #[cfg(windows)]
    if enabled && !HOOK_INSTALLED.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(window_error());
    }
    #[cfg(not(windows))]
    if enabled {
        return Err(window_error());
    }
    let window = app.get_webview_window("main").ok_or_else(window_error)?;
    if enabled {
        let size = window.inner_size().map_err(|_| window_error())?;
        let scale = window.scale_factor().map_err(|_| window_error())?;
        let width = (size.width as f64 / scale)
            .min(size.height as f64 / scale * RATIO)
            .max(MIN_LOCKED_WIDTH)
            .round();
        window
            .set_size(LogicalSize::new(width, (width / RATIO).round()))
            .map_err(|_| window_error())?;
        window
            .set_min_size(Some(LogicalSize::new(MIN_LOCKED_WIDTH, MIN_LOCKED_HEIGHT)))
            .map_err(|_| window_error())?;
    } else {
        window
            .set_min_size(Some(LogicalSize::new(MIN_FREE_WIDTH, MIN_FREE_HEIGHT)))
            .map_err(|_| window_error())?;
    }
    #[cfg(windows)]
    ASPECT_LOCKED.store(enabled, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

fn window_error() -> CoreBridgeError {
    CoreBridgeError {
        code: "WINDOW_SIZE_FAILED".to_string(),
        message: "KeystoneClient could not update the window size.".to_string(),
    }
}

#[cfg(windows)]
use std::sync::atomic::AtomicBool;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
#[cfg(windows)]
use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClientRect, GetWindowRect, WMSZ_BOTTOM, WMSZ_BOTTOMLEFT, WMSZ_BOTTOMRIGHT, WMSZ_LEFT,
    WMSZ_RIGHT, WMSZ_TOP, WMSZ_TOPLEFT, WMSZ_TOPRIGHT, WM_NCDESTROY, WM_SIZING,
};

#[cfg(windows)]
static ASPECT_LOCKED: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static HOOK_INSTALLED: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
fn install_sizing_hook(window: &tauri::WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        let installed = unsafe { SetWindowSubclass(hwnd.0, Some(sizing_proc), 1, 0) } != 0;
        HOOK_INSTALLED.store(installed, std::sync::atomic::Ordering::Relaxed);
    }
}

#[cfg(windows)]
unsafe extern "system" fn sizing_proc(
    hwnd: HWND,
    message: u32,
    edge: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _reference: usize,
) -> LRESULT {
    if message == WM_NCDESTROY {
        RemoveWindowSubclass(hwnd, Some(sizing_proc), subclass_id);
        HOOK_INSTALLED.store(false, std::sync::atomic::Ordering::Relaxed);
    } else if message == WM_SIZING
        && ASPECT_LOCKED.load(std::sync::atomic::Ordering::Relaxed)
        && lparam != 0
    {
        let proposed = &mut *(lparam as *mut RECT);
        let mut current = RECT::default();
        let mut client = RECT::default();
        if GetWindowRect(hwnd, &mut current) != 0 && GetClientRect(hwnd, &mut client) != 0 {
            let dpi = GetDpiForWindow(hwnd).max(1) as f64 / 96.0;
            constrain_rect(proposed, &current, &client, edge as u32, dpi);
            return 1;
        }
    }
    DefSubclassProc(hwnd, message, edge, lparam)
}

#[cfg(windows)]
fn constrain_rect(proposed: &mut RECT, current: &RECT, client: &RECT, edge: u32, scale: f64) {
    let left = matches!(edge, WMSZ_LEFT | WMSZ_TOPLEFT | WMSZ_BOTTOMLEFT);
    let right = matches!(edge, WMSZ_RIGHT | WMSZ_TOPRIGHT | WMSZ_BOTTOMRIGHT);
    let top = matches!(edge, WMSZ_TOP | WMSZ_TOPLEFT | WMSZ_TOPRIGHT);
    let bottom = matches!(edge, WMSZ_BOTTOM | WMSZ_BOTTOMLEFT | WMSZ_BOTTOMRIGHT);
    let requested_width = (proposed.right - proposed.left).max(1) as f64;
    let requested_height = (proposed.bottom - proposed.top).max(1) as f64;
    let frame_width = (current.right - current.left - (client.right - client.left)).max(0) as f64;
    let frame_height = (current.bottom - current.top - (client.bottom - client.top)).max(0) as f64;
    let width_delta = (requested_width - (current.right - current.left) as f64).abs();
    let height_delta = (requested_height - (current.bottom - current.top) as f64).abs() * RATIO;
    let width_driven = !top && !bottom || (left || right) && width_delta >= height_delta;
    let (width, height) = if width_driven {
        let width = requested_width
            .max(MIN_LOCKED_WIDTH * scale + frame_width)
            .round() as i32;
        (
            width,
            ((width as f64 - frame_width) / RATIO + frame_height).round() as i32,
        )
    } else {
        let height = requested_height
            .max(MIN_LOCKED_HEIGHT * scale + frame_height)
            .round() as i32;
        (
            ((height as f64 - frame_height) * RATIO + frame_width).round() as i32,
            height,
        )
    };

    if left {
        proposed.left = proposed.right - width;
    } else if right {
        proposed.right = proposed.left + width;
    } else {
        proposed.left = current.left + (current.right - current.left - width) / 2;
        proposed.right = proposed.left + width;
    }
    if top {
        proposed.top = proposed.bottom - height;
    } else if bottom {
        proposed.bottom = proposed.top + height;
    } else {
        proposed.top = current.top + (current.bottom - current.top - height) / 2;
        proposed.bottom = proposed.top + height;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_size_uses_work_area_and_preserves_large_display_size() {
        assert_eq!(initial_width(1920.0, 1040.0, 1.0), 1478.0);
        assert_eq!(initial_width(1920.0, 1040.0, 1.25), 1183.0);
        assert_eq!(initial_width(3440.0, 1400.0, 1.0), CANVAS_WIDTH);
        assert_eq!(initial_width(0.0, 0.0, 1.0), CANVAS_WIDTH);
    }

    #[cfg(windows)]
    #[test]
    fn sizing_edges_preserve_ratio_and_opposite_edges() {
        let current = RECT {
            left: 100,
            top: 100,
            right: 1772,
            bottom: 1041,
        };
        let client = RECT {
            left: 0,
            top: 0,
            right: 1672,
            bottom: 941,
        };
        let mut proposed = RECT {
            left: 100,
            top: 100,
            right: 1500,
            bottom: 1041,
        };
        constrain_rect(&mut proposed, &current, &client, WMSZ_RIGHT, 1.0);
        assert_eq!(proposed.left, current.left);
        assert_eq!(proposed.right, 1500);
        assert_eq!(proposed.bottom - proposed.top, 788);

        let mut bottom_edge = RECT {
            left: 100,
            top: 100,
            right: 1772,
            bottom: 900,
        };
        constrain_rect(&mut bottom_edge, &current, &client, WMSZ_BOTTOM, 1.0);
        assert_eq!(bottom_edge.top, current.top);
        assert!(((bottom_edge.right - bottom_edge.left) as f64 / 800.0 - RATIO).abs() < 0.002);

        let mut minimum = RECT {
            left: 100,
            top: 100,
            right: 700,
            bottom: 1041,
        };
        constrain_rect(&mut minimum, &current, &client, WMSZ_RIGHT, 1.0);
        assert_eq!(minimum.right - minimum.left, 1281);
        assert_eq!(minimum.bottom - minimum.top, 721);

        let mut corner = RECT {
            left: 300,
            top: 250,
            right: 1772,
            bottom: 1041,
        };
        constrain_rect(&mut corner, &current, &client, WMSZ_TOPLEFT, 1.0);
        assert_eq!(corner.right, current.right);
        assert_eq!(corner.bottom, current.bottom);
        assert!(
            ((corner.right - corner.left) as f64 / (corner.bottom - corner.top) as f64 - RATIO)
                .abs()
                < 0.002
        );

        let framed_client = RECT {
            left: 0,
            top: 0,
            right: 1656,
            bottom: 925,
        };
        let mut framed = RECT {
            left: 100,
            top: 100,
            right: 1500,
            bottom: 1041,
        };
        constrain_rect(&mut framed, &current, &framed_client, WMSZ_RIGHT, 1.0);
        assert!(
            (((framed.right - framed.left - 16) as f64 / (framed.bottom - framed.top - 16) as f64)
                - RATIO)
                .abs()
                < 0.002
        );
    }
}
