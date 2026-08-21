---
name: keystonesync-client
description: Work on the KeystoneSync Windows client, SavedVariables parsing, Raider.IO enrichment, addon installation, PyInstaller/Inno packaging and client releases.
---

# KeystoneSync Windows Client

## When to use

Load this skill for changes under the current Windows client, including:

- Python client code
- Tkinter UI
- tray behavior
- SavedVariables discovery/parsing
- sync polling
- Raider.IO enrichment
- API payload creation
- Worker API transport
- addon installer/updater
- PyInstaller
- Inno Setup
- `VERSION`
- client GitHub releases

## Architectural role

The client bridges local WoW SavedVariables and the remote KeystoneSync API.

Typical flow:

```text
SavedVariables
 ↓
parse
 ↓
optional Raider.IO enrichment
 ↓
payload
 ↓
Worker API
```

Current implementation uses Python, `slpp` parsing, Raider.IO enrichment, Tkinter/tray UI, the configured Worker API URL, and a remote-release addon updater.

KeystoneClient does not embed KeystoneSync addon runtime files. Addon installation/update is based on validated GitHub Release ZIP assets from `Speeson/KeystoneSync`.

## Rules

1. Do not silently discard addon fields.
2. Load `keystonesync-data-contract` for payload/schema changes.
3. Keep parsing resilient to missing/additive SavedVariables fields.
4. Preserve compatibility with existing user configuration where practical.
5. Treat network failures as recoverable.
6. Do not block the UI thread with long-running sync/update operations.
7. Validate addon paths before installing/updating.
8. Do not add addon source/runtime files to the Client package.
9. Keep release asset compatibility with the Web download link.
10. Do not release without explicit authorization.

## Packaging

Current release tooling may include:

- PyInstaller
- Inno Setup
- `VERSION`
- installer scripts

When changing packaging, confirm:

- generated executable location;
- bundled resource paths;
- absence of addon runtime files;
- installer output name;
- expected public GitHub release asset name.

Public installer compatibility target:

`KeystoneClientSetup.exe`

Versioned workflow:

- `.github/workflows/build-client.yml` builds the Windows installer on `windows-latest` for validation/orchestration with read-only permissions.
- `.github/workflows/release-client.yml` builds the Windows installer and can publish a release when manually run with `publish_release=true`.
- It uploads `KeystoneClientSetup.exe` as a workflow artifact.
- It publishes a GitHub Release only when manually triggered with `publish_release=true`.
- Client release tags use the existing `client-vX.Y.Z` convention from `keystone-client/VERSION`.

## Addon updater

Remote addon updating is implemented in `keystone-client/addon_updater.py`.

KeystoneClient checks `Speeson/KeystoneSync` stable GitHub Releases in the background and updates the UI, but install/update/reinstall always requires a user click. Validated release ZIPs are cached under `%APPDATA%\KeystoneClient\addon-cache\` for recovery.

When working on addon update support:

- compare installed/latest versions with semantic version rules;
- validate downloaded archive layout and `.toc` version consistency;
- use safe replacement through `addon_installer.install_from_source`;
- avoid partial installation and preserve rollback behavior;
- keep anti-downgrade behavior for cached packages;
- handle offline/network failure gracefully;
- run updater tests in `tests/client/test_addon_updater.py`.

## Validation

Relevant checks include:

- `python -m compileall -q keystone-client scripts`
- `python -m unittest discover -s tests/client`
- PyInstaller build
- installer build on Windows
- manual SavedVariables sync test
