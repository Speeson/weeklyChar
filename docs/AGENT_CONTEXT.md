# KeystoneSync Agent Context

## Project purpose

KeystoneSync tracks World of Warcraft Retail Mythic+ character state, including current keystones and weekly progression data. The current repository evidence shows a WoW addon writes `KeystoneSyncDB`, the Windows client reads that SavedVariables file and syncs it to the API, the Worker persists it in D1, and the Web app renders it.

## Current modernization status

`docs/KEYSTONESYNC_ACTION_PLAN.md` is the master modernization plan. Phases 0 through 11 are complete. KeystoneClient 0.4.0 is the released Tauri/React/Rust client, backed by its packaged Python JSONL sidecar and NSIS installer. The post-cutover cleanup unifies all active Client code under the canonical `keystone-client/` tree while preserving release, updater, AppData and Inno 0.3.0 migration contracts.

## Verified current architecture

- Active backend/API: `keystone-worker`, a Cloudflare Worker using Hono. `keystone-worker/wrangler.jsonc` binds the Worker to `api-keystonesync.esgarpe.dev`.
- Active database: Cloudflare D1 binding `DB`, database name `keystone-sync`, configured in `keystone-worker/wrangler.jsonc`. Schema is in `keystone-worker/migrations/0001_initial.sql`.
- Active Web application: `keystone-web`, a Next.js app. `keystone-web/lib/auth.ts` uses `NEXT_PUBLIC_API_URL` with fallback `https://api-keystonesync.esgarpe.dev`.
- Active Windows client: `keystone-client`. React/TypeScript owns the UI, Rust/Tauri owns native lifecycle and NSIS packaging, and `keystone-client/sidecar/` owns the Python domain services and JSONL bridge. Its config defaults to `https://api-keystonesync.esgarpe.dev` and normalizes the old Railway URL to that value.
- Client release asset expected by Web and updater: `KeystoneClientSetup.exe` from the `Speeson/weeklyChar` GitHub Releases latest download path.

## Removed legacy implementations

- `keystone-api` was removed after final verification that current Web/client callers target the Worker API domain and that `keystone-worker` implements the active auth, character, keystone sync, team, invitation, profile, and health routes.
- `keystone-sync-client` was removed after final verification that `keystone-client` owns SavedVariables discovery, parsing, Raider.IO enrichment, sync, UI/tray behavior, API targeting, and build/installer packaging.
- Railway, FastAPI, and PostgreSQL are historical architecture only. Historical implementation details remain available through Git history and retained historical documents.

## Still unresolved

- Actual external deployment ownership for `keystone-web` cannot be fully proven from checked-in config alone. The Web docs identify Vercel as the documented deployment target, but no checked-in Vercel Git Integration configuration exists. The checked-in Web workflow validates build/lint only and does not deploy to Vercel.
- Local availability of a `Speeson/KeystoneSync` checkout is not guaranteed for every task. KeystoneClient consumes addon releases from GitHub Releases, not a checked-in client bundle.
- WoW patch-sensitive facts, seasonal IDs, dungeon pools, and API compatibility remain pending the dedicated patch/season audit.

## Data flow

Verified source path:

```text
KeystoneSync addon
  -> KeystoneSyncDB SavedVariables
  -> keystone-client/sidecar/sync_worker.py
  -> POST /api/keystones/update
  -> keystone-worker D1 tables
  -> GET /api/me/characters and team detail read helpers
  -> keystone-web pages/components
```

Main implementation points:

