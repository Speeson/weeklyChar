# KeystoneLoot SavedVariables Reset Reconciliation — Final Report

## Outcome

The stale D1 snapshot bug is fixed without deleting character rows or inferring deletion from
an absent character. A real SavedVariables reset is now authorized only by a persistent local
instance transition already known to KeystoneClient.

The confirmed root cause had two parts:

1. The sidecar sent incremental updates only for characters present in the current
   `KeystoneSyncDB`, so an absent character never produced a remote clear operation.
2. The Worker used `COALESCE` for `keystone_loot_json`, making omitted and explicit `null`
   indistinguishable.

## Final architecture

- The addon stores one top-level `KeystoneSyncDB.savedVariablesInstanceId`. It is generated
  only when missing, including additive enrollment of a legacy database, and remains stable
  across normal saves and addon reloads.
- KeystoneClient stores the last completely processed instance in
  `%APPDATA%\KeystoneClient\config.json` under `saved_variables_instances`, scoped by the
  case-normalized WoW account folder and region.
- No previous baseline plus instance A is enrollment: sync normally, persist A, and do not
  reset. A equal to A is a normal sync. A changing to B invokes reconciliation once.
- For A to B, the Client calls the reset endpoint, synchronizes all current valid characters,
  persists B, and only then marks the file mtime complete. HTTP, character update, or config
  persistence failure leaves A in memory/on disk and retries the same file later.
- Invalid, incomplete, missing, or characterless SavedVariables never authorize a reset.
  Character absence while the instance remains unchanged also never authorizes a reset.

## Worker contract

`POST /api/me/keystone-loot/reset` accepts only:

```json
{ "region": "eu", "wowAccount": "ACCOUNT-1" }
```

Authentication supports the existing owner JWT/sync-token boundary. The client cannot select
a `userId`. The idempotent SQL scope is the authenticated user, exact region, and exact WoW
account:

```sql
UPDATE characters
SET keystone_loot_json = NULL
WHERE user_id = ?
  AND region = ?
  AND wow_account = ?
  AND keystone_loot_json IS NOT NULL
```

No other character column, character row, account/team data, or `wow_item_metadata` row is
changed. Owner/team objective reads immediately fall back to their existing no-KeystoneLoot
state because they read D1 directly.

`POST /api/keystones/update` now distinguishes:

- omitted `keystoneLoot`: preserve the stored snapshot;
- object `keystoneLoot`: validate and replace it, including valid empty/unavailable states;
- explicit `keystoneLoot: null`: clear it.

Older clients remain compatible because omission still preserves the previous value.

## Files changed

Standalone addon repository:

- `KeystoneSync.lua`
- `tests/runtime/test_keystoneloot_integration.py`
- `.changes/pending/savedvariables-instance-id.json`

The existing unrelated/prior dirty addon files were preserved.

weeklyChar repository:

- `keystone-client/sidecar/config.py`
- `keystone-client/sidecar/sync_worker.py`
- `tests/client/test_sync_worker.py`
- `keystone-worker/src/routes/keystones.ts`
- `keystone-worker/src/routes/me.ts`
- `keystone-worker/tests/fakeD1.js`
- `keystone-worker/tests/keystoneRoutes.test.js`
- `keystone-worker/tests/keystoneLootReset.test.js`
- `docs/DATA_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENT_CONTEXT.md`
- the associated SDD design, plan, report, and Client changeset

No D1 migration was added because `characters.keystone_loot_json` is already nullable and the
baseline deliberately remains private Client state. No Web DTO or UI changed.

## Test coverage and validation

Added coverage includes addon ID creation/legacy enrollment/stability; Client enrollment,
unchanged instance, account isolation, A-to-B ordering, retries after reset/update/config-save
failure, invalid/missing input, character absence, and mtime retry; Worker object/omitted/null
semantics, owner/account/region scope, unrelated-data and metadata preservation, idempotence,
the Bakuhatsu/Makabe scenario, and immediate Team objective revocation.

All local validation passed:

- Addon runtime: 70/70.
- Addon deploy-impact: 10/10.
- Addon release: 30/30.
- Addon package validation: passed.
- Client sidecar: 99/99.
- Client bridge: 60/60.
- weeklyChar deploy-impact: 46/46.
- weeklyChar release: 51/51.
- Python compileall: passed.
- Packaged sidecar build and JSONL smoke checks: passed (`ready`, `ping`, second ping,
  `get_state`, and EOF).
- Worker TypeScript typecheck: passed.
- Worker: 117/117.
- Local D1 migration check: passed, with no migrations to apply.
- `git diff --check`: passed in both repositories.

## Deployment and release impact

Strict deterministic classification reports:

- addon build and addon release required;
- Client build and Client release required;
- Worker deployment required;
- Web deployment not required;
- D1 migration not required.

The addon stays at `0.2.7`; pending patch changesets plan `0.2.8`. The Client stays at
`0.6.10`; its pending patch changeset plans `0.6.11`. Safe eventual rollout order is Worker
first, then the Client capable of calling the endpoint; the addon instance-ID rollout itself
is non-destructive because first observation only enrolls a baseline.

No commit, push, merge, tag, release, deployment, remote migration, or other remote write was
performed.
