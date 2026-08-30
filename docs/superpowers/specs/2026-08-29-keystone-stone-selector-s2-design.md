# Keystone Stone Selector S2 Design

## Objective

Extend the existing Worker-owned Blizzard item cache with optional tooltip-safe metadata for
future Web and KeystoneClient item surfaces. S2 stores and exposes equipment slot, item class,
item subclass, and stat names only; numeric stat quantities and raw Blizzard payloads remain out
of contract.

## Verified Blizzard fields

The official Battle.net developer portal documents the static Item and Item Media endpoints used
by the Worker. Blizzard-hosted Item API response examples show the tooltip values at:

- `inventory_type.name` for the localized equipment slot;
- `item_class.name` for the localized item class/category;
- `item_subclass.name` for the localized subclass;
- `preview_item.stats[].type.name` for localized stat names.

The parser does not read `preview_item.stats[].value` or display strings. No Blizzard credentials
are available in this local environment, so S2 cannot record a fresh authenticated live response;
the implementation remains conservative and treats every tooltip field as optional.

## Storage and cache strategy

Migration `0005_keystone_loot_item_tooltip_metadata.sql` adds nullable `slot_name`,
`item_class_name`, `item_subclass_name`, and `stat_names_json` columns to
`wow_item_metadata`. Existing rows remain valid and continue serving cached name/icon data.

`stat_names_json IS NULL` identifies a pre-S2 or negative row. Fresh pre-S2 positive rows are not
refreshed immediately; they acquire tooltip metadata at their existing `refresh_after` boundary,
which bounds rollout traffic and guarantees eventual lazy enrichment under the established
30-day positive TTL. A successful S2 item fetch writes a JSON array, including `[]` when Blizzard
supplies no usable stats. Stale positive rows retain all cached safe fields on transient failure.

Stat names are trimmed, bounded, deduplicated, and code-point sorted. Optional malformed cache or
Blizzard values degrade independently to `null`/`[]`; valid name/icon data remains usable.

## Safe DTO integration

The existing `KeystoneLootObjectiveDTO` gains four additive fields:

```ts
slotName: string | null
itemClassName: string | null
itemSubClassName: string | null
statNames: string[]
```

The same safe enrichment function populates owner objectives, Team objectives, and Stone Selector
objectives. Authorization, status semantics, pagination, identity, counters, and the privacy
allowlist remain unchanged.

## Verification

- Worker typecheck and full tests.
- Local D1 migration chain 0001 through 0005 from a fresh local database.
- Resulting `wow_item_metadata` schema inspection.
- Strict deployment-impact classification.
- Diff and staging-state checks.

## Out of scope

- Web/Client tooltip rendering.
- Numeric stats, bonus IDs, upgrade tracks, instance item levels, gems, enchants, or raw payloads.
- Browser-side Blizzard calls, deployment, remote migrations, releases, or version changes.
