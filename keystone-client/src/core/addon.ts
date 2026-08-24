import type { UnlistenFn } from "@tauri-apps/api/event";
import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";
import type { AddonStatus, CoreEvent } from "./types";

export function getAddonStatus(): Promise<AddonStatus> {
  return coreRequest<AddonStatus>("addon.get_status");
}

export function checkAddon(): Promise<AddonStatus> {
  return coreRequest<AddonStatus>("addon.check");
}

export function installAddon(): Promise<AddonStatus> {
  return coreRequest<AddonStatus>("addon.install");
}

export function updateAddon(): Promise<AddonStatus> {
  return coreRequest<AddonStatus>("addon.update");
}

export function reinstallAddon(): Promise<AddonStatus> {
  return coreRequest<AddonStatus>("addon.reinstall");
}

export function subscribeToAddonEvents(
  handler: (event: Extract<CoreEvent, { event: `addon.${string}` }>) => void,
): Promise<UnlistenFn> {
  return listenCoreEvents((event) => {
    if (event.event.startsWith("addon.")) {
      handler(event as Extract<CoreEvent, { event: `addon.${string}` }>);
    }
  });
}
