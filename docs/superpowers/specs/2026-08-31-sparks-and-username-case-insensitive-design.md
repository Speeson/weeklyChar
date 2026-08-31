# Spark Bank Tracking and Case-Insensitive Username Design

## Objective

Ship one coordinated maintenance phase that counts Spark of Tides across all
character-owned storage while excluding Warband storage, exposes known banked
Spark quantities in Web, and makes username identity case-insensitive without
changing stored display casing.

## Approved design

The addon uses only explicit `C_Item.GetItemCount` calls for Spark quantities:

- carried: `(274476, false, false, false, false)`;
- character-owned candidate: `(274476, true, false, true, false)`.

Bank data is authoritative only while the personal bank is accessible. A
`BANKFRAME_OPENED` capture establishes or refreshes the per-character snapshot;
`BAG_UPDATE_DELAYED` refreshes it while the bank remains open. Closing the bank
does not perform a fresh authoritative read: it retains the last snapshot
captured while open. Before a first trustworthy capture, bank state is unknown;
afterward `bankQuantity`, `bankQuantityKnown`, and `bankUpdatedAt` persist in that
character's `KeystoneSyncDB` entry. Known totals are carried quantity plus the
last trustworthy bank quantity.

The existing Spark fields remain additive and compatible. `quantity`,
`itemQuantity`, and `totalItemQuantity` are aliases for the physical character
total currently known; `inventoryQuantity` is carried quantity. Dust remains an
independent currency/progression block.

The Worker centralizes trimmed username lookup and existence checks using
SQLite `COLLATE NOCASE`. Migration `0007_users_username_nocase.sql` creates a
unique index on `users(username COLLATE NOCASE)` without rewriting rows. All
identity routes use the helper; responses continue returning stored casing.
Registration also maps a database uniqueness race to the existing Spanish
duplicate error. Resend-verification rate-limit identity remains trimmed and
lowercased, so casing cannot create independent buckets.

Web renders a tested pure formatting projection. A known positive bank amount
appends subdued `(<n> en el banco)` text; zero or unknown bank state adds no
parenthetical.

## Architecture and data flow

`KeystoneSync.lua` writes additive Spark keys into `KeystoneSyncDB`. The existing
KeystoneClient currencies pass-through transports them unchanged. Worker keeps
persisting and returning the whole `currencies_json` document. Web extends its
local currency interface and consumes the additive keys. No Client source,
Worker currency transform, or currency migration is required.

Username identity changes only `keystone-worker`: shared D1 helpers, auth and
Team invite routes, plus the forward-only uniqueness migration. A read-only
production collision query using the same `NOCASE` collation is documented but
must not be executed in this phase.

## Verification

- Addon runtime and Season 2 contract tests, deployment-impact tests, release
  tests, `release_changes.py validate`, and `git diff --check`.
- Worker `npm run typecheck`, full `npm test`, migration tests, local D1
  migration application, deployment-impact tests, and `git diff --check`.
- Web focused Spark/Season 2 tests, full unit tests, lint, build, and
  `git diff --check`.
- Final status checks prove both branches, empty staging areas, untouched
  protected files, and no generated Python bytecode.

## Out of scope

- Warband/Account Bank scanning or counting.
- Deriving physical Sparks from Tidal Spark Dust.
- Lowercasing, merging, deleting, or renaming stored users.
- KeystoneClient source or release changes.
- Production collision preflight, remote migration, deployment, staging,
  commits, pushes, tags, or releases.
