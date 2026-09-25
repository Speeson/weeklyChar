# KeystoneClient Teams Global Minimum Keystone Level Header Design

## Objective

Move the existing minimum-keystone-level control from the Planner sidebar into the shared Teams
member header so one visible setting governs keystone availability in both Objectives and Planner.
Make member cards horizontally browsable without changing their dimensions, and align them with
the Team picker.

## Approved Design

- The far-right side of the Team/member header contains a compact framed two-row card, without a
  standalone vertical separator. Its emphasized title row contains `Nivel mínimo de piedras` and
  the current `+N` value above the range input.
- The minimum level defaults to `+10`, remains in the `1` to `20` range, and is shared while Teams
  stays mounted, independently of the selected Team, dungeon, or Objectives/Planner tab.
- Dungeon-rail counts, selected-dungeon owner chips, and Planner stone cards include only keystones
  whose level is at least the selected minimum. Objectives and their item totals are not removed by
  the level control because they describe dungeon loot, not a particular keystone level.
- Raising the minimum above the currently selected Planner stone clears that exact-stone selection
  and any stale recommendation result.
- Member cards keep their current size and visual treatment. Their strip supports horizontal
  trackpad/native scrolling, pointer dragging, keyboard scrolling, and contextual previous/next
  arrow buttons matching the keystone-chip carousel interaction.
- Member cards align vertically with the Team picker and remain fully visible; the strip no longer
  adds the vertical offset that currently places them lower than the picker.
- Spanish and English labels remain available through the existing client localization layer.

## Architecture

- `TeamsPage` owns the minimum-level state and passes it into the shared member header and Planner.
- Local presentation helpers filter selector stone availability and Team-detail keystone counts.
  No Worker request, sidecar bridge, persisted setting, or API response type changes.
- `MemberStrip` owns only its carousel refs and interaction state; Objectives and Planner member
  selections remain independent as before.

## Verification

- `npm --prefix keystone-client test -- TeamsPage.test.tsx`
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- Focused Playwright coverage for the Teams header, both feature tabs, overflow controls, minimum
  viewport, and the Keystone, Poison, and Void themes.
- `python scripts/deploy_impact.py --json --strict --files <changed-paths>`

## Out Of Scope

- Persisting the minimum level across client restarts.
- Filtering objective item cards or objective/tier totals by keystone level.
- Planner solver, Worker, D1, Web, addon, team-membership, or seasonal dungeon changes.
