# Upgrade Track Icons Design

## Objective

Show the item's upgrade track icon on Client character equipment and on Client and Web loot objective icons. Show the same icon immediately before the Great Vault reward item level in Client and Web raid, dungeon, and world tooltips.

## Approved design

- Put the icon at the top left of each item image without covering the existing item level, slot label, or ownership check.
- Use the same Blizzard profession-quality atlas artwork as ItemUpgradeQualityIcons for ranks one through five and its Myth texture for rank six.
- Keep existing Wowhead tooltips unchanged. Only decorate UI owned by KeystoneSync.
- Render an icon only for a known upgrade track. The Client may restore the track from a verified Midnight Season 2 exact-variant bonus-list ID; it must not infer one from item level, item quality, loot tier, or source.
- Accept missing track data from older snapshots and responses.

## Architecture

Equipment and Vault already carry `upgrade.track` and `rewardUpgradeTrack`. Loot favorites require an optional `upgradeTrack` captured from their exact item variant and passed through the existing SavedVariables, Client sync, Worker JSON, objective DTO, selector, planner, and Web types. While published API responses still lack that additive field, the Client uses the exact Midnight Season 2 bonus-list ID already present in `variantKey` for Champion, Hero, and Myth. No D1 migration is required.

## Verification

- Run relevant Client UI tests/build and visual test.
- Run Worker typecheck/tests if its contract changes.
- Run Web lint/build and targeted UI tests.
- Run deployment impact for changed paths, plus addon flag if the canonical addon changes.

## Out of scope

- In-game item buttons and tooltips.
- Modifying Wowhead's generated tooltip DOM.
- Inferring upgrade tracks from seasonal item-level ranges.
