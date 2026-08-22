# KeystoneClient Addon — Exact Figma Make Reference

Source:
https://www.figma.com/make/tOYdEAsjiAMwWMmeKkBgGD/Dise%C3%B1o-de-Addon-para-cliente?t=z0m4BrkM0jR2iefs-1

IMPORTANT: These values apply ONLY to the central Addon content. Preserve the existing KeystoneClient header, global background, footer, window chrome, and outer shell.

## Exact values extracted from Figma Make App.tsx

### Main Addon content wrapper
- Outer section: `max-w-[1600px]`
- Vertical margin: `my-5` = 20 px
- Horizontal padding: 16 px base / 32 px md
- Addon panel:
  - `rounded-2xl`
  - `border border-white/10`
  - background `#041428` at ~78% opacity
  - padding 20 px base / 36 px md
  - shadow `0 18px 70px rgba(0,0,0,.35)`

### Main inner grid
At XL:
- columns: `minmax(0,1.62fr) minmax(400px,.9fr)`
- gap: 36 px
Below XL:
- stacked by the source design, but KeystoneClient may keep its desktop two-column layout if its existing fixed window requires it.

Approximate XL ratio ignoring the right-side 400 px minimum:
- left: 64.3%
- right: 35.7%

### Addon heading area
- Crest/icon: 44 x 44 px
- icon/title row gap: 20 px
- eyebrow `KeystoneSync`: 11 px, bold, uppercase, tracking 0.24em, primary color
- title `Addon`:
  - Marcellus
  - clamp(38.4 px, 4vw, 68 px)
  - line-height 1
- description:
  - top margin 32 px
  - max width 590 px
  - font size 19 px
  - line-height 1.65
  - color `#d6d1c9`

### Ruta de AddOns card
- top margin: 56 px
- border radius: 12 px
- border: theme border
- background: `#06192d` at ~80%
- padding: 24 px
- subtle inset top highlight
- heading icon: 28 px
- heading: 21 px semibold
- heading row gap: 16 px

### Path field
- top margin: 24 px
- border radius: 8 px
- background: `#020e1d` at ~75%
- horizontal padding: 20 px
- vertical padding: 16 px
- font: 15 px base / 17 px md
- copy icon: 22 px

### Folder buttons
- top margin: 20 px
- two equal columns
- gap: 16 px
- minimum height: 64 px
- border radius: 8 px
- background: `#0c2540` at ~80%
- font size: 16 px
- icon sizes: 24–25 px

### Installed primary action row
- top margin: 28 px
- two equal columns
- gap: 16 px
- button min height: 106 px
- border radius: 12 px
- border: 2 px `#ffc929`
- gradient: `#f5a90a -> #ffc737 50% -> #ed9e04`
- text color: `#121619`
- font weight: bold
- font size: clamp(16.8 px, 1.8vw, 22.4 px)
- update icon: 31 px
- reinstall icon: 32 px
- shadow:
  - 0 0 0 2px rgba(100,52,0,.75)
  - 0 12px 30px rgba(0,0,0,.24)

### Not-installed primary action
- same top margin: 28 px
- full available width
- min height: 106 px
- border radius: 12 px
- same gold gradient and border
- horizontal padding: 28 px
- font size: clamp(17.6 px, 2vw, 24.8 px)
- icon: 35 px

### Right status column
At XL:
- left divider: theme border
- left padding: 32 px

### Estado del addon card
- border radius: 12 px
- border: theme border
- background: `#041426` at ~88%
- padding: 24 px base / 28 px md

### Status card header
- icon: 28 px
- title: 21 px semibold
- title color: primary
- bottom padding: 24 px
- bottom divider: white at 15%
- icon/title gap: 16 px

### Status rows
Each:
- minimum height: 82 px
- vertical padding: 12 px
- icon/label/value gap: 16 px
- bottom divider: white at 15%
- icon: 26 px
- label: 17 px
- value: 16 px, medium, right aligned
- value uses `margin-left: auto`

Installed badge:
- border radius: ~6 px
- horizontal padding: 12 px
- vertical padding: 4 px
- installed: lime/green
- not installed: red

### Search updates button
- top margin: 24 px
- full width
- minimum height: 64 px
- border radius: 8 px
- background: `#0d2844`
- font size: 17 px
- search icon: 26 px

## Exact theme values relevant to the Addon inner panel

- `--background`: `#030d1b`
- `--foreground`: `#f5f1e9`
- `--card`: `#07182c`
- `--primary`: `#f6b21a`
- `--primary-foreground`: `#101521`
- `--secondary`: `#0d2742`
- `--secondary-foreground`: `#f4efe7`
- `--muted`: `#0a2139`
- `--muted-foreground`: `#aab6c5`
- `--accent`: `#173b61`
- `--accent-foreground`: `#f9fbff`
- `--destructive`: `#d4183d`
- `--border`: `rgba(183, 202, 223, 0.26)`
- `--input-background`: `#06172b`
- `--ring`: `#f6b21a`
- base radius: `0.75rem` = 12 px

## Source structure

The exact source files from Figma Make are included next to this document:

- `App.tsx`
- `theme.css`

Treat them as DESIGN REFERENCES only.

Do not ship them with KeystoneClient.
Do not migrate KeystoneClient to React.
Do not replace the current application shell.

Only translate the central Addon panel into the existing Python/Tkinter implementation.
