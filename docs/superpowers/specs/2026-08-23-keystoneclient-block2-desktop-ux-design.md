# KeystoneClient Block 2 Desktop UX Design

## Objective

Complete the local Tauri/React desktop experience with frameless native window behavior, controlled shutdown, profile avatar selection, first-run WoW onboarding, native autostart/tray integration, and application-wide Spanish/English localization without changing the approved Sync/AddOn composition or Block 1 data flow.

## Approved design

- Keep the current dark blue, slate and gold KeystoneClient shell, assets, dimensions and proportional scaling.
- Add only the requested modal, login, onboarding, account selector and avatar-picker surfaces in the same visual language.
- Tighten Sync summary-card icon/text spacing and keep character overflow inside the table body.
- Remove native decorations in Tauri configuration and use explicit header drag regions without covering interactive controls.

## Architecture

- Rust/Tauri owns window visibility, native minimize, close-request interception, explicit process exit, tray, external URLs and OS autostart.
- React owns the close-choice modal, onboarding route, avatar picker and localized first-party presentation.
- The Python sidecar remains the only owner of authentication, WoW discovery/account persistence, synchronization and authenticated profile API calls.
- Add a scoped `profile.set_avatar` JSONL command that validates the selected URL against the user's character state and reuses `PATCH /api/me/avatar`. No token reaches React.
- The existing `minimize_on_close` config key remains readable/writable for compatibility but is no longer surfaced or used by Tauri to silently hide the window.
- No Worker/D1 schema or public tracked-character contract changes.

## Verification

- `python -m compileall -q keystone-client scripts`
- `python -m unittest discover -s tests/client`
- `python -m unittest discover -s tests/client_bridge`
- `cd keystone-client-next; npm test`
- `cd keystone-client-next; npm run build`
- `cd keystone-client-next; npm run test:visual`
- `cd keystone-client-next/src-tauri; cargo fmt --check; cargo check; cargo test`
- `cd keystone-client-next; npm run tauri:build`
- `git diff --check`
- Deployment Impact in strict JSON mode for every implementation batch and the final file set.

## Out of scope

- Tauri updater, changelog, release cutover, public installer migration and version changes.
- WoW Phase 12 / Midnight Season 2 data changes.
- Worker/D1 schema changes, deployment, release, tag, commit or push.
