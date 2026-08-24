---
name: keystonesync-client
description: Work on the canonical KeystoneSync Windows client, including React/Tauri, the Python sidecar, addon integration, NSIS packaging and Client releases.
---

# KeystoneSync Windows Client

## When to use

Load this skill for changes to the canonical `keystone-client/` product tree:

- React/TypeScript UI and Playwright visual states
- Rust/Tauri window, tray, lifecycle, updater and scoped navigation
- Python JSONL sidecar and domain services
- SavedVariables discovery/parsing and sync polling
- Raider.IO enrichment and Worker payload transport
- addon installer/updater and validated cache
- PyInstaller sidecar, NSIS packaging, `VERSION` and Client releases

## Architecture

`keystone-client/src/` owns presentation, `keystone-client/src-tauri/` owns the native host and installer, and `keystone-client/sidecar/` owns Python domain behavior. The host maintains one private persistent JSONL sidecar process. End users do not need Python installed.

The sidecar remains authoritative for `%APPDATA%\KeystoneClient`, authentication/session state, WoW discovery, SavedVariables parsing, synchronization, character cache, Raider.IO enrichment and addon release operations. React receives sanitized DTOs and must not bypass the bridge to access tokens, Raider.IO or the Worker directly.

KeystoneClient does not embed addon runtime files. Addon install/update consumes validated `Speeson/KeystoneSync` GitHub Release ZIPs and keeps one recovery cache under `%APPDATA%\KeystoneClient\addon-cache\`.

## Rules

1. Load `keystonesync-data-contract` for payload/schema changes and do not silently discard addon fields.
2. Preserve missing/additive SavedVariables compatibility and unknown future config keys.
3. Preserve the existing JSONL protocol unless the task explicitly changes that contract.
4. Keep network and long-running sidecar work off the UI thread and treat failures as recoverable.
5. Validate addon archive layout and versions before installation; preserve rollback and anti-downgrade behavior.
6. Do not add addon source/runtime files to the Client package.
7. Preserve `%APPDATA%\KeystoneClient` across install, update and uninstall.
8. Preserve direct migration from public Inno 0.3.0 AppId `{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}` through `src-tauri/windows/installer-hooks.nsh`; legacy uninstall failures must abort NSIS installation.
9. Keep the Tauri updater public key and canonical release assets stable.
10. Add a valid pending Client changeset for release-impacting behavior and never publish without authorization.

## Packaging And Release

`keystone-client/VERSION` is the canonical version. `scripts/tauri_release.py` synchronizes npm, Cargo, Tauri and generated release metadata.

Public artifacts are:

- `KeystoneClientSetup.exe`
- `KeystoneClientSetup.exe.sig`
- `latest.json`

`.github/workflows/build-client.yml` provides read-only build validation. `.github/workflows/release-client.yml` supports `build-only`, `release-dry-run` and `release`, retains changeset planning and resume/repair behavior, and uses `client-vX.Y.Z` tags. Tauri updater signing is Minisign-based and separate from Windows Authenticode.

## Validation

```powershell
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/release
npm ci --prefix keystone-client
npm --prefix keystone-client test
npm --prefix keystone-client run build
npm --prefix keystone-client run test:visual
cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml
cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml
python scripts/build_client_sidecar.py --clean
npm --prefix keystone-client run tauri:build -- --bundles nsis
```

Run Deployment Impact for the changed paths and require strict Client-only impact when the task is Client-scoped.
