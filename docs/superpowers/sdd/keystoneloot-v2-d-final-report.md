# KeystoneLoot V2-D Final Report

Date: 2026-08-29

## Verdict

`V2 RELEASE READINESS: GO`

V2-D found no runtime defect and made no Worker, Web, D1, Client, or addon runtime change.
The only pending V2-D changes are this release-readiness report and durable documentation.

## Branch and migration integrity

- V2-C commit: `bf1b83e865ee29440ac3cf455fa82bc879577b0c`,
  `feat(web): share KeystoneLoot team objectives`.
- `origin/main...HEAD` was `0 3` after fetch: no divergence and exactly V2-A, V2-B, V2-C.
- Disposable local D1 applied `0001`, `0002`, `0003`, and additive `0004` in order.
- Verified `characters.keystone_loot_json`,
  `users.share_keystone_loot_with_teams`, and `wow_item_metadata` primary key
  `(region, locale, item_id)`.

## Real input and end-to-end contract

The read-only current file at
`C:\Program Files (x86)\World of Warcraft\_retail_\WTF\Account\KAGUEMARO\SavedVariables\KeystoneSync.lua`
contained seven characters: four supported KeystoneLoot snapshots and three historical rows
without the block. Supported favorite counts were 24, 0, 22, and 0. The real addon version was
`2.13.1` and API version `2`.

The canonical Client parser posted all seven characters to the actual local Worker and
disposable D1. Owner projection preserved `itemId`, `tier`, `specId`, `sourceType`, `sourceId`,
`slotId`, snapshot freshness/API/addon metadata, and derived Voidcore state. A representative
real completed objective was item `250259`, tier `3`, spec `70`, dungeon source `584`, slot
`13`, with `completed_with_voidcore`. Raw `characterKey`, `favorites`, `usedItems`, modifiers,
unknown fields, and raw JSON did not enter the objective DTO.

Historical Client payloads omitted `keystoneLoot`; the Worker preserved any prior value when
omitted and rejected explicit null. A controlled supported empty wishlist returned owner
`empty` and team `no_targets` without stale items.

## Authorization, privacy, and sharing

A disposable A/B/C two-team scenario proved same-team allow, cross-team denial, immediate
denial after membership removal, and successful access after rejoin. Sharing ON enabled
recommendation aggregates and team objective display. Sharing OFF returned only
`sharing_disabled`/`recommended:null`, exposed no item/spec/source/count/timestamp data, and
left owner objective access intact. Re-enabling restored team access.

`GET /api/teams/:teamId` omitted raw KeystoneLoot. Recommendations exposed only their existing
aggregate score/count contract. The objective endpoint exposed only the nine documented DTO
fields and never raw wishlist/internal recommendation data. Browser validation confirmed that
a refreshed 403 clears previously rendered sensitive rows.

## Metadata, edge cases, and UI

No secure local Blizzard developer credentials were available, so no live Blizzard call was
attempted. The 74-test Worker suite proved OAuth/item/media `static-{region}` + `es_ES`, cache
miss/fresh/stale/negative/expired-negative behavior, 401 retry, 404, 429, 5xx, timeout, invalid
or oversized JSON, item mismatch, unsafe media rejection, duplicate lookup collapse, and
four-pipeline concurrency. The actual disposable D1 additionally proved fresh/stale/fallback
rows and EU/US composite-key isolation. Missing credentials returned usable objectives with
null metadata.

The production-built Web ran against the actual local Worker/D1 without API interception for
the core path. Owner available/empty/not-installed/not-ready/unsupported/unavailable states,
metadata name/icon and fallback, future tier `99`, all Voidcore states, stale warning, filters,
and 50+5 pagination passed. Team sharing/privacy states, filters, pagination, metadata fallback,
and 403 row clearing passed. Planner requests used the exact selected character,
`challengeMapId`, and recommended `specId`; the contextual panel showed only matching dungeon
objectives. A raid favorite with colliding numeric source ID was excluded by both scoring and
display filtering. Completed Voidcore items remained visible while aggregate `totalPending`
excluded them, with explicit explanatory copy.

Exact same-name/different-realm owner/team DTOs remained distinct. Automated identity and abort
tests covered late stone, member, owner drawer, team drawer, filter, and pagination responses;
actual browser requests used exact character IDs throughout.

## Validation

- Worker typecheck: passed.
- Worker tests: 74/74 passed.
- Web tests: 48/48 passed.
- Web production build: passed on Next.js 16.2.6.
- Web lint: unchanged baseline, 13 errors and 25 warnings; zero new V2 findings.
- Client Python compile: passed.
- Client Python tests: 82/82 passed.
- Client bridge/protocol tests: 57/57 passed.
- Canonical addon runtime/release/impact tests: 31/31, 30/30, and 10/10 passed at
  `v0.2.3`; no addon file changed.
- Strict complete impact: Web `true`, Worker `true`, DB `true`; Client build/release and
  addon build/release `false`; no unknown or outside paths.
- Phase impacts: V2-A Worker+DB; V2-B Web; V2-C Web.

## Release operations

Worker/Web have no independent versioned changeset system. The repository changeset mechanism
is Client-specific; V2 creates no Client or addon changeset and consumes none.

Production Blizzard credentials belong in Cloudflare Worker secrets named
`BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`. Type bindings and fallback are ready. Their
absence does not fail deployment or authorization; it yields `Objeto #<itemId>` and the generic
icon until configured. Configure them before rollout for product quality.

Safe rollout:

1. configure both Blizzard Worker secrets;
2. apply remote additive migration `0004`;
3. deploy the backward-compatible Worker;
4. smoke owner/team objective endpoints;
5. deploy Web;
6. smoke Characters, team drawer, and planner.

No push, merge, deployment, remote migration, production-secret write, release, tag, or version
bump occurred during V2-D.
