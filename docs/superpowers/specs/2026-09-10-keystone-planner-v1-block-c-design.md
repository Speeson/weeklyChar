# Keystone Planner V1 Block C Design

## Objective

Expose the pure Block B solver through an authenticated Team endpoint. The Worker must derive every
candidate, objective, stone, role, and capability from live server-side data while preserving Team
membership and KeystoneLoot sharing boundaries.

## Approved design

`POST /api/teams/:teamId/keystone-planner` accepts only participant IDs, target level, an optional
current-pool dungeon, exact composition options, and up to 15 locks. Unknown or malformed fields
are rejected. Expected solver states return HTTP 200 except `invalid_input`, which returns 400.
Missing teams return 404, non-members 403, invalid JWT/sync tokens 401, and defensive normalized
data-limit overflow 422.

The public response wraps the solver with Team/request identity and eligible-stone count. Solver
objectives are projected to safe item identity/tier/variant/Voidcore fields and enriched in grouped
region batches from the existing metadata cache. Missing Blizzard metadata remains nullable.
Capabilities are projected from the central Worker catalog with names, types, icon spell IDs,
stacking, availability/provider mode, and conditions.

## Architecture and data flow

`keystonePlannerApi.ts` owns strict request parsing, grouped D1 adaptation, limits, solver invocation,
and public projection. `routes/teams.ts` retains HTTP authentication, Team existence/membership,
status mapping, and JSON handling. The pure solver remains unaware of Hono, D1, authorization,
sharing, metadata, or locale.

After live Team authorization, one selected-member query proves every participant belongs to the
Team. A second query loads only their characters/preferences and suppresses snapshot values in SQL
when sharing is disabled. A third query selects only each selected character's latest same-week real
stone. Eligible dungeon IDs are known before snapshots are normalized; one shared objective helper
parses each relevant character snapshot once and retains only eligible dungeon/spec objectives.

Defensive limits are 5 participants, 15 locks, 150 normalized candidates, 100 eligible stones, and
5,000 candidate-objective entries. Limits are checked without truncation and return 422.

## Verification

- `cd keystone-worker; npm run typecheck`
- `cd keystone-worker; npm test`
- `cd keystone-worker; python -m unittest tests.test_keystone_planner_migration`
- `git diff --check`
- `python scripts/deploy_impact.py --files <changed-files> --json --strict`

## Out of scope

No schema/migration, Web/UI, StoneSelector, Client, addon, deployment, release, tag, push, or solver
ranking change is part of Block C. The Web-local Devourer mapping remains for Block D.
