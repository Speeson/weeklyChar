# KeystoneClient Theme / Skin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Track progress with the checkboxes below.

**Goal:** Introduce a reusable skin/theme architecture for KeystoneClient so the application can switch between visually distinct themes without duplicating pages, business logic, navigation, or interaction behavior.

**Architecture:** Keep application structure and behavior theme-agnostic. A small frontend theme engine applies a stable `data-theme` attribute to the document, while semantic CSS tokens control surfaces, borders, glows, buttons, backgrounds, motion and icon treatment. Theme-specific assets and optional icon-shape overrides are isolated behind explicit contracts. The current look becomes the `keystone` theme with no intended visual regression; `poison` becomes the first genuinely different skin and proves the architecture.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties, Tailwind v4 where already used, Lucide React, Vitest, Testing Library, Playwright.

**Spec:** This document is the approved design and implementation plan.

---

## 0. Approved Product Design

KeystoneClient must support **skins**, not just color palettes.

A theme may change:

- application background
- gradients and ambient layers
- card surfaces and card decoration
- borders, shadows and glows
- primary/secondary buttons and their hover/pressed/focus effects
- tabs, dropdowns, modals and scrollbars
- header/footer decoration
- icon color, glow and presentation
- optional icon-shape variants
- optional theme-specific SVG/WebP assets
- subtle motion and ambient effects

A theme must **not** change:

- navigation structure or page hierarchy
- business logic
- sync/addon/WoW/updater behavior
- button meaning
- accessibility semantics
- account/character data
- WoW class colors
- Raider.IO / item-level semantic colors
- success / warning / danger semantics

The same component must remain the same functional component under every theme.

```text
Business logic / navigation / state
               |
               v
Shared components and page structure
               |
               v
Semantic visual contract
               |
       +-------+-------+
       |               |
       v               v
   Keystone          Poison
```

Target UX:

```text
Settings -> Appearance -> Theme -> Poison
                                |
                                v
                    application changes live
                                |
                                v
                         restart application
                                |
                                v
                         Poison remains active
```

No application restart is required to switch themes.

---

# Global Constraints

1. **Frontend-only by default.** Theme selection is a local appearance preference and must not require Python/bridge/backend changes unless the current local codebase already has an established frontend preference persistence service that should be reused.
2. **Persistence key:** if no existing frontend preference abstraction exists, use `keystone-client.theme` in `localStorage`.
3. **Default theme:** `keystone`.
4. **Initial themes:** `keystone`, `poison`.
5. Invalid/removed stored theme IDs must fail safely to `keystone`.
6. Apply the stored theme **before React renders** to avoid a Keystone flash before Poison appears.
7. Theme IDs are stable machine identifiers; translated names are never IDs.
8. Do not duplicate `SyncPage`, `AddonPage`, `SettingsPage`, `WowPage`, `LoginPage`, shell components, modals or business logic.
9. Do not add runtime-downloaded themes, arbitrary custom CSS, a marketplace or user-authored themes in this phase.
10. Do not add automatic seasonal theme selection in v1; keep explicit user selection.
11. Prefer CSS/SVG over raster assets. WebP/PNG only where they materially improve visual quality.
12. Theme images are decorative and contain no functional text.
13. Respect `prefers-reduced-motion`.
14. Keyboard focus must remain obvious in every theme.
15. Theme effects must not reduce readability or make semantic status colors ambiguous.
16. WoW class, Raider.IO, item-level and other domain colors remain independent from theme accents.
17. The current visual design must become `keystone` with **no intentional visual change** before Poison is introduced.
18. Do not bump the canonical client release version, create tags, publish or deploy from this plan.
19. Follow repository `AGENTS.md`, applicable nested instructions, current KeystoneClient skills and local release/readiness work. The local checkout may be ahead of remote `main`; inspect local state first.
20. Run Deployment Impact for every logical batch and the final changed-file set.

---

# 1. Target File Structure

Use this structure unless the current local branch already contains an equivalent abstraction; reuse equivalent abstractions rather than duplicating them.

