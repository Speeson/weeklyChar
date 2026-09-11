# Keystone Planner V1 — Block E final report

## Outcome

Block E completed the currently executable D1 and Worker rollout, authenticated production-API
validation, local Web validation, visual/accessibility review, and one scoped hardening fix. Full
Block E acceptance remains blocked on a real-data Top 3. D1 migration
`0010_keystone_planner.sql` is applied and production Worker version
`c88172eb-fbc6-4fd6-b67c-08dcdd7fe0e8` is healthy. The Block D Web remains local and was not
deployed. No push, merge, PR, tag, release, Client/Addon operation, destructive data operation, or
Web/Vercel deployment was performed.

The remaining product-level blocker before Web rollout is data readiness: only the authenticated
test user has configured Planner preferences. Other members of the real Team must configure their
own characters before production data can yield a real Top 3 and therefore before real-data
composition, stone-holder, loot-ranking, utility, affinity, and privacy-output invariants can be
observed end to end. Those invariants continue to pass deterministic Worker and Playwright tests.

## Checkpoint and initial state

- Branch: `feature/keystone-planner-v1`.
- Block D local checkpoint: `54dccfafb4f547294442384c446c22a8849bc87d`
  (`feat(web): add Keystone Planner interface`). No push was performed.
- Release range A→D: `7ca502d..54dccfa`. Strict Deployment Impact reported
  `DB=true`, `WORKER=true`, `WEB=true`, with Client and Addon dimensions false and no unknown or
  outside paths.
- Immediately after the checkpoint the tracked tree was clean. The pre-existing untracked
  `.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`,
  `docs/keystonesync-selector-piedra-plan.md`, and
  `keystone-client/tauri-current-characters.png` were preserved.
- Secret-pattern and staged-scope checks found no credential material in the Block D diff.

## D1 rollout and integrity

The production migration list was queried before applying anything. The only pending migration was
`0010_keystone_planner.sql`; no unexpected migration was present. Its reviewed SQL was additive:
it created only `character_play_preferences`, with composite primary key
`(character_id, spec_id)`, positive spec/loot-spec checks, the four-state preference check,
`updated_at`, and a `characters(id) ON DELETE CASCADE` foreign key.

Pre-migration non-sensitive snapshot:

| Metric | Before | Immediately after |
| --- | ---: | ---: |
| users | 5 | 5 |
| characters | 29 | 29 |
| teams | 3 | 3 |
| team_members | 8 | 8 |
| keystones | 514 | 514 |
| character_play_preferences | not present | 0 |

The environment-provided `CLOUDFLARE_API_TOKEN` permitted read queries but the first migration
attempt failed closed with Cloudflare permission error `7500`; the migration remained pending and
the table remained absent. Wrangler OAuth was then completed interactively with `d1:write`, after
which the same sole-pending-migration and integrity gates were repeated. The second attempt applied
`0010` successfully.

Post-migration verification established:

- `wrangler d1 migrations list DB --remote`: no migrations to apply;
- all five existing-table counts unchanged;
- new table initially empty, as expected;
- five expected columns and `(character_id, spec_id)` PK positions 1/2;
- unique SQLite PK auto-index;
- FK from `character_id` to `characters.id` with `ON DELETE CASCADE`;
- persisted table SQL contains the four allowed play states and positive ID checks;
- `PRAGMA foreign_key_check`: zero rows.

No artificial preference row was inserted with SQL. The later 22 rows were created only by the
authenticated product UI/API flow.

## Worker deployment and production smoke

Before deployment, Worker typecheck, 189 tests, and all 3 migration tests passed. The initial
authorized deployment produced version `bfe187af-a8cc-4b55-87a0-b7f756f17879`.

The production browser preflight review then found one major bug: the route uses
`PUT /api/me/planner/preferences`, while CORS advertised only
`GET,POST,PATCH,DELETE,OPTIONS`. A regression test was written first and failed against the real
middleware response. The minimal fix adds `PUT` to `Access-Control-Allow-Methods`; the focused test
then passed, followed by Worker typecheck and all 190 tests. Strict impact for the fix reported only
`WORKER=true`. The authorized corrective redeploy produced the final version
`c88172eb-fbc6-4fd6-b67c-08dcdd7fe0e8`.

