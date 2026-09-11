# KeystoneClient Planner configuration implementation plan

**Design:** `docs/superpowers/specs/2026-09-11-keystoneclient-planner-configuration-design.md`

## Task 1 — Expose privacy-safe Team readiness

- Add failing Worker route tests requiring `plannerConfigured` on every Team-detail member.
- Compute the boolean from at least one valid, non-disabled owned character preference.
- Keep Team list and invitation DTOs unchanged; expose no preference details.
- Run Worker typecheck and focused/full route tests.

## Task 2 — Add owner preference transport to KeystoneClient

- Add failing Python service and bridge tests for authenticated GET/PUT preference commands.
- Add strict sanitization for owner preferences and request validation for full replacement saves.
- Add commands to the protocol-v1 sidecar handler and Rust allowlist.
- Add failing TypeScript parser/data-source tests, then implement typed GET/PUT helpers.
- Preserve React → Tauri → sidecar → Worker and keep bearer tokens private.

## Task 3 — Implement required configuration editor

- Add a local supported specialization catalog consistent with the verified Worker catalog.
- Add tests for four-state editing, same-class loot specs, valid-save gating and initial values.
- Implement the approved character-card modal and persistent configuration action.
- Open it automatically in Planner mode when the current user is unconfigured; block only Planner
  interaction and keep normal navigation available.

## Task 4 — Make availability selection and planning automatic

- Add tests for active-feature-aware member selection, five-member cap, unconfigured members,
  pinned owner and empty `locks`.
- Preserve Objectives member filtering unchanged.
- Remove participant and role-lock controls from the left Planner column.
- Keep selected member IDs as required participants and let the Worker select character/spec/role.

## Task 5 — Apply the approved visual refinement

- Bundle stable local dungeon/capability artwork and official WoW role art with source attribution.
- Keep the existing Team selector component unchanged; align the member strip to it.
- Implement the approved themed level filter, stone cards, priority rows and compact switches with
  comfortable inset spacing in every theme.
- Implement class-tinted Top 5 assignment cards with circular avatars, class/spec labels, official
  role icons, larger owner crown and Team-selector-style disclosure control.
- Preserve the exclusive accordion and expanded trapezoid composition.

## Task 6 — Integration, documentation and local executable

- Update `docs/DATA_CONTRACT.md`, `docs/AGENT_CONTEXT.md`, the active feature plan and pending Client
  changeset without changing released versions.
- Run Worker, Python, bridge, frontend, visual, Rust and sidecar validations required by `AGENTS.md`.
- Run Deployment Impact for every changed path.
- Build and smoke a direct local `KeystoneClient.exe` plus its adjacent sidecar for user review.
- Do not deploy Worker, publish Client, push, tag or create a release.
