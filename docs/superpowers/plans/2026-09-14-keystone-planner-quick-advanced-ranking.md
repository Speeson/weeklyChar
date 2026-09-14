# Keystone Planner Quick / Advanced Ranking Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-14-keystone-planner-quick-advanced-ranking-design.md`

## Constraints

- Preserve the existing dirty Planner work and the exact legacy request behavior.
- Work test-first for every behavior block.
- Do not change Keystone Web visuals or raw source JSON.
- Do not perform remote operations or create a database migration.

## Tasks

- [x] Add generator-contract tests, then implement deterministic typed production-data generation and
  `--check`, including archetype fallbacks and Hunter's Mark exclusion.
- [x] Add focused scoring tests, then implement pure offensive bands/interactions, utility availability,
  marginal coverage, dungeon relevance, role filtering, permutation dedupe, and stable ordering.
- [x] Add solver/API regression and compatibility tests, then integrate modern Quick/Advanced completion
  variants after the current Battle Rez comparison while retaining the legacy comparator.
- [x] Add sidecar and TypeScript parser tests, then preserve the additive vacancy explanation DTO with
  bounded defensive validation.
- [x] Add Client component and Playwright tests, then implement the segmented selector, conditional
  priority rows, local official icons, and minimal external class/spec result labels.
- [x] Update ranking-data README, durable contract/context docs, Client changeset, and final SDD report.
- [x] Run full relevant Worker, Client, bridge, visual, build, Web compatibility, generated-data drift,
  diff, self-review, and Deployment Impact checks.
