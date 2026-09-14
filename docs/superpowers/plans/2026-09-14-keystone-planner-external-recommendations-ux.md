# Keystone Planner external recommendations UX implementation plan

1. Extend generated ranking metadata with utility spell IDs and add presentation-only alternative scoring/helpers without changing comparators.
2. Add the modern-vacancy recommendations DTO to Worker output, Client types, and the sidecar sanitizer; keep legacy output unchanged.
3. Refactor the Client preview, detail vacancy card, and full modal around a shared alternative/capability presenter and official Wowhead icon tooltips.
4. Portal the modal to the document body and replace the obsolete nested-popover stacking assumptions.
5. Add focused Worker, sidecar, Client unit, and Planner visual/E2E coverage.
6. Run scoped builds/tests, inspect Quick and Advanced screenshots, check the diff and deployment impact, and report the dirty worktree without committing.
