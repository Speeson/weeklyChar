# KeystoneSync Data Contract

## Contract Overview

```text
WoW API
  |
  v
KeystoneSyncDB
  |
  v
KeystoneClient Python parse
  |
  v
POST /api/keystones/update
  |
  v
Cloudflare D1
  |
  v
Worker read response
  |
  v
KeystoneSync Web
```

This document describes the current contract implemented by the repository. It does not define an ideal future schema.

Primary files:

- Addon source used for inspection: canonical external repository `Speeson/KeystoneSync`
- Client parser/payload: `keystone-client/sync_worker.py`
- Worker write route: `keystone-worker/src/routes/keystones.ts`
- D1 schema: `keystone-worker/migrations/0001_initial.sql`
- Worker response helpers: `keystone-worker/src/db.ts`
- Web API helper: `keystone-web/lib/auth.ts`
- Web consumers: `keystone-web/app/dashboard/page.tsx`, `keystone-web/app/characters/page.tsx`, `keystone-web/app/summary/page.tsx`, `keystone-web/app/teams/[id]/page.tsx`

## SavedVariables Contract

The addon declares:

```text
## SavedVariables: KeystoneSyncDB
```

`KeystoneSyncDB` is a Lua table keyed by:

```text
<realm>-<character>
```

`GetCharacterKey()` builds the key from `GetRealmName()` and `UnitName("player")`. Each value is a per-character table written by `SaveCharacterData()`.

### Per-character Fields

| Field | Type / shape | Source | Optional behavior | Consumer |
| --- | --- | --- | --- | --- |
| `character` | string | `UnitName("player")` | Required for Worker sync; missing value causes Worker 400 through payload validation. | Client, Worker |
| `realm` | string | `GetRealmName()` | Required for Worker sync. | Client, Worker |
| `region` | string | Addon constant `REGION`, currently `eu` | Client defaults missing value to `eu`. Worker also defaults missing payload region to `eu`. | Client, Worker, Web |
| `ilvl` | integer or nil | Rounded `GetAverageItemLevel()`; preserves previous value if current read is empty | Client sends addon value when present; otherwise Raider.IO equipped item level fallback may be used. | Client, Worker, Web |
| `hasKeystone` | boolean | `GetCurrentKeystone()` | Client defaults missing value to `False`; Worker only inserts keystone rows when true and level is present. | Client, Worker |
| `keystoneLevel` | number or nil | WoW Mythic+ API or bag keystone link fallback | Preserved from previous same-week data if the current read is transiently empty. | Client, Worker |
| `keystoneChallengeMapId` | number or nil | WoW Mythic+ API or bag keystone link fallback | May be nil when no keystone or incomplete read. | Client, Worker, Web |
| `keystoneMapId` | number or nil | WoW Mythic+ API / map info | May be nil. | Client, Worker |
| `keystoneDungeon` | string or nil | `C_ChallengeMode.GetMapUIInfo()` | Preserves previous dungeon name for same challenge map when map info is not loaded. | Client, Worker, Web |
| `keystoneWeeklyResetKey` | date string `YYYY-MM-DD` | Addon weekly reset helper | Local-only today; not included in client payload. | Addon local preservation |
| `vault` | table | `C_WeeklyRewards` | Always written by current save path; individual buckets/slots may be empty. | Client, Worker JSON block, Web |
| `preyHunts` | table | `C_QuestLog.IsQuestFlaggedCompleted()` over current hardcoded quest sets | Preserves previous same-week nonzero result when WoW returns a transient empty snapshot. | Client, Worker JSON block, Web |
| `currencies` | map keyed by currency/item aliases | `C_CurrencyInfo`, bag/item APIs | Missing currency info omits that currency key. | Client, Worker JSON block, Web |
| `money` | table | `GetMoney()` | Preserves previous money on logout if WoW returns zero and previous copper was positive. | Client, Worker JSON block, Web |
| `mythicPlusSeason` | table | `C_PlayerInfo`, `C_ChallengeMode`, `C_MythicPlus` | Updated only on delayed login, completed runs, new weekly records, and manual `/ksync`; previous season data can be preserved when the new read is empty/duplicate. | Client, Worker JSON block, Web |
| `mythicPlusSeasonUpdatedAt` | Unix seconds | `time()` in `UpdateMythicPlusSeason()` | Local-only today; not included in client payload. | Addon local preservation |
| `updatedAt` | Unix seconds | `time()` in `SaveCharacterData()` | Used by Worker staleness rules for current keystone rows. | Client, Worker, Web |
| `updatedReason` | string | Event/reason passed into `SaveCharacterData()` | Stored on keystone rows when a real keystone snapshot is inserted. | Client, Worker, Web |

