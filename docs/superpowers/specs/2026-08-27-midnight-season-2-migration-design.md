# KeystoneSync Midnight Season 2 Migration Design

## Objective

Migrate KeystoneSync from Midnight Season 1 to patch 12.1 / Midnight Season 2 while preserving the existing addon-to-Web architecture, weekly protections, and UI structure. Add Trovehunter's Bounty as richer nested currency state without adding a D1 migration.

## Approved Design

The addon writes canonical Season 2 keys only:

- `adventurerMistcrest`
- `veteranMistcrest`
- `championMistcrest`
- `heroMistcrest`
- `mythMistcrest`
- `venomblightManaflux`
- `tidalSparkDust`
- `sparksOfTides`
- `nebulousVoidcore`
- `trovehuntersBounty`

The client continues passing `currencies` as an opaque JSON object. The Worker continues storing and returning that object through `currencies_json`. The Web renders only canonical Season 2 keys; old Season 1 data remains tolerated but is not relabeled and appears unavailable until a fresh addon sync.

The Web keeps the current layout. Its active Season 2 dungeon metadata moves into one shared module consumed by Summary, Dashboard, and Teams. The addon continues discovering Mythic+ maps dynamically with `C_ChallengeMode.GetMapTable()`.

## Addon Behavior

- Set TOC Interface to `120100`.
- Replace Season 1 currency IDs with Mistcrests `3442`-`3446`, Venomblight Manaflux `3465`, Tidal Spark Dust `3509`, and Nebulous Voidcore `3513`.
- Keep Coffer Key Shards `3310` and Restored Coffer Key `3028`.
- Track Spark of Tides item `274476` and retain all compound item/dust fields.
- Append Nightmare Prey quest IDs `95021`-`95024` without changing existing ranges or same-week transient-zero preservation.
- Store `trovehuntersBounty` with item ID `274374`, `bagCount`, `hasBuff`, `questCompleted`, and `iconFileID`. Read bag count, aura `1293799`, and weekly quest `86371` defensively.
- Preserve Great Vault, current keystone, money, season snapshot, event, and reset behavior.

## Contract And Persistence

Data continues through:

```text
KeystoneSyncDB.currencies
  -> sync_worker.py payload.currencies
  -> POST /api/keystones/update
  -> characters.currencies_json
  -> Worker read response
  -> Web Character.currencies
```

No schema column, query behavior, or authentication boundary changes. Worker tests will prove the richer JSON survives write/read unchanged. No D1 migration is expected.

## Web Behavior

- Shared dungeon metadata contains the eight approved Season 2 challenge map IDs, names, abbreviations, and portal spell IDs.
- Summary keeps its existing table and prominently displays Hero/Myth Mistcrest plus the existing seasonal resource rows, Spark of Tides, and Trovehunter status.
- Trovehunter uses readable `Completed` / `Incomplete` text so color is not the only state cue.
- Settings migrate old visibility preferences once to their Season 2 equivalents; rendering does not read old currency data keys.
- Landing copy, settings copy, Dashboard voidcore metadata, current-keystone formatting, and Teams filters use Season 2 names.

## Icon Strategy

Use verified live Wowhead icon names first in the existing 20x20 (`h-5 w-5`) visual container:

| Entry | Live icon name |
| --- | --- |
| Hero Mistcrest | `inv_121_crest_hero` |
| Myth Mistcrest | `inv_121_crest_myth` |
| Venomblight Manaflux | `inv_10_blacksmithing_craftedoptional_blacksmithdye_earth` |
| Tidal Spark Dust | `inv_enchanting_dust_color3` |
| Spark of Tides | `inv_12_profession_questandcrafting_sparkwhole_green` |
| Nebulous Voidcore | `inv_1205_voidforge_fluctuatingvoidcores_green` |
| Trovehunter's Bounty | `icon_treasuremap` |

Only add a matching local Season 2 fallback when Playwright proves a live icon broken, generic, incorrectly cropped, or visually inconsistent. Never fall back to a Season 1 asset.

## Compatibility

- Old/partial SavedVariables and stored Worker JSON remain accepted.
- Old Season 1 quantities are not mapped onto Season 2 keys.
- New Season 2 rows show unavailable for stale records until a fresh addon capture.
- A narrow localStorage settings migration maps old visibility choices to canonical Season 2 setting keys and then removes the old keys from the active settings object.

## Verification

- Addon temporary clone: compile/static contract tests, package validation, release/deploy-impact tests, and source audit for dynamic M+ discovery and weekly protections.
- Client: `python -m compileall -q keystone-client/sidecar scripts tests`, `python -m unittest discover -s tests/client`, and focused character display/contract tests.
- Worker: `npm.cmd run typecheck` and `npm.cmd test` under `keystone-worker`.
- Web: focused Node tests, `npm.cmd run lint`, `npm.cmd run build`, and Playwright/browser screenshots at desktop and narrow widths.
- Repository: stale active Season 1 reference search, `git diff`, `git status --short`, and `python scripts/deploy_impact.py --files <changed-paths> --addon-changed`.

## Out Of Scope

- No D1 migration unless an unexpected storage blocker is proven.
- No new currencies such as Untainted Mana-Crystals.
- No Summary redesign or additional crest rows.
- No addon hardcoded dungeon pool.
- No authentication weakening, release, tag, push, deployment, or remote migration.
- No edits to historical release assets or historical changelog entries solely to erase Season 1 history.
