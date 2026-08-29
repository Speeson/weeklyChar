import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const CLOSE_REQUESTED_EVENT = "keystone://close-requested";

export function openWeb(): Promise<void> {
  return invoke<void>("open_web");
}

export function openForgotPassword(): Promise<void> {
  return invoke<void>("open_forgot_password");
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

export function exitApplication(): Promise<void> {
  return invoke<void>("exit_app");
}

export function minimizeToTray(): Promise<void> {
  return invoke<void>("hide_to_tray");
}

export function listenWindowCloseRequested(handler: () => void): Promise<UnlistenFn> {
  return listen(CLOSE_REQUESTED_EVENT, handler);
}
