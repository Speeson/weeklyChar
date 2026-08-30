# Keystone Stone Selector S1 Design

## Objective

Add one authenticated Worker endpoint that returns the complete, privacy-safe Stone Selector summary for one Team and one supported Season 2 dungeon. This phase is backend-only and does not implement tooltip metadata expansion, Web, Client, or party-planning behavior.

## Approved design

The endpoint is `GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`. It checks the requester and current Team membership on every request, loads only current members who enabled `shareKeystoneLootWithTeams`, validates stored KeystoneLoot v2 snapshots, and returns only allowlisted selector DTO fields.

Actionable counters exclude `completed_with_voidcore`; unchecked Voidcore objectives remain actionable. A character is omitted when it has no actionable objectives. Character/global totals deduplicate by `(sourceType, sourceId, itemId)`, merge sorted unique `specIds`, and choose the strongest duplicate tier using the existing tier-weight helper. Per-spec counts remain independent and can sum above the deduplicated character total.

Current stone availability uses the existing EU weekly-reset semantics and current Team membership, independently of KeystoneLoot sharing. Metadata enrichment reuses the existing Blizzard item cache and batch helper for names/icons only; tooltip fields remain `null`, `null`, `null`, and `[]` until S2.

## Architecture

- `keystone-worker/src/season2.ts` owns the minimal Worker allowlist of the eight verified current Season 2 challenge-map IDs. It intentionally duplicates Web metadata during S1 because this phase cannot change Web or introduce a shared build boundary.
- `keystone-worker/src/keystoneSelector.ts` owns the DTOs and deterministic pure aggregation.
- `keystone-worker/src/db.ts` owns batched current-member character and current-stone reads.
- `keystone-worker/src/routes/teams.ts` owns route validation, authentication, live authorization/privacy queries, enrichment, and response assembly.
- Existing recommendation and per-character objective endpoints remain unchanged.

## Verification

- `cd keystone-worker; npm run typecheck`
- `cd keystone-worker; npm test`
- `python scripts/deploy_impact.py --files <changed-paths> --json --strict`
- `git diff --check`
- `git status --short -uall`

## Out of scope

- Blizzard tooltip metadata columns or migration 0005.
- Web or KeystoneClient changes.
- A shared cross-surface seasonal package.
- Composition, scoring, Raider.IO ranking, deployment, migration, release, or version changes.

