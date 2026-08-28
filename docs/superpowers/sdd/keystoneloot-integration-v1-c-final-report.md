# KeystoneLoot Integration V1-C Final Report

## Outcome

V1-C adds server-enforced KeystoneLoot team-sharing privacy and a deterministic recommendation endpoint without exposing raw wishlist data. The work is limited to Worker, D1, tests, and contract/architecture documentation. V1-B is committed locally as `ebd6519`; V1-C remains uncommitted.

## Contract

- Migration `0003_keystone_loot_sharing.sql` adds `users.share_keystone_loot_with_teams` with a default of enabled.
- `GET /api/me` exposes the owner preference and JWT-authenticated `PATCH /api/me/preferences` changes only that authenticated user's boolean value.
- `GET /api/teams/:teamId/recommendations?challengeMapId=<id>` requires current team membership and reports one of `recommended`, `sharing_disabled`, `no_keystoneloot`, or `no_targets` for each current member.
- Privacy is applied before loading, parsing, or scoring a member's characters. Owner access through `/api/me/characters` remains unchanged.
- The endpoint returns only recommendation identity, score, and aggregate counts. It does not return raw favorites, item/source records, modifiers, or Voidcore item lists.
- Tier weights are 25, 60, 100, 5, and 15 for tiers 1 through 5. Unknown numeric tiers remain valid stored data but contribute zero until a future contract assigns a weight.
- Candidates are grouped by character and spec, matched to the exact numeric challenge-map/source ID, deduplicated by item within a candidate, and filtered by checked Voidcore completion.
- Ties resolve by score, tier-summary counts, item level, Raider.IO score, character, realm, then spec ID.

## Validation

- Worker typecheck passed.
- Worker suite passed: 47 tests, including the 25-test V1-B baseline and 22 new V1-C tests.
- Deployment-impact suite passed: 45 tests.
- Release suite passed: 28 tests.
- Migrations `0001`, `0002`, and `0003` applied in order to a disposable local D1 database; a user inserted without the new column received the value `1`.
- A realistic local route fixture covered multiple users, characters, specs, tiers, checked Voidcore exclusions, all four statuses, deterministic selection, and response-wide raw-field redaction.
- `git diff --check` and the strict deployment-impact classifier passed.

## Deployment And Remaining Scope

Deploy migration `0003` before the Worker code. No remote migration or deployment was performed. V1-D Web UI and V2 item-level recommendation display remain pending. The current loader performs a focused character query per sharing-enabled team member; that is acceptable for V1-C team sizes but is the main future scaling point.