### `vault`

Shape:

- `weekKey`
- `hasAvailableRewards`
- `raid`, `dungeons`, `world`
- each bucket has `unlocked` and `slots`
- slot fields include `id`, `index`, `type`, `level`, `progress`, `threshold`, `activityTierID`, `unlocked`
- `dungeons.completedRuns` includes `heroic`, `mythic`, and `mythicPlus`

### `preyHunts`

Shape:

- `weekKey`
- `questsCompleted`: map of quest ID to boolean
- `normal`, `hard`, `nightmare`
- each difficulty bucket has `count` and `completedQuestIDs`

Weekly behavior: if a current same-week read returns zero completed hunts while previous same-week data had progress, the addon preserves previous progress. Reset-week zeroes may replace old data because the `weekKey` changes.

### `currencies`

The addon writes a map of known keys such as:

- `adventurerDawncrest`
- `veteranDawncrest`
- `championDawncrest`
- `heroDawncrest`
- `mythDawncrest`
- `dawnlightManaflux`
- `radiantSparkDust`
- `cofferKeyShards`
- `restoredCofferKey`
- `nebulousVoidcore`
- `sparksOfRadiance`

Currency entries can include `id`, `name`, `quantity`, `maxQuantity`, `maxWeeklyQuantity`, `totalEarned`, `trackedQuantity`, `quantityEarnedThisWeek`, `discovered`, `quality`, `iconFileID`, `iconPath`, `isWeeklyComplete`, and `displayColor`.

`sparksOfRadiance` is item/currency-derived and includes item and dust counts.

### `money`

Shape:

- `copper`
- `gold`
- `silver`
- `copperOnly`

### `mythicPlusSeason`

Shape:

- `rating`
- `dungeons`

Each dungeon entry can include `challengeMapId`, `name`, `texture`, `texturePath`, `timeLimit`, `level`, `timed`, `upgradeLevel`, `rating`, `bestOverAllScore`, `bestTimedRun`, `bestNotTimedRun`, `bestAffixScore`, and `affixScores`.

The addon includes safeguards to avoid accepting empty or duplicate season snapshots in cases that appear to be transient API reads.

## Client Parsing And Payload Contract

`keystone-client/sync_worker.py` watches selected SavedVariables files discovered by `keystone-client/wow_path.py`.

Parsing behavior:

- Reads the SavedVariables file as UTF-8.
- Takes the substring after the first `=`.
- Decodes the Lua table with `slpp`.
- Iterates every per-character entry in the decoded table.
- Does not use the `KeystoneSyncDB` table key as identity; identity comes from fields inside each entry.

Raider.IO enrichment:

- Calls `https://raider.io/api/v1/characters/profile`.
- Sends `region`, `realm`, `name`.
- Requests `thumbnail_url`, `class`, `mythic_plus_scores_by_season:current`, and `gear`.
- Adds `avatarUrl`, `rioScore`, `wowClass`, and item-level fallback when available.
- Network/API failures return `None` values and do not stop local parsing.

Payload sent to `POST /api/keystones/update`:

| Payload field | Source |
| --- | --- |
| `character` | SavedVariables `character` |
| `realm` | SavedVariables `realm` |
| `region` | SavedVariables `region`, default `eu` |
| `hasKeystone` | SavedVariables `hasKeystone`, default `False` |
| `keystoneLevel` | SavedVariables `keystoneLevel` |
| `keystoneChallengeMapId` | SavedVariables `keystoneChallengeMapId` |
| `keystoneMapId` | SavedVariables `keystoneMapId` |
| `keystoneDungeon` | SavedVariables `keystoneDungeon` |
| `updatedAt` | SavedVariables `updatedAt` |
| `updatedReason` | SavedVariables `updatedReason` |
| `wowAccount` | Selected/discovered WoW account folder name |
| `avatarUrl` | Raider.IO |
| `rioScore` | Raider.IO |
| `wowClass` | Raider.IO |
| `ilvl` | SavedVariables `ilvl`, otherwise Raider.IO equipped item level |
| `vault` | SavedVariables `vault` |
| `preyHunts` | SavedVariables `preyHunts` |
| `currencies` | SavedVariables `currencies` |
| `money` | SavedVariables `money` |
| `mythicPlusSeason` | SavedVariables `mythicPlusSeason` |

Authentication:

- Header: `Authorization: Bearer <sync_token>`.
- The sync token is obtained from `/api/me` after login and stored in local config.

Missing and partial fields:

