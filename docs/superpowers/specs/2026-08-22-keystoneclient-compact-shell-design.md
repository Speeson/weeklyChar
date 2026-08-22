# KeystoneClient Compact Shell Design

## Objective

Align the Tauri client window with the legacy client's measured `940 x 534` geometry and remove avoidable vertical space while preserving all existing client actions.

## Approved Design

- Use a fixed `940 x 534` Tauri window, matching the legacy calculation for the current `bg.jpg` (`940 x 418` content plus `58 px` header and footer).
- Keep synchronization content in a compact horizontal layout at that size.
- Contain the application version panel inside the upper emblem panel and render `22-version-icon.png`.
- Layer `11-footer-shell.png.png` below `04-footer-decoration.png.png` in the footer.
- Render the user control with `14-user-dropdown-shell.png.png`, the avatar inside `26-avatar.png`, and `25-dropdown-icon.png` at the right.
- Remove the inline logout icon and keep logout inside the user dropdown.
- Render window minimize and close controls directly from assets `15` and `16`, without duplicate Lucide/text glyphs.

## Architecture

- `src-tauri/tauri.conf.json` owns native window dimensions.
- `src/components/KeystoneShell.tsx` owns header, user menu, window controls, and footer asset composition.
- `src/pages/SyncPage.tsx` owns the nested emblem/version composition.
- `src/App.css` owns compact geometry and asset layering.
- No Core command, authentication DTO, synchronization contract, or `/v1` API changes are required.

## Verification

- `cd keystone-client-next; npm test`
- `cd keystone-client-next; npm run build`
- `cd keystone-client-next; npm run test:visual`
- Playwright viewport and document bounds must both be `940 x 534` with no page overflow.
- `python scripts/deploy_impact.py --json --strict --files <changed-paths>`

## Out Of Scope

- Redesigning the Addon page or settings dialogs.
- Changing synchronization, authentication, tray, or updater behavior.
- Releasing, deploying, committing, or publishing the client.
