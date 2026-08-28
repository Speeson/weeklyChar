# KeystoneLoot Integration V1-D Design

## Objective

Expose the committed V1-C privacy preference and per-member dungeon recommendations in KeystoneSync Web. Users can manage the account-level sharing preference and plan one actual current team keystone without exposing wishlist objects or duplicating Worker scoring logic.

## Approved experience

Settings gains a separate `KeystoneLoot y privacidad` section. It loads `shareKeystoneLootWithTeams` from `GET /api/me`, saves changes through `PATCH /api/me/preferences`, disables the control while loading/saving, restores the last server value on failure, and reports concise inline state. The preference never enters `ks_web_settings`, and `Restaurar valores` continues resetting only local display settings.

The team header gains `Planificar piedra`. The action is enabled only when `team.members[].characters[]` contains a current keystone with positive numeric level and positive safe-integer `challengeMapId`; otherwise the header explains that no current stones are available. Stone options retain member, character, class/avatar, dungeon, level, and challenge-map identity, are never deduplicated, and sort by level descending, dungeon, character, then realm.

An accessible native dialog presents the team stones and preserves its selected stone/result during the page session. Selecting a stone clears stale results and calls `GET /api/teams/:teamId/recommendations?challengeMapId=<id>`. An abort controller plus request generation prevents a slower previous selection from overwriting the current one. Loading, retryable error, selected-stone context, and every Worker member status remain planner-local.

`recommended` cards show the returned character/spec, optional item level and Raider.IO, non-zero tier-category counts, and only the aggregate Voidcore-excluded count. `sharing_disabled`, `no_keystoneloot`, and `no_targets` use neutral explicit Spanish explanations. Only the requesting user's disabled card links to Settings.

While a recommendation result is active, the existing team character display highlights only the exact returned `characterId` and labels its returned specialization. Existing text/dungeon filters, member collapse state, ordering, and keystone display remain unchanged; the planner result remains visible even when those controls hide a recommended row.

## Architecture and contract

- `keystone-web/lib/keystoneRecommendations.ts` owns explicit V1-C response types plus pure stone derivation, sorting, summary formatting, and ID-based highlight helpers. It contains no scoring weights, Voidcore evaluation, or candidate selection.
- `keystone-web/lib/wowSpecs.ts` maps current playable specialization IDs from current `ChrSpecialization` data to display names and falls back to `Spec <id>`.
- `keystone-web/app/teams/[id]/KeystonePlanner.tsx` owns dialog state and API orchestration.
- Existing Settings and team pages integrate those focused modules without changing Worker, D1, Client, addon, or version metadata.

The Web sends only `challengeMapId` and renders the V1-C aggregate response. It does not request or display item IDs, item names/icons, modifiers, favorites, or raw Voidcore data. V2 remains the mandatory object-display milestone.

## Verification

- Test-first Node tests for stone eligibility/non-deduplication/order, summary formatting, known/unknown specialization names, and exact-ID highlighting.
- `npm test`, `npm run lint`, and `npm run build` in `keystone-web`; compare lint with the captured 13-error/25-warning baseline.
- Worker `npm run typecheck` and `npm test` regression.
- Desktop and narrow Chromium validation of Settings and team planner states using a controlled local API scenario, including two challenge-map selections and stale-response protection.
- Strict deployment-impact classification, `git diff --check`, scope/status review, and an SDD final report.

## Out of scope

- V2 item/object display, wishlist drawers, `Ver objetivos`, item metadata, tooltips, or Wowhead links.
- Worker scoring/API changes, D1 migrations, Client/addon changes, role composition, global party optimization, or performance scoring.
- Version bumps, V1-D commit, push, merge, remote migration, deployment, tag, or release.
