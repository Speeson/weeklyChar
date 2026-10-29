# Client currency layout and tracked items

## Intent

Let each KeystoneSync user choose and arrange the tracked currencies and items shown for every character on that Windows installation. Keep the amount, icon, and complete title visible while making cap and item-location details available on hover and keyboard focus.

## Agreed behavior

- The Characters currency panel has 16 fixed positions, eight per row. Empty positions have no visible border in the normal view; they retain their space. Every card has the same dimensions.
- A settings button in the panel header opens an editor with the 16-position grid in the center and available, unplaced items with icons in a scrollable list on the right. The editor shows an icon in each occupied slot, without a full card.
- Clicking an item in the right list places it in the first free slot, left to right and top to bottom. Dragging from the list to an empty slot fills it. Dragging from the list to an occupied slot replaces that item and returns the displaced item to the list. Moving an occupied slot to an empty slot leaves the source empty; moving it to an occupied slot swaps them. An explicit remove action returns a placed item to the list. Provide click/keyboard equivalents for drag actions.
- Each successful change updates the normal panel and local preference immediately. Closing the editor does not undo changes. A restore-default action is available.
- The preference is shared by all characters of one authenticated KeystoneSync user on that installation. Different signed-in users have separate layouts. A missing or invalid preference shows the current ten cards in their existing two-group order plus the flute in its own slot after the second group; the first row has three free slots and the second has two. Validate stored keys, uniqueness, and slot count; keep unknown future keys harmless.
- Each quantitative card always shows its complete localized title at the top, with a maximum of two lines, and an icon on the left with the current amount on the right. Start with modestly smaller icon, amount, padding, and title text; check all ES/EN names at the client's supported scale and reduce title size for specific long names if required. Do not ellipsize or clip titles. Trovehunter's Bounty keeps its obtained/active status because it has no meaningful currency quantity.
- On the Trovehunter's Bounty card, keep the map icon and the two descriptive status icons: check or X for obtained/not obtained, and, when applicable, the icon for active buff, in bags, or claimed. Remove the visible status text and the flute badge from this card. The local hover/focus tooltip spells out both statuses in the current language, including unknown state when the snapshot cannot establish one. Give the icons accessible names so the meaning is available without hovering.
- Move weekly/seasonal/ordinary cap details out of cards into a local hover/focus tooltip. Use that same tooltip for the full Trovehunter status text and other card details. Preserve status styling and special Vault information. Item cards show bags, personal bank and, where applicable, Warband Bank counts and whether bank counts are last-known snapshots. Keep the Wowhead tooltip reachable from the item icon or name without overlapping the local detail tooltip.

## Tracked data

The addon already writes Adventurer, Veteran, Champion, Hero, and Myth Mistcrests. Add the first three to the client card catalog. The addon also already tracks Scalebound Herald's Flute (`scaleboundHeraldFlute`, item ID 275910); make it an independently selectable card with its own icon and total count, regardless of Trovehunter's Bounty status. Remove the flute badge from the Bounty card. Its hover/focus tooltip shows the existing bags, personal bank, and Warband Bank breakdown, distinguishing unknown or last-known bank counts from current zeroes.

Add Afflicted Soul (item ID 276547, icon ID 136214), Tormented Soul (276548, 236300), and Ascendant Venomstone (280562, 7658134) to the canonical standalone addon. Confirm IDs, icons, and binding rules against current game data before release. For the two Warband-bound souls, capture bags, personal bank, and Warband Bank separately. For the Soulbound Venomstone, capture only bags and personal bank. Follow the existing flute snapshot rules: inaccessible banks retain last known values with known/timestamp metadata, and missing data is distinct from zero. Treat Warband Bank counts as shared account data when calculating any cross-character total, so they cannot be added once per character.

Add five further currency entries to the standalone addon's `C_CurrencyInfo.GetCurrencyInfo` capture and to the client card catalog. These candidate IDs come from the linked current game-data entries and must be checked against the live WoW API before release:

