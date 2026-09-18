# KeystoneClient Window Sizing Design

## Objective

Choose an initial client size from the current monitor's usable area and let users optionally keep the client canvas ratio while dragging window edges or corners.

## Approved Design

- On launch, size the window to at most the existing 1672×941 canvas and about 80% of the monitor work area. Preserve the existing initial size on sufficiently large displays.
- Leave free resizing as the default. It keeps the current centered canvas and background fill.
- Add a saved Settings checkbox to lock the window to the 1672:941 ratio. In locked mode, Windows constrains the proposed window rectangle during the native drag. A readable minimum of approximately 1280×720 logical pixels applies; turning the option off restores the existing 940×529 minimum.
- The canvas continues to scale uniformly inside the window. The current background and page layouts stay intact.

## Architecture

- Tauri owns startup monitor sizing and the Windows sizing hook. The UI invokes a scoped native command when the saved preference changes.
- The Python sidecar adds one boolean to its existing settings whitelist and `config.json`; no JSONL protocol version or network API changes.
- React Settings exposes the checkbox in Spanish and English. Existing free resizing remains the fallback if the setting is absent.

## Verification

- `python -m unittest discover -s tests/client_bridge`
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- Run Client visual checks for the default, Full HD, and reduced size compositions.
- Run strict Deployment Impact for the changed paths.

## Out Of Scope

- Reflowing individual pages, remembering arbitrary window dimensions, or changing the Worker, Web, D1, or addon.
