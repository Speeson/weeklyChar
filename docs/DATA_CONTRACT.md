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
- Client parser/payload: `keystone-client/sidecar/sync_worker.py`
- Worker write route: `keystone-worker/src/routes/keystones.ts`
- D1 schema: `keystone-worker/migrations/0001_initial.sql`, `0002_keystone_loot.sql`, and `0003_keystone_loot_sharing.sql`
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
| `keystoneLoot` | table | Optional `KeystoneLootIntegration.lua` snapshot using KeystoneLoot public API v2 plus read-only Voidcore state | Present only after that character is processed by V1-A; empty `favorites` is authoritative. | Conditional Client transport, validated Worker JSON block, owner read API |
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

The addon writes the canonical Midnight Season 2 keys:

- `adventurerMistcrest`
- `veteranMistcrest`
- `championMistcrest`
- `heroMistcrest`
- `mythMistcrest`
- `venomblightManaflux`
- `tidalSparkDust`
- `cofferKeyShards`
- `restoredCofferKey`
- `nebulousVoidcore`
- `sparksOfTides`
- `trovehuntersBounty`

Currency entries can include `id`, `name`, `quantity`, `maxQuantity`, `maxWeeklyQuantity`, `totalEarned`, `trackedQuantity`, `quantityEarnedThisWeek`, `discovered`, `quality`, `iconFileID`, `iconPath`, `isWeeklyComplete`, and `displayColor`.

`sparksOfTides` is item/currency-derived and includes Spark of Tides item counts plus Tidal Spark Dust currency counts. `trovehuntersBounty` includes `itemID`, `bagCount`, `hasBuff`, `questCompleted`, `iconFileID`, `iconPath`, and `weekKey`; same-week completed quest state is preserved across transient incomplete reads.

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

### `keystoneLoot`

The optional V1-A block has one of four states: `not_installed`,
`installed_not_ready`, `unsupported_api`, or `supported`. Every state includes
`installed`, `supported`, and `favorites`. State flags must be consistent:

- `not_installed`: `installed=false`, `supported=false`;
- `installed_not_ready`: `installed=true`, `supported=false`;
- `unsupported_api`: `installed=true`, `supported=false`;
- `supported`: `installed=true`, `supported=true`, `apiVersion=2`.

A supported snapshot also includes `addonVersion`, KeystoneLoot `characterKey`,
`updatedAt`, and `voidcore` with boolean `checked` plus positive integer `usedItems`.
Favorites use `sourceId`, `specId`, `itemId`, and generic positive integer `tier` as
identity. Optional known fields are `sourceType`, `slotId`, `icon`, `bonusIds`, `gems`,
and `enchant`. Numeric tiers are not capped at 5. Localized names are not identity.

The addon writes only the currently processed character and does not backfill historical
records. A present supported block with `favorites = {}` is a real empty wishlist and
replaces older favorites.

## Client Parsing And Payload Contract

`keystone-client/sidecar/sync_worker.py` watches selected SavedVariables files discovered by `keystone-client/sidecar/wow_path.py`.

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
| `keystoneLoot` | SavedVariables `keystoneLoot`, only when that key exists |

Authentication:

- Header: `Authorization: Bearer <sync_token>`.
- The sync token is obtained from `/api/me` after login and stored in local config.

Missing and partial fields:

- `region` defaults to `eu`.
- `hasKeystone` defaults to `False`.
- Addon item level wins over Raider.IO item level when present.
- Nested blocks are passed as `None` if missing in the decoded entry.
- `keystoneLoot` is different: a missing SavedVariables key is omitted from the HTTP
  payload, while a present block is authoritative.
- `slpp` represents numeric Lua arrays as mappings and cannot distinguish an empty Lua
  array from an empty object. The Client converts only the known V1-A array fields
  `favorites`, `voidcore.usedItems`, `bonusIds`, and `gems` from empty or contiguous
  one-based mappings to JSON arrays. It does not otherwise normalize or enrich the block.

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
- Existing JSON blocks use `payload.<block> === undefined ? null : jsonDump(payload.<block>)` before `COALESCE`.
- For those existing blocks, omitted values preserve previous JSON; present `null` is serialized to JSON string `"null"` and stored.
- KeystoneLoot is stricter: omitted `keystoneLoot` preserves the existing column, a
  present valid block replaces it authoritatively, and explicit `null` is rejected.
- KeystoneLoot validation happens before character creation/update, so malformed data
  cannot partially persist or erase an earlier snapshot.
- `characters.updated_at` is always set to current Worker time on accepted update.

KeystoneLoot validation accepts additive unknown fields but enforces the known V1-A
contract. Supported snapshots require API v2, bounded version/character identifiers,
non-negative integer timestamp, favorites, and Voidcore. Favorites require positive
integer item/spec IDs, positive integer tiers without a maximum, and numeric or bounded
string source identity. Known optional item fields are type-checked.

Limits:

