# Bank Items And Character Visibility Design

## Objective

Show the already tracked Spark of Tides bank quantity in KeystoneClient, track Scalebound
Herald's Flute in bags, personal bank and Warband Bank, and make Web character visibility
preferences apply across the character, dashboard, summary and team views.

## Approved Design

- KeystoneClient's Spark of Tides card displays the existing known total with the bank amount in
  parentheses, matching Web Summary's `X (Y en el banco)` format.
- The canonical addon captures Scalebound Herald's Flute (`itemID 275910`, icon file ID
  `1928595`) as an additive currency snapshot with bag, personal-bank (including Reagent Bank),
  and Warband Bank counts. Bank values retain their last trustworthy capture while the relevant
  bank is closed; bags refresh with normal inventory updates.
- KeystoneClient persists and renders the additive snapshot. On the Trovehunter's Bounty card,
  show the flute icon and owned count only while the bounty snapshot is known and unobtained.
  Hover/focus shows the Wowhead item tooltip with an adjacent location breakdown for bags,
  personal bank and Warband Bank. The icon is half the existing currency icon size, has a light
  glow, and the count overlays its lower-left corner.
- Worker continues storing `currencies` in its existing JSON block; no route or D1 migration is
  expected. Web's existing character response then carries the new snapshot additively; this
  request does not add a new flute display to Web Summary.
- Web keeps the existing `ks_hidden_chars` preference and applies it to the signed-in user's own
  characters throughout the character-management, dashboard, summary and team views. Other Team
  members' characters remain visible. This is a local display preference and does not change
  Worker authorization, Team membership, or stored character data.
- KeystoneClient's active/inactive control becomes a square gold button. Its hide action uses a
  crossed-out eye icon, and its show action uses an open eye, retaining drag-and-drop behavior and
  accessible state labels.

## Architecture

- Canonical addon: `Speeson/KeystoneSync` captures bank item counts and writes the additive
  SavedVariables currency key.
- Client sidecar parses the existing `currencies` JSON block and transports it unchanged through
  the current Worker payload. Client React presents the bank hint and flute badge/popover.
- Worker/D1 need no schema change because `currencies` is already an evolving JSON block. Web
  receives the additive values through the existing `/api/me/characters` response.
- A shared Web helper reads the existing hidden-character preference so every affected page uses
  the same local character IDs.

## Verification

- Validate the addon TOC/package structure and inspect its SavedVariables output shape.
- Run the Client frontend build and the Web lint/build commands documented by component guidance.
- Review `git diff`, `git status --short`, and run strict Deployment Impact classification for
  repository paths. Do not publish, deploy, push, or migrate remotely.

## Out Of Scope

- New Worker routes, D1 columns/migrations, or changes to Team membership and authorization.
- A flute count display in Web Summary.
- Guild-bank tracking; the requested shared storage is the account-wide Warband Bank.
- Publishing or releasing the addon or KeystoneClient.
