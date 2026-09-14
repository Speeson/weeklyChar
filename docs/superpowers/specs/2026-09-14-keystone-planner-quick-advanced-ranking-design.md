# Keystone Planner Quick / Advanced Ranking Design

## Objective

Extend the existing Keystone Planner after its current Battle Resurrection comparison with two
explicit vacancy-recommendation modes. Quick recommends role-compatible classes using only
composition-relative offensive evidence; Advanced recommends exact role-compatible specs and may
then use group defense and selected-dungeon utility inside the offensive equivalence band.

## Approved design

- KeystoneClient starts in `quick` mode and owns only presentation/local option state.
- The Client sidebar inserts one accessible 50/50 segmented control between character configuration
  and the unchanged minimum-level filter. Quick shows Bloodlust, Battle Resurrection, and Offensive
  Synergy; Advanced additionally shows Group Defense and Dungeon Utility.
- Legacy Class Buffs and Damage Synergy controls disappear only from KeystoneClient. Keystone Web is
  visually unchanged and keeps sending its legacy five-option payload.
- The Worker accepts either the exact legacy option shape or the exact modern option shape. Legacy
  requests follow the existing comparator byte-for-behavior. Modern requests keep the current hard
  priorities, then use Bloodlust, Battle Resurrection, offensive band, optional Advanced defense and
  dungeon-utility bands, existing loot score, existing loot tiers, same-armor loot-sharing tie-break,
  exact offensive gain, and stable identity.
- Quick jointly enumerates unique class combinations for missing roles and only measures new unique
  offensive buffs against already-known DPS specs.
- Advanced jointly enumerates exact specs. It measures new candidate-to-existing, existing-to-candidate,
  and candidate-to-candidate offensive interactions without self-provider credit or absolute DPS.
- Production SimC gains are clamped to zero and combined multiplicatively per recipient. Feral,
  Balance, Devastation, and Augmentation use generated archetype medians with explicit provenance;
  Hunter's Mark stays in the raw source and is excluded from production scoring.
- Offensive bands use `max(0.005, bestGain * 0.25)`. Defense and dungeon utility use the same 25%
  idea over lexicographic S/A/B/C vectors with a minimum 250 production units, so a small conditional-
  availability or relevance delta cannot displace materially better loot. Lower tiers never compensate
  a deficit outside the active higher-tier window.
- Utility availability is centralized: baseline/spec-only/spec-access/racial = 1.0; class/spec/choice/
  hero talents and pet-conditional abilities = 0.5. `best_only` and `coverage_once` award no duplicate
  marginal value; `diminishing` uses 1, 0.5, 0.25, then 0.125.
- Modern vacancies add the selected class/spec and bounded scoring explanations. They never receive a
  player, character, keystone, preference, or loot objective. Combination identity is part of modern
  recommendation fingerprints so the global Top 5 contains unique deterministic combinations.
- The four source JSON files remain immutable research artifacts. A checked-in generator creates a
  compact versioned TypeScript runtime module under `keystone-worker/src/` and supports a drift check.
- New Client icons are local copies downloaded from Blizzard's official WoW render CDN: Battle Shout
  (6673), Blessing of Sacrifice (6940), and current Cleanse Toxins (440013).

## Architecture

```text
tools/planner-ranking-data/source/*.json
  -> tools/planner-ranking-data/generate.mjs
  -> keystone-worker/src/plannerRankingDataGenerated.ts
  -> keystone-worker/src/plannerVacancyScoring.ts
  -> existing keystonePlanner comparator after Battle Rez
  -> additive vacancy DTO
  -> sidecar bounded sanitizer
  -> KeystoneClient parser and existing external-slot presentation
```

No D1 persistence or migration is involved. Keystone Web continues to parse the legacy vacancy subset
and ignores additive modern fields.

## Verification

- `node tools/planner-ranking-data/generate.mjs --check`
- `npm --prefix keystone-worker run typecheck`
- `npm --prefix keystone-worker test`
- `python -m compileall -q keystone-client/sidecar scripts tests`
- `python -m unittest discover -s tests/client`
- `python -m unittest discover -s tests/client_bridge`
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `npm --prefix keystone-client run test:visual`
- Web lint/build and its Planner contract tests, solely as compatibility proof.
- Manual screenshot inspection for Quick and Advanced, plus `git diff --check` and Deployment Impact.

## Out of scope

- Keystone Web visual/layout/control changes.
- Absolute DPS, spec tier lists, Power Infusion, full Augmentation support modeling, new SimC runs, or
  Hunter's Mark production scoring.
- Addon changes, database migrations, deploys, releases, tags, pushes, or commits.
