# Owned Loot And Great Vault Item Levels Design

## Objective

Keep owned KeystoneLoot favorites visible but visually completed, exclude them from every pending-loot count and recommendation input, and show the current reward item level for each unlocked Great Vault chest in Client and Web tooltips.

## Approved design

- Match KeystoneLoot's current ownership semantics: an item is owned while its item ID is equipped, in bags, or in the personal bank. This is current possession, not permanent loot history.
- The canonical KeystoneSync addon adds optional `owned: boolean` to each captured favorite. Existing bag, bank, equipment, login, logout, and manual refresh paths remain authoritative.
- Old snapshots without `owned` behave as pending. The Worker validates the optional boolean, projects only `owned: true` in presentation DTOs, excludes owned objectives from counts and Planner inputs, but retains them in objective responses.
- Client and Web render owned objectives desaturated with a green check in the lower corner and group them with non-actionable/completed items. Voidcore completion remains distinct copy but follows the same non-counting rule.
- The addon captures `rewardItemLevel` for every unlocked raid, dungeon, and world slot from Blizzard's current example reward item. Client and Web show it once beside that chest's progress. Existing boss, Mythic+ run, and world activity lists remain unchanged and do not receive per-activity item levels.

## Architecture

```text
KeystoneLoot favorites + WoW inventory
  -> KeystoneSync favorite.owned
  -> KeystoneClient pass-through
  -> Worker keystone_loot_json (existing D1 JSON column)
  -> objective DTO owned
  -> Client/Web counts, Planner filtering, and completed visuals
```

No D1 migration is needed. The `/v1` behavior is additive: stored snapshots, incoming snapshots, and objective DTOs may omit `owned`; omission means the item is not known to be owned.

Great Vault item levels are presentation metadata in the Client and Web seasonal modules; the existing Vault payload and D1 schema do not change.

## Verification

- Addon: `python -m unittest discover -s tests/runtime` and addon repository deployment-impact validation.
- Client parser: `python -m unittest discover -s tests/client`.
- Worker: `npm run typecheck` and `npm test` in `keystone-worker`.
- Client UI: `npm --prefix keystone-client test`, `npm --prefix keystone-client run build`, and `npm --prefix keystone-client run test:visual`.
- Web: `npm run lint`, `npm test`, `npm run build`, and `npm run test:visual` in `keystone-web`.
- Run repository Deployment Impact for every changed path and `--addon-changed` for the external canonical addon.

## Out of scope

- Persisting permanent loot history after an item is sold, traded, disenchanted, or deleted.
- Changing KeystoneLoot itself or depending on its private `KeystoneLoot.Owned` table.
- Hardcoded Great Vault reward tables.
- Remote migrations, deployments, tags, releases, pushes, or version bumps.
