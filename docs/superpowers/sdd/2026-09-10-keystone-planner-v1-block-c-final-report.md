# Keystone Planner V1 Block C Final Report

## 1. Block B checkpoint

Local commit `fdcb193b10601a7ea5981fbef7dbb9e8497ea2a2` with message
`feat(worker): add Keystone Planner solver`. No push or other remote operation was performed.

## 2. Post-checkpoint working tree

Only the pre-existing unrelated `.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`,
`docs/keystonesync-selector-piedra-plan.md`, and
`keystone-client/tauri-current-characters.png` remained untracked. They were preserved.

## 3. Block C files

Created `keystone-worker/src/keystonePlannerApi.ts`,
`keystone-worker/tests/keystonePlannerRoutes.test.js`, the Block C spec/plan, and this report.
Modified `keystone-worker/src/routes/teams.ts`, `keystone-worker/src/keystoneObjectives.ts`,
`keystone-worker/src/http.ts`, `keystone-worker/tests/fakeD1.js`, `docs/AGENT_CONTEXT.md`,
`docs/ARCHITECTURE.md`, and `docs/DATA_CONTRACT.md`.

## 4. HTTP request

`POST /api/teams/:teamId/keystone-planner` accepts exactly:

```ts
{
  participantUserIds: number[]
  targetLevel: number
  challengeMapId?: number | null
  options: {
    optimizeComposition: boolean
    bloodlust: boolean
    battleRez: boolean
    classBuffs: boolean
    damageSynergy: boolean
  }
  locks?: Array<
    | { type: 'assignment', userId: number, characterId: number, specId: number }
    | { type: 'character', userId: number, characterId: number }
    | { type: 'role', userId: number, role: 'tank' | 'healer' | 'dps' }
  >
}
```

Participant count is 2–5, IDs are positive safe integers and unique, target is 1–20, a non-null
dungeon belongs to the current pool, options are exact booleans, and locks are exact and capped at
15. Unknown fields and all server-derived Planner data are rejected.

## 5. HTTP response

The stable wrapper contains `teamId`, requested `challengeMapId`, `targetLevel`,
`availability.eligibleStoneCount`, `status`, `diagnostics`, and `recommendations`. Recommendations
preserve rank, fingerprint, stone, assignments, vacancies, all solver summaries, and reason codes.
Public objectives contain item ID, nullable name/icon, tier, variant key, and Voidcore state.
Capabilities add central catalog name/type/icon/stacking metadata to provider mode/condition or
aggregate availability.

## 6. HTTP mapping

- 200: `ok`, `unconfigured_participants`, `no_valid_composition`, including zero stones.
- 400: malformed/unknown request data, non-Team participant, malformed locks, solver invalid input.
- 401: missing/invalid JWT and sync token.
- 403: authenticated requester is not a current Team member.
- 404: Team does not exist.
- 422: normalized server-side data exceeds a defensive limit.
- Unexpected D1/runtime failures propagate to the existing 500 handler.

## 7. D1 adapter and queries

After Team existence and requester-membership checks, one grouped query loads only selected live
Team users. One latest-row window query loads only selected characters' current same-week real
stones. If stones exist, one grouped character/preference query loads only selected users and uses
SQL `CASE` to return snapshot JSON only when sharing is enabled. There is no query per candidate,
dungeon, or objective. Metadata cache reads are deduplicated by region/item and chunked at 100 IDs.

## 8. Candidate construction

Only persisted non-disabled preferences become candidates. Played and loot specs must both still
exist in the central catalog and belong to the character's canonical class. Role, class, damage
affinity, and capabilities remain solver/catalog-derived. Missing or invalid preferences create no
candidate and therefore the solver's structured unconfigured state.

## 9. Stone construction

The adapter selects the latest same-week row per selected character using the established ordering
by update time then ID. It requires a real positive level, supported positive challenge-map ID,
non-empty dungeon name, selected current Team owner, and optional exact request dungeon match.
Historical, stale, false/empty, unsupported, foreign-member, and unselected-user stones are absent.
Holder preference validity remains a solver constraint.

## 10. KeystoneLoot sharing

Sharing-disabled users retain characters/preferences/candidates but SQL projects their snapshot as
`NULL`. The adapter does not parse it and assigns `objectives: []`. The endpoint never returns raw
snapshots, favorites, used-item lists, bonus arrays, or private JSON.

## 11. Objective filtering

Eligible stone dungeon IDs are known first. The shared `keystoneObjectives.ts` normalizer parses
each relevant character snapshot once, keeps only `sourceType=dungeon`, exact numeric eligible
source IDs and configured loot specs, uses the existing spec/source/item/variant identity and
stronger-tier selection, and excludes `completed_with_voidcore`. The solver remains the only scorer.

## 12. Item enrichment

After solving, public scoring objectives are grouped by normalized character region and unique item
ID. Existing metadata infrastructure enriches names/icons in cache-safe batches of 100 and copies
the result to duplicate Top 3 occurrences. Missing credentials/cache/metadata leaves both fields
null without affecting scoring or Planner status.

## 13. Defensive limits

Limits are 5 participants, 15 locks, 150 normalized candidates, 100 eligible stones, and 5,000
candidate-objective entries. Exact boundaries are accepted. Any excess throws a structured
`PlannerDataLimitError`, maps to 422, and never truncates ranking input.

## 14. Zero stones

The adapter returns HTTP 200, `status: no_valid_composition`, zero eligible stones, the normal
diagnostic code, and an empty recommendation array. It skips character/snapshot work. A requested
valid dungeon with no matching stone behaves identically.

## 15. Unconfigured users

With at least one eligible stone, selected users without any valid playable preference reach the
solver with no candidates. The public result remains HTTP 200 with
`status: unconfigured_participants` and sorted `diagnostics.unconfiguredUserIds`.

## 16. Added tests

Seventeen API/adapter tests cover JWT/sync-token boundaries, Team and participant membership,
strict request/lock validation, optional fields and boundaries, played/loot specs, 1/1/3,
incomplete/impossible/unconfigured states, live stones and dungeon filtering, privacy, exact
objective semantics, zero-score recommendations, invalid-lock mapping, item/capability metadata,
metadata batching, Devourer, Top 3, holder binding, level/utility behavior, zero stones, limits,
and deterministic repeated responses. Existing objective, solver, Selector, recommendation,
preference, auth, and Team tests remain green.

## 17. Final test total

Worker Node suite: 189 passed, 0 failed. Planner migration Python suite: 3 passed, 0 failed.

## 18. Validation

- `npm run typecheck`: exit 0.
- `npm test`: exit 0; 189/189.
- `python -m unittest tests.test_keystone_planner_migration`: exit 0; 3/3.
- `git diff --check`: exit 0; only LF/CRLF working-copy warnings.

No local or remote migration was required because Block C changes no schema.

## 19. Deployment Impact

The strict classifier requires Worker consideration only: Worker true; DB, Web, Client build,
Client release, addon, and addon release false. There are no unknown or outside paths. This does
not authorize deployment.

## 20. Before Block D

Block D must implement the owner preference configuration and Planner session/selected-dungeon Web
flows against these exact endpoints, translate reason/diagnostic/capability IDs into UI, and correct
the Web-local Devourer mapping. It should decide how to present 422 and zero-stone availability and
whether the initial Web experience uses the default Spanish metadata locale. No API, solver,
ranking, privacy, or schema decision remains open. Block C remains uncommitted.