- Canonical addon source `Speeson/KeystoneSync`: `SaveCharacterData()` writes `KeystoneSyncDB`; `UpdateMythicPlusSeason()` writes the season block.
- Addon distribution to users: `Speeson/KeystoneSync` GitHub Release -> `KeystoneSync-vX.Y.Z.zip` -> `keystone-client/sidecar/addon_updater.py` -> validated local cache -> WoW AddOns folder.
- `keystone-client/sidecar/wow_path.py`: discovers `World of Warcraft/_retail_/WTF/Account/*/SavedVariables/KeystoneSync.lua`.
- `keystone-client/sidecar/sync_worker.py`: `SyncWorker._sync()` parses SavedVariables with `slpp`, fetches Raider.IO enrichment, builds the payload, and posts to `/api/keystones/update`.
- `keystone-client/sidecar/character_service.py`: sanitizes cached/API character DTOs, preserves cached rows on refresh failure, enriches missing display fields server-side and publishes `characters.updated` without exposing tokens.
- `keystone-client/sidecar/sync_service.py`: owns the single SavedVariables monitor, reconciles it against authentication/WoW account prerequisites and schedules character refresh after successful sync.
- `keystone-client/src/`: consumes `characters.get` / `characters.refresh`, renders real sortable character rows and uses a scoped Tauri command for Raider.IO profile navigation.
- The Tauri host owns the frameless window lifecycle, controlled close prompt, native minimize/tray actions, real Windows autostart and localized dynamic tray. Blocking sidecar requests run outside the UI thread, and explicit exit terminates the sidecar without waiting for the synchronization monitor. React owns the ES/EN presentation, login/onboarding routing and profile/avatar dialogs; account creation stays inside the client through the allowlisted `auth.register` bridge command and existing Worker endpoint.
- The legacy `minimize_on_close` config value is retained for compatibility but is neither shown nor used to bypass the Tauri close-choice dialog.
- `keystone-worker/src/routes/keystones.ts`: receives sync payloads and persists character JSON blocks plus current keystone snapshots.
- `keystone-worker/src/db.ts`: `characterResponse()`, `charactersForUser()`, and `latestRealKeystone()` build read responses.
- `keystone-worker/src/routes/me.ts`: `GET /api/me/characters` exposes user characters.
- `keystone-worker/src/routes/teams.ts`: team detail responses expose member characters through shared DB helpers.
- `keystone-web/lib/auth.ts`: `apiFetch()` centralizes Web API calls.
- `keystone-web/app/dashboard/page.tsx`, `keystone-web/app/characters/page.tsx`, `keystone-web/app/summary/page.tsx`, and `keystone-web/app/teams/[id]/page.tsx`: consume character and team character data.

## Current versions

Verified from checked-out files:

- Canonical addon repo `Speeson/KeystoneSync` at verified `main`/`v0.2.3`: `Version: 0.2.3`, `Interface: 120100`
- Canonical Windows client `keystone-client/VERSION`: `0.6.3`
- Current public Tauri release: `0.6.3`, tag `client-v0.6.3`, at commit `e1eadbdecc673b81220f8aab9601af6fc26e3552`
- Web package `keystone-web/package.json`: package version `0.1.0`, Next.js `16.2.6`
- Worker package `keystone-worker/package.json`: package version `0.1.0`
- Worker compatibility date `keystone-worker/wrangler.jsonc`: `2026-07-25`

## Deployment and release model

