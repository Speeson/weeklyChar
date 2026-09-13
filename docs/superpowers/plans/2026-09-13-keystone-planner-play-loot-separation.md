# Keystone Planner play/loot separation implementation plan

**Design:** `docs/superpowers/specs/2026-09-13-keystone-planner-play-loot-separation-design.md`

## Task 1 — Persist the independent contract

- Add failing parser/domain and route tests for separate play and character-level loot preferences,
  onboarding completion, owner isolation and legacy request conversion.
- Add migration `0011` without inferred loot interests, so existing characters start unselected,
  plus local migration validation.
- Extend owner GET/PUT atomically while retaining the legacy `loot_spec_id` mirror and response.

## Task 2 — Correct solver semantics and ranking

- Add regression tests reproducing preferred Protection losing to available Retribution because of
  loot, and prove that played spec and loot recommendation are independent.
- Add tests for available critical roles beating preferred DPS, emergency ordering, and Druid
  leather-stack versus Death Knight plate-stack tie-breaking.
- Add armor type to the central composition catalog and reorder the comparator lexicographically.
- Select primary/secondary loot objectives per character before solver enumeration.

## Task 3 — Carry the additive contract through KeystoneClient

- Extend sidecar sanitization/update handling and tests for `lootPreferences` and
  `onboardingCompleted`.
- Extend TypeScript DTO parsing, validation, data-source calls and tests without exposing tokens or
  changing the Tauri command allowlist.

## Task 4 — Implement the approved Client editor

- Replace the two-field spec popover with a direct custom availability listbox and approved icons.
- Replace active/inactive action buttons with the square loot-priority button and floating matrix.
- Enforce one primary, multiple secondary and no-interest behavior with save gating.
- Add the two-step first-use guide and persist completion with successful save.
- Preserve active/inactive drag behavior, fixed card height, theming, localization and keyboard use.

## Task 5 — Documentation and verification

- Update the active feature plan, data contract and durable context.
- Add a pending Client changeset without changing the released version.
- Run Worker typecheck/tests/local migration, Client Python/bridge/frontend/build/visual and relevant
  Rust checks.
- Review the complete diff and run strict Deployment Impact.
- Do not push, deploy, apply remote D1 migrations, tag or publish a Client release.
