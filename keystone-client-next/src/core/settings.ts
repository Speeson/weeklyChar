import { coreRequest } from "./client";
import type { ClientSettings, UpdateSettingsPayload } from "./types";

export function getSettings(): Promise<ClientSettings> {
  return coreRequest<ClientSettings>("settings.get");
}

export function updateSettings(payload: UpdateSettingsPayload): Promise<ClientSettings> {
  return coreRequest<ClientSettings>("settings.update", payload);
}
