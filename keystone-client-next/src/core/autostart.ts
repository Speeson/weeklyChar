import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export function getAutostartEnabled(): Promise<boolean> {
  return isEnabled();
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
  return isEnabled();
}
