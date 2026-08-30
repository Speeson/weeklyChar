# Teams lifecycle and localized tooltip refinement

## Scope

This refinement changes KeystoneClient Teams lifecycle and presentation and the Worker metadata
locale used by the Client Selector. Web, D1, and the standalone KeystoneSync addon remain unchanged.
No item-level or favorite-variant fields are added in this phase.

## Teams lifecycle

- `I18nProvider` memoizes its translator and context value by language, so unrelated App renders do
  not retrigger Teams effects.
- `TeamsPage` performs one true initial load, then revalidates the Team list without clearing visible
  data on picker open, window focus, or document visibility restoration.
- Concurrent list refreshes share one request. A monotonic generation prevents an older result from
  replacing a newer result. A refresh failure preserves the last valid list and Team detail.
- The active Team remains selected while present; if removed, the first current Team is selected.
  The Team picker always opens, including when the cached list contains one Team.
- Selector responses use an in-memory cache keyed by `teamId:challengeMapId:locale`. Cached data
  renders immediately and is revalidated in the background. Identical in-flight requests are
  deduplicated; selection generations prevent cross-dungeon and cross-Team display races. No eager
  eight-dungeon prefetch is introduced.

## Localized tooltip metadata

The Client sends its current Blizzard locale (`es_ES` or `en_US`) through the existing generic
bridge and Python sidecar to the Worker Selector endpoint. The Worker validates that allowlist and
uses the requested locale for Blizzard item and media requests and for D1 cache lookup/write.

The existing D1 primary key already includes `(region, locale, item_id)`, so Spanish and English
metadata remain isolated without a migration. Older callers and Web retain the existing `es_ES`
default. Unknown locales fail closed.

The tooltip uses the existing cached `qualityType` only for the item-name color. Objective category
colors remain independent. Local labels continue to use the Client translator, while Blizzard name,
slot, class, subclass, and stat names now match the selected Client language.

## Client presentation

- The unselected prompt uses the current theme's existing `brand-mark` asset with larger responsive
  typography.
- Existing rarity classes map `POOR`, `COMMON`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`, `ARTIFACT`,
  and `HEIRLOOM` to their established colors, with a neutral fallback for missing/unknown quality.
- Opening or closing Settings preserves the mounted Teams data and does not cause a list/detail
  refetch.

## Compatibility and rollout

The locale query is additive and defaults to Spanish for older callers. No Worker response shape,
SavedVariables contract, or database schema changes. Deployment impact is Worker and Client
build/release only; Web, DB, Addon, and Addon release remain false.
