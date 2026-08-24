import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { UpdaterAdapter } from "./updater";

export const tauriUpdaterAdapter: UpdaterAdapter = {
  check,
  relaunch,
};
