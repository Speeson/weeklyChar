# KeystoneClient static theme authoring

KeystoneClient themes are static frontend skins. A theme may change visual presentation, but it must reuse the same pages, navigation, accessibility semantics, application state, and Client/sidecar behavior. Keystone is the safe default and Poison is the first selectable alternate skin currently shipped.

## Add a static theme

1. Choose a stable lowercase `ThemeId`. Add it to `THEME_IDS` in `theme.types.ts`; labels and translated text are never IDs.
2. Register one `ThemeDefinition` in `theme.registry.ts`. Keep `selectable: false` until the CSS, behavior, and snapshots are complete, then make it selectable in the integration change.
3. Create `src/themes/<theme>.css`, import it from `src/styles/tokens.css`, scope it to `html[data-theme="<theme>"]`, and define every required token below. Copy the contract from an existing complete theme, then replace every value deliberately; do not inherit Keystone palette values accidentally.
4. Add optional optimized SVG or WebP files under `src/themes/assets/<theme>/` only when CSS cannot provide the intended result. Register them centrally in `asset.registry.ts`; pages must not import theme artwork.
5. Add optional semantic icon-shape overrides in `icon.registry.tsx`. Callers continue to request roles through `ThemedIcon`; they never branch on the active theme.
6. Confirm Settings discovers the theme from registry data. `ThemeSelector` filters the canonical registry through `getSelectableThemes`; do not add a second option list to Settings.
7. Add deterministic Playwright coverage. Install `keystone-client.theme=<theme>` with `page.addInitScript(...)` before the first `page.goto(...)`, use new theme-prefixed snapshot names, and never update another theme's PNGs.
8. Add or extend behavior coverage for live selection, reload persistence, invalid-value fallback, keyboard use, and reduced motion. Do not add snapshots for viewport-only duplicates when the skin has no distinct semantic state.
9. Run the validation commands in this document, inspect every new screenshot, verify existing snapshot hashes are unchanged, and add or update the single pending Client changeset required by repository policy. Theme work does not itself authorize a VERSION bump, tag, release, deployment, or push.

A new theme must not copy pages, edit Sync/Addon/WoW logic, scatter `if (theme === ...)` branches, require generated backgrounds, or redesign the application structure.

## Required CSS token contract

Every static theme defines all 150 properties below inside its own `html[data-theme="<theme>"]` rule. `keystone.css`, `poison.css`, and the palette Playwright test are the current executable references.

```text
--theme-accent
--theme-accent-border-soft
--theme-accent-contrast
--theme-accent-soft
--theme-accent-strong
--theme-accent-surface-soft
--theme-addon-background
--theme-addon-border
--theme-addon-border-strong
--theme-addon-button-background
--theme-addon-button-hover-border
--theme-addon-button-text
--theme-addon-card-background
--theme-addon-card-border
--theme-addon-card-highlight
--theme-addon-column-divider
--theme-addon-description
--theme-addon-divider
--theme-addon-eyebrow
--theme-addon-field-background
--theme-addon-field-border
--theme-addon-field-text
--theme-addon-icon-glow
--theme-addon-icon-muted
--theme-addon-inner-border
--theme-addon-label
--theme-addon-primary-background
--theme-addon-primary-shadow
--theme-addon-primary-text
--theme-addon-secondary-background
--theme-addon-shadow
--theme-addon-status-background
--theme-addon-status-shadow
--theme-addon-text
--theme-addon-value
--theme-ambient-primary
--theme-ambient-secondary
--theme-auth-background
--theme-auth-register-background
--theme-auth-register-border
--theme-auth-shadow
--theme-avatar-background
--theme-avatar-border
--theme-avatar-glow
--theme-bg
--theme-bg-image
--theme-bg-overlay
--theme-bg-secondary
--theme-border
--theme-border-active
--theme-border-strong
--theme-brand-glow
--theme-button-primary
--theme-button-primary-active
--theme-button-primary-hover
--theme-button-secondary
--theme-button-secondary-hover
--theme-card-highlight
--theme-card-inner-border
--theme-card-overlay
--theme-card-texture
--theme-choice-background
--theme-choice-border
--theme-choice-check-text
--theme-choice-portrait-border
--theme-control-background
--theme-control-border
--theme-control-shadow
--theme-divider
--theme-dropdown-background
--theme-dropdown-hover-background
--theme-dropdown-hover-border
--theme-dropdown-hover-text
--theme-dropdown-item-background
--theme-dropdown-item-border
--theme-dropdown-item-text
--theme-emblem-glow
--theme-focus-ring
--theme-footer-accent-border
--theme-footer-action-background
--theme-footer-action-border
--theme-footer-action-shadow
--theme-footer-action-text
--theme-footer-background
--theme-footer-border
--theme-footer-web-active-filter
--theme-footer-web-hover-filter
--theme-frame-border
--theme-frame-shadow
--theme-glow-medium
--theme-glow-soft
--theme-glow-strong
--theme-header-background
--theme-header-border
--theme-header-divider
--theme-header-shadow
--theme-icon
--theme-icon-active
--theme-icon-glow
--theme-icon-muted
--theme-menu-text
--theme-modal-backdrop
--theme-motion-ambient
--theme-motion-fast
--theme-motion-normal
--theme-onboarding-account-background
--theme-onboarding-background
--theme-panel-divider
--theme-scrollbar
--theme-scrollbar-hover
--theme-scrollbar-track
--theme-shadow-elevated
--theme-shadow-panel
--theme-sidebar-background
--theme-summary-background
--theme-summary-detail
--theme-summary-icon-glow
--theme-summary-label
--theme-summary-value
--theme-surface-1
--theme-surface-2
--theme-surface-3
--theme-surface-active
--theme-surface-hover
--theme-sync-action-background
--theme-sync-action-border
--theme-sync-action-shadow
--theme-sync-action-text
--theme-tab-active-shadow
--theme-tab-border
--theme-tab-hover-border
--theme-tab-hover-glow
--theme-tab-hover-shadow
--theme-tab-hover-text
--theme-table-background
--theme-table-divider
--theme-table-heading
--theme-table-row-hover
--theme-table-row-marker
--theme-table-row-text
--theme-table-sort-icon
--theme-tab-text
--theme-text
--theme-text-accent
--theme-text-bright
--theme-text-muted
--theme-update-modal-divider
--theme-version-background
--theme-version-border
--theme-version-shadow
```

