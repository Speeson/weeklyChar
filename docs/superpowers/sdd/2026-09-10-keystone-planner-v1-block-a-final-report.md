# Keystone Planner V1 Block A Final Report

## Delivery

- Created `feature/keystone-planner-v1` from `main` at
  `7ca502d037c547036f2c3fbc6226808a3558e2c2`; no commit or push was made.
- Initial working tree contained only pre-existing untracked paths:
  `.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`,
  `docs/keystone-planner-v1-plan.md`, `docs/keystonesync-selector-piedra-plan.md`, and
  `keystone-client/tauri-current-characters.png`. They were preserved.
- Added migration `0010_keystone_planner.sql` with `character_play_preferences`, composite PK
  `(character_id, spec_id)`, the four-state D1 check, positive spec checks, `loot_spec_id`, UTC
  timestamp, and character-delete cascade. No role column exists.
- Added the Worker-owned 40-spec Retail catalog, derived roles, conservative damage affinity,
  nine unique capability definitions, spell/icon metadata, class/spec providers, and explicit
  conditional Hunter Bloodlust.
- Added JWT-only owner routes `GET/PUT /api/me/planner/preferences`. PUT is a strict, atomic,
  full-replacement document; it validates all input before one transactional D1 batch and defaults
  an omitted `lootSpecId` to `specId`.
- Preserved `shareKeystoneLootWithTeams`, Team/Selector contracts, and all Web, Client, and addon
  code unchanged.

## Files

Added:

- `keystone-worker/migrations/0010_keystone_planner.sql`
- `keystone-worker/src/plannerPreferences.ts`
- `keystone-worker/src/wowComposition.ts`
- `keystone-worker/tests/plannerPreferencesRoutes.test.js`
- `keystone-worker/tests/test_keystone_planner_migration.py`
- `keystone-worker/tests/wowComposition.test.js`
- Block A SDD spec, implementation plan, and this final report under `docs/superpowers/`.

Modified:

- `keystone-worker/src/routes/me.ts`
- `keystone-worker/src/types.ts`
- `docs/AGENT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_CONTRACT.md`

## API contract

`GET /api/me/planner/preferences` returns `200`:

```json
{
  "preferences": [
    {
      "characterId": 10,
      "specId": 66,
      "role": "tank",
      "playPreference": "available",
      "lootSpecId": 70,
      "updatedAt": "2026-09-10T00:00:00.000Z"
    }
  ]
}
```

No configuration returns `{ "preferences": [] }`. Ordering is `(characterId, specId)`.

`PUT /api/me/planner/preferences` accepts exactly:

```json
{
  "preferences": [
    {
      "characterId": 10,
      "specId": 66,
      "playPreference": "available",
      "lootSpecId": 70
    }
  ]
}
```

`lootSpecId` is optional and defaults to `specId`. The array replaces all preferences belonging
to the authenticated owner; an empty array clears them. Both routes reject missing/invalid JWTs
and sync tokens with `401`. PUT rejects malformed input, unknown fields, invalid states/IDs,
duplicates, foreign characters, missing/unknown character classes, and class-invalid played or
loot specs with `400`, without persistence.

## WoW catalog decisions

The catalog is structured as specialization definitions plus unique capability definitions with
provider metadata. `capabilitiesForSpec()` resolves contributions without route/class conditionals.
Every capability is `stacking: "unique"`, allowing later scoring to collapse duplicates.

Conservative DPS affinity:

- `physical`: Arms, Fury, Feral, Outlaw, Subtlety, Windwalker.
- `magical`: Arcane, Fire, Frost Mage; Balance; Shadow; Elemental; Affliction, Demonology,
  Destruction; Devastation, Augmentation; Devourer.
- Explicitly `null`: Retribution, Frost/Unholy Death Knight, all three Hunter specs,
  Assassination, Enhancement, and Havoc. Tank/healer specs are also `null` by design.

The catalog uses no percentages. Devourer `1480` is correctly assigned to Demon Hunter, based on
Blizzard's current announcement. The existing Web-only catalog currently assigns it to Evoker;
that file was not changed because Web is outside Block A.

Sources checked on 2026-09-10 include Blizzard's current
[class catalog](https://worldofwarcraft.blizzard.com/en-us/game/classes) and
[Devourer announcement](https://worldofwarcraft.blizzard.com/en-us/news/24262570), plus current
Warcraft Wiki provider/spell references for
[Bloodlust](https://warcraft.wiki.gg/wiki/Bloodlust_effect),
[combat resurrection](https://warcraft.wiki.gg/wiki/Resurrect), and
[Skyfury](https://warcraft.wiki.gg/wiki/Skyfury).

## Tests and validation

New tests cover empty GET, JWT requirement, sync-token rejection, all four states, default and
cross-spec loot selection, creation/update/full replacement/clear, owner isolation, foreign
characters, class-invalid played and loot specs, missing class, duplicates, malformed payloads,
derived role, persisted reread, 40 unique specs, catalog roles/damage profiles, unique capabilities,
provider integrity, conditional capability resolution, schema checks, D1 checks, and FK cascade.

- `npm run typecheck`: passed, exit `0`.
- `npm test`: passed, 137 tests, 137 passed, 0 failed, exit `0`.
- `python -m unittest tests.test_keystone_planner_migration`: passed, 3 tests, exit `0`.
- First `npm run d1:migrate:local`: applied `0010_keystone_planner.sql` successfully to local D1;
  Wrangler reported 2 commands successful and explicitly identified the resource as local.
- Final `npm run d1:migrate:local`: passed with `No migrations to apply!`, exit `0`.
- Local `sqlite_master` query through `wrangler d1 execute DB --local`: returned the expected table
  SQL with composite PK, four states, positive IDs, timestamp, and cascade.
- `python scripts/deploy_impact.py --files <changed-paths> --json --strict`: passed, exit `0`, with
  no unknown or outside paths.
- `git diff --check`: passed, exit `0`; Git emitted only existing LF-to-CRLF normalization warnings
  for tracked files and no whitespace errors.

Deployment Impact:

```text
WEB=false
WORKER=true
DB=true
CLIENT_BUILD=false
CLIENT_RELEASE=false
ADDON=false
ADDON_RELEASE=false
```

No remote migration, deployment, release, push, or commit was performed.

## Before Block B

- Decide whether conditional capabilities (currently Hunter Bloodlust) should participate in the
  Solver exactly like guaranteed capabilities or receive a distinct soft-preference treatment.
- Confirm whether the seven conservative `null` DPS affinities should remain neutral in V1 or
  receive a separate evidence pass before damage-synergy scoring is enabled.
- Correct Devourer `1480` from Evoker to Demon Hunter in the Web-local catalog during Block D, when
  Web changes are in scope.
- Characters whose persisted `wow_class` is missing cannot save Planner preferences safely. The UI
  should surface that state or trigger the existing enrichment path rather than infer a class.
