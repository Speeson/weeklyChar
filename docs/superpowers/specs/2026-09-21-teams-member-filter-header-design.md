# KeystoneClient Teams Member Filter And Header Design

## Objective

Make the Teams member cards explicit selection controls in both views, while changing Objectives from visual emphasis to a real member filter and simplifying the selected-dungeon header.

## Approved Design

- Objectives starts with every team member selected. Toggling a member removes or restores that member's characters, keystones, objectives, and contribution to every visible Objectives count. Selecting no members shows the existing empty state with zero summary counts.
- Planner keeps its current participant-selection rules, five-member limit, owner pinning, readiness checks, and request payload. Objectives and Planner selections are independent so filtering Objectives cannot preselect or remove Planner participants.
- Selected member cards in both views receive a clearly visible border, tinted surface, and glow in addition to the existing checkmark. Unselected cards keep the current neutral treatment.
- The selected-dungeon header removes the redundant dungeon name and textual keystone count. Available keystone owners are rendered as chips containing `Character (username)`, with the chip tinted using the owning character's WoW class color and the character name at the former dungeon-title size.
- The character/objective total and objective-category breakdown remain separate sections, but are grouped at the far right with no expanding content between them.
- In Objectives, header chips and both summary sections use the filtered member set. In Planner, they continue to describe the unfiltered selector response so Planner behavior remains unchanged.

## Architecture

- `TeamsPage` owns separate Objectives and Planner member sets.
- Pure frontend helpers filter `KeystoneSelectorResponse` data and recompute character, objective, and tier totals without changing the API response or transport types.
- Keystone chip class colors are resolved from the already-loaded team-detail characters by `characterId`; no Worker, D1, Web, sidecar, addon, or protocol change is required.
- Existing accessibility contracts remain: member controls expose `aria-pressed`, chips preserve readable text, and empty filtered results use the existing Objectives empty state.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- Focused Playwright screenshots for the Teams Objectives and Planner states in Keystone, Poison, and Void.
- Manual verification of default selection, filtering, independent Planner selection, selected-card glow, header chips, and right-aligned summaries.
- Strict Deployment Impact classification for all changed paths.

## Out Of Scope

- Planner solver or API behavior, backend filtering, persistence of member filters across restarts, Web Teams UI, Worker/D1 changes, addon changes, and changes to dungeon cards in the left rail.
