# KeystoneClient Block 3 Release Cutover Plan

1. Add version synchronization and release-manifest helpers with Python tests.
2. Rename the Tauri product identity to `KeystoneClient`, align current manifests to `0.3.0`, and configure NSIS/updater capabilities.
3. Add Tauri updater/process dependencies and register the plugins in Rust.
4. Implement the typed React updater controller, startup check, settings controls, progress modal, explicit relaunch and controlled errors.
5. Implement the one-time post-update changelog and tests.
6. Replace legacy installer jobs in client build/release workflows with sidecar plus Tauri validation and NSIS packaging.
7. Generate and validate `latest.json`, preserve the canonical `KeystoneClientSetup.exe` asset, signature asset and resumable release behavior.
8. Update deployment-impact classification and durable migration documentation.
9. Run Python, npm, Playwright, Rust, sidecar, Tauri package and deployment-impact validation.
10. Run the GitHub Actions release dry-run when remote execution and signing secrets are available; stop before client tag/release publication.
