# KeystoneClient Window Sizing Report

## Delivered

- The Windows client chooses its initial size from the current monitor's usable area, preserving the existing maximum canvas size.
- Settings persists an optional window proportion lock. The default remains free resizing with the existing background behavior.
- The locked mode constrains Windows drag rectangles for all edges and corners, including non-client frame offsets, and uses a readable minimum.
- Spanish and English labels, a Client changeset, and focused persistence, UI, and native geometry tests were added.

## Validation

- `python -m compileall -q keystone-client/sidecar scripts tests`: passed.
- `python -m unittest discover -s tests/client_bridge`: 67 passed.
- `python -m unittest discover -s tests/client`: 119 passed.
- `npm --prefix keystone-client test`: 338 passed.
- `npm --prefix keystone-client run build`: passed.
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`: passed.
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`: passed.
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`: 27 passed.
- The three changed Settings visual snapshots were regenerated and verified. A Full HD sized preview also confirmed the new checkbox and Save action remain reachable.
- The broader visual suite had 179 passes and five old Void version-text snapshot differences; the new Full HD preview test passed separately.

## Remaining Limitation

- A physical mouse drag in the packaged Windows application remains to be checked manually. Five unrelated Void snapshots in the broader visual run differ because they still show Client version 0.10.3 rather than the current 0.13.1.
