# Poison Addon Geometry Rebuild

## Objective

Rebuild the Poison Addon composition so the existing Keystone semantic layout defines every interactive box and Poison PNG artwork is fitted from measured alpha bounds. Preserve all Addon behavior and keep Keystone pixel-identical.

## Approved design

- Keep one shared `AddonPage`; Poison remains registry- and CSS-driven.
- Use Keystone DOM geometry as the baseline for heading, path controls, action regions and status rows.
- Give every Poison button a semantic wrapper and per-asset text safe area.
- Fit decorative artwork inside those wrappers without clipping or uncontrolled overflow.
- Render the divider through a narrow semantic wrapper whose placement compensates for its transparent raster margins.
- Preserve semantic success, warning and error colors.

## Architecture

Changes are limited to Addon presentation, the existing theme asset registry/markup where required, and Playwright/Vitest coverage. No bridge, sidecar, Rust, API, data-contract or business-logic behavior changes.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- focused Poison Addon Playwright geometry/review tests
- Keystone `preview.spec.ts` visual baseline
- full Playwright without snapshot update
- Cargo format/check/tests
- strict Deployment Impact
- manual inspection of fresh `.tmp/poison-addon-review-v2/` captures

## Out of scope

- Golden snapshot updates
- Sync/header/footer redesign
- Version, release, deployment or remote operations
