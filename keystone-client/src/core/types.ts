export type CoreCommand =
  | "system.ping"
  | "system.get_state"
  | "auth.login"
  | "auth.register"
  | "auth.logout"
  | "auth.battlenet.start"
  | "auth.battlenet.poll"
  | "auth.battlenet.cancel"
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
  | "planner.preferences.get"
  | "planner.preferences.update"
  | "teams.keystone_selector"
  | "teams.keystone_planner"
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

export type BattleNetDesktopStart = {
  authorizationUrl: string;
  expiresAt: string;
};

export type BattleNetDesktopPoll = {
  status: "pending" | "needs_onboarding" | "ready" | "expired" | "consumed";
  auth?: AuthState;
};

export type CharacterCurrency = {
  id?: number | null;
  name?: string | null;
  quantity?: number | null;
  maxQuantity?: number | null;
  maxWeeklyQuantity?: number | null;
  totalEarned?: number | null;
  trackedQuantity?: number | null;
  quantityEarnedThisWeek?: number | null;
  useTotalEarnedForMaxQty?: boolean;
  canEarnPerWeek?: boolean;
  discovered?: boolean;
  quality?: number | null;
  iconFileID?: number | null;
  iconPath?: string | null;
  itemID?: number | null;
  currencyID?: number | null;
  itemQuantity?: number | null;
  inventoryQuantity?: number | null;
  totalItemQuantity?: number | null;
  bankQuantity?: number | null;
  bankQuantityKnown?: boolean;
  bankUpdatedAt?: number | null;
  dustQuantity?: number | null;
  dustMaxQuantity?: number | null;
  dustTotalEarned?: number | null;
  dustTrackedQuantity?: number | null;
  bagCount?: number | null;
  hasBuff?: boolean;
  questCompleted?: boolean;
  weekKey?: string | null;
  isWeeklyMaxed?: boolean;
  isSeasonMaxed?: boolean;
  isTotalMaxed?: boolean;
  isMaxed?: boolean;
  isWeeklyComplete?: boolean;
  displayColor?: string | null;
};

export type EquipmentGem = {
  itemId: number;
  itemLink: string | null;
  name: string | null;
  iconFileID: number | null;
  iconPath?: string | null;
};

export type EquipmentEnchant = {
  enchantId: number | null;
  spellId?: number | null;
  name: string | null;
  iconFileID?: number | null;
  iconPath?: string | null;
};

export type EquipmentItem = {
  slotId: number;
  slotName: string;
  itemId: number;
  itemName: string | null;
  itemLink: string;
  quality: number | null;
  itemLevel: number | null;
  iconFileID: number | null;
  iconPath: string | null;
  setId: number | null;
  enchant: EquipmentEnchant | null;
  gems: EquipmentGem[];
  bonusIds: number[];
  itemContext?: number | null;
  suffixId?: number | null;
  upgrade?: {
    track?: string | null;
    currentLevel?: number | null;
    maxLevel?: number | null;
  } | null;
};

export type EquipmentSnapshot = {
  averageItemLevel?: number | null;
  setPieces?: Array<{ setId?: number | null; count: number }>;
  tierPieces?: Array<{ tier: number; count: number }>;
  items: EquipmentItem[];
};

export type TalentEntrySnapshot = {
  entryId: number;
  definitionId: number | null;
  spellId: number | null;
  overriddenSpellId: number | null;
  name: string | null;
  description: string | null;
  subtext: string | null;
  iconFileID: number | null;
  iconPath?: string | null;
  selected: boolean;
  rank: number;
  maxRanks?: number | null;
  entryType?: number | string | null;
  subTreeId?: number | null;
};

export type TalentEdgeSnapshot = {
  targetNodeId: number;
  type: number | string | null;
  visualStyle: number | string | null;
  active: boolean;
};

export type TalentNodeSnapshot = {
  nodeId: number;
  posX: number;
  posY: number;
  nodeType: number | string | null;
  ranksPurchased: number;
  maxRanks: number;
  activeEntryId: number | null;
  entries: TalentEntrySnapshot[];
  visibleEdges: TalentEdgeSnapshot[];
  subTreeId: number | null;
  subTreeActive?: boolean;
};

export type TalentTreeSnapshot = {
  treeId: number;
  type: "class" | "hero" | "spec" | "omnium" | string;
  name: string | null;
  iconFileID?: number | null;
  iconPath?: string | null;
  subTreeId?: number | null;
  description?: string | null;
  iconAtlas?: string | number | null;
  active?: boolean;
  nodes: TalentNodeSnapshot[];
};

export type TalentsSnapshot = {
  specId?: number | null;
  specName?: string | null;
  specIconFileID?: number | null;
  specIconPath?: string | null;
  class?: string | null;
  className?: string | null;
  configId?: number | null;
  loadoutName?: string | null;
  importString?: string | null;
  characterLevel?: number | null;
  trees: TalentTreeSnapshot[];
};