- `region` defaults to `eu`.
- `hasKeystone` defaults to `False`.
- Addon item level wins over Raider.IO item level when present.
- Nested blocks are passed as `None` if missing in the decoded entry.

## Worker Write Contract

Endpoint:

```text
POST /api/keystones/update
```

Implementation: `keystone-worker/src/routes/keystones.ts`.

Authentication:

- Requires `Authorization: Bearer <sync_token>`.
- `getUserBySyncToken()` maps the bearer token to `users.sync_token`.
- Invalid/missing sync token returns 401.

Identity:

- `character` and `realm` are required.
- `region` defaults to `eu`.
- Character rows are matched by `(user_id, name, realm, region)`.
- Missing row creates a new `characters` record.

Character update behavior:

- Updates scalar enrichment fields with `COALESCE`.
- For scalar enrichment fields, `null` or omitted values retain the previous stored value.
- JSON blocks use `payload.<block> === undefined ? null : jsonDump(payload.<block>)` before `COALESCE`.
- For JSON blocks, omitted values preserve previous JSON; present `null` is serialized to JSON string `"null"` and stored.
- `characters.updated_at` is always set to current Worker time on accepted update.

Current keystone behavior:

- Worker checks the latest same-week real keystone with `latestRealKeystone()`.
- `latestRealKeystone()` filters to `has_keystone = 1`, non-null level, and `updated_at >= currentEuWeeklyResetUnix()`.
- A new `keystones` row is inserted only when:
  - payload is newer than the latest same-week row according to `updatedAt`; and
  - `hasKeystone === true`; and
  - `keystoneLevel` is not `null` or `undefined`.
- Payloads without a real current keystone still update character metadata and JSON blocks, but do not insert a keystone row.

Write response:

```text
{
  status: "ok",
  message: "Keystone updated",
  character: <payload.character>,
  realm: <payload.realm>
}
```

## D1 Storage Contract

Schema source: `keystone-worker/migrations/0001_initial.sql`.

Tables:

| Table | Role |
| --- | --- |
| `users` | Login identity, password hash, sync token, profile and email fields. |
| `characters` | Character identity, Raider.IO/profile enrichment, item level, and JSON blocks. |
| `keystones` | Current keystone snapshots over time. |
| `teams` | Team records and invite code ownership. |
| `team_members` | User/team memberships. |
| `team_invitations` | Pending/accepted/declined invitations. |
| `rate_limits` | Rate-limit attempt JSON by key. |

Character sync columns:

- `characters.name`
- `characters.realm`
- `characters.region`
- `characters.avatar_url`
- `characters.wow_account`
- `characters.rio_score`
- `characters.wow_class`
- `characters.ilvl`
- `characters.vault_json`
- `characters.prey_hunts_json`
- `characters.currencies_json`
- `characters.money_json`
- `characters.mythic_plus_season_json`

Keystone columns:

- `keystones.character_id`
- `keystones.has_keystone`
- `keystones.keystone_level`
- `keystones.keystone_challenge_map_id`
- `keystones.keystone_map_id`
- `keystones.keystone_dungeon`
- `keystones.updated_reason`
- `keystones.updated_at`

JSON storage:

- `vault` is stored as `characters.vault_json`.
- `preyHunts` is stored as `characters.prey_hunts_json`.
- `currencies` is stored as `characters.currencies_json`.
- `money` is stored as `characters.money_json`.
- `mythicPlusSeason` is stored as `characters.mythic_plus_season_json`.

Design implication: adding a nested key inside an existing JSON block may not require a D1 migration if the Worker can preserve and return it and the Web can tolerate it. Adding a new independently persisted top-level block or queryable field requires a schema/contract decision and may require a migration.

## Worker Read Contract

Read response shaping lives in `keystone-worker/src/db.ts`.

Character response shape:

| Response field | Source |
| --- | --- |
| `id` | `characters.id` |
| `name` | `characters.name` |
| `realm` | `characters.realm` |
| `region` | `characters.region` |
| `wowAccount` | `characters.wow_account` |
| `avatarUrl` | `characters.avatar_url` |
| `rioScore` | `characters.rio_score` |
| `wowClass` | `characters.wow_class` |
| `ilvl` | `characters.ilvl` |
| `currentKeystone` | latest same-week real `keystones` row, or `null` |
| `vault` | parsed `vault_json`, or `null` |
| `preyHunts` | parsed `prey_hunts_json`, or `null` |
| `currencies` | parsed `currencies_json`, or `null` |
| `money` | parsed `money_json`, or `null` |
| `mythicPlusSeason` | parsed `mythic_plus_season_json`, or `null` |

