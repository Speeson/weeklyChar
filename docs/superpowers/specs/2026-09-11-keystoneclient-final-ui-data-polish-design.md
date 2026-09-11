# KeystoneClient final UI and equipment-data polish design

## Scope

Complete four approved corrections before branch cleanup and publication:

1. replace the WebView browser context menu with a compact KeystoneClient menu;
2. move the selected-avatar marker out of the portrait;
3. show the character's total Mythic+ rating in the Dungeons header;
4. identify equipped set-piece counts by raid tier using Raider.IO gear metadata.

Push, release, deployment and cleanup are explicitly outside this implementation step.

## Context menu

KeystoneClient will cancel the document `contextmenu` default action and render one themed React
menu at the pointer position. Its coordinates will be clamped to the visible client frame so the
panel never leaves the window. It contains, in this order:

- Sync now;
- Change avatar;
- Settings;
- Minimize to tray.

The menu closes after an action, on outside pointer interaction, on Escape, or when the active view
changes. Actions reuse existing App/Tauri handlers; React does not add direct token, filesystem or
Worker access. An action that is invalid in the current application state is rendered disabled.
The native menu remains suppressed during startup and unauthenticated screens even when the custom
actions cannot be shown.

Keyboard behavior uses menu semantics, focus transfer to the first enabled item, arrow navigation,
Home/End, Enter/Space activation and Escape restoration. Existing keyboard shortcuts for editable
fields remain available; the custom menu does not add clipboard permissions or clipboard actions.

## Avatar selection

`AvatarChoice` renders only the portrait. The selected marker becomes a sibling at the right edge
of the complete avatar card. It uses the existing themed confirm artwork in a yellow square with
rounded corners, remains covered by the card's `aria-pressed` state and cannot overlap the portrait,
character name or realm.

## Total Mythic+ rating

The Dungeons panel header gains a compact trailing chip. Its value source is:

1. `character.mythicPlusSeason.rating` when finite and positive;
2. `character.rioScore` as fallback;
3. an em dash when neither exists.

The label is `Rating total` in Spanish and `Total rating` in English. The chip is inside the header
layout rather than absolutely positioned. It uses content width, bounded horizontal padding,
minimum right inset equal to the header's own padding, ellipsis protection and no negative margins;
therefore it neither touches the panel border nor protrudes at 1672×941 or the 940×529 minimum
window. Its number may use the existing Raider.IO score color helper, but the label stays themed and
legible.

## Tier-aware set pieces

### Source

The existing Raider.IO character request already asks for `gear`. Raider.IO gear items can expose a
numeric-string `tier` value. KeystoneClient will normalize only positive integer tier values and
count equipped items per tier. No static set-ID table, item-name inference or bonus-ID heuristic is
introduced.

### Additive model

Equipment gains an optional field:

```text
tierPieces: Array<{ tier: number; count: number }>
```

Entries are unique by tier, have positive integer values and are sorted by tier ascending for stable
storage and rendering. Missing, malformed or empty Raider.IO data yields no `tierPieces` field and
preserves the current generic set-piece summary.

### Pipeline

The existing Raider.IO response is parsed during synchronization without an additional HTTP call.
Normalized tier counts are merged into the addon-provided `equipment` snapshot before the existing
payload is posted. Worker validation accepts the optional nested field inside the existing equipment
JSON, D1 stores it in that existing JSON block, and character reads return it additively. No D1
migration or new column is required.

When the desktop client combines the remote equipment block with a fresher local addon snapshot,
local item and set data remain authoritative while the remote `tierPieces` enrichment is preserved
unless a newer normalized enrichment replaces it. Old clients and old records can omit the field.

### Presentation

When tier counts exist, the Gear header renders one compact segment per tier, for example:

```text
3 piezas de conjunto (T35) · 2 piezas de conjunto (T36)
```

English uses `Set pieces`; singular counts use the singular label. If tier data is absent, the
current total `N piezas de conjunto`/`N Set pieces` remains unchanged. Tier labeling never changes
the item tooltip or the addon `setId` grouping.

## Failure and compatibility behavior

- Raider.IO timeout, HTTP failure or absent `tier` values cannot fail synchronization; tier labels
  simply fall back to the current generic total.
- Unknown future positive tiers are preserved instead of capped to the current season.
- Existing character payloads, cached records and SavedVariables remain valid.
- Context-menu failures do not block normal left-click navigation or keyboard shortcuts.
- No authentication, authorization or secret-handling boundary changes.

## Validation

- React unit tests for menu lifecycle/actions, disabled states, avatar marker placement, rating
  source precedence, localization and tier-summary fallback.
- Playwright coverage for right-click suppression, viewport clamping, themed menu, external avatar
  marker and header-chip bounds at normal and minimum window sizes.
- Python tests for Raider.IO tier normalization, mixed T35/T36 data, malformed/unknown values,
  no-extra-request behavior and local/remote equipment merging.
- Worker tests for additive acceptance, persistence and readback of `equipment.tierPieces`, including
  old payload compatibility.
- Client frontend, Python, bridge, Worker and relevant visual validation followed by Deployment
  Impact classification.

## Acceptance criteria

1. Right-click never exposes Back, Reload, Save as or other WebView browser commands.
2. The compact custom menu contains exactly the four approved actions and stays inside the frame.
3. The selected-avatar tick is a rounded yellow square at the right of the selected card.
4. Dungeons shows a legible total-rating chip with safe internal spacing at both supported sizes.
5. Mixed equipped tiers display independently using Raider.IO's item-level tier metadata.
6. Missing Raider.IO tier data preserves the existing generic set count without sync failure.
7. The change is additive and requires no D1 migration.
