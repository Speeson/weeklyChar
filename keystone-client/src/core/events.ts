import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CoreEvent } from "./types";

export const CORE_EVENT_NAME = "core://event";

export async function listenCoreEvents(
  handler: (event: CoreEvent) => void,
): Promise<UnlistenFn> {
  return listen<CoreEvent>(CORE_EVENT_NAME, (event) => {
    handler(event.payload);
  });
}
