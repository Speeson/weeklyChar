# KeystoneClient Void Theme Design

## Objective

Add `void` as a selectable, persisted KeystoneClient theme that preserves Keystone's shared layouts, behavior, navigation, accessibility, and application state while applying the supplied dark violet cosmic artwork and a complete Void token palette across every client surface.

## Approved Design

- Void follows Keystone's functional composition: shared React pages and controls remain unchanged, while semantic assets and CSS tokens replace presentation.
- The supplied `background-main.png` covers the client viewport and `overlay1.png` is the production overlay above the background and below interactive content, with no pointer interaction.
- `overlay2.png` and `overlay3.png` remain registered comparison candidates used only by deterministic visual review tests; no end-user overlay selector or runtime preference is added.
- Shell branding, active tab, profile/avatar, dropdown, window controls, footer controls, Sync hero, summary/status icons, and Addon status icons resolve through the central asset registry.
- The inactive-tab role remains absent for Void, so only the active Sync, Teams, or Addon tab renders supplied decoration.
- Addon, Teams, authentication, registration, onboarding, Settings, dropdowns, dialogs, and modals use the shared structure with a complete dark indigo/violet CSS token contract. They do not receive Poison-style dedicated frames.
- `empty-button.png` stays unimported and unused.
- Semantic success, warning, danger, Raider.IO, item-level, keystone-level, and WoW class colors retain their existing meaning and accessible distinction.

## Architecture

- `src/theme/theme.types.ts` and `theme.registry.ts` own the stable `void` ID and selectable metadata; existing storage and startup application paths persist and restore it without special cases.
- `src/theme/asset.registry.ts` owns Void imports and role mappings. Optional overlay comparison roles extend the generic registry contract, while `artwork-overlay` points to `overlay1` in production.
- `src/themes/void.css` defines the complete theme token contract and Void-only composition details; `src/styles/tokens.css` imports it.
- Shared pages and `KeystoneShell.tsx` continue requesting semantic roles through `useThemeAsset`; no theme-ID conditionals or business-logic changes are introduced.
- Vitest covers registry, persistence, selection, asset fallback/isolation, active-only navigation, dropdown/footer roles, default overlay, comparison candidates, and the unused empty button.
- Playwright uses existing production preview routes for Void authentication, onboarding/registration, Sync, Addon, Teams, Settings, dropdown/modal coverage, and separate overlay1/2/3 comparison screenshots.
- No sidecar, Rust/Tauri behavior, Worker, Web, D1, addon, or data-contract change is required.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `npm --prefix keystone-client run test:visual`
- Inspect every new Void and overlay comparison PNG; verify existing Keystone and Poison snapshot hashes are unchanged.
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `python -m unittest discover -s tests/release`
- `python -m unittest discover -s tests/deploy_impact`
- `python scripts/deploy_impact.py --files <changed-paths> --json --strict`
- `git diff --check`

## Out Of Scope

- Functional redesign, navigation/layout changes, or business-logic changes.
- Poison-style Addon or Teams frame collections.
- An end-user overlay selector or persistence of comparison overlays.
- Use of `empty-button.png`.
- Changes to Keystone or Poison styling or golden snapshots.
- Asset renaming, destructive source-art modification, VERSION changes, remote operations, releases, tags, merges, pushes, or deployments.
