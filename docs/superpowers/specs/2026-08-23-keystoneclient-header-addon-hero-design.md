# KeystoneClient Header, Addon Summary, And Hero Design

## Objective

Remove duplicated synchronization information from the summary row and refine the header and right hero area with the supplied KeystoneClient assets, without changing the main screen structure.

## Approved Design

- The first summary card tracks the current Addon state instead of synchronization state.
- Addon status changes from Core update the summary card without requiring a restart.
- The brand area gains breathing room before the tabs and uses the same sans-serif typography as the application.
- The user control uses `13-current-status-panel-frame`, `26-avatar`, the authenticated character avatar, username, and `25-dropdown-icon`.
- `14-user-dropdown-shell` is removed.
- The settings control renders only `03-settings-button`, without an additional CSS frame or Lucide gear.
- The right artwork area uses `09-right-hero-panel-frame` with `21-app-icon-hd` centered inside it.
- Existing header, content, sidebar, version panel, and footer ordering remains unchanged.

## Architecture

- `App.tsx` keeps its Addon status synchronized from existing Addon Core events and passes it to `SyncPage`.
- `SyncPage.tsx` maps `AddonStatus` to compact card metadata.
- `KeystoneShell.tsx` owns the asset composition for the header controls.
- `App.css` adapts the assets to the existing fixed logical canvas.
- No Core protocol, API, or data contract changes are required.

## Verification

- `npm test -- --run`
- `npm run build`
- `npx playwright test`
- Inspect full-size, reduced-size, Addon-current, and settings screenshots.

## Out Of Scope

- Reordering the main application layout.
- Changing authentication or avatar selection behavior.
- Changing Addon install/update logic.
