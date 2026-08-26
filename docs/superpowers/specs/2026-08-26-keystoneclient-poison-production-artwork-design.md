# KeystoneClient Poison Production Artwork Design

## Objective

Integrate the approved Poison PNG set into KeystoneClient's existing theme system while preserving the shared application structure, behavior, accessibility, and pixel-identical Keystone rendering.

## Approved Design

- The supplied Poison background is the global foundation, with the ambient overlay rendered above it at deliberately low opacity.
- Poison replaces shell branding, tab decoration, profile chrome, native window-control artwork, footer artwork, Synchronization cards, table, sidebar frames, and semantic status icons through the centralized asset registry.
- The emblem frame and emblem remain separate layers, and the real account avatar remains a separate clipped layer inside the profile frame.
- Text, table rows, state, sorting, buttons, focus, dropdowns, modals, and native interactions remain live HTML/React.
- Shared CSS variables normalize brightness, saturation, contrast, opacity, and glow across the supplied raster set.
- Variable-size Poison overlays use reusable 9-slice `border-image` chrome rather than stretched screenshot-like panels.

## Architecture

- `src/theme/asset.registry.ts` owns all Poison PNG imports and semantic role mappings, including optional decorative roles.
- `KeystoneShell.tsx` and `SyncPage.tsx` request semantic asset roles without branching on a theme ID.
- `poison.css` composes and sizes Poison-only layers. Keystone CSS and assets remain unchanged.
- Playwright preview infrastructure produces review screenshots at the canonical 1672x941 viewport without updating committed golden snapshots.
- No sidecar, Tauri protocol, API, Worker, Web, D1, addon, or cross-component data-contract changes are required.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `npm --prefix keystone-client run test:visual` without update mode
- Canonical Poison review screenshots for Sync states, Settings, user menu, and Addon shell
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `python -m unittest discover -s tests/release`
- strict deployment-impact classification for every changed path

## Out Of Scope

- Final Addon-page-specific artwork or Addon interior redesign.
- Updating Keystone or Poison committed visual golden snapshots.
- VERSION changes, releases, pushes, pull requests, merges, tags, or deployments.
- Destructive modification, recoloring, or optimization of the supplied source PNGs.
