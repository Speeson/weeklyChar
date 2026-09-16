# Owned Loot And Great Vault Item Levels Plan

1. Extend the canonical addon snapshot with tested per-favorite ownership derived from WoW inventory APIs.
2. Preserve and validate the additive field through Client sync and Worker storage.
3. Default ownership in objective DTOs, exclude owned items from Selector/Planner counts, and retain completed-only character rows for display.
4. Update Client and Web parsers, grouping, completed visuals, labels, and fixtures.
5. Capture each unlocked raid/dungeon/world chest's current reward item level in the addon and render it beside that chest's progress in Client/Web while preserving existing activity lists.
6. Update the durable data contract and project context, add pending release changesets where required, then run targeted and full validation plus Deployment Impact.
