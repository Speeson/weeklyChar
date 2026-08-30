# Keystone Stone Selector S1 Final Report

## Delivered

- Added `GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`.
- Added the strongly typed aggregate Selector DTO and deterministic aggregation for actionable
  counts, tiers, multiple specs, canonical cross-spec deduplication, and character ordering.
- Added live Team authorization, privacy filtering before snapshot parsing, exact Team isolation,
  and batched Team character/current-stone reads.
- Added current weekly stone availability independently of KeystoneLoot sharing.
- Reused cached Blizzard name/icon enrichment with S2 tooltip metadata fields left nullable/empty.
- Added the approved minimal Worker-owned Season 2 dungeon allowlist. Web remains unchanged and
  cross-surface pool consolidation is deferred.

## Validation

- `npm run typecheck`: passed.
- `npm test`: passed with 85 tests, 0 failures (baseline: 74 tests).
- `npm run d1:migrate:local`: all existing migrations applied successfully to local D1; no S1
  migration was added.
- The Selector current-stone window query executed successfully against local D1.
- `python scripts/deploy_impact.py --files <changed-paths> --json --strict`: passed with Worker-only
  product impact and no unknown/outside paths.
- `git diff --check`: passed.

## Remaining limitations

- S2 must add tooltip metadata persistence and Blizzard mapping for slot, class/subclass, and stat
  names.
- Web and Client consumers remain deferred to their planned phases.
- Worker and Web season-pool definitions intentionally remain duplicated until a later approved
  cross-surface consolidation.
