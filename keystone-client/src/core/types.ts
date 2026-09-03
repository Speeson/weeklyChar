export type CoreCommand =
  | "system.ping"
  | "system.get_state"
  | "auth.login"
  | "auth.register"
  | "auth.logout"
  | "profile.set_avatar"
  | "settings.get"
  | "settings.update"
  | "wow.detect"
  | "wow.list_accounts"
  | "wow.select_accounts"
  | "wow.select_install"
  | "sync.get_status"
  | "sync.start"
  | "sync.stop"
  | "sync.force"
  | "characters.get"
  | "characters.refresh"
  | "teams.list"
  | "teams.get"
  | "teams.keystone_selector"
  | "addon.get_status"
  | "addon.check"
  | "addon.install"
  | "addon.update"
  | "addon.reinstall";

export type CoreError = {
  code: string;
  message: string;
};

export type PingResult = {
  pong: true;
};

export type AuthState = {
  authenticated: boolean;
  username: string | null;
  avatarUrl: string | null;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
};

export type RegisterResult = {
  username: string;
  email: string;
  emailVerified: boolean;
  message: string;
};

export type ClientSettings = {
  startMinimized: boolean;
  minimizeOnClose: boolean;
  closeBehavior: "ask" | "minimize" | "exit";
  lang: "es" | "en";
};

export type UpdateSettingsPayload = Partial<ClientSettings>;

export type WowInstallState = {
  detected: boolean;
  installPath: string | null;
  retailPath: string | null;
  addonsPath: string | null;
};

export type WowAccount = {
  name: string;
  savedVariablesPath: string;
  savedVariablesExists: boolean;
  selected: boolean;
  modifiedAt: number | null;
};

export type WowState = {
  install: WowInstallState;
  accounts: WowAccount[];
  selectedAccounts: string[];
  configurationComplete?: boolean;
};

export type SelectWowInstallPayload = {
  path: string;
};

export type SelectWowAccountsPayload = {
  accounts: string[];
};

export type SystemState = {
  protocolVersion: 1;
  bridge: "ready";
  auth: AuthState;
  settings: ClientSettings;
  wow: WowState;
  sync: SyncStatus;
  characters: CharacterState;
  addon: AddonStatus;
};

export type SetAvatarPayload = {
  avatarUrl: string;
};

export type CharacterKeystone = {
  level: number;
  dungeon: string | null;
  challengeMapId: number | null;
  mapId: number | null;
};

export type Character = {
  id: string;
  name: string;
  realm: string;
  region: string;
  wowAccount: string | null;
  wowClass: string | null;
  avatarUrl: string | null;
  ilvl: number | null;
  rioScore: number | null;
  currentKeystone: CharacterKeystone | null;
  keystoneDisplay: string;
};

export type CharacterState = {
  characters: Character[];
  refreshing: boolean;
  source: "none" | "cache" | "remote";
  lastRefreshAt: string | null;
  lastError: string | null;
};

export type ClientTeamSummary = {
  id: number;
  name: string;
  memberCount: number;
};

export type ClientTeamKeystone = {
  level: number;
  challengeMapId: number | null;
  dungeon: string | null;
};

export type ClientTeamCharacter = {
  characterId: number;
  name: string;
  realm: string;
  region: string;
  wowClass: string | null;
  avatarUrl: string | null;
  ilvl: number | null;
  rioScore: number | null;
  currentKeystone: ClientTeamKeystone | null;
};

export type ClientTeamMember = {
  userId: number;
  username: string;
  characters: ClientTeamCharacter[];
};

export type ClientTeamDetail = {
  id: number;
  name: string;
  members: ClientTeamMember[];
};

export type KeystoneSelectorTierCounts = {
  bestInSlot: number;
  mustHave: number;
  niceToHave: number;
  catalyst: number;
  transmog: number;
  other: number;
};

export type ItemQualityType = "POOR" | "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "ARTIFACT" | "HEIRLOOM";

