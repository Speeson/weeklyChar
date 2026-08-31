# KeystoneLoot SavedVariables Reset Reconciliation

## Objective

Remove obsolete per-character KeystoneLoot snapshots after a real reset of one WoW
account's `KeystoneSync.lua`, without treating an absent character or a transient parse
failure as deletion authority.

## Approved design

`KeystoneSyncDB.savedVariablesInstanceId` is a persistent, non-cryptographic identifier for
the current SavedVariables instance. The addon creates it only when missing and leaves it
unchanged across saves, reloads, characters, and addon versions. Existing databases enroll
additively on their first save.

KeystoneClient reads the reserved top-level field and stores the last successfully processed
value in `%APPDATA%\KeystoneClient\config.json`, scoped by normalized WoW account folder and
region. Missing baseline is enrollment and never resets remote data. Equal IDs perform a normal
sync. A changed ID calls the authenticated reconciliation endpoint before character updates.
The new baseline is persisted only after reconciliation and every current character update
succeed. Failed parsing, missing identity/scope, HTTP failure, or config persistence failure
keeps the old in-memory and on-disk baseline and remains retryable. The watcher confirms a file
mtime only after that complete operation succeeds.

The Worker adds `POST /api/me/keystone-loot/reset` using the existing flexible owner
authentication boundary. Its payload contains only bounded `region` and `wowAccount`; `user_id`
always comes from the bearer token. The idempotent statement is:

```sql
UPDATE characters
SET keystone_loot_json = NULL
WHERE user_id = ? AND region = ? AND wow_account = ?
```

No character or unrelated column is removed, and `wow_item_metadata` is untouched.

`POST /api/keystones/update` gains presence-sensitive KeystoneLoot semantics:

- omitted: preserve `keystone_loot_json`;
- object: validate and replace `keystone_loot_json`;
- explicit `null`: clear `keystone_loot_json`.

Existing explicit unavailable objects and empty favorites remain authoritative replacements.

## Architecture and contract impact

The addon SavedVariables contract gains one reserved top-level string. It is local control
metadata and is never sent to the Worker. The Client config gains an additive private baseline
map. The Worker request contract gains one authenticated endpoint and allows explicit null on
the existing sync field. D1 uses its existing nullable column, so no migration is required.
Owner/team reads naturally stop returning objectives as soon as the column becomes null.

## Verification

- Addon: `python -B -m unittest discover -s tests/runtime`, deploy-impact tests, release tests,
  package validation.
- Client: compile sidecar/scripts/tests; run `tests/client` and `tests/client_bridge`.
- Worker: `npm run typecheck`, `npm test`, and local D1 migrations.
- Repository: release/deploy-impact tests, strict Deployment Impact, `git diff --check`, status
  and diff review.

## Out of scope

- Deleting character rows or any non-KeystoneLoot character/account/team data.
- Inferring deletion from character absence while the instance ID is unchanged.
- Server-side instance-ID comparison or storage.
- Clearing or invalidating `wow_item_metadata`.
- Changing KeystoneLoot upstream, selector identity, sharing preferences, Web DTOs, or UI.
- Commit, push, merge, tag, release, deployment, or remote D1 migration.
