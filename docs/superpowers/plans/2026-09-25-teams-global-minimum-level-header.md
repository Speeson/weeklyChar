# Teams Global Minimum Keystone Level Header Implementation Plan

## Task 1: Lock global filtering behavior with tests

- Cover the shared header range input and localized current value.
- Prove the minimum level filters dungeon-rail counts and selected-dungeon keystone chips in Objectives.
- Prove the same value filters Planner stone cards and clears a selected stone that falls below it.
- Preserve objective characters and objective/tier totals when only the keystone level changes.

## Task 2: Move minimum-level ownership to Teams

- Lift minimum-level state from `KeystonePlannerPanel` to `TeamsPage`.
- Filter Team-detail counts and selector availability locally from that shared state.
- Remove the old Planner-local label, slider, and helper copy.
- Keep Planner participant state and exact-stone request behavior unchanged.

## Task 3: Add the member-card carousel and align the header

- Wrap the existing member strip with contextual previous/next controls.
- Add keyboard, pointer-drag, trackpad/native scrolling, resize observation, and accessible labels.
- Preserve member-card dimensions and selected/unavailable/pinned presentation.
- Add the vertical separator and compact two-row minimum-level control at the far right.
- Remove the member strip's vertical offset so cards align with the Team picker.

## Task 4: Validate and document release impact

- Run focused Teams tests, the complete Client frontend suite, and the frontend build.
- Run focused Teams visual tests and inspect updated screenshots where available.
- Review the complete diff for scope, accessibility, and regressions.
- Update the pending Client changeset and final SDD report.
- Run strict Deployment Impact classification without performing remote operations.