| Key | Currency | Candidate currency ID |
| --- | --- | --- |
| `undercoin` | Undercoin | [2803](https://www.wowhead.com/currency=2803/undercoin) |
| `remnantOfAnguish` | Remnant of Anguish | [3392](https://www.wowhead.com/currency=3392/remnant-of-anguish) |
| `timewarpedBadge` | Timewarped Badge | [1166](https://www.wowhead.com/currency=1166/timewarped-badge) |
| `tradersTender` | Trader's Tender | [2032](https://www.wowhead.com/currency=2032/traders-tender) |
| `voidlightMarl` | Voidlight Marl | [3316](https://www.wowhead.com/currency=3316/voidlight-marl) |

Use the WoW API's current quantity, icon, and cap fields; do not infer a cap from a current balance or from Trading Post monthly earnings. Capture account-wide metadata when the API provides it. Trader's Tender is an [account-wide currency](https://worldofwarcraft.blizzard.com/en-us/news/23892227/updated-january-24-dragonflight-1005-content-update-notes); do not sum it across character snapshots. Other currencies may be transferable between characters without sharing one balance. A missing or temporarily unavailable API result is unknown or last-known data, not a confirmed zero. The client should not silently present an old snapshot as current.

The completed catalog contains 22 choices for 16 positions. Adding these currencies does not increase the visible-card limit; the list on the right holds all unplaced choices.

The client parser currently forwards `currencies` unchanged; the Worker persists that map in `currencies_json` and returns it. Additive item keys do not require a D1 column. Update client types, fixtures, and the data contract as required. Web presentation of the new items is outside this client-focused UI change unless contract compatibility requires a change.

## Mistcrest cap correction

The addon currently copies `maxQuantity` and `maxWeeklyQuantity` from `C_CurrencyInfo.GetCurrencyInfo`; the client treats positive values as active caps. Blizzard announced the crest cap lift for the week of 21 October 2026. Compare current in-game API results and freshly written SavedVariables with an older snapshot to identify stale values or changed API semantics. Correct the source/cap semantics in the addon and ensure the client does not display an obsolete Mistcrest cap from older snapshots. Do not apply a permanent cap override that would hide a cap if a later season restores one.

## Approaches considered

- **Ten columns, two rows:** keeps current panel height but makes titles and icon-plus-amount too narrow. Rejected.
- **Five columns, four rows:** retains width but makes cards too short for title, icon, and amount. Rejected.
- **Eight columns, two rows:** selected by the user; retains two rows and gives enough height for two-line titles with compact card content. Verify actual ES/EN rendering before release.

## Scope and checks

Implement local per-user preferences in the client, UI/editor and card changes, additive addon item/currency capture, cap correction, and corresponding contract/tests. Preserve other users' existing unrelated work. Check drag/click/keyboard placement rules, persistent account isolation, missing/old snapshots, the five new currency IDs and account scopes, all card titles in both languages, the independent flute count and location tooltip, absence of the flute badge on the Bounty card, Trovehunter status icons and localized tooltip text, tooltip interactions, and the 16-card layout at supported client window sizes. Validate the addon in-game when available; run the relevant client/addon tests and Deployment Impact classifiers. Do not push, publish, or deploy as part of this work.

## Builder calls left open

Choose the smallest existing client storage mechanism that provides reliable local per-user persistence and survives restarts. Determine exact compact dimensions from a rendered preview. Confirm patch-sensitive item/currency IDs, account-scope metadata, and cap API behavior with live game data before claiming addon release readiness.

## Refinements after desktop review

- Center each card title and its icon-and-amount group horizontally. Enlarge the card icon while preserving complete two-line titles.
- Increase and center the text in local card tooltips. Spark of Tides shows Season earned/max using Tidal Spark Dust progression, followed by its bag and personal bank counts.
- Show matching status icons to the left of Trovehunter's tooltip text, and enlarge and stack its two card icons vertically.
- Use a square gear button to open the currency editor.
- Make editor slots square and smaller than the first iteration, with square icons occupying most of each slot. Use a small red square remove button in the upper-right corner.
- Align the available list to the left. Highlight a list item and the first free slot in green while the item is hovered; highlight a slot in green while an item is dragged over it.
