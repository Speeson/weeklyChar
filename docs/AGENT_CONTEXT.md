# KeystoneSync Agent Context

## Project purpose

KeystoneSync tracks World of Warcraft Retail Mythic+ character state, including current keystones and weekly progression data. The current repository evidence shows a WoW addon writes `KeystoneSyncDB`, the Windows client reads that SavedVariables file and syncs it to the API, the Worker persists it in D1, and the Web app renders it.

## Current modernization status

`docs/KEYSTONESYNC_ACTION_PLAN.md` is the master modernization plan. Phases 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, and 10 are complete. The repository now retains the current Worker/D1 backend, current KeystoneClient, current Web app, a generated client addon bundle, historical documentation, project skills aligned to the verified architecture, local validation around the addon -> Client -> Worker data path, deterministic deployment-impact tooling, and selective GitHub Actions workflow infrastructure. Phase 10 workflows were pushed to GitHub and user-verified as passing after external Actions/environment configuration. The next planned milestone is Phase 11, decoupling addon releases from Client releases.

## Verified current architecture

- Active backend/API: `keystone-worker`, a Cloudflare Worker using Hono. `keystone-worker/wrangler.jsonc` binds the Worker to `api-keystonesync.esgarpe.dev`.
- Active database: Cloudflare D1 binding `DB`, database name `keystone-sync`, configured in `keystone-worker/wrangler.jsonc`. Schema is in `keystone-worker/migrations/0001_initial.sql`.
- Active Web application: `keystone-web`, a Next.js app. `keystone-web/lib/auth.ts` uses `NEXT_PUBLIC_API_URL` with fallback `https://api-keystonesync.esgarpe.dev`.
- Active Windows client: `keystone-client`. Its config defaults to `https://api-keystonesync.esgarpe.dev` and normalizes the old Railway URL to that value.
- Client release asset expected by Web and updater: `KeystoneClientSetup.exe` from the `Speeson/weeklyChar` GitHub Releases latest download path.

## Removed legacy implementations

- `keystone-api` was removed after final verification that current Web/client callers target the Worker API domain and that `keystone-worker` implements the active auth, character, keystone sync, team, invitation, profile, and health routes.
- `keystone-sync-client` was removed after final verification that `keystone-client` owns SavedVariables discovery, parsing, Raider.IO enrichment, sync, UI/tray behavior, API targeting, and build/installer packaging.
- Railway, FastAPI, and PostgreSQL are historical architecture only. Historical implementation details remain available through Git history and retained historical documents.

## Still unresolved

- Actual external deployment ownership for `keystone-web` cannot be fully proven from checked-in config alone. The Web docs identify Vercel as the documented deployment target, but no checked-in Vercel Git Integration configuration exists. The checked-in Web workflow validates build/lint only and does not deploy to Vercel.
- Local availability of a `Speeson/KeystoneSync` checkout is not guaranteed for every task. Agents should use an explicit `--source` path or `KEYSTONESYNC_ADDON_SOURCE` for addon bundle synchronization when needed.
- WoW patch-sensitive facts, seasonal IDs, dungeon pools, and API compatibility remain pending the dedicated patch/season audit.

## Data flow

Verified source path:

```text
KeystoneSync addon
  -> KeystoneSyncDB SavedVariables
  -> keystone-client/sync_worker.py
  -> POST /api/keystones/update
  -> keystone-worker D1 tables
  -> GET /api/me/characters and team detail read helpers
  -> keystone-web pages/components
```

Main implementation points:

- Canonical addon source `Speeson/KeystoneSync`: `SaveCharacterData()` writes `KeystoneSyncDB`; `UpdateMythicPlusSeason()` writes the season block.
- Generated bundled addon copy `keystone-client/addon/KeystoneSync/`: packaged by KeystoneClient and synchronized from the canonical addon source.
- `keystone-client/wow_path.py`: discovers `World of Warcraft/_retail_/WTF/Account/*/SavedVariables/KeystoneSync.lua`.
- `keystone-client/sync_worker.py`: `SyncWorker._sync()` parses SavedVariables with `slpp`, fetches Raider.IO enrichment, builds the payload, and posts to `/api/keystones/update`.
- `keystone-worker/src/routes/keystones.ts`: receives sync payloads and persists character JSON blocks plus current keystone snapshots.
- `keystone-worker/src/db.ts`: `characterResponse()`, `charactersForUser()`, and `latestRealKeystone()` build read responses.
- `keystone-worker/src/routes/me.ts`: `GET /api/me/characters` exposes user characters.
- `keystone-worker/src/routes/teams.ts`: team detail responses expose member characters through shared DB helpers.
- `keystone-web/lib/auth.ts`: `apiFetch()` centralizes Web API calls.
- `keystone-web/app/dashboard/page.tsx`, `keystone-web/app/characters/page.tsx`, `keystone-web/app/summary/page.tsx`, and `keystone-web/app/teams/[id]/page.tsx`: consume character and team character data.

## Current versions

Verified from checked-out files:

