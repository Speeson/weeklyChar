# Teams Member Filter And Header Implementation Plan

## Task 1: Lock the member-selection behavior with tests

- Add coverage for all members selected by default in Objectives.
- Add coverage proving deselected members and all their characters disappear rather than becoming muted.
- Add coverage for filtered keystones and recomputed character, objective, and tier totals.
- Add coverage proving Planner keeps an independent participant set and its existing constraints.
- Run the focused Teams tests.

## Task 2: Implement independent Objectives filtering

- Split Objectives and Planner selection state.
- Initialize Objectives from every member of the selected team.
- Filter selector characters and stones locally and recompute the visible Objectives summary.
- Preserve the existing empty state when no selected member contributes data.
- Run the focused Teams tests.

## Task 3: Strengthen selected-member presentation

- Add a selected border, surface tint, and glow to member cards in both views.
- Preserve unavailable and pinned Planner states.
- Run the focused Teams tests and frontend build.

## Task 4: Redesign the selected-dungeon header

- Remove the redundant dungeon title and textual stone count.
- Render class-colored `Character (username)` owner chips.
- Align the total and category summaries together at the far right.
- Add or update focused component and visual coverage.
- Run frontend tests, build, and focused visual tests.

## Task 5: Review and manual validation checkpoint

- Review the complete diff for client-only scope and accessibility.
- Run strict Deployment Impact classification.
- Stop for manual validation of Objectives filters, Planner selection, glow states, chips, summaries, resizing, and all three themes before any further action.
