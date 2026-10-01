# Bank Items And Character Visibility Implementation Plan

## Task 1: Extend the canonical addon snapshot — complete

- Inspect current addon source and API/event patterns.
- Capture item 275910 in bags, personal bank plus Reagent Bank, and Warband Bank, preserving
  previously captured closed-bank values.
- Keep item ID, icon file ID and the new snapshot additive and backward compatible.

## Task 2: Carry the new item snapshot through the existing data contract — complete

- Confirm Client parsing and payload construction preserve nested `currencies` fields.
- Add the documented flute fields to `docs/DATA_CONTRACT.md`.
- Confirm Worker JSON persistence and read projection need no route or migration changes.

## Task 3: Update KeystoneClient presentation — complete

- Add the known personal-bank amount to the Spark of Tides quantity label.
- Add the conditional flute icon/count to the unclaimed Trovehunter's Bounty card.
- Add the Wowhead tooltip and adjacent inventory-location breakdown.
- Replace the elongated power control with a square gold eye control: crossed-out eye to hide,
  open eye to show.

## Task 4: Apply Web character visibility globally — complete

- Extract the existing `ks_hidden_chars` reader into a shared Web helper.
- Apply the same local preference to own-character views on Dashboard, Summary and Team pages;
  preserve visibility for other Team members.
- Keep the management control on My Characters as the only editor for that preference.

## Task 5: Validate and report impact — complete

- Run Client build and Web lint/build validation; inspect addon packaging and changed SavedVariables
  shape.
- Review the diff and classify product impact with `scripts/deploy_impact.py`.
- Report remaining game-client validation limits without performing remote operations.
