# KeystoneClient

Tauri 2 + React + TypeScript implementation of KeystoneClient.

The current public client remains the legacy build until the signed Tauri release dry-run and native upgrade gates pass. Python services under `../keystone-client/` remain the packaged sidecar and must not be removed during the UI/host cutover.

## Validation

```bash
npm run sidecar:build -- --clean
npm test
npm run build
npm run test:visual
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri:build -- --bundles nsis
```

The native NSIS output is `src-tauri/target/release/bundle/nsis/KeystoneClient_<version>_x64-setup.exe`. The production updater public key is committed in `src-tauri/tauri.conf.json`; normal build-only configuration keeps `createUpdaterArtifacts` disabled, while `scripts/tauri_release.py write-release-config` creates the temporary release overlay that enables signed updater artifacts.

Signed release and dry-run jobs require GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The private key is encrypted and stored outside the repository. Before upload, release tooling checks version and asset consistency and verifies `KeystoneClientSetup.exe.sig` against the exact installer bytes and configured public key. Tauri updater signing is separate from Windows Authenticode, which is not configured.

This tree has `CLIENT_BUILD=true` and `CLIENT_RELEASE=true`. Automatic release from `main` remains disabled unless repository variable `TAURI_CLIENT_RELEASE_ENABLED` is explicitly set to `true` after cutover approval.
