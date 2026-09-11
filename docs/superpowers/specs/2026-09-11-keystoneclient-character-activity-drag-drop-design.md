# KeystoneClient Character Activity Drag-and-Drop

## Objective

Make Active/Inactive card movement work in the real Windows client and reuse the same interaction in Characters. Inactivity in Characters is a local presentation preference: snapshots continue to synchronize and no Worker, D1, Web, addon, or shared payload contract changes.

## Approved design

- Disable Tauri's native file-drop interception for the main WebView so frontend HTML5 drag events work on Windows.
- While a card is being dragged, render it at 50% opacity with a subtle blur until drop or cancellation.
- Planner configuration keeps its accessible Activate/Deactivate buttons and supports dragging in both directions.
- Characters divides the current account/realm list into Active and Inactive zones. Cards can be dragged or moved with an accessible button.
- Inactive character cards remain visible in the lower zone, appear darkened, and do not become the default selected character while an active character exists.
- Persist inactive character IDs in versioned, defensively parsed localStorage. Missing or invalid state means every character is active.

## Architecture

- `src-tauri/tauri.conf.json`: set `dragDropEnabled: false` for HTML5 drag-and-drop on Windows.
- `src/core/characterTracking.ts`: local preference parsing and persistence only.
- `src/pages/CharactersPage.tsx` and `src/App.css`: zones, movement, selection fallback, drag feedback, and themed inactive state.
- `src/components/PlannerPreferencesModal.tsx`: shared 50% drag feedback and reliable drop cleanup.

The character snapshot and transport DTO remain unchanged. Inactive IDs never enter sidecar, Worker, D1, Web, or addon data.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `npm --prefix keystone-client run test:visual`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- Real Tauri no-bundle build and portable launch.
- Deployment Impact strict classification.

## Out of scope

- Deleting characters or stopping their synchronization.
- Changing team Planner preferences or the Worker contract.
- Synchronizing inactive UI choices between devices.
- Reordering cards within the same zone.
