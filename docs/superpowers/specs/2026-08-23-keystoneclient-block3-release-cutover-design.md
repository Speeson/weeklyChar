# KeystoneClient Block 3 Release Cutover Design

## Objective

Replace the legacy Tkinter public build and release path with the existing Tauri v2 application while preserving the Python sidecar domain services and `%APPDATA%\KeystoneClient` data.

## Product And Version Identity

- Public product name: `KeystoneClient`.
- Stable Tauri identifier: `dev.esgarpe.keystoneclient`.
- Canonical version source: `keystone-client/VERSION`.
- Current public version: `0.3.0`; pending minor changesets plan `0.4.0`.
- Manual Windows release asset: `KeystoneClientSetup.exe`.
- Windows bundle target: NSIS.

The release tooling must validate that npm, Cargo and Tauri versions match the canonical version before a build. Release dry-runs and releases synchronize all four files to the planned version before compiling.

## Updater Architecture

Use the official Tauri v2 updater and process plugins. Production builds receive the updater public key through CI and enable signed updater artifacts. The private key is only read from `TAURI_SIGNING_PRIVATE_KEY`; it is never written to the repository or emitted to logs.

The client reads `https://github.com/Speeson/weeklyChar/releases/latest/download/latest.json`. The manifest contains the release version, publication date, release notes and the signed Windows NSIS download. Release publication uploads the manual installer, its updater signature and `latest.json` in one release operation.

React owns a typed updater controller with these states: `idle`, `checking`, `current`, `available`, `downloading`, `installing`, and `error`. It checks once after startup, supports a manual settings check, reports download progress, displays sanitized plain-text release notes, and only installs/relaunches after explicit confirmation.

## Changelog

After startup, a successful version transition is detected from a small local marker. The release notes embedded at build time are shown once for that installed version and the marker is persisted after dismissal. Preview/browser mode uses local storage; the Tauri build uses the same non-sensitive marker without changing the Python configuration contract.

## CI/CD Cutover

`build-client.yml` and `release-client.yml` build the Python sidecar, test React and Rust, then package the Tauri NSIS installer. Release modes remain `build-only`, `release-dry-run`, and `release`; release state remains resumable and publication remains atomic with the version commit/tag. The release workflow generates `latest.json` from validated artifacts and signatures.

Build-only validates the current canonical version. Dry-run plans the next version and builds exactly what a release would build, but uploads Actions artifacts only. Public release and tag creation remain behind the existing explicit release gate.

## Security And Failure Handling

- Updater signatures are mandatory in production.
- Missing or malformed signing inputs fail release builds before packaging.
- Release notes render as text, not HTML.
- Network, manifest, signature, download and install failures become controlled UI errors.
- No Worker, D1, addon gameplay, auth, sync or sidecar protocol changes are part of this block.

## Acceptance

The block is ready only when local Python/React/Rust tests pass, a clean sidecar and Tauri package build succeeds, version and manifest contract tests pass, and a GitHub Actions `release-dry-run` succeeds with configured signing secrets. A public client release still requires a separate final authorization.
