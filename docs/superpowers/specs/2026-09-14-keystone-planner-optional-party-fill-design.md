# Keystone Planner Optional Party Fill Design

## Objective

Allow KeystoneClient users to choose whether Planner recommendations are completed with external
players, while keeping the Planner sidebar visually stable when switching between Quick and
Advanced modes.

## Approved design

- Add an enabled-by-default `Rellenar la composición` switch immediately above the Quick/Advanced
  selector. When enabled, the current external completion and recommendation behavior is unchanged.
- When disabled, the Worker ranks only the selected Team members and returns no vacancies or
  external recommendations. Internal role, composition, loot, tier and stable priorities still
  apply; Quick/Advanced priorities score the selected party itself.
- When disabled, compact recommendation cards keep their normal five-member width but center the
  visible incomplete party as one horizontal group instead of leaving all missing slots at the end.
- Extend only the modern request with additive `fillComposition`. The Worker also accepts the
  previous seven-key modern shape and treats a missing value as `true`, preserving deployed Client
  compatibility. The exact legacy request and comparator remain unchanged.
- Detail cards retain role grouping but center incomplete rows: one tank/healer card is centered,
  two remain symmetric; one DPS is centered, two form a centered pair, and three fill the row. When
  exactly two cards occupy the same role row (Tank + Healer or two DPS), that row is also centered
  vertically; mixed upper/lower pairs and all default role positions remain unchanged.
- The sidebar remains internally scrollable without a visible scrollbar. A bottom overlay arrow is
  shown only while more content exists below; activating it scrolls to the bottom and it disappears
  there. Keyboard and wheel scrolling remain available.

## Architecture

`TeamsPage` owns the local switch and scroll affordance. The TypeScript bridge request and Python
sidecar validate and forward `fillComposition`; the Worker remains the only ranking authority. No
D1 persistence, addon data, or Web contract changes are required.

## Verification

- Worker request/parser and solver tests for omitted, enabled and disabled fill.
- Sidecar and TypeScript request validation tests.
- React tests for switch placement, outgoing value, hidden scrollbar arrow behavior and centered
  incomplete role rows.
- Client build and focused Planner Playwright coverage.
- Worker typecheck/tests, Client Python/bridge tests, frontend tests/build, diff check, and Deployment
  Impact classification.

## Out of scope

- Changing external scoring or equivalence-band thresholds when fill is enabled.
- Persisting the switch across application restarts.
- Keystone Web UI changes, D1 migrations, deployment, executable generation, releases or pushes.
