import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const CLOSE_REQUESTED_EVENT = "keystone://close-requested";

export type OverlayShortcutStatus = {
  enabled: boolean;
  shortcut: string;
  registered: boolean;
  lastError: string | null;
};

export function openWeb(): Promise<void> {
  return invoke<void>("open_web");
}

export function openForgotPassword(): Promise<void> {
  return invoke<void>("open_forgot_password");
}

export function openBattleNetAuthorization(url: string): Promise<void> {
  return invoke<void>("open_battlenet_authorization", { url });
}

export function openReleases(): Promise<void> {
  return invoke<void>("open_releases");
}

export function openRaiderIoCharacter(region: string, realm: string, name: string): Promise<void> {
  return invoke<void>("open_raiderio_character", { region, realm, name });
}

export function minimizeWindow(): Promise<void> {
  return getCurrentWindow().minimize();
}

export function startWindowDragging(): Promise<void> {
  return getCurrentWindow().startDragging();
}

export function setWindowAspectLock(enabled: boolean): Promise<void> {
  return invoke<void>("set_window_aspect_lock", { enabled });
}

export function configureOverlayShortcut(enabled: boolean, shortcut: string): Promise<OverlayShortcutStatus> {
  return invoke<OverlayShortcutStatus>("configure_overlay_shortcut", { enabled, shortcut });
}

export function getOverlayShortcutStatus(): Promise<OverlayShortcutStatus> {
  return invoke<OverlayShortcutStatus>("get_overlay_shortcut_status");
}

export function beginOverlayShortcutCapture(): Promise<void> {
  return invoke<void>("begin_overlay_shortcut_capture");
}

export function pollOverlayShortcutCapture(): Promise<string | null> {
  return invoke<string | null>("poll_overlay_shortcut_capture");
}

export function validateOverlayShortcut(shortcut: string): Promise<void> {
  return invoke<void>("validate_overlay_shortcut", { shortcut });
}

export function endOverlayShortcutCapture(): Promise<void> {
  return invoke<void>("end_overlay_shortcut_capture");
}

export function exitApplication(): Promise<void> {
  return invoke<void>("exit_app");
}

export function minimizeToTray(): Promise<void> {
  return invoke<void>("hide_to_tray");
}

export function listenWindowCloseRequested(handler: () => void): Promise<UnlistenFn> {
  return listen(CLOSE_REQUESTED_EVENT, handler);
}
