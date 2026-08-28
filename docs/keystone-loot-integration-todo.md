# KeystoneLoot Integration

## Objective

Use KeystoneLoot wishlists for team-scoped planning and objective inspection while
preserving the public KeystoneLoot API boundary, owner access, and strict live membership
authorization.

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

## V1-D: Web planner and privacy UI — completed

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

## V1-E: end-to-end validation and release readiness — completed

The complete V1 chain was validated with the real WoW SavedVariables file through the
real KeystoneClient parser, a disposable local Worker/D1 with migrations `0001`, `0002`,
and `0003`, owner reads, privacy enforcement, recommendations, and the actual Web
Settings/planner UI. Historical entries omit `keystoneLoot` and preserve server data;
authoritative empty favorites replace stale favorites. Team detail and recommendation UI
remain free of raw wishlist data.

Compatibility validation also proved that the pre-V1 Worker accepts and safely ignores
the new additive Client field, while the new Worker accepts older payloads that omit it.
V1 is release-ready subject to separately authorized production operations.

## V2-A: Worker objective contracts and metadata — implemented for review

V2 must display actual KeystoneLoot targets. Mandatory product scope is:

- item icon;
- item name;
- tier;
- dungeon/source;
- spec;
- Voidcore state;
- `Ver objetivos`;
- per-character wishlist view or drawer;
- dungeon/spec filtering.

The existing `shareKeystoneLootWithTeams` preference is the single consent boundary. When
enabled it permits aggregate recommendation use and allowlisted objective visibility only
between current members of the same requested team. When disabled it permits neither.
Owner access remains available. No second preference or privacy column exists.

V2-A implements owner and team objective endpoints, live same-team authorization,
allowlisted DTOs, server-side source/dungeon/spec filtering, stable cursor pagination,
display deduplication, Voidcore presentation states, Worker-side Blizzard item/media
enrichment, and D1 migration `0004_keystone_loot_item_metadata.sql`. It does not expose raw
snapshots or modify V1 scoring.

Remaining phases:

- **V2-B:** owner per-character wishlist drawer and filters.
- **V2-C:** team objective visibility and stone-comparison UI, `Ver objetivos`, and the
  Settings text `Compartir mis objetivos de KeystoneLoot con mis equipos` with description
  `Permite que los miembros de tus equipos usen tus objetivos de KeystoneLoot para
  planificar piedras y ver qué objetos necesitas en cada mazmorra.`
- **V2-D:** full local E2E, release readiness, and separately authorized production work.

## V3: advanced planner — pending

Role composition, global party optimization, and performance-aware scoring remain future
scope and are not part of V1-D.

## Release boundaries

- Addon releases remain owned independently by `Speeson/KeystoneSync`.
- Complete V1 weeklyChar impact is Web, Worker, DB, Client build, and Client release.
- Standalone V1-A impact is addon build and addon release.
- Safe production order is addon release, Client release, D1 migration `0002`, D1
  migration `0003`, Worker deployment, then Web deployment.
- The early addon/client steps are compatible with the old backend: old Client ignores
  the additive SavedVariables block and old Worker ignores the additive Client payload
  field. The new Worker remains compatible with clients that omit `keystoneLoot`.
- Push, release, deployment, and remote D1 migration require separate explicit approval.
