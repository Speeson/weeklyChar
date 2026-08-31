# KeystoneLoot SavedVariables Reset Reconciliation Plan

**Spec:** `docs/superpowers/specs/2026-08-31-keystoneloot-savedvariables-reset-reconciliation-design.md`

## Task 1: Addon instance identity

- Add failing runtime tests for creation, legacy enrollment, and stability.
- Generate and persist one top-level `savedVariablesInstanceId` before character-level guards.
- Preserve the existing cross-spec KeystoneLoot behavior and add the required addon changeset.
- Run the focused and full runtime suites.

## Task 2: Client reset detection and retry safety

- Add failing sidecar tests for first observation, unchanged ID, A-to-B reset, retry, successful
  baseline advancement, invalid input, unchanged-ID character absence, and mtime retry.
- Parse the reserved top-level metadata separately from validated character entries.
- Store baselines in the existing private config, scoped by WoW account and region.
- Reconcile before normal updates and persist baseline only after full success.
- Confirm file mtime only after the complete sync succeeds.

## Task 3: Worker clear semantics and account reconciliation

- Replace KeystoneLoot `COALESCE` with property-presence-sensitive SQL.
- Permit explicit null while retaining object validation and omitted preservation.
- Add the authenticated, idempotent account/region reset endpoint with bounded input.
- Extend Fake D1 and tests for scope, data preservation, metadata preservation, idempotency,
  Makabe-style resync, and owner/team visibility revocation.
- Run typecheck, Worker tests, and local migrations.

## Task 4: Durable contract and release metadata

- Update `DATA_CONTRACT.md`, `ARCHITECTURE.md`, and `AGENT_CONTEXT.md` with the verified flow.
- Add one pending Client patch changeset; do not bump Client or addon versions.
- Write the SDD final report.

## Task 5: Final verification

- Run all required addon, Client, bridge, Worker, release, and deploy-impact suites.
- Review both repository diffs for correctness, security, contract compatibility, and scope.
- Run strict Deployment Impact for weeklyChar and the standalone addon.
- Do not perform remote operations.