Production smoke on `https://api-keystonesync.esgarpe.dev` after the corrective deploy:

- `GET /api/health`: `200`, expected service payload;
- localhost `OPTIONS /api/me/planner/preferences`: `204`, exact allowed origin, Authorization and
  Content-Type headers, and `GET,POST,PUT,PATCH,DELETE,OPTIONS` methods;
- unauthenticated Planner Team POST: `401`;
- unauthenticated preference GET and PUT: `401`;
- unauthenticated existing Selector route: `401`;
- unauthenticated `/api/me` and `/api/teams`: `401`.

No token, cookie, password, OAuth secret, sync token, email value, or raw KeystoneLoot snapshot was
recorded.

## Authenticated real-data strategy

The Block D Web was run locally at `http://localhost:3000` with
`NEXT_PUBLIC_API_URL=https://api-keystonesync.esgarpe.dev`. Production CORS already explicitly
allowed localhost, so no origin exception was introduced. The user authenticated interactively in
a visible Edge instance with an isolated temporary profile. The JWT stayed in browser localStorage;
automation checked only token presence and used it in browser memory. At the end, the browser,
launcher, temporary scripts, and complete temporary browser profile were removed.

Authenticated calls returned `200` for `/api/me`, `/api/me/characters`, `/api/teams`, all three
Team details, and `/api/me/planner/preferences`. Testing used one real four-member Team. No setting
or preference owned by another user was changed.

## Real preferences

The user opened **Configurar mis personajes** and saved the full replacement for seven real owned
characters. A subsequent GET returned 22 character/spec rows, all mapped to those owned characters:

- 4 `preferred`;
- 1 `available`;
- 3 `emergency`;
- 14 `disabled`.

The reopened dialog rendered all 22 rows and the same four persisted states. Specs matched their
character classes; roles were returned by the Worker rather than stored or inferred by React.
Devourer (`1480`) appeared under Demon Hunter. No character without a class existed in this user's
current data. The user did not select a meaningful `lootSpecId != specId`, so that behavior was not
manufactured in production and remains covered by Worker/Web tests.

## Real Planner results

Authenticated production API checks used target level `+12` and selected only live members of the
real Team:

| Case | Participants | challengeMapId | Eligible stones | Domain status | Recommendations |
| --- | ---: | ---: | ---: | --- | ---: |
| Session | 2 | null | 7 | `unconfigured_participants` | 0 |
| Session | 3 | null | 10 | `unconfigured_participants` | 0 |
| Session | 4 | null | 13 | `unconfigured_participants` | 0 |
| Existing dungeon stone | 2 | 249 | 2 | `unconfigured_participants` | 0 |
| Dungeon absent for selection | 2 | 399 | 0 | `no_valid_composition` | 0 |

The local UI reproduced the two important presentations:

- session and real-stone modes named the unconfigured teammate and explained that each teammate
  must configure their own characters;
- the zero-stone dungeon displayed the neutral **No hay una piedra de esta mazmorra** state, not a
  red error.

Because no second Team member had preferences, production returned no recommendation cards. Thus
real-data 1/1/3 composition, exact holder assignment, allowed played/loot specs, objective counts,
ranking order, vacancies, Heroism mode, buffs/debuffs, affinity counts, and hidden-shared-objective
behavior could not be re-proven from a real recommendation. No other user's sharing preference or
private snapshot was inspected. The complete deterministic suites cover these rules, including
five-player 1/1/3, incomplete vacancies, holder binding, disabled exclusion, exact lootSpec/source,
Voidcore filtering, ranking comparator order, guaranteed/conditional Heroism, unique capabilities,
Chaos Brand/Mystic Touch beneficiaries, affinity, and privacy filtering.

## Visual and accessibility review