```text
keystone-client-next/
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ App.css
   ├─ theme/
   │  ├─ theme.types.ts
   │  ├─ theme.registry.ts
   │  ├─ theme.storage.ts
   │  ├─ theme.dom.ts
   │  ├─ ThemeProvider.tsx
   │  ├─ useTheme.ts
   │  ├─ theme.test.tsx
   │  ├─ icon.registry.tsx
   │  └─ README.md
   ├─ themes/
   │  ├─ base.css
   │  ├─ keystone.css
   │  ├─ poison.css
   │  └─ assets/
   │     ├─ keystone/
   │     └─ poison/
   ├─ styles/
   │  └─ tokens.css
   ├─ components/
   │  ├─ KeystoneShell.tsx
   │  ├─ ui.tsx
   │  ├─ ui.test.tsx
   │  ├─ ThemedIcon.tsx
   │  └─ ThemedIcon.test.tsx
   └─ pages/
      ├─ SettingsPage.tsx
      └─ SettingsPage.test.tsx

keystone-client-next/tests/
└─ theme-visual.spec.ts
```

---

# 2. Theme Contract

Create `keystone-client-next/src/theme/theme.types.ts`:

```ts
export const THEME_IDS = ["keystone", "poison"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
};

export const DEFAULT_THEME: ThemeId = "keystone";
export const THEME_STORAGE_KEY = "keystone-client.theme";
```

Create `theme.registry.ts`:

```ts
import {
  DEFAULT_THEME,
  THEME_IDS,
  type ThemeDefinition,
  type ThemeId,
} from "./theme.types";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "keystone",
    label: "Keystone",
    description: "The original dark blue and gold KeystoneClient style.",
  },
  {
    id: "poison",
    label: "Poison",
    description: "A dark toxic skin with acid-green energy and organic glow.",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" &&
    (THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}
```

Do not put visual CSS values in the TypeScript registry.

---

# 3. Token Model

## Stable application tokens

These do not change with the skin unless a specific accessibility reason requires it:

```css
--status-success
--status-warning
--status-danger
--wow-class-*
--rio-*
--item-level-*
--radius-sm
--radius-md
--radius-lg
--space-1
--space-2
--space-3
--space-4
--space-5
--space-6
--space-7
--space-8
```

Existing stable spacing/radius tokens in `src/styles/tokens.css` should remain reusable.

## Theme tokens

Minimum contract:

```css
--theme-bg
--theme-bg-secondary
--theme-bg-image
--theme-bg-overlay
--theme-ambient-primary
--theme-ambient-secondary

--theme-surface-1
--theme-surface-2
--theme-surface-3
--theme-surface-hover
--theme-surface-active

--theme-border
--theme-border-strong
--theme-border-active
--theme-divider

--theme-text
--theme-text-muted
--theme-text-accent

--theme-accent
--theme-accent-strong
--theme-accent-soft
--theme-accent-contrast

--theme-button-primary
--theme-button-primary-hover
--theme-button-primary-active
--theme-button-secondary
--theme-button-secondary-hover

--theme-focus-ring
--theme-glow-soft
--theme-glow-medium
--theme-glow-strong
--theme-shadow-panel
--theme-shadow-elevated

--theme-icon
--theme-icon-muted
--theme-icon-active
--theme-icon-glow

--theme-card-texture
--theme-card-highlight
--theme-card-overlay

--theme-modal-backdrop
--theme-scrollbar
--theme-scrollbar-hover

--theme-motion-fast
--theme-motion-normal
--theme-motion-ambient
```

Forbidden after migration:

```css
.sync-button { color: #f4b72a; }
```

Required style:

```css
.sync-button { color: var(--theme-accent); }
```

---

# 4. Asset Contract

Theme assets are optional enhancement layers, not a requirement for a functioning theme.

Use CSS slots:

```css
--theme-bg-image: none;
--theme-card-texture: none;
--theme-card-overlay: none;
```

A theme may override them:

```css
html[data-theme="poison"] {
  --theme-bg-image: url("./assets/poison/background.webp");
  --theme-card-texture: url("./assets/poison/card-texture.svg");
}
```

Priority:

1. CSS gradients / pseudo-elements
2. inline or bundled SVG
3. WebP
4. PNG only where specifically justified

A new theme must be able to ship initially with **zero raster assets**.

---

# 5. Icon Architecture

Create `keystone-client-next/src/components/ThemedIcon.tsx`.

Pages request semantic icons:

```tsx
<ThemedIcon name="sync" size={18} />
<ThemedIcon name="addon" size={18} />
<ThemedIcon name="settings" size={18} />
```

Default registry maps semantic names to existing Lucide icons:

```ts
const baseIcons = {
  sync: RefreshCw,
  addon: Puzzle,
  settings: Settings,
  characters: Users,
  folder: FolderOpen,
  download: Download,
} as const;
```

Every theme can alter all icons through CSS:

```css
.theme-icon {
  color: var(--theme-icon);
  filter: var(--theme-icon-glow);
}
```

Support optional shape overrides:

```ts
type ThemeIconOverrides = Partial<
  Record<ThemeIconName, React.ComponentType<IconProps>>
>;
```

The caller never knows whether an override exists. The fallback is always the base icon.

Initial Poison requirements:
- every standard icon receives Poison color/glow/effects
- optional custom geometry is proven with only a few signature icons where it adds value
- no bitmap icons
- layout footprint remains identical

---

# 6. Poison Visual Direction

Poison must look like a separate skin, not Keystone recolored green.

Initial direction:

```css
--theme-bg: #040805;
--theme-bg-secondary: #07110a;
--theme-surface-1: rgb(7 20 11 / 84%);
--theme-surface-2: rgb(9 28 14 / 90%);
--theme-surface-3: rgb(12 34 17 / 94%);
--theme-accent: #a6ff3f;
--theme-accent-strong: #c7ff57;
--theme-accent-soft: rgb(134 255 54 / 18%);
--theme-accent-contrast: #071005;
--theme-border: rgb(120 220 55 / 28%);
--theme-border-strong: rgb(166 255 63 / 58%);
--theme-border-active: rgb(196 255 94 / 80%);
--theme-text: #f2f7ed;
--theme-text-muted: #aab9a5;
--theme-text-accent: #c7ff72;
```

Exact values may be tuned for contrast/quality, but preserve this art direction:

- charcoal / black-green depth
- toxic fog in corners
- acid-green accents
- restrained yellow-green highlights
- dark translucent cards
- organic/irregular decorative highlights
- soft toxic inner/outer glow
- subtle card-edge luminescence
- more fluid hover energy than Keystone
- optional faint bubbles/spores/noise via CSS/SVG
- no neon overload
- no full-screen green wash
- no readability sacrifice

Recommended CSS-first background:

```css
background:
  radial-gradient(circle at 14% 8%, rgb(133 255 55 / 10%), transparent 30%),
  radial-gradient(circle at 84% 90%, rgb(84 189 44 / 9%), transparent 32%),
  linear-gradient(145deg, #040805 0%, #07110a 46%, #020503 100%);
```

---

# 7. Task 1 — Baseline Inventory and Visual Lock

**Inspect:**
- `keystone-client-next/src/App.css`
- `keystone-client-next/src/styles/tokens.css`
- `keystone-client-next/src/components/KeystoneShell.tsx`
- `keystone-client-next/src/components/ui.tsx`
- `keystone-client-next/src/pages/*.tsx`
- current Playwright visual tests

**Produces:** inventory of hardcoded theme values + trustworthy Keystone baseline.

- [ ] Read local project instructions and current git state:

```bash
git status --short --untracked-files=all
git branch --show-current
git log --oneline --decorate -10
```

- [ ] Inventory theme-coupled CSS by searching for `#`, `rgb(`, `rgba(`, gradients, shadows, filters, backgrounds, colors and borders.
- [ ] Classify each literal as `stable semantic`, `theme semantic`, `component geometry` or `domain semantic`.
- [ ] Do not convert WoW/status colors blindly.
- [ ] Capture current Keystone visual baseline for Login, Sync, Addon, Settings, shell/header/tabs and modal/dropdown states where fixtures exist.
- [ ] Run:

```bash
cd keystone-client-next
npm test
npm run test:visual
```

Expected: PASS before refactor.

- [ ] Add a regression proving no stored preference resolves to `data-theme="keystone"`.
- [ ] Run strict Deployment Impact for changed files.

**Gate:** no visual migration begins until baseline is green.

---

# 8. Task 2 — Core Theme Engine

**Create:**
- `src/theme/theme.types.ts`
- `src/theme/theme.registry.ts`
- `src/theme/theme.storage.ts`
- `src/theme/theme.dom.ts`
- `src/theme/ThemeProvider.tsx`
- `src/theme/useTheme.ts`
- `src/theme/theme.test.tsx`

**Modify:** `src/main.tsx`, `src/App.tsx`.

Required context API:

```ts
type ThemeContextValue = {
  theme: ThemeId;
  themes: readonly ThemeDefinition[];
  setTheme: (theme: ThemeId) => void;
};
```