- Web: build/lint scripts exist in `keystone-web/package.json`. Deployment is documented as Vercel-based, but checked-in deployment ownership is not fully provable.
- Worker: `keystone-worker/package.json` defines local dev, deploy, typecheck, tests, and local/remote D1 migration scripts. Remote deploy/migration requires explicit authorization.
- Released Client: `keystone-client/VERSION` is canonical and `scripts/tauri_release.py` synchronizes package, Cargo and Tauri versions plus bundled release notes. The NSIS release assets are `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig`, and `latest.json`; the static updater endpoint is `https://github.com/Speeson/weeklyChar/releases/latest/download/latest.json`.
- Native Tauri build validation: Cargo resolves the updater/process/autostart plugins in `Cargo.lock`; `npm run tauri:build -- --bundles nsis` generates `src-tauri/target/release/KeystoneClient.exe` and `src-tauri/target/release/bundle/nsis/KeystoneClient_<version>_x64-setup.exe`. An unsigned local `0.4.0` package passed direct launch, sidecar, single-instance, tray-hide/restore, explicit exit, clean install and uninstall smoke tests while preserving the installed legacy client.
- Tauri update signing uses the official Tauri v2 updater chain. The single production public verification key is committed in `keystone-client/src-tauri/tauri.conf.json`; the encrypted private key is stored outside the repository and GitHub Actions receives it only through `TAURI_SIGNING_PRIVATE_KEY`, with its password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. No private updater key or password belongs in the repository.
- A local signed `0.4.0` NSIS build produced `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig` and a valid static `latest.json`. Release preflight checks build/manifest version, canonical asset URL and filename, signature contents and staged installer bytes, then verifies the Minisign signature with the same `minisign-verify` implementation used by the Tauri updater. Valid signatures pass while altered bytes and a wrong public key fail closed.
- Production Tauri cutover: KeystoneClient 0.4.0 was released and verified from commit `b927d6721ab68272413f1035e583886927caf5ae` with tag `client-v0.4.0`, the canonical installer/signature assets and public `latest.json`.
- Inno-to-NSIS migration: the Tauri installer uses machine-wide scope to match the public Inno client and a minimal preinstall hook for legacy AppId `{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}`. The hook runs the registered Inno uninstaller silently and aborts the NSIS installation if removal fails. The exact public `0.3.0` installer to CI-built `0.4.0` path preserved auth/config, WoW path, selected accounts, language/settings, addon cache and cached characters; it migrated an enabled legacy auto-start entry to the new executable, left one installation and one shortcut set, and retained AppData across uninstall/reinstall.
- Tauri updater signatures are not Windows Authenticode signatures. Authenticode remains unconfigured as a separate future concern.
- The Client workflows preserve `build-only`, `release-dry-run`, `release`, changeset planning, resume state and atomic tag/release publication. Automatic publication from a qualifying `main` push requires repository variable `TAURI_CLIENT_RELEASE_ENABLED=true`; manual `release` remains an explicit operation.
- Addon: changes go to canonical `Speeson/KeystoneSync` with version tags after explicit confirmation. Standalone addon releases use tag `vX.Y.Z`, asset `KeystoneSync-vX.Y.Z.zip`, and ZIP root `KeystoneSync/`. KeystoneClient checks these releases automatically in the background and installs/updates only after explicit user action.
- Client addon cache: `%APPDATA%\KeystoneClient\addon-cache\` stores the last successfully downloaded and validated addon ZIP for recovery. It is not canonical and must not cause automatic downgrade.
- Deterministic deployment-impact script: `scripts/deploy_impact.py`.
- Deployment Impact dimensions: `WEB`, `WORKER`, `DB`, `CLIENT_BUILD`, `CLIENT_RELEASE`, `ADDON`, `ADDON_RELEASE`.
- External canonical addon changes are represented with `python scripts/deploy_impact.py --addon-changed` because `Speeson/KeystoneSync` is outside this repository.
- Current addon/client coupling policy: external canonical addon changes imply `ADDON` and `ADDON_RELEASE` only. KeystoneClient updater/installer code changes imply `CLIENT_BUILD` and `CLIENT_RELEASE`, not `ADDON_RELEASE`.
- Unknown or outside-repository paths are reported by the impact script; `--strict` exits non-zero for them.
- CI/CD orchestrator: `.github/workflows/deploy.yml` calculates Deployment Impact in strict mode and calls relevant reusable workflows.
- Web workflow: `.github/workflows/deploy-web.yml` validates build and lint. Build is blocking; lint is temporarily non-blocking because of the documented Phase 8 baseline. Web production deployment remains documented as externally Vercel-managed.
- Worker workflow: `.github/workflows/deploy-worker.yml` validates `npm run typecheck` and `npm test`; Worker deploy and remote D1 migrations are guarded behind manual inputs and `production` environment.
- Client build workflow: `.github/workflows/build-client.yml` builds the Windows installer on `windows-latest` with read-only permissions and uploads `KeystoneClientSetup.exe` as a workflow artifact for validation/orchestration.
- Client release workflow: `.github/workflows/release-client.yml` supports `build-only`, `release-dry-run`, and `release`; PRs do not publish, while qualifying `main` pushes publish only when Deployment Impact reports `CLIENT_RELEASE=true` and `TAURI_CLIENT_RELEASE_ENABLED=true`.
- Client release tag convention: `client-vX.Y.Z`, derived from `keystone-client/VERSION`.
- Addon workflows: authoritative addon CI/CD lives in the standalone `Speeson/KeystoneSync` repository. `weeklyChar/docs/workflow-handoff/addon/` is only a pointer and must not contain active duplicate addon workflow YAML. weeklyChar must not publish addon releases.
- GitHub Actions operational status: user confirmed the required GitHub-side configuration was added and validation workflows passed. Required external configuration includes `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the GitHub `production` environment. Secret values and exact external settings are not versioned in this repository.

## Validation baseline

- Worker: `cd keystone-worker; npm run typecheck; npm test`. Worker tests cover weekly reset helpers plus route-level sync behavior using a local in-memory D1 test double.
- Client: compile and test `keystone-client/sidecar/`, run Vitest/Vite/Playwright under `keystone-client/`, run Cargo checks/tests against `keystone-client/src-tauri/Cargo.toml`, and build the sidecar with `python scripts/build_client_sidecar.py --clean`. Client tests parse synthetic SavedVariables fixtures and validate the outbound Worker payload shape without live Raider.IO calls.
- Addon updater tests live in `tests/client/test_addon_updater.py` and cover release metadata, ZIP security, cache fallback, safe install, rollback, and candidate selection.
- Web: `cd keystone-web; npm run build; npm run lint`. As of Phase 8, build passes and lint fails with a pre-existing baseline of 13 errors and 25 warnings under `keystone-web/app/**`.
- Shared fixtures live under `tests/fixtures/`.
- Deployment Impact: `python scripts/deploy_impact.py --files <changed-paths>` and `python -m unittest discover -s tests/deploy_impact`.