Real API/UI states were inspected at 1440×1000 and 390×844. The session modal, selected-dungeon
modal, unconfigured state, zero-stone state, and 22-row preference editor had no horizontal
overflow. Hierarchy, labels, participant cards, target slider, master/suboptions, advanced section,
lock controls, status copy, fixed preference actions, and touch-sized close/actions remained
legible. The long preference list scrolls internally and retains its action footer.

The validated Playwright Top 3 fixture was also captured and inspected because production lacked a
second configured member. Rank #1 had the strongest hierarchy; dungeon/level, five conceptual
slots, differentiated vacancies, loot/preference/composition summaries, expandable objectives,
conditional/guaranteed capability badges, and subsequent recommendations were readable in desktop
and mobile layouts.

Keyboard checks on the real local/API flow covered participant selection, slider `Home`/`End`
(`1`/`20`), disabling/re-enabling the composition master and its Heroism subcontrol, opening
advanced locks, calculating, opening/closing preferences, Escape, and focus return to both the
preferences and Planner triggers. Automated Playwright coverage additionally exercises adding,
displaying, removing, and participant-scoping locks, focus containment, objectives, mobile stone
entry, and retry/error states.

One cosmetic/minor observation remains: the scrollbar of the underlying Team page stays visible
beside the modal's intentional internal scrollbar. It caused no overflow, clipping, focus failure,
or blocked interaction and was not changed during hardening.

## Hardening changes left for review

- Major, fixed: production CORS omitted the preference route's `PUT` method.
- Regression test: `keystone-worker/tests/httpCors.test.js` exercises an actual Hono preflight from
  the supported localhost origin and asserts `204`, the origin, and `PUT` in allowed methods.
- Minimal production change: `keystone-worker/src/http.ts` adds only `PUT` to the existing method
  allowlist.
- Cosmetic/minor, documented only: underlying page scrollbar remains visible with the modal.

Per instruction, these Block E files remain uncommitted for final review. The final production
Worker therefore contains a hardening change not yet represented by a Git commit; that commit must
exist before any later push/reproducible release workflow.

## Final validation

Final commands and exact results after the report/document updates:

- Worker `npm run typecheck`: passed.
- Worker `npm test`: passed, 190/190.
- Worker `python -m unittest tests.test_keystone_planner_migration`: passed, 3/3.
- Web `npm run lint`: passed with zero reported issues.
- Web `npm test`: passed, 73/73.
- Web `npm run build`: passed with Next.js 16.2.6; all 16 routes/pages generated and
  `/teams/[id]` remained dynamic.
- Web `npm run test:visual`: passed, 25/25 Chromium scenarios.
- Repository `git diff --check`: passed. The two untracked Block E files were separately checked
  for trailing whitespace.
- Strict Deployment Impact for Block E changed files: `WORKER=true`; `DB=false`, `WEB=false`,
  `CLIENT_BUILD=false`, `CLIENT_RELEASE=false`, `ADDON=false`, `ADDON_RELEASE=false`; no unknown or
  outside paths.
- Final production recheck: no D1 migrations pending, original counts still unchanged, 22 Planner
  rows, empty `PRAGMA foreign_key_check`, health `200`, and localhost PUT preflight `204`.

## Final production state and next gate

- D1: `0010` applied; no migration pending; original counts preserved; foreign-key check clean;
  22 owner-created preference rows now exist.
- Worker: version `c88172eb-fbc6-4fd6-b67c-08dcdd7fe0e8` deployed and passing health, CORS, auth,
  Planner, preference, and existing Selector smoke boundaries.
- Web production: unchanged previous version; Block D/E Web was not deployed.
- Web local: Block D plus no Web hardening changes. The sole code hardening is Worker CORS.
- Before final Web rollout: commit/review the Block E hardening and report, have enough other real
  Team members configure preferences to produce recommendations, complete the mandatory
  authenticated Top 3 acceptance described in this Block E plan, and only then perform a separately
  authorized Web deployment followed by production acceptance.
