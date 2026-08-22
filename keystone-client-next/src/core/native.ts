import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function openWeb(): Promise<void> {
  return invoke<void>("open_web");
}

export function minimizeWindow(): Promise<void> {
  return getCurrentWindow().minimize();
}

export function closeWindow(): Promise<void> {
  return getCurrentWindow().close();
}

export function minimizeToTray(): Promise<void> {
  return getCurrentWindow().hide();
}