export type KeystoneSelectorObjective = {
  itemId: number;
  itemName: string | null;
  iconUrl: string | null;
  tier: number;
  specIds: number[];
  sourceType: string;
  sourceId: number | string;
  slotId: number | null;
  slotName: string | null;
  itemClassName: string | null;
  itemSubClassName: string | null;
  statNames: string[];
  primaryStatNames: string[];
  secondaryStatNames: string[];
  otherStatNames: string[];
  qualityType: ItemQualityType | null;
  itemLevel: number | null;
  variantKey: string;
  voidcoreState: "pending" | "completed_with_voidcore" | "voidcore_not_checked";
};

export type KeystoneSelectorStone = {
  characterId: number;
  characterName: string;
  ownerUserId: number;
  ownerUsername: string;
  level: number;
};

export type KeystoneSelectorSpec = {
  specId: number;
  objectiveCount: number;
  tierCounts: KeystoneSelectorTierCounts;
};

export type KeystoneSelectorCharacter = {
  userId: number;
  username: string;
  characterId: number;
  characterName: string;
  realm: string;
  region: string;
  wowClass: string | null;
  avatarUrl: string | null;
  ilvl: number | null;
  rioScore: number | null;
  totalObjectives: number;
  tierCounts: KeystoneSelectorTierCounts;
  specs: KeystoneSelectorSpec[];
  objectives: KeystoneSelectorObjective[];
};

export type KeystoneSelectorResponse = {
  teamId: number;
  challengeMapId: number;
  availability: { stoneCount: number; stones: KeystoneSelectorStone[] };
  summary: {
    charactersWithObjectives: number;
    totalObjectives: number;
    tiers: KeystoneSelectorTierCounts;
  };
  characters: KeystoneSelectorCharacter[];
};

export type SyncState = "idle" | "watching" | "syncing" | "success" | "error";

export type SyncStatus = {
  running: boolean;
  state: SyncState;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  selectedAccounts: number;
};

export type AddonState =
  | "not-installed"
  | "current"
  | "update-available"
  | "local-newer"
  | "offline-cache"
  | "unavailable"
  | "error";

export type AddonOperation = {
  action: "install" | "update" | "reinstall";
  state: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
};

export type AddonStatus = {
  installed: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  state: AddonState;
  cacheAvailable: boolean;
  lastCheckAt: string | null;
  source: "remote" | "cache" | null;
  message: string;
  operation: AddonOperation | null;
};

export type CoreEventName =
  | "system.ready"
  | "sync.started"
  | "sync.status"
  | "sync.completed"
  | "sync.error"
  | "characters.updated"
  | "addon.check.failed"
  | "addon.check.started"
  | "addon.check.completed"
  | "addon.install.started"
  | "addon.install.progress"
  | "addon.install.completed"
  | "addon.install.failed"
  | "addon.status.changed";

export type SystemReadyEventData = {
  capabilities: CoreCommand[];
};

export type SyncErrorEventData = {
  code: string;
  message: string;
};

export type SyncCompletedEventData = {
  status: SyncStatus;
  syncedCharacters: number;
};

export type AddonFailedEventData = {
  operation: AddonOperation;
  error: CoreError;
};

export type CoreEvent =
  | {
      protocolVersion: 1;
      event: "system.ready";
      data: SystemReadyEventData;
    }
  | {
      protocolVersion: 1;
      event: "sync.started" | "sync.status";
      data: SyncStatus;
    }
  | {
      protocolVersion: 1;
      event: "sync.completed";
      data: SyncCompletedEventData;
    }
  | {
      protocolVersion: 1;
      event: "sync.error";
      data: SyncErrorEventData;
    }
  | {
      protocolVersion: 1;
      event: "characters.updated";
      data: CharacterState;
    }
  | {
      protocolVersion: 1;
      event: "addon.check.failed";
      data: CoreError;
    }
  | {
      protocolVersion: 1;
      event: "addon.check.started";
      data: Record<string, never>;
    }
  | {
      protocolVersion: 1;
      event: "addon.check.completed" | "addon.status.changed";
      data: AddonStatus;
    }
  | {
      protocolVersion: 1;
      event: "addon.install.started" | "addon.install.progress";
      data: AddonOperation;
    }
  | {
      protocolVersion: 1;
      event: "addon.install.completed";
      data: { operation: AddonOperation; status: AddonStatus };
    }
  | {
      protocolVersion: 1;
      event: "addon.install.failed";
      data: AddonFailedEventData;
    };