- Canonical addon repo `Speeson/KeystoneSync` at verified `main`/`v0.1.16`: `Version: 0.1.16`, `Interface: 120005`
- Generated bundled client addon copy `keystone-client/addon/KeystoneSync/KeystoneSync.toc`: `Version: 0.1.16`, `Interface: 120005`
- Windows client `keystone-client/VERSION`: `0.2.1`
- Windows installer `keystone-client/installer/version.ini`: `AppVersion=0.2.1`
- Web package `keystone-web/package.json`: package version `0.1.0`, Next.js `16.2.6`
- Worker package `keystone-worker/package.json`: package version `0.1.0`
- Worker compatibility date `keystone-worker/wrangler.jsonc`: `2026-07-25`

## Deployment and release model

- Web: build/lint scripts exist in `keystone-web/package.json`. Deployment is documented as Vercel-based, but checked-in deployment ownership is not fully provable.
- Worker: `keystone-worker/package.json` defines local dev, deploy, typecheck, tests, and local/remote D1 migration scripts. Remote deploy/migration requires explicit authorization.
- Client: PyInstaller and Inno Setup scripts produce `KeystoneClient.exe` and `installer/output/KeystoneClientSetup.exe`. Releases are manual through GitHub Releases.
- Addon: changes go to canonical `Speeson/KeystoneSync` with version tags after explicit confirmation. The weeklyChar client bundle is refreshed with `scripts/sync_addon.py --source <path>` and verified with `scripts/check_addon_sync.py --source <path>` before client packaging when addon files change.
- Deterministic deployment-impact script: `scripts/deploy_impact.py`.
- Deployment Impact dimensions: `WEB`, `WORKER`, `DB`, `CLIENT_BUILD`, `CLIENT_RELEASE`, `ADDON`, `ADDON_RELEASE`.
- External canonical addon changes are represented with `python scripts/deploy_impact.py --addon-changed` because `Speeson/KeystoneSync` is outside this repository.
- Current addon/client coupling policy: addon source or generated bundle changes imply `ADDON`, `ADDON_RELEASE`, `CLIENT_BUILD`, and `CLIENT_RELEASE` because KeystoneClient still bundles the addon and Phase 11 has not implemented a remote addon updater.
- Unknown or outside-repository paths are reported by the impact script; `--strict` exits non-zero for them.
- CI/CD orchestrator: `.github/workflows/deploy.yml` calculates Deployment Impact in strict mode and calls relevant reusable workflows.
- Web workflow: `.github/workflows/deploy-web.yml` validates build and lint. Build is blocking; lint is temporarily non-blocking because of the documented Phase 8 baseline. Web production deployment remains documented as externally Vercel-managed.
- Worker workflow: `.github/workflows/deploy-worker.yml` validates `npm run typecheck` and `npm test`; Worker deploy and remote D1 migrations are guarded behind manual inputs and `production` environment.
- Client build workflow: `.github/workflows/build-client.yml` builds the Windows installer on `windows-latest` with read-only permissions and uploads `KeystoneClientSetup.exe` as a workflow artifact for validation/orchestration.
- Client release workflow: `.github/workflows/release-client.yml` builds the Windows installer and publishes a GitHub Release only when manually run with `publish_release=true`.
- Client release tag convention: `client-vX.Y.Z`, derived from `keystone-client/VERSION`.
- Addon workflows: prepared as handoff files in `docs/workflow-handoff/addon/` because the canonical `Speeson/KeystoneSync` repository is external and was not modified in Phase 10.
- GitHub Actions operational status: user confirmed the required GitHub-side configuration was added and validation workflows passed. Required external configuration includes `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the GitHub `production` environment. Secret values and exact external settings are not versioned in this repository.

## Validation baseline

- Worker: `cd keystone-worker; npm run typecheck; npm test`. Worker tests cover weekly reset helpers plus route-level sync behavior using a local in-memory D1 test double.
- Client: `python -m compileall -q keystone-client scripts` and `python -m unittest discover -s tests/client`. Client tests parse synthetic SavedVariables fixtures and validate the outbound Worker payload shape without live Raider.IO calls.
- Addon bundle: `python scripts/validate_addon.py` validates generated bundle structure and `.toc` entries locally. Full canonical-source divergence validation requires `python scripts/validate_addon.py --source <path-to-Speeson-KeystoneSync>` or `python scripts/check_addon_sync.py --source <path-to-Speeson-KeystoneSync>`.
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
- The root `KeystoneSync/` duplicate was removed in Phase 5. The client addon bundle is generated content and must not be edited directly.
- Deployment/release impact must be determined by `scripts/deploy_impact.py`, not by memory. Reporting remote impact does not authorize deployment, remote D1 migration, tag, release, or push.

## Known risks / ambiguities

- Historical FastAPI/Railway docs are retained for project history and should not be used as current architecture instructions.
- Addon bundle divergence is checked by `scripts/check_addon_sync.py` when a canonical source path is supplied. Structural bundle validation is available through `scripts/validate_addon.py`; CI enforcement is not present until later automation phases.
- `KeystoneSyncDB.keystoneWeeklyResetKey` and `mythicPlusSeasonUpdatedAt` are written by the addon but are not currently included in the client sync payload.
- Web API response types are duplicated in individual pages, and seasonal dungeon/currency metadata remains hardcoded pending the WoW patch/season phase.

## Current WoW patch / season status

The master plan records WoW 12.1 basic addon compatibility as manually verified. The `.toc` Interface value, seasonal data, hardcoded IDs, dungeon pools, and WoW API details are pending the dedicated WoW patch/season audit.

## Next planned milestone

Phase 11 - Decouple addon releases from Client releases.
