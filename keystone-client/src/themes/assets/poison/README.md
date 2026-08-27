# Poison artwork contract

Production Poison artwork is registered centrally in `src/theme/asset.registry.ts`. Pages request semantic roles; they must not import these files directly or branch on the active theme.

The runtime set contains:

- `backgrounds/background-main.png` and `overlays/ambient-overlay.png` for the global environment.
- `branding/app-badge.png` and `branding/emblem.png` for Poison branding.
- Card frames for the Sync summary, character table, emblem, version, and current-status surfaces.
- Button frames for Sync, Web, tray, Settings, minimize, and close actions.
- `frames/profile/profile-frame.png`, with the real user avatar and username mounted separately by React.
- Active and inactive tab decorations.
- Semantic Sync icons for accounts, characters, last sync, version, success, error, warning, information, and active synchronization.

Decorative layers remain pointer-neutral and never replace interactive HTML, localized text, dynamic data, or accessibility semantics. Variable-size overlays reuse the neutral frame role through Poison's CSS 9-slice treatment rather than stretching ornamental artwork.

The Addon tab currently receives the production Poison shell only. Its page-specific artwork is intentionally deferred until approved Addon assets exist; do not invent or reuse Sync artwork for its interior.

The north-star image under `keystone-client/design/` is a reference-only file and must never be imported by runtime code. Source PNGs are intentionally preserved at production quality for review; optimize them only in a separately approved asset pass.
