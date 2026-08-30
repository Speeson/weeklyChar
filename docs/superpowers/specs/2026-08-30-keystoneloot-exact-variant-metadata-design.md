# KeystoneLoot Exact Favorite Variant Metadata Design

## Goal

Carry the exact saved KeystoneLoot Favorite variant into KeystoneClient's Stone Selector and
persist direct language selections immediately. The change is additive across addon SavedVariables,
Client sync, Worker projection, Python/TypeScript validation, and Client presentation. Web and D1
remain unchanged.

## Verified KeystoneLoot contract

The locally installed KeystoneLoot API v2 exposes Favorites as `itemId`, `specId`, `sourceId`,
`tier`, `tierName`, `bonusIds`, `gems`, and `enchant`. `GetItemInfo(itemId)` exposes only static
database slot/icon data. It does not expose an exact Favorite link, item level, or quality.
KeystoneLoot's internal `Upgrade:BuildItemLink` demonstrates the canonical item-string layout but
also adds current UI track, item-level, special, gem, and forced-Epic modifiers; it is therefore not
an exact Favorite identity helper.

KeystoneSync builds the same item-string layout with only the Favorite's stored `bonusIds`, loads it
through `Item:CreateFromItemLink(...):ContinueOnItemLoad()`, and reads exact level and numeric quality
through `C_Item`. Unknown or unresolved values remain absent. Callbacks are guarded by integration
generation plus both current character identities.

## Contract

Each normalized Favorite additively carries `variantKey`, optional `itemLevel`, and optional
`qualityType`. `variantKey` is `base` without bonus IDs or `bonus:` plus sorted numeric bonus IDs.
It is deterministic before item data resolves and keeps distinct variants separate. Legacy
Favorites remain valid and derive `base` or their normalized bonus identity in the Worker.

Worker validation accepts only positive safe-integer item levels and the established WoW quality
allowlist. Objective and Selector deduplication include `variantKey`. Exact Favorite quality wins;
locale-scoped Blizzard item metadata remains the display source and base-quality fallback only.
No variant data is written into `wow_item_metadata` and no migration is needed.

## Client behavior

Python and TypeScript allowlist `variantKey` and nullable `itemLevel`. React keys include the
variant. The tooltip keeps its existing actual-quality name color and renders localized
`Nivel de objeto X` / `Item Level X` only when an exact level exists.

Settings language buttons enqueue serialized `settings.update({ lang })` writes. App language is
updated immediately from the last persisted settings plus the selected language, while unrelated
local drafts stay local. Generation guards ignore stale loads/responses; a failed final write
restores the last persisted language and reports a controlled error.

## Compatibility and rollout

Old addon snapshots, old Clients, and rows without exact fields remain valid. The additive payload
stays inside `characters.keystone_loot_json`, so `DB=false`. Worker must deploy before Client 0.6.9
so the released Client receives the extended safe Selector DTO. The separate addon repository needs
its own patch release before new exact metadata can be produced.
