import type { AddonStatus, SyncStatus, SystemState } from "./types";

const baseSync: SyncStatus = {
  running: false,
  state: "idle",
  lastSyncAt: null,
  lastSuccessAt: null,
  lastError: null,
  selectedAccounts: 2,
};

const baseAddon: AddonStatus = {
  installed: false,
  installedVersion: null,
  latestVersion: "0.1.17",
  state: "not-installed",
  cacheAvailable: false,
  lastCheckAt: "2026-08-22T12:00:00Z",
  source: "remote",
  message: "",
  operation: null,
};

function baseState(sync: SyncStatus = baseSync, addon: AddonStatus = baseAddon): SystemState {
  return {
    protocolVersion: 1,
    bridge: "ready",
    auth: {
      authenticated: true,
      username: "Spee",
      avatarUrl: null,
    },
    settings: {
      startMinimized: false,
      minimizeOnClose: true,
      lang: "es",
    },
    wow: {
      install: {
        detected: true,
        installPath: "C:\\Games\\World of Warcraft",
        retailPath: "C:\\Games\\World of Warcraft\\_retail_",
        addonsPath: "C:\\Games\\World of Warcraft\\_retail_\\Interface\\AddOns",
      },
      accounts: [
        {
          name: "PREVIEW",
          savedVariablesPath:
            "C:\\Games\\World of Warcraft\\_retail_\\WTF\\Account\\PREVIEW\\SavedVariables\\KeystoneSync.lua",
          savedVariablesExists: true,
          selected: true,
          modifiedAt: 1787390400,
        },
      ],
      selectedAccounts: ["PREVIEW"],
    },
    sync,
    addon,
  };
}

const previews: Record<string, SystemState> = {
  "addon-installed": baseState(baseSync, {
    ...baseAddon,
    installed: true,
    installedVersion: "0.1.16",
    state: "update-available",
    cacheAvailable: true,
    message: "Actualización disponible.",
  }),
  "addon-current": baseState(baseSync, {
    ...baseAddon,
    installed: true,
    installedVersion: "0.1.17",
    state: "current",
    cacheAvailable: true,
    message: "Addon actualizado.",
  }),
  "addon-not-installed": baseState(),
  "sync-idle": baseState(baseSync),
  "sync-watching": baseState({
    ...baseSync,
    running: true,
    state: "watching",
  }),
  "sync-success": baseState({
    ...baseSync,
    running: true,
    state: "success",
    lastSyncAt: "2026-08-22T15:34:00+02:00",
    lastSuccessAt: "2026-08-22T15:34:00+02:00",
    selectedAccounts: 8,
  }),
  "sync-syncing": baseState({
    ...baseSync,
    running: true,
    state: "syncing",
    lastSyncAt: "2026-08-22T12:00:00Z",
  }),
  "sync-error": baseState({
    ...baseSync,
    state: "error",
    lastSyncAt: "2026-08-22T12:00:00Z",
    lastError: "No se pudo contactar con KeystoneSync API.",
  }),
};

export function getPreviewState(): SystemState | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const preview = new URLSearchParams(window.location.search).get("preview");
  return preview ? previews[preview] ?? null : null;
}
