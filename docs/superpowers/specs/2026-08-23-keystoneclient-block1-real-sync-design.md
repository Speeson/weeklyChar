# KeystoneClient Block 1 Real Synchronization Design

## Objective

Connect the approved Tauri synchronization screen to production-shaped character data and restore the automatic synchronization lifecycle from the Python client without redesigning the shell or changing Worker/D1 schemas.

## Approved Design

- Keep the current header, footer, summary cards, character table geometry, sidebar and Addon screen.
- Production mode renders sanitized characters from `GET /api/me/characters`; preview mode keeps deterministic fixtures.
- Character rows use Raider.IO avatars with a class-colored initial fallback, WoW class name colors, continuous approved item-level and Raider.IO gradients, Python-compatible keystone text, sortable headers and safe row navigation to Raider.IO.
- The character summary reports the real character list size while the account summary remains based on selected WoW accounts.
- Loading, empty and recoverable refresh-error states stay inside the existing table panel.

## Architecture

- `character_service.py` owns cached character loading, remote refresh, optional Raider.IO enrichment, DTO sanitization and coalesced background refreshes. Tokens remain Python-side.
- The private JSONL bridge adds allowlisted `characters.get`, `characters.refresh` and `characters.updated` capabilities. `system.get_state` includes cached character state.
- `SyncService` remains the only SavedVariables monitor owner and gains idempotent reconciliation after startup, authentication and WoW configuration changes.
- Successful foreground or watcher synchronization schedules a character refresh without blocking the monitor.
- `AddonService` performs one background release check per active AddOns path; install/update/reinstall remain explicit user actions.
- Rust keeps the bridge allowlist in sync and exposes a scoped Raider.IO character opener that constructs and encodes the URL from structured fields.
- This is an internal Client DTO/IPC extension. The addon, Worker API, D1 schema and cross-product tracked-data contract do not change.

## Compatibility

- Continue using `%APPDATA%\KeystoneClient\config.json` and its existing `cached_characters`, `wow_install_path`, `wow_path` and `wow_accounts_selected` keys.
- Selecting the same installation through its base, `_retail_` or AddOns folder preserves matching account selections.
- A genuine install change preserves only account names still discovered in the new installation.
- Refresh failures retain usable in-memory/cached characters and expose only user-safe errors.

## Verification

- `python -m compileall -q keystone-client scripts`
- `python -m unittest discover -s tests/client`
- `python -m unittest discover -s tests/client_bridge`
- `cd keystone-client-next && npm test`
- `cd keystone-client-next && npm run build`
- `cd keystone-client-next/src-tauri && cargo test`
- `cd keystone-client-next/src-tauri && cargo check`
- `cd keystone-client-next && npx playwright test`
- `git diff --check`
- `python scripts/deploy_impact.py --files <changed-paths> --json --strict`

## Out Of Scope

- Login/onboarding redesign, host updater and changelog work.
- WoW Phase 12, seasonal IDs or dungeon-pool updates.
- Worker, D1 or public API schema changes.
- Automatic addon installation or update.
- Release cutover, version bump, push, tag, release or deployment.
