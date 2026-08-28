# KeystoneLoot Integration

## Objective

Use the wishlist configured in KeystoneLoot as future input for KeystoneSync team
recommendations while preserving owner privacy and the KeystoneLoot public contract.

## V1-A: addon capture — completed

The canonical `Speeson/KeystoneSync` addon uses isolated
`KeystoneLootIntegration.lua`, declared with `## OptionalDeps: KeystoneLoot` and loaded
before the normal runtime. Readiness never depends on TOC order: it uses public API v2
`IsReady()` and `READY`, then listens only for aggregate `FAVORITES_CHANGED`.

Character identity and wishlist data come from public methods:

- `GetCurrentCharacterKey()`;
- `GetFavorites(characterKey)`;
- `GetSourceInfo(sourceId)`;
- `GetItemInfo(itemId)`.

The integration does not read `KeystoneLootDB.favorites`, construct KeystoneLoot keys,
hardcode four/five tiers, or use localized names as identity. Numeric tiers are preserved
generically. Direct SavedVariables access is limited to verified read-only
`KeystoneLootCharDB.voidcore` and `voidcoreChecked` because no public read API exists.

Each character processed by the addon receives an explicit `keystoneLoot` state. A ready
supported snapshot contains API/addon version, KeystoneLoot character key, timestamp,
normalized favorites, and Voidcore state. Empty favorites are authoritative. Generation,
debounce, logout, and dual-character-key checks prevent stale or cross-character writes,
and all KeystoneLoot calls are protected from the normal save flow.

## V1-B: Client, Worker, D1, and owner read — completed in feature branch

```text
KeystoneSyncDB[key].keystoneLoot
  -> conditional KeystoneClient payload
  -> POST /api/keystones/update validation
  -> characters.keystone_loot_json
  -> owner GET /api/me/characters[].keystoneLoot
```

The Client omits the HTTP field when the SavedVariables key is absent, preserving any
existing server snapshot for historical characters and old clients. A present block is
authoritative, including `favorites: []` and unavailable states. The Client performs only
the Lua-to-JSON array representation required by `slpp`; it does not enrich or score data.

The Worker validates states, flags, supported metadata, favorite identity, generic
numeric tiers, Voidcore, strings, arrays, and conservative payload limits. Valid present
blocks replace D1 JSON; omitted blocks preserve it; explicit `null` and malformed blocks
are rejected before persistence. Migration `0002_keystone_loot.sql` adds only nullable
`keystone_loot_json TEXT`.

Owner reads return the parsed block or `null`. Team detail responses omit the
`keystoneLoot` property entirely. `/api/me/characters/enrich` is not a KeystoneLoot write
surface.

## V1-C: privacy and recommendations — pending

Future work must define and implement server-side privacy policy before any team access.
Only then may the system calculate one recommended character per team member for a chosen
keystone. Scoring rules, duplicate-item/spec treatment, Voidcore completion handling,
fallbacks, and user controls remain deliberately undecided in V1-B.

Raw owner wishlist data must not be exposed through team endpoints as a shortcut.

## V2: item/object display — mandatory future scope

Future visual experiences must resolve and render item/source metadata safely rather than
depend on localized names captured by the addon. Item names, links, icons, cache loading,
object presentation, and wishlist UI are not implemented by V1-A or V1-B.

## Release boundaries

- Addon releases remain owned by `Speeson/KeystoneSync` and are independent from Client
  releases.
- V1-B changes the Client binary and Worker/D1 contract, so Client build/release plus
  Worker and DB deployment consideration is required.
- Push, release, deployment, and remote D1 migration require separate explicit approval.
