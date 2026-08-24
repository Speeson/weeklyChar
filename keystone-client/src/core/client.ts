import { invoke } from "@tauri-apps/api/core";
import type { CoreCommand } from "./types";

export async function coreRequest<T>(
  command: CoreCommand,
  payload: object = {},
): Promise<T> {
  return invoke<T>("core_request", {
    command,
    payload,
  });
}
