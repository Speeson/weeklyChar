# KeystoneClient Block 2 Desktop UX Final Report

## Delivered

- Frameless Tauri window with scoped drag regions, real native minimize, separate tray hiding and one controlled close-choice flow for the custom X and native close requests.
- Clean explicit exit for the close dialog and tray, with blocking sidecar requests off the UI thread and a scoped Rust tray-hide command, preserving the historical `minimize_on_close` config key without exposing misleading UI.
- Polished profile dropdown, outside-click/Escape behavior and authenticated character-derived avatar selection through the existing `/api/me/avatar` route.
- Finished login screen, internal account registration through the existing Worker contract and first-run WoW installation/account onboarding over the existing Python services.
- Responsive logout that renders login immediately and persists anonymous state before waiting for synchronization cleanup.
- Non-blocking sync event dispatch so force-sync responses and React status animation are independent of Windows tray menu updates.
- KeystoneClient native icon set generated from the approved high-resolution app artwork and explicitly assigned to the Windows tray.
- Real Tauri autostart, dynamic ES/EN tray state and centralized application-wide ES/EN first-party translations.
- Internal character-table scrolling beyond eight rows, card spacing/typography polish and deterministic previews for all new surfaces.

## Automated verification

- Python compileall: PASS.
- Python client tests: 73 PASS.
- Python bridge tests: 57 PASS.
- React/Vitest: 86 PASS across 22 files.
- Playwright visual tests: 18 PASS; all changed screenshots inspected, including registration at full and minimum client sizes.
- Rust formatting/check/tests: PASS; 22 tests.
- Sidecar PyInstaller build and JSONL smoke test: PASS.
- Legacy Python client PyInstaller build: PASS.
- Tauri Release executable and NSIS production bundle: PASS.
- MSI payload/link: PASS with WiX ICE validation skipped because the local Windows Installer service rejected ICE01-ICE09 (`LGHT0217`/`LGHT0216`). Re-run the standard MSI bundle on a healthy Windows Installer host before release.
- Deployment Impact strict classification: client build and eventual client release required; no Web, Worker, D1 or addon deployment required.

## Local artifacts

- `keystone-client-next/src-tauri/target/release/keystone-client-next.exe`
- `keystone-client-next/src-tauri/target/release/bundle/msi/KeystoneClient Next_0.1.0_x64_en-US.msi` (linked with WiX `-sval`; requires normal ICE validation before release)
- `keystone-client-next/src-tauri/target/release/bundle/nsis/KeystoneClient Next_0.1.0_x64-setup.exe`
- `keystone-client/dist/KeystoneClient.exe`

## Native manual verification

Native desktop interaction is not automated in this checkout. Before release cutover, verify against an isolated test profile:

1. Confirm no Windows title bar is shown and only empty/logo areas drag the window.
2. Confirm custom minimize goes to the taskbar while footer minimize and close-dialog minimize hide to the tray.
3. Confirm Alt+F4 opens one close dialog; Escape cancels; confirmed exit leaves no client or sidecar process.
4. Confirm tray state, Sync now, show/focus, Web and exit actions in authenticated and anonymous states.
5. Toggle autostart on/off in Settings, verify Windows startup state, then verify start-minimized after a Windows sign-in.
6. Launch a second instance and confirm it restores/focuses the existing instance.

No commit, push, tag, release, deployment, database migration, version bump or updater/cutover work was performed.
