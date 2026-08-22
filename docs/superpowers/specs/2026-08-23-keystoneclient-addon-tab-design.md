# KeystoneClient Addon Tab Design

## Objective

Apply the approved Addon content from `docs/ui-reference/` to the Tauri client while preserving the current global shell, header, navigation, window controls, background and footer unchanged.

## Approved Design

- Replace the centered legacy wrapper with a full-width Addon content surface inside the existing `ks-view` area.
- Reproduce the approved two-column composition: title and path/actions on the left, live addon status on the right.
- Render installed, update, cache, error and unavailable states from the real typed `AddonStatus` DTO.
- Display the real AddOns path from `WowState` and connect folder selection/opening to existing Tauri/Core APIs.
- Keep install, update, reinstall and check actions connected to the existing addon wrappers and event lifecycle.

## Architecture

- `App.tsx` passes the existing `WowState` into `AddonPage` and receives validated folder changes.
- `AddonPage.tsx` owns only Addon-tab presentation and interaction state.
- `App.css` receives Addon-specific selectors; shared shell selectors remain unchanged.
- No `/v1`, SavedVariables, Worker, D1 or Web contract changes.

## Verification

- `cd keystone-client-next; npm test -- --run`
- `cd keystone-client-next; npm run build`
- `cd keystone-client-next; npx playwright test --update-snapshots`
- Inspect installed and not-installed screenshots at 1672x941.
- Run `python scripts/deploy_impact.py --files <changed-paths> --json --strict`.

## Out Of Scope

- Header, navigation, user menu, window controls and footer changes.
- Addon updater behavior, package validation or data-contract changes.
- Tauri host self-updater or release cutover work.
