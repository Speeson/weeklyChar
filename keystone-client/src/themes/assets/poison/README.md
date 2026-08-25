# Poison artwork contract

This directory is reserved for optional, replaceable Poison theme artwork. Register a file in `src/theme/asset.registry.ts`; pages must not import these assets or branch on the active theme.

| Registry role | Intended use | Preferred format |
| --- | --- | --- |
| `artwork-background` | Full-window environment or atmospheric backdrop | WebP |
| `artwork-overlay` | Transparent full-window texture or haze | WebP or SVG |
| `brand-theme-emblem` | Primary Poison emblem/logo | SVG |
| `brand-app-badge` | Small brand badge layered near the app mark | SVG |
| `decoration-panel-ornament` | Transparent panel/card border ornament | SVG or WebP |
| `decoration-serpentine-amani` | Transparent serpentine or Amani-inspired accent | SVG |

Missing roles intentionally resolve to `undefined` and publish `none` to their CSS slots. Keep assets transparent where appropriate, pointer-neutral through the existing decorative layers, and optimized before committing. The design north-star under `keystone-client/design/` is reference-only and must never be imported by runtime code.
