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

Current implementation uses Python, `slpp` parsing, Raider.IO enrichment, Tkinter/tray UI, and the configured Worker API URL.

The bundled addon directory `keystone-client/addon/KeystoneSync/` is generated packaging content synchronized from external `Speeson/KeystoneSync`. Do not edit it directly.

## Rules

1. Do not silently discard addon fields.
2. Load `keystonesync-data-contract` for payload/schema changes.
3. Keep parsing resilient to missing/additive SavedVariables fields.
4. Preserve compatibility with existing user configuration where practical.
5. Treat network failures as recoverable.
6. Do not block the UI thread with long-running sync/update operations.
7. Validate addon paths before installing/updating.
8. Use `scripts/sync_addon.py` and `scripts/check_addon_sync.py` when client packaging depends on addon bundle freshness.
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
- addon resource inclusion;
- installer output name;
- expected public GitHub release asset name.

Public installer compatibility target:

`KeystoneClientSetup.exe`

Versioned workflow:

- `.github/workflows/release-client.yml` builds the Windows installer on `windows-latest`.
- It uploads `KeystoneClientSetup.exe` as a workflow artifact.
- It publishes a GitHub Release only when manually triggered with `publish_release=true`.
- Client release tags use the existing `client-vX.Y.Z` convention from `keystone-client/VERSION`.

## Addon updater

Remote addon updating is future Phase 11 work, not current behavior.

When working on remote addon update support:

- compare installed/latest versions;
- validate downloaded archive layout;
- use safe replacement;
- avoid partial installation;
- retain bootstrap behavior if the client installer includes an addon;
- handle offline/network failure gracefully.

## Validation

Relevant checks include:

- `python -m compileall -q keystone-client scripts`
- `python -m unittest discover -s tests/client`
- PyInstaller build
- installer build on Windows
- manual SavedVariables sync test
