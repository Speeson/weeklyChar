# Keystone Planner functional Top 5 implementation plan

**Design:** `docs/superpowers/specs/2026-09-13-keystone-planner-ranking-preview-live-recalculation-design.md`

## Task 1 — Protect functional diversity in the Worker

- Add combat style to the central specialization catalog.
- Add regression fixtures for same-profile specializations and meaningful melee/ranged alternatives.
- Filter canonical ranked results by functional identity before applying the Top 5 cap.
- Keep exact fingerprint deduplication and deterministic ordering.

## Task 2 — Make Client priority changes safe and live

- Reproduce the released synthetic-event read that blanks WebView2.
- Capture checkbox values synchronously.
- Preserve existing results, debounce option changes and recalculate with the latest request.
- Retain generation-based stale-response rejection and add `Recalculate Top 5`/loading copy.

## Task 3 — Implement the approved assignment visuals

- Add played-spec and loot-spec treatments to compact previews with username and accessible labels.
- Move the owner crown to an overlaid top-left position in compact cards and inside the top-right
  corner in expanded cards.
- Add role artwork/glow to both views and keep expanded objective rows uninterrupted and centered.
- Update theme-safe CSS and minimum-viewport behavior.

## Task 4 — Document and validate

- Update the active Planner plan and confirm that the existing public data contract remains unchanged.
- Add a pending Client changeset.
- Run targeted and complete Worker/Client validations plus visual review.
- Self-review the diff and run strict Deployment Impact.
- Do not push, deploy, migrate, tag or publish.
