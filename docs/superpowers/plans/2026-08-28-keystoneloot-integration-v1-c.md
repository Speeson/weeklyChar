# KeystoneLoot Integration V1-C Implementation Plan

**Goal:** Implement server-side sharing privacy and deterministic per-member KeystoneLoot recommendations while preserving owner access and raw team-data non-exposure.

**Spec:** `docs/superpowers/specs/2026-08-28-keystoneloot-integration-v1-c-design.md`

## Constraints

- Worker/D1/docs/tests only; no Client, Web, or addon changes.
- Privacy filtering happens before snapshot parsing/scoring.
- Stored JSON is trusted only after the V1-B validator accepts a supported API v2 snapshot.
- V1-C remains uncommitted and no remote operation is allowed.

### Task 1: Typed V1-B parser and pure scorer

**Files:** `keystone-worker/src/keystoneLoot.ts`, new `keystone-worker/src/keystoneRecommendations.ts`, new `keystone-worker/tests/keystoneRecommendations.test.js`.

- [x] Add failing unit tests for exact tier weights, mixed summaries, dungeon/source filtering, multi-spec and multi-character ranking, item deduplication, same item across specs, checked/unchecked Voidcore, unknown tiers, and every tie-break level.
- [x] Export the validated supported-snapshot types/parser from the V1-B module.
- [x] Implement pure candidate grouping, scoring, summaries, eligibility, and deterministic comparison.
- [x] Run Worker typecheck and the focused unit test.

### Task 2: Preference migration and API

**Files:** new `keystone-worker/migrations/0003_keystone_loot_sharing.sql`, `keystone-worker/src/types.ts`, `keystone-worker/src/routes/me.ts`, `keystone-worker/tests/fakeD1.js`, new route tests.

- [x] Add failing tests for default true, `GET /api/me`, JWT-only true/false PATCH toggles, malformed input, sync-token rejection, and user isolation.
- [x] Add the additive migration and D1 row field.
- [x] Expose the boolean and implement the narrow authenticated update.
- [x] Align Fake D1 and rerun focused tests/typecheck.

### Task 3: Recommendation route and privacy

**Files:** `keystone-worker/src/routes/teams.ts`, `keystone-worker/src/db.ts` if a focused loader is useful, `keystone-worker/tests/fakeD1.js`, route tests.

- [x] Add failing tests for auth, live membership/non-member rejection, invalid challenge-map values, multiple members, all statuses, realistic multi-character/spec selection, Voidcore completion, and privacy disabled.
- [x] Add response-wide forbidden-key assertions and regressions for team-detail omission and owner raw access.
- [x] Load members from D1, skip disabled users before character access, parse supported snapshots once, call the pure scorer, and shape summaries only.
- [x] Rerun all Worker tests and typecheck.

### Task 4: Documentation and local validation

**Files:** `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACT.md`, `docs/keystone-loot-integration-todo.md`, final SDD report.

- [x] Document the preference/default, server enforcement, endpoint, weights, Voidcore, deduplication, tie-breaking, statuses, redaction, owner access, V1-D/V2 pending scope, and migration ordering.
- [x] Apply `0001`/`0002`/`0003` to disposable local D1 and verify the new default column.
- [x] Run full Worker, deploy-impact, release, V1-B regression, strict impact, and diff/status checks.
- [x] Produce a realistic multi-user recommendation output and final report; leave V1-C uncommitted.
