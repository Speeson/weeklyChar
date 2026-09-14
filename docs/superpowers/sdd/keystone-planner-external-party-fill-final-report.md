# Keystone Planner External Party Fill Final Report

## Delivery

- Every compact Top 5 recommendation now renders five equal slots in the required 1 Tank / 1 Healer
  / 3 DPS shape. Missing members are shown as external role cards and do not change loot,
  objectives, or play-preference totals.
- The Worker is the sole scoring authority. It evaluates all missing roles jointly and ranks viable
  classes by Bloodlust, battle resurrection, then the shared class-buff/damage-synergy tier using
  effective DPS beneficiaries and new unique coverage.
- External alternatives are aggregated to one entry per class. Specialization IDs are not returned
  or rendered. Guaranteed capabilities rank above conditional ones.
- The Client preserves the Worker's order, shows four class icons around a centered ornamental
  question mark, localizes the `Externo`/`External` title, and opens an overflow dialog containing
  all class-only alternatives and their contributions.
- The compact layout restores clear rank/metrics spacing, uses symmetric gaps around the five-card
  grid, and splits the loot-value label over two lines.
- The additive optional `candidateClasses` field remains compatible with an older Worker; a missing
  field produces a generic external card. Nothing is persisted and no D1 migration is required.

## Contract and implementation

- `keystone-worker/src/wowComposition.ts` now tracks DPS primary-stat family independently from
  physical/magical damage profile.
- `keystone-worker/src/keystonePlanner.ts` owns role feasibility, joint completion scoring,
  class aggregation, capability availability, reasons, and deterministic ordering.
- `keystone-client/sidecar/team_service.py` and `keystone-client/src/core/keystonePlanner.ts` validate
  bounded canonical candidates while retaining the legacy vacancy shape when the field is absent.
- `keystone-client/src/pages/TeamsPage.tsx` is presentation-only and performs no local scoring.
- `docs/DATA_CONTRACT.md` and `docs/AGENT_CONTEXT.md` record the additive, derived, non-persistent
  behavior.

## Verification

- Worker `npm run typecheck`: passed, exit `0`.
- Worker `npm test`: passed, 210/210 tests, exit `0`.
- `python -m compileall -q keystone-client/sidecar scripts tests`: passed, exit `0`.
- `python -m unittest discover -s tests/client`: passed, 114/114 tests, exit `0`.
- `python -m unittest discover -s tests/client_bridge`: passed, 66/66 tests, exit `0`.
- `python -m unittest discover -s tests/release`: passed, 51/51 tests, exit `0`.
- Client `npm test`: passed, 290/290 tests, exit `0`.
- Client `npm run build`: passed, exit `0`.
- Planner visual file `npx playwright test tests/visual/teams-stone-selector.spec.ts --workers=1`:
  passed, 7/7 tests, exit `0`; the generated compact preview was inspected manually.
- Full Client Playwright run: 174/181 passed. The Planner file passed. One unrelated Poison theme
  initialization failure passed on isolated rerun; six unrelated Void screenshots consistently
  differ only in the application version text because their baselines contain `v0.10.2` while the
  current Client renders `v0.10.3`. No snapshots outside this task were updated.
- `git diff --check`: passed; Git emitted only line-ending normalization warnings.

## Deployment impact

Deterministic classification:

```text
WEB=false
WORKER=true
DB=false
CLIENT_BUILD=true
CLIENT_RELEASE=true
ADDON=false
ADDON_RELEASE=false
```

The safe publication order is Worker first and Client second. No deployment, release, tag, push,
remote migration, or commit was performed.
