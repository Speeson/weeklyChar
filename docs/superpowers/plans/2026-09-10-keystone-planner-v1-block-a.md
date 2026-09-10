# Keystone Planner V1 Block A Implementation Plan

**Goal:** Establish validated Planner preference storage and the centralized Worker composition
domain without implementing the solver or UI.

**Spec:** `docs/superpowers/specs/2026-09-10-keystone-planner-v1-block-a-design.md`

## Constraints

- Worker/D1/docs/tests only; no Web, Client, addon, solver, ranking, or Planner Team endpoint.
- Preserve `shareKeystoneLootWithTeams` unchanged.
- Verify every request before the atomic replacement write.
- No remote operation, push, commit, deployment, or release.

### Task 1: Migration and persistence contract

**Files:** new `keystone-worker/migrations/0010_keystone_planner.sql`, migration tests.

- [x] Add the composite-key table, four-state check, positive IDs, timestamp, and cascading
  character ownership.
- [x] Verify the schema excludes a duplicated role and preserves all four states.

### Task 2: WoW composition domain

**Files:** new `keystone-worker/src/wowComposition.ts`, catalog tests.

- [x] Add the complete 40-spec Retail catalog with canonical class and derived role.
- [x] Add conservative physical/magical DPS affinity and explicit `null` for ambiguous specs.
- [x] Add the nine required unique capabilities, spell metadata, providers, and conditional
  provider mode.
- [x] Test unique IDs, class/spec consistency, roles, and duplicate-free capability resolution.

### Task 3: Owner preference API

**Files:** new `keystone-worker/src/plannerPreferences.ts`, `keystone-worker/src/routes/me.ts`,
new route tests.

- [x] Add strict validation for shape, states, safe integer IDs, duplicates, ownership, class/spec,
  loot spec, and missing character class.
- [x] Add deterministic JWT-only GET and atomic full-replacement PUT.
- [x] Return derived role and persisted timestamps without exposing another user's rows.

### Task 4: Documentation and validation

**Files:** `docs/DATA_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/AGENT_CONTEXT.md`, final report.

- [x] Document the durable schema, API contract, catalog boundary, and conservative affinity.
- [x] Run Worker typecheck/tests, local D1 migration, Deployment Impact, diff checks, and status.
- [x] Record exact results and Block B questions in the final SDD report.