- [ ] Write failing tests for valid Keystone, valid Poison, missing preference, invalid preference and persisted Poison.
- [ ] Implement `readStoredTheme()` and `writeStoredTheme(theme)` using `keystone-client.theme`.
- [ ] Implement `applyThemeToDocument(theme)` using `document.documentElement.dataset.theme`.
- [ ] Apply the stored theme in `main.tsx` **before** React `createRoot(...).render(...)`.
- [ ] Implement ThemeProvider/useTheme.
- [ ] `setTheme()` must validate, apply DOM immediately, persist and update React state.
- [ ] Test live Keystone <-> Poison switching.
- [ ] Run `npm test` and `npm run build`.

---

# 9. Task 3 — Convert Current Look into the Keystone Theme

**Create:** `src/themes/base.css`, `src/themes/keystone.css`.

**Modify:** `src/styles/tokens.css`, `src/App.css`, relevant shared component styles and central stylesheet imports.

- [ ] Move structural/stable tokens to base.
- [ ] Define the complete semantic token contract under `html[data-theme="keystone"]` using the actual current local visual values.
- [ ] Replace hardcoded theme literals in shell, cards, buttons, tabs, modals, dropdowns, controls, scrollbars and backgrounds with semantic variables.
- [ ] Audit pages so they retain domain colors but do not carry the global skin palette directly.
- [ ] Run unit/build/visual tests.
- [ ] Keystone screenshots must remain pixel-identical or only have reviewed, equivalent normalization differences.

**Gate:** architecture exists and the app still looks like current KeystoneClient.

---

# 10. Task 4 — Theme-Aware Shared UI Primitives

**Modify:** `src/components/ui.tsx`, `src/components/ui.test.tsx`, `src/components/KeystoneShell.tsx`, relevant CSS.

- [ ] Test representative shared components under both `data-theme="keystone"` and `data-theme="poison"`.
- [ ] Ensure ARIA/behavior is identical.
- [ ] Make `default`, `hover`, `focus-visible`, `active`, `disabled`, `selected`, `danger` and `success` states semantic.
- [ ] Keep danger/success semantics independent from Poison accent.
- [ ] Use stable decoration hooks such as `data-ui="card"`, `data-ui="primary-button"`, `data-ui="tab"`, `data-ui="modal"` only where useful.
- [ ] Do not add visual `if (theme === "poison")` branches in pages.
- [ ] Add `prefers-reduced-motion` fallbacks.
- [ ] Run tests/build/visual suite.

---

# 11. Task 5 — Themed Icon System

**Create:** `src/components/ThemedIcon.tsx`, `src/components/ThemedIcon.test.tsx`, `src/theme/icon.registry.tsx` if needed.

**Optional assets:** `src/themes/assets/poison/icons/`.

- [ ] Inventory current Lucide imports and create only the semantic icon names actually needed.
- [ ] Add tests for default mapping, dimensions, accessible behavior and theme-independent layout footprint.
- [ ] Implement the centralized base Lucide registry.
- [ ] Implement optional per-theme override registry with base fallback.
- [ ] Apply CSS-driven icon color/glow/hover/selected treatment to every standard icon.
- [ ] Migrate direct Lucide imports where the semantic wrapper is appropriate.
- [ ] Keep exact domain-specific icons outside the wrapper if theming would damage their semantics.
- [ ] Verify no icon shifts layout while switching themes.

---

# 12. Task 6 — Theme Asset and Decoration Slots

**Create:**
- `src/themes/assets/keystone/`
- `src/themes/assets/poison/`

**Modify:** base/Keystone/Poison CSS and shell/shared styles.

- [ ] Add safe `none` defaults for background/card texture/overlay slots.
- [ ] Add decorative pseudo-element layers with `pointer-events: none`.
- [ ] Missing optional assets must never break layout.
- [ ] Optimize SVG/WebP before commit.
- [ ] Avoid multi-megabyte decorative assets unless specifically reviewed.
- [ ] Run Vite production build and verify referenced assets are bundled.

---

# 13. Task 7 — Appearance / Theme Selector

**Modify:** `src/pages/SettingsPage.tsx`, `src/pages/SettingsPage.test.tsx` and shared controls only if reusable.

- [ ] Add failing tests: Keystone default, Poison option exists, selecting Poison updates document immediately, persistence works, reopening Settings shows Poison selected.
- [ ] Add an `Appearance` section following the existing Settings hierarchy.
- [ ] Use registry data rather than hardcoding selector options separately.
- [ ] Switch live; do not show restart-required messaging.
- [ ] Ensure keyboard operation.
- [ ] Run unit/build tests.

Suggested UX:

```text
Appearance

Theme
[ Keystone                          v ]

Keystone
Poison
```

---

# 14. Task 8 — Implement Poison as the First Real Skin

**Create/complete:** `src/themes/poison.css` plus only necessary optional Poison assets/icon overrides.

- [ ] Define every consumed theme variable; do not silently inherit Keystone accent values.
- [ ] Build ambient black-green/toxic background using CSS gradients first.
- [ ] Theme cards with dark translucent green surfaces, acid edge highlights, controlled hover glow and optional organic texture.
- [ ] Theme buttons with distinct default/hover/active/focus/disabled behavior.
- [ ] Theme shell/navigation/tabs while keeping selected state readable without glow alone.
- [ ] Theme modals/dropdowns/scrollbars.
- [ ] Theme every standard icon through Poison effects.
- [ ] Add a small number of signature shape overrides only where they genuinely improve the skin; recommended candidates: sync, addon, settings.
- [ ] Explicitly verify success/warning/error, WoW class, Raider.IO and item-level colors remain distinguishable.
- [ ] Run visual tests and manually inspect the full app.

**Quality bar:** Poison must feel intentionally designed, not mechanically hue-shifted.

---

# 15. Task 9 — Visual Regression, Accessibility and Performance

**Create/modify:** `keystone-client-next/tests/theme-visual.spec.ts` and existing test utilities as needed.

- [ ] Add deterministic Playwright setup by writing `keystone-client.theme` before render.
- [ ] Capture Keystone and Poison for Login, Sync, Addon, Settings and modal/dropdown states.
- [ ] Test persistence across reload.
- [ ] Test invalid storage (`not-a-theme`) -> no crash, safe Keystone fallback.
- [ ] Test reduced-motion behavior.
- [ ] Check contrast for body/muted text, button labels, focus rings, selected tabs and status states.
- [ ] Verify changing theme does **not** remount/refetch/restart sidecar/sync/navigation.

Theme switching should primarily cause CSS restyling plus ThemeContext state update.

---

# 16. Task 10 — Future Theme Authoring Contract

**Create:** `keystone-client-next/src/theme/README.md`.

Optional: `keystone-client-next/src/themes/theme-template.css`.

Document this exact future workflow:

```text
1. Choose a stable ThemeId.
2. Register metadata in theme.registry.ts.
3. Copy the complete theme token contract into <theme>.css.
4. Set every required theme token.
5. Add optional SVG/WebP assets.
6. Add optional semantic icon overrides.
7. Settings discovers it through registry data.
8. Add visual snapshots.
9. Run unit/build/visual tests.
```

A future theme must not require:
- copying pages
- editing sync/addon logic
- scattering `if (theme === ...)`
- mandatory generated backgrounds
- redesigning KeystoneClient from zero

Add a checklist:

```markdown
## New theme checklist

- [ ] Theme ID registered
- [ ] Complete token contract
- [ ] No Keystone variable leakage
- [ ] Optional assets optimized
- [ ] Icons readable
- [ ] Status/domain colors preserved
- [ ] Settings selector works
- [ ] Persistence works
- [ ] Reduced-motion works
- [ ] Unit tests pass
- [ ] Visual tests pass
```

---

# 17. Task 11 — Release Metadata / Repository Hygiene

- [ ] Inspect `.changes/README.md` and current local pending entries; do not guess schema.
- [ ] Add one client runtime change entry if required by current repository policy, e.g. “Adds selectable KeystoneClient visual themes and the new Poison skin.” Use the repository's current release-note language convention.
- [ ] Do not bump canonical client version.
- [ ] No tag, GitHub Release or deployment.
- [ ] Remove unintended `.tmp`, generated installers or unrelated artifacts.

---

# 18. Final Validation

Frontend:

```bash
cd keystone-client-next
npm test
npm run build
npm run test:visual
```

Repository:

```bash
git diff --check
git status --short --untracked-files=all
```

Inspect full diff.

Deployment Impact from repo root using actual final changed paths:

```bash
python scripts/deploy_impact.py --files <changed-paths> --json --strict
```

Expected conceptually:

```text
CLIENT_BUILD=true
CLIENT_RELEASE=true
```

Unrelated Web/Worker/DB/Addon impact should remain false unless repository logic legitimately says otherwise.

Because this affects shipped UI, run the current local Tauri client build-readiness command before declaring release readiness. Do not publish it.

---

# 19. Manual Acceptance Matrix

