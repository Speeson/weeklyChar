# Stone Selector S5 — KeystoneClient Teams UI design

## Objective

Add a first-class localized Teams page to KeystoneClient that lets an authenticated user select a Team and Season 2 dungeon, inspect aggregate loot demand, expand character item grids, and use a compact safe tooltip. Party composition remains deferred.

## Approved design

The existing shell gains a middle `Equipos` / `Teams` tab. The page uses a compact horizontally scrollable member dashboard above a two-column Selector: all eight canonical dungeons form a vertical rail and the selected dungeon's independently scrollable result fills the right panel. Zero-stone dungeons remain selectable. No dungeon is selected automatically.

The right panel has an initial prompt, then local loading/error/empty/populated states. Its selected header contains `Objetivos`, a disabled `Planificar piedra · Próximamente` control, and close. Server summary values and character order are preserved. Character cards start collapsed, offer spec filters only when useful, separate completed Voidcore objectives, and render actionable objectives in ordered tier grids. A portal tooltip supports hover, focus, click pinning, outside click, and Escape without numeric stats.

## Architecture

- `App` and `KeystoneShell` own first-class navigation and session-expiry routing.
- `TeamsPage` owns view state and calls only an injected `TeamsDataSource`; the live source delegates to the S4 `teams.*` bridge wrappers.
- `core/teams.ts` owns stone-count, filtering, grouping, naming, and request-identity helpers rather than JSX business parsing.
- Client-local Season 2 display metadata is intentionally minimal. Cross-surface packaging remains deferred.
- `core/teamsPreview.ts` centralizes deterministic data-source fixtures selected from the existing `?preview=` mechanism. Production JSX contains no scenario branches.
- No Worker, D1, addon, protocol, credential, or direct browser HTTP contract changes occur.

## Verification

- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- focused and full `npm --prefix keystone-client run test:visual`
- Python Client and bridge suites
- Rust format/check/tests
- PyInstaller sidecar build and smoke
- strict incremental and cumulative Deployment Impact
- manual inspection of early and final Playwright screenshots at 1672×941 and reduced scale

## Out of scope

No automatic party composition, recommendation endpoint, Team creation/joining, Worker changes, addon changes, version bump, release, deployment, push, or changeset consumption.
