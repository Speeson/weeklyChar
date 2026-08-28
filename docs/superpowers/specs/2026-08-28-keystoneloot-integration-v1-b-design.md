# KeystoneLoot Integration V1-B Design

## Objective

Transport the optional V1-A `KeystoneSyncDB[key].keystoneLoot` snapshot through
KeystoneClient and `POST /api/keystones/update`, persist it in D1, and return it only
from the authenticated owner's `GET /api/me/characters` response.

V1-B is transport and persistence only. It does not add recommendations, privacy UI,
team wishlist access, Web rendering, item enrichment, or V2 item/object display.

## Approved data flow

```text
KeystoneSyncDB[key].keystoneLoot
  -> KeystoneClient conditional payload.keystoneLoot
  -> Worker validation
  -> characters.keystone_loot_json
  -> owner /api/me/characters[].keystoneLoot
```

The Client treats field presence as authoritative. If the SavedVariables entry has no
`keystoneLoot` key, the HTTP payload omits it. If the key is present, the Client passes
the decoded structure through without semantic normalization. The repository's `slpp`
decoder represents numerically keyed Lua arrays as Python mappings and cannot distinguish
an empty Lua array from an empty Lua object, so the transport performs one
representation-only correction: empty or contiguous one-based numeric tables at the known
V1-A array fields `favorites`, `voidcore.usedItems`, `favorite.bonusIds`, and
`favorite.gems` become JSON arrays. Non-array mappings, ordering, tiers, and unknown
additive fields are untouched.

## Worker validation

The sync route validates `keystoneLoot` before creating or updating a character row.
Explicit `null`, arrays, primitives, malformed state/flag combinations, invalid favorite
identity, invalid Voidcore data, and oversized payloads return HTTP 400 without changing
the stored KeystoneLoot snapshot.

Allowed states and required flags are:

| State | `installed` | `supported` |
| --- | --- | --- |
| `not_installed` | `false` | `false` |
| `installed_not_ready` | `true` | `false` |
| `unsupported_api` | `true` | `false` |
| `supported` | `true` | `true` |

Every state requires an array-valued `favorites`. Unavailable states require that array
to be empty. A supported snapshot additionally requires API version `2`, bounded addon
and character identifiers, a non-negative integer `updatedAt`, and a valid `voidcore`
object.

Each favorite requires a positive integer `itemId`, positive integer `specId`, integer
`tier` greater than zero with no maximum, and a `sourceId` that is either a positive
integer or bounded non-empty string. Known optional fields are validated when present:
bounded `sourceType`, integer `slotId`/`icon`/`enchant`, and integer arrays for
`bonusIds`/`gems`. Unknown additive fields remain permitted and are preserved.

Voidcore requires boolean `checked` and an array of positive integer `usedItems`.

Limits are:

- serialized UTF-8 block: at most 256 KiB;
- favorites: at most 2,000 entries;
- Voidcore used items: at most 2,000 entries;
- bonus IDs per favorite: at most 64;
- gems per favorite: at most 64;
- addon version: at most 64 characters;
- character key and string source identity: at most 128 characters;
- source type: at most 64 characters.

## Persistence and compatibility

Migration `0002_keystone_loot.sql` adds nullable `characters.keystone_loot_json TEXT`.
No normalized favorites table or query columns are added.

An omitted request property binds SQL `NULL` into the existing `COALESCE` update pattern
and preserves the stored column. A present valid block is serialized and replaces the
column authoritatively. This includes empty favorites, `checked = false`, and transitions
from `supported` to an unavailable state.

Old clients and historical SavedVariables entries therefore preserve existing server
data. Invalid input never reaches the database write.

## Read and privacy boundary

Character response shaping accepts an explicit `includeKeystoneLoot` option. Owner reads
set it to true and return `keystoneLoot` parsed from `keystone_loot_json`, or `null` for a
missing/invalid SQL value. Team response paths use the false default and omit the property
entirely. `/api/me/characters/enrich` remains unchanged and cannot write KeystoneLoot.

## Testing and release metadata

Dedicated SavedVariables and Client-payload fixtures cover a realistic supported V1-A
snapshot. Client tests also cover authoritative empty favorites, unavailable state, and
absence of the key. Worker tests cover round trip, replacement, omission, null rejection,
state semantics, favorite/Voidcore validation, size and array limits, authentication, and
team non-exposure. Fake D1 mirrors the new column and SQL binding order.

A pending Spanish Client patch changeset records the release impact without changing the
Client version.

## Verification

Run Client Python/bridge tests and compile checks, Worker typecheck/tests, local D1
migrations, deploy-impact and release tests, Client frontend/Rust/sidecar builds, visual
tests, and a local NSIS build where the existing environment supports it. Run strict
deployment impact and `git diff --check`. Do not run remote migrations or deployments.

## Out of scope

- V1-C recommendations, scoring, team privacy settings, or team wishlist access.
- Any KeystoneLoot Web UI or V2 item/object display.
- Writes through `/api/me/characters/enrich`.
- Addon changes or version bumps.
- V1-B commit, push, merge, tag, release, deployment, or remote D1 migration.
