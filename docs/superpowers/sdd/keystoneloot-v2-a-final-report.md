# KeystoneLoot V2-A Final Report

## Outcome

V2-A adds backend-only objective presentation contracts on
`feature/keystoneloot-v2-a`. Owner reads are JWT/ownership protected. Team reads require
live requester and target-owner membership in the requested team plus the target owner's
existing `shareKeystoneLootWithTeams` opt-in. The opt-out is enforced before the stored
snapshot is queried. There is no second privacy preference or column.

The response is an explicit item DTO rather than stored JSON. Projection covers defensive
snapshot states, source/spec filters, the dungeon namespace guard, deterministic display
deduplication using the V1 tier helper, stable filter-bound cursors, bounded pages, and
derived Voidcore states. V1 scoring behavior is unchanged.

Migration `0004_keystone_loot_item_metadata.sql` adds only the Blizzard display-metadata
cache. Worker-only OAuth and fixed regional Game Data endpoints enrich unique item IDs from
the current page, with positive/negative/stale caching, four-pipeline concurrency, response
validation, retry cooling, and null fallbacks.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 74/74 passed, including the complete V1 recommendation suite.
- Disposable local D1: migrations `0001` through `0004` applied in order; table and
  composite primary key verified; temporary persistence removed.
- Synthetic 2,000-favorite route: response and metadata read were limited to 50 current-page
  item IDs.
- Strict deployment impact: `WORKER=true`, `DB=true`; Web, Client build/release, Addon, and
  Addon release all false; no unknown/outside paths.
- `git diff --check`: required in final handoff after this report is added.

## Remaining limitations

Production requires separately provisioned `BLIZZARD_CLIENT_ID` and
`BLIZZARD_CLIENT_SECRET`, migration `0004` before the Worker deployment, and normal
monitoring of Blizzard rate/availability behavior. Missing credentials or upstream/cache
refresh failure returns objectives with null `itemName`/`iconUrl`; it does not block access
to the canonical item IDs. V2-B, V2-C, and V2-D remain unstarted.
