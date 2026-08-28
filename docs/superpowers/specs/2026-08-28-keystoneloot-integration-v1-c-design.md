# KeystoneLoot Integration V1-C Design

## Objective

Add a server-enforced team-sharing preference and a deterministic KeystoneLoot recommendation API that selects at most one `(character, specId)` target for each current team member and requested Mythic+ challenge map.

V1-C is Worker/D1 logic only. It does not add Web, Client, or addon behavior.

## Approved architecture

Migration `0003_keystone_loot_sharing.sql` adds `users.share_keystone_loot_with_teams INTEGER NOT NULL DEFAULT 1`. `GET /api/me` exposes the value as `shareKeystoneLootWithTeams: boolean`; authenticated JWT-only `PATCH /api/me/preferences` accepts exactly a boolean for that preference and updates only the current user.

`GET /api/teams/:teamId/recommendations?challengeMapId=<positive-safe-integer>` uses live D1 membership for authorization and member discovery. Privacy is applied before character loading or snapshot parsing. A disabled member returns only `userId`, `username`, `status: "sharing_disabled"`, and `recommended: null`.

For enabled members, stored JSON is parsed defensively and accepted only through the V1-B KeystoneLoot validator when it is a supported API v2 snapshot. Invalid, missing, unavailable, or unsupported snapshots are ignored without failing the response.

Pure scoring lives in `keystone-worker/src/keystoneRecommendations.ts`. It evaluates separate `(character, specId)` candidates. Numeric `favorite.sourceId` must exactly equal the requested challenge map; explicit non-dungeon `sourceType` values and string sources are excluded. Unknown numeric tiers score zero.

Tier weights are explicit: Nice `1=25`, Must `2=60`, BiS `3=100`, Transmog `4=5`, Catalyst `5=15`. Within a candidate, each `itemId` counts once at its highest known weight. When authoritative Voidcore is checked, used items are excluded rather than penalized and increment the candidate's unique `voidcoreExcluded` count.

Candidates require score greater than zero. Ties resolve by score, BiS, Must, Nice, Catalyst, Transmog, item level, Raider.IO score, character name, realm, then spec ID. Missing item level and Raider.IO are lower than real values.

## Response and privacy contract

The endpoint returns `{ teamId, challengeMapId, members }`. Each member has `userId`, `username`, one of `recommended`, `sharing_disabled`, `no_keystoneloot`, or `no_targets`, and either a recommendation summary or `null`.

Recommendations may contain character display fields, `specId`, score, and aggregate counts only. They never contain raw favorites, item IDs, modifiers, Voidcore item IDs, or the raw KeystoneLoot object. Normal team detail continues omitting `keystoneLoot`; owner `/api/me/characters` continues returning it regardless of sharing preference.

## Verification

- `npm run typecheck` and `npm test` in `keystone-worker`.
- Pure scoring tests for weights, filtering, multi-spec/character selection, deduplication, Voidcore, unknown tiers, and every deterministic tie-break level.
- Route tests for authentication, live membership, parameter validation, preference updates, privacy isolation, statuses, response redaction, owner access, and team-detail non-exposure.
- Local D1 migrations `0001`, `0002`, and `0003` in order.
- Deployment-impact and release regression suites, strict changed-path impact, and `git diff --check`.

## Deployment ordering

Future deployment must apply `0002`, then `0003`, then deploy the Worker. This task performs no remote migration or deployment.

## Out of scope

- V1-D Web planner, privacy UI, or wishlist rendering.
- Item names, objects, modifiers, or V2 display APIs.
- Party-role composition or performance-based scoring.
- Client/addon changes, version bumps, commits for V1-C, pushes, tags, releases, or deployments.
