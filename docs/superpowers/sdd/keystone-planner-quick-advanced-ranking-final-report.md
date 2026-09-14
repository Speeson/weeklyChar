# Keystone Planner Quick / Advanced Ranking Final Report

## Branch and worktree

- Repository: `C:/DAM2/weeklyChar`.
- Branch: `main`.
- Checkout: the primary working tree (`.git` is both Git dir and common dir), not a linked worktree.
- The checkout was already dirty when this task began. Existing Planner external-party-fill work,
  pending changesets and `tools/` research artifacts were preserved; nothing was reset, discarded,
  committed or included through a remote operation.

## Delivery

- KeystoneClient now starts in Quick mode and exposes an accessible 50/50 Quick/Advanced selector.
  Quick shows Bloodlust, Battle Resurrection and Offensive Synergy; Advanced additionally exposes
  Group Defense and Dungeon Utility while retaining their saved in-memory switch state.
- The Worker accepts either the exact five-key legacy options document or the exact seven-key modern
  document. Quick completes every missing role jointly with role-compatible classes; Advanced does
  the same with exact specializations. Mixed, incomplete or extended option documents are rejected
  by Client, sidecar and Worker boundaries.
- Modern ranking preserves the existing hard and played-preference priorities, then compares
  Bloodlust, Battle Resurrection, offensive equivalence band, optional Advanced defensive band,
  optional Advanced selected-dungeon utility band, existing weighted loot, existing loot tiers,
  exact offensive gain and stable identity.
- Small offensive, defensive or utility differences inside the same semantic band cannot displace a
  party with clearly better loot. Composition values are evaluated jointly for every external-slot
  combination, permutations are deduplicated and the Top 5 remains deterministic.
- Quick uses only the already-known DPS specs as recipients and never becomes an absolute class tier
  list. Advanced scores exact bidirectional candidate interactions without self-provider credit.
  Negative SimulationCraft noise is clamped to zero, multiple unique buffs combine
  multiplicatively, and Hunter's Mark remains excluded from production offensive scoring.
- Advanced group defense excludes personal defensives. Defensive and dungeon capability scores use
  exact-spec access, centralized availability discounts, marginal duplicate coverage and the exact
  selected-dungeon relevance matrix.
- Vacancy output is additive and bounded: Quick identifies the recommended class, Advanced the exact
  spec, and both may expose marginal offensive value, band identity, short reasons and provenance.
  External slots never gain a player, preference, stone or loot objectives.

## Files

Created for this evolution:

- `docs/superpowers/specs/2026-09-14-keystone-planner-quick-advanced-ranking-design.md`
- `docs/superpowers/plans/2026-09-14-keystone-planner-quick-advanced-ranking.md`
- `docs/superpowers/sdd/keystone-planner-quick-advanced-ranking-final-report.md`
- `.changes/pending/client-planner-quick-advanced-ranking.json`
- `tools/planner-ranking-data/generate.mjs`
- `keystone-worker/src/plannerRankingData.ts`
- `keystone-worker/src/plannerRankingDataGenerated.ts`
- `keystone-worker/src/plannerVacancyScoring.ts`
- `keystone-worker/tests/plannerRankingData.test.js`
- `keystone-worker/tests/plannerVacancyScoring.test.js`
- `keystone-client/src/assets/planner/offensive-synergy.jpg`
- `keystone-client/src/assets/planner/group-defense.jpg`
- `keystone-client/src/assets/planner/dungeon-utility.jpg`

Modified across the modern path and its compatibility boundaries:

- Worker: `keystonePlanner.ts`, `keystonePlannerApi.ts`, `wowComposition.ts` and their focused tests.
- Client: `team_service.py`, `App.css`, `core/keystonePlanner.ts`, `core/teamsPreview.ts`,
  `core/types.ts`, `pages/TeamsPage.tsx`, their unit/bridge/visual tests and Planner asset sources.
- Documentation: `ARCHITECTURE.md`, `DATA_CONTRACT.md`, `AGENT_CONTEXT.md` and the ranking-data
  source README.

The four supplied JSON datasets under `tools/planner-ranking-data/source/` remain unchanged raw
research inputs.

## `armorSynergy` decision