| Scenario | Expected |
|---|---|
| First launch, no preference | Keystone |
| Keystone -> Poison | Immediate live switch |
| Poison -> Keystone | Immediate live switch |
| Restart on Poison | Poison retained |
| Invalid stored theme | Safe fallback to Keystone |
| Login under both | Same behavior |
| Sync under both | Same behavior |
| Addon under both | Same behavior |
| Settings under both | Same behavior |
| Dialog/modal under both | Same behavior |
| Dropdown under both | Same behavior |
| Scroll areas under both | Themed and readable |
| Hover/active/focus | Theme-specific and accessible |
| Reduced motion | Fully usable |
| WoW class colors | Unchanged |
| Status colors | Semantically unchanged |
| Changing theme | No sidecar restart/refetch/sync restart |

---

# 20. Architecture Guardrails

Reject:

```tsx
return theme === "poison"
  ? <PoisonSyncPage />
  : <KeystoneSyncPage />;
```

Reject:

```tsx
className={theme === "poison" ? "poison-card" : "keystone-card"}
```

Prefer:

```tsx
<Card />
```

with:

```html
<html data-theme="poison">
```

and semantic CSS variables.

Theme-specific JavaScript is acceptable only in centralized theme/icon infrastructure for metadata or optional semantic icon overrides.

---

# 21. Future-Proofing Without Overengineering

The architecture should make these possible later, but **not implement them now**:

```text
Void
Fel
Frost
Blood
Arcane
season-selected defaults
theme previews
downloadable optional asset packs
```

A future static theme should mostly be:

```text
new CSS file
+ registry entry
+ optional assets
+ optional icon overrides
+ visual snapshots
```

not a new app design.

---

# 22. Task Sequence / Reviewer Gates

```text
Task 1  Baseline inventory + screenshots
   |
Task 2  Theme engine / persistence / no-flash bootstrap
   |
Task 3  Current UI -> Keystone tokens, visually unchanged
   |
Task 4  Shared primitives fully theme-semantic
   |
Task 5  Themed icon architecture
   |
Task 6  Asset/decorative slots
   |
Task 7  Settings selector
   |
Task 8  Poison skin
   |
Task 9  Visual/accessibility/performance hardening
   |
Task 10 Theme authoring documentation
   |
Task 11 Change entry / final repository hygiene
   |
Final validation
```

Each task is a review gate. Do not start Poison before the Keystone migration passes visual regression.

---

# 23. Final Acceptance Criteria

Complete only when:

1. `keystone` and `poison` are registered themes.
2. Keystone is the safe default.
3. Stored theme is applied before React paints.
4. Switching is immediate.
5. Selection persists across restarts.
6. Invalid saved values fall back safely.
7. Existing UI uses semantic theme tokens.
8. Keystone has no intentional visual regression.
9. Poison visibly changes the full shell/shared UI.
10. Poison changes backgrounds, cards, buttons, borders, glows and icons.
11. All standard icons react to active theme.
12. Optional theme-specific icon-shape overrides work.
13. Theme-specific assets are supported but optional.
14. No page/business logic is duplicated by theme.
15. No normal page needs visual `if (theme === ...)` branches.
16. Status/domain colors remain independent.
17. Keyboard focus is clear in both themes.
18. Reduced motion is supported.
19. Theme switching does not restart/refetch application functionality.
20. Unit tests pass.
21. Production frontend build passes.
22. Playwright visual tests pass.
23. Native client validation remains green.
24. Deployment Impact reports only intended client impact.
25. Release metadata follows repository policy.
26. No version/tag/release/deployment occurs as part of implementation.
27. `src/theme/README.md` explains how to add the next theme without redesigning the app.

---

# 24. Final Report Required from the Implementer

Return:

1. Theme architecture implemented.
2. Files created/modified.
3. Theme token contract summary.
4. Persistence strategy.
5. Startup no-flash strategy.
6. Keystone visual-regression result.
7. Poison visual summary.
8. Icon strategy: base Lucide mapping, global effects, custom overrides if any.
9. Theme assets added and sizes.
10. Settings selector behavior.
11. Vitest results.
12. Vite build result.
13. Playwright results.
14. Native client validation result.
15. Deployment Impact.
16. Change entry added.
17. Known visual limitation, if any.
18. Confirmation: no business logic duplication, no version bump, no push unless separately authorized, no tag, no release, no deploy.

Finish with exactly one:

```text
KEYSTONECLIENT THEME SYSTEM READY
```

or:

```text
KEYSTONECLIENT THEME SYSTEM BLOCKED
```
