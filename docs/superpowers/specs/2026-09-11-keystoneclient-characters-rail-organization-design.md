# KeystoneClient Characters rail organization

## Objective

Compact the Characters sidebar while keeping account/realm navigation, character selection and
active/inactive drag organization clear and usable at supported window sizes.

## Approved design

- Replace the separate Account and Realm controls with one collapsible **Account and realm**
  section and one hierarchical selector: accounts are the first level and each account expands to
  its realms before a realm is selected.
- Make both **Account and realm** and **Characters** section headers clickable accordions. Their
  expanded/collapsed state is temporary UI state and is not persisted.
- Keep active characters in the available sidebar space. Make **Inactive** a compact tray by
  default; clicking it opens an anchored panel upward without permanently reducing active space.
- The compact inactive tray remains a drop target. Dropping a character into it moves the card
  directly into the inactive collection even while the tray is closed.
- Preserve bidirectional drag/drop, accessible move buttons, local inactive-ID persistence and the
  50 % opacity/blur drag feedback.
- Replace the selected character's inner outline with a glow on the complete draggable card. The
  card must not scale or change layout.

## Architecture

- `CharactersPage.tsx` owns temporary accordion/menu state and derives account-to-realm options
  from the existing character DTO.
- `characterTracking.ts` remains the only persistence boundary for inactive character IDs.
- `App.css` owns compact tray, upward popover and selected-card illumination.
- No JSONL, sidecar, Worker, D1, Web or SavedVariables contract changes.

## Verification

- Vitest coverage for hierarchical selection, collapsible sections, compact inactive drop and
  selected-card state.
- Playwright coverage at 1672×941 and 940×529, including drop into a closed inactive tray.
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- Targeted and complete Client visual tests as applicable.
- Portable `tauri build --no-bundle` after frontend validation.

## Out of scope

- Reordering characters inside one zone.
- Stopping synchronization or deleting an inactive character.
- Persisting accordion expansion state.
- Any backend, database, Web or addon change.
