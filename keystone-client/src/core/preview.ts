import type { AddonStatus, Character, CharacterState, SyncStatus, SystemState } from "./types";

const previewCharacters: Character[] = [
  { id: "makabe", name: "Makabe", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Warrior", avatarUrl: null, ilvl: 344, rioScore: 4500, currentKeystone: { level: 10, dungeon: "King's Rest", challengeMapId: null, mapId: null }, keystoneDisplay: "+10 King's Rest (KR)" },
  { id: "bakuhatsu", name: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Paladin", avatarUrl: null, ilvl: 321, rioScore: 3375, currentKeystone: { level: 2, dungeon: "Temple of Sethraliss", challengeMapId: null, mapId: null }, keystoneDisplay: "+2 Temple of Sethraliss (ToS)" },
  { id: "dkimio", name: "Dkimio", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Death Knight", avatarUrl: null, ilvl: 297, rioScore: 2250, currentKeystone: null, keystoneDisplay: "\u2014" },
  { id: "nakada", name: "Nakada", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Demon Hunter", avatarUrl: null, ilvl: 274, rioScore: 1125, currentKeystone: null, keystoneDisplay: "\u2014" },
  { id: "spee", name: "Spee", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Monk", avatarUrl: null, ilvl: 250, rioScore: 0, currentKeystone: { level: 2, dungeon: "The Blinding Vale", challengeMapId: null, mapId: null }, keystoneDisplay: "+2 The Blinding Vale" },
  { id: "speen", name: "Speen", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Mage", avatarUrl: null, ilvl: 288, rioScore: null, currentKeystone: null, keystoneDisplay: "\u2014" },
  { id: "speeral-a", name: "Speeral", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Druid", avatarUrl: null, ilvl: 305, rioScore: null, currentKeystone: { level: 2, dungeon: "Murder Row", challengeMapId: null, mapId: null }, keystoneDisplay: "+2 Murder Row" },
  { id: "speeral-b", name: "Speeral", realm: "Zul'jin", region: "eu", wowAccount: "PREVIEW", wowClass: "Shaman", avatarUrl: null, ilvl: null, rioScore: null, currentKeystone: null, keystoneDisplay: "\u2014" },
];

const previewCharacterState: CharacterState = {
  characters: previewCharacters,
  refreshing: false,
  source: "remote",
  lastRefreshAt: "2026-08-22T15:34:00+02:00",
  lastError: null,
};

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
      configurationComplete: true,
    },
    sync,
    characters: previewCharacterState,
    addon,
  };
}

const previews: Record<string, SystemState> = {
  "login": {
    ...baseState(),
    auth: { authenticated: false, username: null, avatarUrl: null },
  },
  "wow-onboarding": {
    ...baseState(),
    wow: {
      install: { detected: false, installPath: null, retailPath: null, addonsPath: null },
      accounts: [],
      selectedAccounts: [],
      configurationComplete: false,
    },
  },
  "account-selector": {
    ...baseState(),
    wow: {
      install: {
        detected: true,
        installPath: "C:\\Games\\World of Warcraft",
        retailPath: "C:\\Games\\World of Warcraft\\_retail_",
        addonsPath: "C:\\Games\\World of Warcraft\\_retail_\\Interface\\AddOns",
      },
      accounts: [
        {
          name: "WOW_ACCOUNT_1",
          savedVariablesPath: "C:\\Games\\World of Warcraft\\_retail_\\WTF\\Account\\WOW_ACCOUNT_1\\SavedVariables\\KeystoneSync.lua",
          savedVariablesExists: true,
          selected: false,
          modifiedAt: 1787390400,
        },
        {
          name: "WOW_ACCOUNT_2",
          savedVariablesPath: "C:\\Games\\World of Warcraft\\_retail_\\WTF\\Account\\WOW_ACCOUNT_2\\SavedVariables\\KeystoneSync.lua",
          savedVariablesExists: true,
          selected: false,
          modifiedAt: 1787390300,
        },
      ],
      selectedAccounts: [],
      configurationComplete: false,
    },
  },
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
  "teams-default": baseState(),
  "teams-cold-loading": baseState(),
  "teams-multiple": baseState(),
  "teams-empty": baseState(),
  "teams-selector-full": baseState(),
  "teams-selector-multispec": baseState(),
  "teams-selector-empty": baseState(),
  "teams-selector-loading": baseState(),
  "teams-selector-error": baseState(),
};

export function isTeamsPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview")?.startsWith("teams-") === true;
}

export function getPreviewState(): SystemState | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  const state = preview ? previews[preview] ?? null : null;
  return state && params.get("lang") === "en"
    ? { ...state, settings: { ...state.settings, lang: "en" } }
    : state;
}
