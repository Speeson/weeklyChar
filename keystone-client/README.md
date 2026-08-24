# KeystoneClient

Canonical KeystoneClient product tree. React 19 and TypeScript provide the UI, Tauri 2/Rust provides the native Windows host and NSIS installer, and a PyInstaller one-file Python sidecar provides the existing domain services over a private JSONL protocol.

## Structure

- `src/`: React UI, typed controllers and generated release metadata.
- `src-tauri/`: Rust host, tray/window lifecycle, updater, icons and NSIS hooks.
- `sidecar/`: Python auth, settings, WoW, sync, character and addon services.
- `tests/visual/`: Playwright states and committed Windows snapshots.
- `VERSION`: single canonical Client version.

## Prerequisites

- Node.js 22 or newer and npm
- Python 3 with dependencies from `sidecar/requirements.txt`
- Rust stable MSVC toolchain
- Windows NSIS prerequisites installed by the Tauri toolchain
- Playwright Chromium for visual validation

## Validation

Run from the repository root:

```powershell
python -m pip install -r keystone-client/sidecar/requirements.txt
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python scripts/build_client_sidecar.py --clean
npm ci --prefix keystone-client
npm --prefix keystone-client test
npm --prefix keystone-client run build
npm exec --prefix keystone-client -- playwright install chromium
npm --prefix keystone-client run test:visual
cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml
cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml
```

For local development use `npm --prefix keystone-client run tauri:dev`. Build the real installer with:

```powershell
npm --prefix keystone-client run tauri:build -- --bundles nsis
```

The sidecar binary is written to `src-tauri/binaries/`. The NSIS installer is written to `src-tauri/target/release/bundle/nsis/KeystoneClient_<version>_x64-setup.exe`; release automation stages it as `KeystoneClientSetup.exe`.

## Compatibility And Release Contracts

`VERSION` is authoritative. `scripts/tauri_release.py` synchronizes package, Cargo, Tauri and generated release metadata. The public updater key is committed in `src-tauri/tauri.conf.json`; private signing material remains outside the repository. Production updater assets are `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig` and `latest.json`.

The Python sidecar owns `%APPDATA%\KeystoneClient`, including tokens, session/config metadata, WoW install and account selection, cached characters, addon cache/state, preferences, language and update state. These values must survive upgrades and uninstall/reinstall flows.

`src-tauri/windows/installer-hooks.nsh` preserves direct migration from the public Inno 0.3.0 AppId `{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}`. It must keep fail-closed legacy uninstall behavior, AppData preservation and autostart migration.

KeystoneClient does not package addon runtime files. `sidecar/addon_updater.py` consumes validated standalone releases from `Speeson/KeystoneSync` and owns the local recovery cache.