- serialized UTF-8 block: 256 KiB;
- favorites: 2,000;
- Voidcore used items: 2,000;
- bonus IDs per favorite: 64;
- gems per favorite: 64;
- addon version/source type strings: 64 characters;
- character key/string source identity: 128 characters.

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

Schema source: `keystone-worker/migrations/0001_initial.sql` plus additive migrations
`keystone-worker/migrations/0002_keystone_loot.sql` and
`keystone-worker/migrations/0003_keystone_loot_sharing.sql`.

Tables:

| Table | Role |
| --- | --- |
| `users` | Login identity, password hash, sync token, profile/email fields, and the KeystoneLoot team-sharing preference. |
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
- `characters.keystone_loot_json`

KeystoneLoot team sharing is stored as
`users.share_keystone_loot_with_teams INTEGER NOT NULL DEFAULT 1`. The API converts this
integer to boolean `shareKeystoneLootWithTeams`: `1` enables recommendation use and `0`
excludes the user's wishlist from team recommendations, including requests made by that
same user.

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
- `keystoneLoot` is stored as `characters.keystone_loot_json`.

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
| `keystoneLoot` | owner reads only: parsed `keystone_loot_json`, or `null` |

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

- `GET /api/me/characters` returns the current user's character responses and explicitly
  enables `keystoneLoot` in response shaping.
- `GET /api/teams/:teamId` returns member characters through the default response shape,
  which continues to omit the `keystoneLoot` property entirely.
- `POST /api/me/characters/enrich` can update its established enrichment/JSON blocks but
  does not accept or persist KeystoneLoot. The only V1-B write source is SavedVariables
  sync through `POST /api/keystones/update`.

Privacy and recommendation endpoints:

- `GET /api/me` returns boolean `shareKeystoneLootWithTeams`.
- `PATCH /api/me/preferences` requires normal user/JWT authentication, accepts
  `{ "shareKeystoneLootWithTeams": boolean }`, updates only the authenticated user, and
  rejects sync-token authentication or non-boolean input.
- `GET /api/teams/:teamId/recommendations?challengeMapId=<positive-safe-integer>` requires
  live team membership and derives the evaluated member list entirely from D1.
- Privacy filtering precedes character loading and snapshot parsing. Disabled members
  return only `sharing_disabled` with `recommended: null`; no wishlist-derived counts,
  scores, items, or specs are calculated or exposed.
- Enabled members use only stored JSON that passes the V1-B validator as a supported API
  v2 snapshot. Missing, malformed, and unavailable snapshots are ignored safely.

Recommendation candidates are `(character, specId)` pairs. A target counts only when
`sourceId === challengeMapId` by exact numeric identity and `sourceType === "dungeon"`;
the type is a namespace guard against a raid boss ID collision. Tier weights are explicit: tier 3
BiS `100`, tier 2 Must `60`, tier 1 Nice `25`, tier 5 Catalyst `15`, and tier 4 Transmog
`5`; unknown tiers score `0`. Each `itemId` counts once per candidate at its highest
known weight, while the same item may count independently for another spec. Checked
Voidcore excludes used items and reports only aggregate `voidcoreExcluded`; unchecked
Voidcore does not exclude them.

Positive candidates tie-break by score, BiS, Must, Nice, Catalyst, Transmog, item level,
Raider.IO score, character name, realm, and spec ID. Missing item level/Raider.IO rank
below real values. Member statuses are `recommended`, `sharing_disabled`,
`no_keystoneloot`, and `no_targets`.

Recommendation responses contain character display fields, `specId`, score, and summary
counts only. They never contain favorites, item IDs/modifiers, `voidcore.usedItems`, or
raw `keystoneLoot`. Owner `/api/me/characters` access is unchanged when sharing is off.

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
  - Derives sorted actual-stone choices and requests `/api/teams/:teamId/recommendations`
    using only the selected stone's `challengeMapId`.
- `keystone-web/app/settings/page.tsx`
  - Loads the account-level KeystoneLoot sharing preference from `GET /api/me` and saves
    it through `PATCH /api/me/preferences` independently of local display settings.
- `keystone-web/lib/keystoneRecommendations.ts`
  - Defines the aggregate V1-C response shape and owns presentation-only stone,
    summary, response-validation, and exact-character-ID helpers. It does not score data.

V1-D renders only privacy-safe recommendation summaries and keeps normal team detail free
of raw wishlists. It does not consume the owner-only `keystoneLoot` block. V2 remains
mandatory and pending for actual item/object display.

The Web keeps local TypeScript interfaces in each page rather than a single shared generated API type. Seasonal dungeon/currency display metadata is currently hardcoded in Web pages and should be reviewed during the WoW season phase, not changed here.

## Local-only / Not Currently Transported

Verified addon fields that are written to `KeystoneSyncDB` but do not cross the current client payload:

| Field | Addon source | Current status |
| --- | --- | --- |
| `keystoneWeeklyResetKey` | `SaveCharacterData()` writes `keystone.weeklyResetKey` | Used locally by addon preservation logic; not included in `keystone-client/sidecar/sync_worker.py` payload; not accepted/persisted by Worker. |
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
