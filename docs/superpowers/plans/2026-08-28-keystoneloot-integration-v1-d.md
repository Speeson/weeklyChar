# KeystoneLoot Integration V1-D Implementation Plan

**Goal:** Add the server-backed KeystoneLoot privacy control and an accessible team-keystone planner that renders V1-C recommendations without reproducing backend decisions.

**Spec:** `docs/superpowers/specs/2026-08-28-keystoneloot-integration-v1-d-design.md`

## Constraints

- V1-D changes Web, tests, and documentation only.
- The Worker remains authoritative for privacy, scoring, Voidcore, selection, tie-breaking, and statuses.
- V1-D remains uncommitted and unstaged; no remote operation is allowed.

### Task 1: Pure contract and presentation helpers

**Files:** new `keystone-web/lib/keystoneRecommendations.ts`, `keystone-web/lib/keystoneRecommendations.test.ts`, `keystone-web/lib/wowSpecs.ts`, and `keystone-web/lib/wowSpecs.test.ts`.

- [x] Add failing tests for usable-stone filtering, duplicate-dungeon preservation, deterministic sorting, summary formatting, exact-ID highlighting, known specs, and unknown fallback.
- [x] Add explicit V1-C response and planner input types.
- [x] Implement only presentation/selection helpers; verify no scoring constants or wishlist logic exist.
- [x] Run the focused Web helper tests.

### Task 2: Server-backed Settings privacy

**File:** `keystone-web/app/settings/page.tsx`.

- [x] Load the account preference from `GET /api/me` independently of local display settings.
- [x] Add the separate KeystoneLoot section with accessible loading/saving/error states.
- [x] PATCH the boolean, use the returned value, restore on failure, and keep reset local-only.
- [x] Run Web tests and lint the touched file.

### Task 3: Team planner and exact-ID highlight

**Files:** new `keystone-web/app/teams/[id]/KeystonePlanner.tsx` and existing `keystone-web/app/teams/[id]/page.tsx`.

- [x] Add the enabled/empty team-header entry point and accessible responsive dialog.
- [x] Render actual stones, selected context, all statuses, summaries, Voidcore count, loading, and retryable errors.
- [x] Abort and generation-guard stone switches; reset state across team changes.
- [x] Feed exact returned character IDs into existing member rows/cards without changing filters or ordering.
- [x] Run Web tests, lint the touched files, and production build.

### Task 4: Documentation and validation

**Files:** `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACT.md`, `docs/keystone-loot-integration-todo.md`, and final SDD report.

- [x] Document the privacy-toggle and actual-team-stone planner flow; keep V2 actual-object display mandatory and pending.
- [x] Run Worker typecheck/tests, full Web test/lint/build, and inspect scoring-logic absence.
- [x] Exercise a controlled multi-member/two-stone scenario at desktop and mobile widths, including every status and error/loading behavior.
- [x] Run strict deployment impact and final diff/status review; leave V1-D uncommitted and unstaged.