## Important architectural decisions

- Modernization work follows `docs/KEYSTONESYNC_ACTION_PLAN.md`.
- `docs/AGENT_CONTEXT.md` stores durable project state, not chronological work history.
- Detailed system architecture is documented in `docs/ARCHITECTURE.md`.
- The end-to-end tracked-data contract is documented in `docs/DATA_CONTRACT.md`.
- Project skills live under `.agents/skills/` and were reviewed against the verified architecture/data contract in Phase 7.
- The data contract spans addon SavedVariables, client parsing/payloads, Worker API, D1 persistence, and Web rendering.
- The root `KeystoneSync/` duplicate was removed in Phase 5. Phase 11 removed the remaining embedded Client addon bundle; do not recreate it without an explicit architecture change.
- Deployment/release impact must be determined by `scripts/deploy_impact.py`, not by memory. Reporting remote impact does not authorize deployment, remote D1 migration, tag, release, or push.

## Known risks / ambiguities

- Historical FastAPI/Railway docs are retained for project history and should not be used as current architecture instructions.
- The canonical addon repository is external. This repository contains addon updater tests and a pointer to addon workflow ownership, but no active embedded addon source and no active addon release workflows.
- `KeystoneSyncDB.keystoneWeeklyResetKey` and `mythicPlusSeasonUpdatedAt` are written by the addon but are not currently included in the client sync payload.
- Web API response types remain duplicated in individual pages. Midnight Season 2 dungeon and currency metadata is shared by the active Web views under `keystone-web/lib/season2.ts` and `keystone-web/lib/season2Currencies.ts`.

## Current WoW patch / season status

The application layers use the verified Midnight Season 2 pool (challenge map IDs 588, 587, 586, 584, 585, 249, 250, and 399) and canonical Season 2 currency keys. The standalone addon release `v0.2.3` implements Interface 120100, Season 2 currencies, Prey quest IDs, Trovehunter's Bounty, and the compatible KeystoneLoot V1 snapshot contract.

## Next planned milestone

Stone Selector S1 added the backend-only aggregate route
`GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`. It uses live Team
membership and sharing, actionable Voidcore counters, cross-spec canonical deduplication,
deterministic character ordering, current weekly stone availability, and existing Blizzard
metadata enrichment. S2 additively extends the Worker-owned item cache and shared safe objective
projection with localized equipment slot, item class, item subclass, and bounded stat names;
numeric stat quantities and raw Blizzard payloads remain excluded. Existing positive cache rows
upgrade lazily at their normal refresh boundary. Web tooltip rendering, Client UI/bridge, and
composition planning remain deferred. The Worker owns a minimal duplicate of the verified
Season 2 challenge-map allowlist; cross-surface consolidation is intentionally deferred.

Stone Selector S3 adds the Web-only inline Selector on the Team page. It always shows the eight
canonical Season 2 dungeons (including selectable zero-stone entries), consumes the S1 aggregate
route through a strict parser and abort/generation guards, and renders compact server-ordered
character summaries with multi-spec filtering and grouped item grids. A shared portal tooltip
applies S2 safe metadata to Selector, owner, and Team objective items on hover/focus/click/tap.
The exposed legacy Team planner UI and its visual components are removed; the disabled
`Planificar piedra · Próximamente` tab documents the future feature boundary. S4 Client bridge,
S5 Client Teams UI, and composition planning remain deferred.

KeystoneLoot V2-A, V2-B, V2-C, and the local V2-D release-readiness validation are complete
on `feature/keystoneloot-v2-a`. The committed phase SHAs are `a99cedfa6e293a374cea3bfb77970443851ba975`,
`d64db656dd7c3ebf513275b89c07416f7a880f7b`, and
`bf1b83e865ee29440ac3cf455fa82bc879577b0c`. The durable contract uses the existing
`shareKeystoneLootWithTeams` preference for both recommendations and allowlisted same-team
objective visibility, with live membership checks on every team request and no second privacy
column. Owner access remains independent of that preference.

Production rollout remains a separately authorized operation. Before deployment, configure
Cloudflare Worker secrets `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`, apply additive D1
migrations `0004_keystone_loot_item_metadata.sql` and
`0005_keystone_loot_item_tooltip_metadata.sql`, deploy the backward-compatible Worker, smoke
the owner/team objective routes, and only then deploy Web. Missing Blizzard credentials do not
break objective routes, but metadata falls back to `Objeto #<itemId>` and the generic icon;
deployment is technically safe without them, while configuring them first is the recommended
product rollout.