`armorSynergy` counts same-armor pairs (`cloth`, `leather`, `mail`, `plate`). Its original design
explicitly describes it as a potential loot-sharing heuristic, not as a general composition-quality
score and not as a guarantee that an item can be traded. It does not inspect item level, weapons,
trinkets or exact trade eligibility.

The legacy path therefore retains its exact historical position before personal loot. On the modern
path it is not allowed to define a composition stratum: it is retained only as a late loot-sharing
tie-break after weighted loot and known loot tiers, before exact offensive gain and stable identity.

## Data and contract

- `tools/planner-ranking-data/generate.mjs` deterministically projects the four immutable research
  datasets into `keystone-worker/src/plannerRankingDataGenerated.ts` and supports `--check` drift
  validation. Generated fallback profiles carry their archetype donors and confidence.
- `keystone-worker/src/plannerVacancyScoring.ts` owns the pure Quick/Advanced scoring and band logic;
  `keystone-worker/src/keystonePlanner.ts` integrates it into the existing solver comparator.
- `keystone-client/sidecar/team_service.py` and
  `keystone-client/src/core/keystonePlanner.ts` independently validate and allowlist the modern DTO.
- `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACT.md`, `docs/AGENT_CONTEXT.md`, the ranking-data README
  and the pending Client/Worker changeset record the durable behavior. No D1 persistence or migration
  was introduced, and Keystone Web keeps its unchanged legacy request and presentation.
- Feral uses a medium-confidence per-buff median of the covered melee/AP profiles (spec IDs 70, 71,
  72, 251, 252, 255, 259, 260, 261, 263, 269 and 577). Balance and Devastation use a
  medium-confidence caster/Intellect median; Augmentation uses the same caster donor set with low
  confidence (62, 63, 64, 258, 262, 265, 266 and 267). All are marked
  `source: archetype_estimate`, never exact SimC.
- The three new local icons are official Blizzard render assets: Battle Shout (spell 6673),
  Blessing of Sacrifice (6940) and Cleanse Toxins (440013). Their source URLs and attribution are in
  `keystone-client/src/assets/planner/SOURCES.md`; the application does not hotlink them at runtime.

## Verification

- Generated-data drift: passed.
- Worker typecheck: passed, exit `0`.
- Worker tests: passed, 231/231, exit `0`.
- Python compileall: passed, exit `0`.
- Client Python tests: passed, 115/115, exit `0`.
- Client bridge tests: passed, 66/66, exit `0`.
- Release-policy tests: passed, 51/51, exit `0`.
- Client Vitest: passed, 293/293, exit `0`.
- Client production build: passed, exit `0`; only the existing Vite chunk-size advisory remains.
- Planner Playwright file: passed, 8/8, exit `0`. Quick, Advanced, compact and exact-spec result
  screenshots were inspected manually.
- Keystone Web tests: passed, 73/73; lint and production build passed.
- Full Client Playwright run: 175/182 initially passed. The one Poison initialization failure passed
  on isolated rerun. The remaining six Void snapshot failures reproduce consistently and differ only
  in application-version text: committed baselines render `v0.10.2`, while the current package renders
  `v0.10.3`. All Planner visual tests pass, and unrelated release baselines were not rewritten.
- `git diff --check`: passed with only Git line-ending normalization notices.

## Remote operations

Deployment Impact classified the product changes as:

```text
WEB=false
WORKER=true
DB=false
CLIENT_BUILD=true
CLIENT_RELEASE=true
ADDON=false
ADDON_RELEASE=false
```

The new `tools/planner-ranking-data/**` generator and research inputs are reported as unknown paths
by the current classifier. They are build-time inputs only; the resulting checked-in Worker module
is independently classified under `WORKER=true` and validated by the drift check.

No deployment, release, tag, push, remote migration, commit or external repository write was
performed.

## Final working tree

The working tree remains intentionally dirty with the requested implementation plus the pre-existing
local work. Relevant modified files are the Worker, Client, tests and durable docs listed above;
relevant untracked files are the generated/scoring modules, tests, three icons, SDD documents,
changeset and generator. Pre-existing 2026-09-13 external-party-fill documents, other pending
changesets and Planner POC/utility tooling were left in place without cleanup.

Deliberately out of scope: Keystone Web UI changes, absolute-DPS/spec-tier ranking, Hunter's Mark,
Power Infusion, full Augmentation rotational support, new SimC runs, raw dataset edits, D1 changes
and all remote publication operations.