export type OmniumFolioSnapshot = {
  systemId: number;
  configId?: number | null;
  treeIds: number[];
  trees: TalentTreeSnapshot[];
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
  vault?: Record<string, unknown> | null;
  preyHunts?: Record<string, unknown> | null;
  currencies?: Record<string, CharacterCurrency> | null;
  money?: { gold?: number; silver?: number; copper?: number; copperOnly?: number; totalCopper?: number } | null;
  mythicPlusSeason?: { rating?: number | null; dungeons?: Array<Record<string, unknown>> } | null;
  equipment?: EquipmentSnapshot | null;
  talents?: TalentsSnapshot | null;
  omniumFolio?: OmniumFolioSnapshot | null;
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
  plannerConfigured: boolean;
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

export type KeystonePlannerRole = "tank" | "healer" | "dps";
export type KeystonePlannerPreference = "preferred" | "available" | "emergency";
export type KeystonePlannerPreferenceState = KeystonePlannerPreference | "disabled";
export type ClientPlannerPreference = {
  characterId: number;
  specId: number;
  role: KeystonePlannerRole;
  playPreference: KeystonePlannerPreferenceState;
  lootSpecId: number;
  updatedAt: string;
};
export type ClientPlannerPreferenceInput = Omit<ClientPlannerPreference, "role" | "updatedAt">;
export type ClientPlannerPreferences = { preferences: ClientPlannerPreference[] };
export type KeystonePlannerAvailability = "guaranteed" | "conditional" | "none";

export type KeystonePlannerOptions = {
  optimizeComposition: boolean;
  bloodlust: boolean;
  battleRez: boolean;
  classBuffs: boolean;
  damageSynergy: boolean;
};

export type KeystonePlannerLock =
  | { type: "assignment"; userId: number; characterId: number; specId: number }
  | { type: "character"; userId: number; characterId: number }
  | { type: "role"; userId: number; role: KeystonePlannerRole };

export type KeystonePlannerRequest = {
  participantUserIds: number[];
  targetLevel: number;
  challengeMapId: number;
  stoneCharacterId: number;
  options: KeystonePlannerOptions;
  locks: KeystonePlannerLock[];
};

export type KeystonePlannerObjective = {
  itemId: number;
  itemName: string | null;
  iconUrl: string | null;
  tier: number;
  variantKey: string;
  voidcoreState: "pending" | "completed_with_voidcore" | "voidcore_not_checked";
};

export type KeystonePlannerCapability = {
  capabilityId: string;
  name: string;
  type: "major_utility" | "class_buff" | "damage_debuff";
  iconSpellId: number;
  stacking: "unique";
  mode?: "guaranteed" | "conditional";
  condition?: string | null;
  availability?: "guaranteed" | "conditional";
};

export type KeystonePlannerAssignment = {
  userId: number;
  username: string;
  characterId: number;
  characterName: string;
  wowClass: string;
  specId: number;
  role: KeystonePlannerRole;
  lootSpecId: number;
  playPreference: KeystonePlannerPreference;
  objectives: KeystonePlannerObjective[];
  capabilities: KeystonePlannerCapability[];
};

export type KeystonePlannerRecommendation = {
  rank: number;
  fingerprint: string;
  stone: {
    characterId: number;
    characterName: string;
    ownerUserId: number;
    ownerUsername: string;
    challengeMapId: number;
    dungeon: string;
    level: number;
  };
  assignments: KeystonePlannerAssignment[];
  vacancies: Array<{ role: KeystonePlannerRole; preferredCapabilities: string[] }>;
  lootSummary: {
    weightedScore: number;
    playersWithObjectives: number;
    totalObjectives: number;
    tierCounts: { bestInSlot: number; mustHave: number; niceToHave: number; catalyst: number; transmog: number };
  };
  levelSummary: { targetLevel: number; stoneLevel: number; levelDistance: number };
  preferenceSummary: { preferred: number; available: number; emergency: number };
  compositionSummary: {
    bloodlust: KeystonePlannerAvailability;
    battleRez: KeystonePlannerAvailability;
    uniqueCapabilities: KeystonePlannerCapability[];
    damageProfile: "physical" | "magical" | "mixed" | "unknown";
    magicalDpsCount: number;
    physicalDpsCount: number;
    unknownDpsCount: number;
    chaosBrandBeneficiaries: number;
    mysticTouchBeneficiaries: number;
    uniqueClassBuffCount: number;
  };
  reasonCodes: string[];
};

export type KeystonePlannerResponse = {
  teamId: number;
  challengeMapId: number;
  targetLevel: number;
  availability: { eligibleStoneCount: number };
  status: "ok" | "invalid_input" | "unconfigured_participants" | "no_valid_composition";
  diagnostics: { codes: string[]; unconfiguredUserIds: number[]; lockIssues: string[] };
  recommendations: KeystonePlannerRecommendation[];
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