`currentKeystone` shape:

- `level`
- `dungeon`
- `challengeMapId`
- `mapId`
- `updatedAt`
- `updatedReason`

JSON parsing:

- `jsonLoad()` returns `null` for empty SQL values.
- Invalid JSON also returns `null`.

Read endpoints:

- `GET /api/me/characters` returns the current user's character responses.
- `GET /api/teams/:teamId` returns members, each with `characters` using the same character response helper.
- `POST /api/me/characters/enrich` can update enrichment and JSON blocks for an existing character through the authenticated Web/client path, but it is not the primary SavedVariables sync endpoint.

## Web Consumption Contract

API helper:

- `keystone-web/lib/auth.ts` defines `API_URL`.
- Fallback API domain is `https://api-keystonesync.esgarpe.dev`.
- `apiFetch()` adds bearer auth from local storage and calls Worker routes.

Main consumers:

- `keystone-web/app/dashboard/page.tsx`
  - Fetches `/api/me/characters`, `/api/teams`, and team details.
  - Uses `currentKeystone`, `vault.dungeons`, `currencies.nebulousVoidcore`, class, account, avatar, and item level data.
- `keystone-web/app/characters/page.tsx`
  - Fetches `/api/me/characters`.
  - Displays identity, class/avatar, dungeon, keystone level, and current keystone timestamp.
- `keystone-web/app/summary/page.tsx`
  - Fetches `/api/me/characters`.
  - Uses `money`, `vault`, `preyHunts`, `currencies`, and `mythicPlusSeason`.
  - Contains current dungeon and currency display metadata in-page.
- `keystone-web/app/teams/[id]/page.tsx`
  - Fetches `/api/teams/:teamId`.
  - Uses member character lists with `currentKeystone`, identity, class, and avatar fields.

The Web keeps local TypeScript interfaces in each page rather than a single shared generated API type. Seasonal dungeon/currency display metadata is currently hardcoded in Web pages and should be reviewed during the WoW season phase, not changed here.

## Local-only / Not Currently Transported

Verified addon fields that are written to `KeystoneSyncDB` but do not cross the current client payload:

| Field | Addon source | Current status |
| --- | --- | --- |
| `keystoneWeeklyResetKey` | `SaveCharacterData()` writes `keystone.weeklyResetKey` | Used locally by addon preservation logic; not included in `keystone-client/sync_worker.py` payload; not accepted/persisted by Worker. |
| `mythicPlusSeasonUpdatedAt` | `UpdateMythicPlusSeason()` writes `time()` or preserves previous value | Used locally to track season capture time; not included in client payload; not accepted/persisted by Worker. |

Do not fix this gap in documentation-only phases. Future work should decide whether these are intentionally local-only or should become transported contract fields.

## Documented Contract Gaps And Validation Notes

- `keystoneWeeklyResetKey` and `mythicPlusSeasonUpdatedAt` are local-only despite being useful metadata for reset/season reasoning.
- Web API response types are duplicated in individual pages instead of centralized.
- Seasonal dungeon/currency display metadata is hardcoded in Web pages and must be audited during the WoW patch/season phase.
- Worker tests cover weekly reset behavior and representative sync write/read behavior using shared Client payload fixtures.

## Compatibility Expectations

Additive changes:

- Prefer additive fields when possible.
- Old/missing SavedVariables fields should be tolerated where current code already allows missing values.
- Adding nested keys to existing JSON blocks should preserve old JSON parsing where possible.

Removal or rename:

- Requires review of deployed Client compatibility.
- Must consider old SavedVariables and old client payloads.
- Must update Worker request handling, read responses, Web interfaces, fixtures/tests, and documentation as needed.

JSON blocks:

- Keep JSON blocks backward compatible.
- Missing or invalid stored JSON currently reads as `null`.

Weekly data:

- Do not erase valid same-week data due to transient empty WoW API reads.
- This is currently enforced in addon logic for current keystone preservation, Prey Hunts, money-on-logout, and Mythic+ season snapshots.

## Contract Change Checklist

For any new or changed tracked field, review:

- [ ] WoW data source/API
- [ ] Addon capture
- [ ] SavedVariables key/type
- [ ] Backward compatibility with old SavedVariables
- [ ] Client parser
- [ ] Client payload
- [ ] Worker request handling
- [ ] Persistence model
- [ ] D1 migration requirement
- [ ] Worker read response
- [ ] Web type/interface
- [ ] Web rendering
- [ ] Reset/staleness semantics
- [ ] Fixtures/tests
- [ ] Documentation

A tracked-data feature is not complete merely because the addon captures it.
