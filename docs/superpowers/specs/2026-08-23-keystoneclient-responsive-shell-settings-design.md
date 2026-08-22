# KeystoneClient Responsive Shell And Settings Design

## Goal

Keep the existing `1672x941` client composition and ordering unchanged while allowing the desktop window to grow or shrink without distorting any visual element. Align and simplify the footer, correct the header controls, and bring the settings dialog closer to the legacy client's option set using the current blue and gold visual language.

## Responsive Window

- The application keeps a logical design canvas of `1672x941`.
- A single scale factor is calculated from the available viewport width and height.
- Width, height, text, assets, and spacing scale together; no section is reordered or independently reflowed.
- Extra space caused by a different host-window aspect ratio is centered around the canvas.
- The Tauri window starts at the original logical size and is resizable, with a practical minimum size that uses the same aspect ratio.

## Main Shell Changes

- Preserve the existing header, main content, and footer structure.
- Remove the decorative `04-footer` and `11-footer-shell` layers.
- Keep only the footer background and the two footer actions.
- Place `Acceder a la Web` at the left and `Minimizar a la bandeja` at the right with equal dimensions, symmetric horizontal offsets, and shared vertical centering.
- Keep `14-user-dropdown-shell` as the user-control shell and remove the separately overlaid `25-dropdown-icon`.
- Keep the avatar content within the shell.
- Normalize the visible sizes of the minimize and close image assets despite their different transparent padding.

## Settings Dialog

The dialog uses the current client styling and a single vertically ordered flow:

1. General settings: start with Windows, start minimized, and minimize on close.
2. WoW installation and account selection: installation path, folder change/save, detected accounts, addon state, redetection, select all, account save, and navigation to the Addon view.
3. Application settings: language, client version, release/update controls, last update check, and close.

Options that are not yet backed by the migrated Tauri/Core contract remain visibly unavailable rather than simulating success. This currently applies to Windows auto-start and the Phase 12 client self-updater controls.

## Verification

- Run the frontend unit tests and production build.
- Exercise the preview at the full logical size and at a smaller same-ratio viewport.
- Confirm the rendered frame keeps the `1672:941` ratio at both sizes.
- Capture screenshots of the main synchronized view and the settings dialog.
- Review the final diff and run the deployment-impact classifier.
