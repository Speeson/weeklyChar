import type { UnlistenFn } from "@tauri-apps/api/event";
import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";
import type { CoreEvent, SyncStatus } from "./types";

export function getSyncStatus(): Promise<SyncStatus> {
  return coreRequest<SyncStatus>("sync.get_status");
}

export function startSync(): Promise<SyncStatus> {
  return coreRequest<SyncStatus>("sync.start");
}

export function stopSync(): Promise<SyncStatus> {
  return coreRequest<SyncStatus>("sync.stop");
}

export function forceSync(): Promise<SyncStatus> {
  return coreRequest<SyncStatus>("sync.force");
}

export function subscribeToSyncEvents(
  handler: (event: Extract<CoreEvent, { event: `sync.${string}` }>) => void,
): Promise<UnlistenFn> {
  return listenCoreEvents((event) => {
    if (event.event.startsWith("sync.")) {
      handler(event as Extract<CoreEvent, { event: `sync.${string}` }>);
    }
  });
}