`base.css` owns stable spacing, radii, disabled opacity, status colors, and domain colors. Preserve these semantics unless an accessibility correction requires a shared change:

```text
--radius-sm, --radius-md, --radius-lg
--space-1 ... --space-8
--theme-disabled-opacity
--status-success*, --status-warning*, --status-danger*, --status-info*
--keystone-level-accent, --rio-score-accent, --item-level-accent
```

Success, warning, danger, WoW class, Raider.IO, keystone level, and item-level meaning must remain distinguishable from a theme's accent.

## Optional artwork and assets

The optional registry roles and their document CSS slots are:

| Registry role | CSS slot |
| --- | --- |
| `artwork-background` | `--theme-artwork-background` |
| `artwork-overlay` | `--theme-artwork-overlay` |
| `brand-theme-emblem` | `--theme-emblem-artwork` |
| `brand-app-badge` | `--theme-app-badge-artwork` |
| `decoration-panel-ornament` | `--theme-panel-ornament` |
| `decoration-serpentine-amani` | `--theme-serpentine-decoration` |

`applyThemeToDocument` publishes missing optional roles as `none` and controls `--theme-emblem-fallback-visibility`. Decorative layers must remain text-free and `pointer-events: none`. Prefer CSS gradients, then SVG, then WebP; optimize files before committing. Required branded/status asset roles resolve through `useThemeAsset` and safely fall back to Keystone until a theme registers a replacement.

The design references under `keystone-client/design/` are authoring evidence only. Never import them into runtime code.

## Semantic icons

Add a semantic role to `BASE_THEME_ICONS` only when production UI needs it. A theme may map that role in `THEME_ICON_OVERRIDES`; an omitted override uses the base Lucide glyph. Keep the same icon footprint and accessible behavior across themes. Standard icons inherit theme color and glow from `.theme-icon`; status/danger/bright-action surfaces retain their dedicated semantic foregrounds.

## Selector, storage, and startup

The Settings selector reads `ThemeDefinition` entries from the canonical registry and exposes only entries with `selectable: true`. Selecting an option calls `ThemeProvider.setTheme`, which applies `document.documentElement.dataset.theme`, persists the stable ID under `keystone-client.theme`, and updates React state without remounting application content.

`main.tsx` calls `applyThemeToDocument(readStoredTheme())` before `createRoot(...).render(...)`. Keep this bootstrap order so a stored theme appears on the first paint. `resolveThemeId` must continue to map missing, invalid, or removed stored IDs safely to Keystone.

## Visual snapshots

Cover materially different states: authentication, onboarding, the full Sync composition and status variants, Addon states, Settings with the selector, navigation interaction, and meaningful modals/dropdowns. Use production preview routes and real interactions; do not introduce screenshot-only production branches. A typical setup is:

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("keystone-client.theme", "<theme>"),
  );
});
```

Run a focused test without update mode first and confirm the RED is a missing new snapshot. Generate only the named new theme snapshots, rerun without update mode, then inspect each PNG with an image viewer. Record SHA-256 hashes for all existing theme PNGs before and after generation.

## Reduced motion

Every theme must remain fully navigable and keyboard-usable under `prefers-reduced-motion: reduce`. Disable nonessential animation and transitions while keeping static selected indicators, status meaning, focus rings, and decoration visible. Scope the fallback to the theme and include pseudo-elements:

```css
@media (prefers-reduced-motion: reduce) {
  html[data-theme="<theme>"] *,
  html[data-theme="<theme>"] *::before,
  html[data-theme="<theme>"] *::after {
    scroll-behavior: auto !important;
    animation: none !important;
    transition: none !important;
  }
}
```

## Validation

From `keystone-client/`:

```powershell
npm test
npm run build
npm run test:visual
```

From the repository root:

```powershell
python -m unittest discover -s tests/release
python -m unittest discover -s tests/deploy_impact
python scripts/deploy_impact.py --files <changed-paths> --json --strict
git diff --check
git status --short --untracked-files=all
```

Deployment Impact should report Client build/release consideration for shipped theme code and no Web, Worker, DB, or Addon impact. Its output reports required consideration; it does not authorize remote operations.

## New theme checklist

- [ ] Stable theme ID and registry metadata added
- [ ] Complete 150-token contract defined with no accidental Keystone leakage
- [ ] Optional assets optimized, registered centrally, and safe when absent
- [ ] Semantic icons readable with an unchanged footprint
- [ ] Status and domain colors preserved
- [ ] Settings discovers and switches the theme live
- [ ] Persistence and invalid-value fallback work
- [ ] Reduced-motion and keyboard use work
- [ ] Meaningful visual snapshots added without changing existing PNGs
- [ ] Every new screenshot inspected
- [ ] Unit tests, build, full Playwright, release tests, and Deployment Impact pass
- [ ] Pending Client changeset accurately describes the selectable skin
