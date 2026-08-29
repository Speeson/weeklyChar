# KeystoneLoot V2-C Design

## Objective

Expose allowlisted KeystoneLoot objectives between current members of the same team so the
existing stone planner can explain its aggregate recommendations. Preserve the Worker as the
sole authorization, privacy, scoring, filtering, and Voidcore authority.

## Approved design

The existing single `shareKeystoneLootWithTeams` control receives the approved V2 wording;
its API field, loading, optimistic save, rollback, authentication, and local-reset separation
remain unchanged.

Every character in the Team page receives `Ver objetivos`. This opens one native responsive
team drawer outside the planner, using the explicit team endpoint with server-side dungeon
(`challengeMapId`) and specialization filters plus bounded cursor pagination. Authoritative
privacy/product statuses are distinct from retryable failures. A refreshed 403 clears rows
before showing membership/access loss.

Each recommended planner member receives `Ver objetivos`. Inside the existing planner dialog,
desktop adds a compact side panel and mobile drills into a detail view with `Volver`; no nested
dialog is created. Requests contain the exact team, recommended character, selected challenge
map, and recommended spec. Stone changes close and invalidate details. Member changes, filter
changes, pagination, close, and late responses are guarded by abort plus exact identities.

## Architecture and data flow

`keystoneLootObjectives.ts` keeps one strict item parser while exposing separate Owner and
Team envelope parsers/status unions. It also owns explicit owner/team URL builders and team
request identities. A small shared objective-list component owns only row presentation and
fallbacks. Owner and Team containers keep endpoint and status semantics explicit.

```text
Team row / planner recommendation
  -> GET /api/teams/:teamId/characters/:characterId/keystone-loot/objectives
  -> Worker live membership + sharing authorization
  -> strict Team response parser
  -> shared presentation-only objective rows
```

No SavedVariables, Client payload, Worker route, D1 schema, raw team response, recommendation
weight, or scoring contract changes.

## Verification

- Web parser/helper, Settings, planner, team drawer, and V2-B regression tests.
- `npm test`, TypeScript, production build, and lint-baseline comparison under `keystone-web`.
- Worker `npm run typecheck` and `npm test` (74-test baseline).
- Local browser scenarios at 1440×1100 and 390×844, including three members and product/error
  states.
- Strict deployment impact relative to the V2-B commit and `git diff --check`.

## Out of scope

Recommendation/scoring changes, a new optimizer, a second sharing preference, nested planner
dialogs, raw wishlist access, Worker/D1/addon/client changes, production operations, releases,
version bumps, and V2-D.
