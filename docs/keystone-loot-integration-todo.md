# KeystoneLoot Integration

## Objective

Use KeystoneLoot wishlists for privacy-safe KeystoneSync team recommendations while
preserving the public KeystoneLoot API boundary and owner access to raw snapshots.

## V1-A: addon capture — completed

The canonical `Speeson/KeystoneSync` addon uses isolated
`KeystoneLootIntegration.lua`, public API v2 readiness/events, public favorite/source/item
methods, and verified read-only Voidcore state. It preserves generic numeric tiers,
authoritative empty favorites, current-character isolation, and protected normal saves.

## V1-B: Client, Worker, D1, and owner read — completed

```text
KeystoneSyncDB[key].keystoneLoot
  -> conditional KeystoneClient payload
  -> POST /api/keystones/update validation
  -> characters.keystone_loot_json
  -> owner GET /api/me/characters[].keystoneLoot
```

Absent Client fields preserve existing D1 data; present valid blocks replace it,
including empty favorites and unavailable states. Explicit null/malformed blocks are
rejected. Team detail omits raw `keystoneLoot`, and `/api/me/characters/enrich` is not a
write surface.

## V1-C: privacy and recommendations — completed

Migration `0003_keystone_loot_sharing.sql` adds user preference
`share_keystone_loot_with_teams`, enabled by default. `GET /api/me` exposes boolean
`shareKeystoneLootWithTeams`; JWT-only `PATCH /api/me/preferences` can toggle only the
current user. Sync tokens cannot change privacy preferences.

`GET /api/teams/:teamId/recommendations?challengeMapId=<id>` requires live membership and
returns one stable result per current team member. Sharing-disabled members are filtered
before character loading or snapshot parsing. Enabled members use only stored snapshots
that pass the V1-B validator as supported API v2 data.

The pure engine ranks `(character, specId)` candidates for exact numeric dungeon source
identity. Explicit weights are BiS 100, Must 60, Nice 25, Catalyst 15, and Transmog 5;
unknown tiers score zero. Items deduplicate by `itemId` within a candidate at their
highest known weight. Checked Voidcore excludes used items without penalizing unrelated
pending targets.

Responses contain display fields, `specId`, score, and aggregate counts only. They never
expose favorites, item IDs/modifiers, `voidcore.usedItems`, or raw `keystoneLoot`. Owner
character reads remain available regardless of team-sharing preference.

## V1-D: Web planner and privacy UI — completed in feature branch

Settings now loads the account preference from `GET /api/me` and saves it through
`PATCH /api/me/preferences`; it never stores that value in `ks_web_settings`, and the
local `Restaurar valores` action does not change it.

The team page derives selectable options only from actual current member keystones,
preserves duplicate dungeon stones owned by different characters, and sends the selected
stone's `challengeMapId` to the V1-C recommendation endpoint. The responsive planner
renders every member status and aggregate explanation, guards rapid stone switches with
abort/generation checks, and highlights only the exact recommended `characterId` in the
existing team list. No scoring, tier weights, Voidcore decisions, or raw wishlist data
exist in Web.

## V2: item/object display — mandatory future scope

Future visual experiences must resolve and render actual item/source objects safely.
Item names, links, icons, cache loading, object presentation, and wishlist UI are not
implemented by V1-A, V1-B, V1-C, or V1-D. V2 remains mandatory and must not depend on localized
names captured by the addon.

## V3: advanced planner — pending

Role composition, global party optimization, and performance-aware scoring remain future
scope and are not part of V1-D.

## Release boundaries

- Addon releases remain owned independently by `Speeson/KeystoneSync`.
- V1-B has Client/Worker/DB impact.
- V1-C has Worker/DB impact only; future ordering is `0002`, `0003`, then Worker deploy.
- V1-D has Web impact only and introduces no migration or Client/addon release requirement.
- Push, release, deployment, and remote D1 migration require separate explicit approval.
