# KeystoneSync

KeystoneSync tracks World of Warcraft Retail Mythic+ character state, syncs it from local SavedVariables, stores it in a Cloudflare Worker/D1 backend, and displays it in a Next.js Web app.

- **Web:** https://keystonesync.esgarpe.dev
- **API:** https://api-keystonesync.esgarpe.dev
- **Addon source:** `Speeson/KeystoneSync` is the canonical manually edited addon repository.

---

## Current Architecture

```text
World of Warcraft
      |
      v
KeystoneSync addon
      |
      v
KeystoneSyncDB SavedVariables
      |
      v
KeystoneClient
      |
      v
https://api-keystonesync.esgarpe.dev
      |
      v
Cloudflare Worker / Hono
      |
      v
Cloudflare D1: keystone-sync
      |
      v
KeystoneSync Web / Next.js
```

Current production persistence is Cloudflare D1 database `keystone-sync`. PostgreSQL is part of the former FastAPI/Railway backend history only.

---

## Current Components

### `Speeson/KeystoneSync` addon

World of Warcraft Retail addon written in Lua. It writes character data to `KeystoneSyncDB` SavedVariables for external tools to read. The standalone `Speeson/KeystoneSync` repository is the only manually edited addon source.

Verified checked-out addon metadata:

- Version: `0.1.16`
- Interface: `120005`
- SavedVariables: `KeystoneSyncDB`

The addon records current keystone data and weekly state such as Great Vault, Prey Hunts, currencies, money, item level, and Mythic+ season data. The SavedVariables file is written by WoW at:

```text
World of Warcraft/_retail_/WTF/Account/<ACCOUNT>/SavedVariables/KeystoneSync.lua
```

KeystoneClient does not embed or package addon runtime files. Addon installation and updates are consumed directly from `Speeson/KeystoneSync` GitHub Releases.

### `keystone-client`

Current Windows desktop client.

Responsibilities:

- discovers WoW installs and `KeystoneSync.lua` SavedVariables files;
- supports selected WoW account folders;
- parses `KeystoneSyncDB` with `slpp`;
- enriches character data with Raider.IO where relevant;
- builds the sync payload;
- posts to `POST /api/keystones/update` on the Worker API;
- checks `Speeson/KeystoneSync` releases for addon updates in the background;
- installs, updates, or reinstalls the addon from validated release ZIPs when the user requests it;
- keeps one validated local addon ZIP cache for recovery;
- runs as a packaged Windows application.

Current version:

```text
0.2.1
```

Default API URL:

```text
https://api-keystonesync.esgarpe.dev
```

The client normalizes the old Railway API URL to the current API URL.

Build scripts:

```bat
cd keystone-client
build.bat
```

Produces:

```text
keystone-client\dist\KeystoneClient.exe
```

Installer build:

```bat
cd keystone-client
build_installer.bat
```

Produces:

```text
keystone-client\installer\output\KeystoneClientSetup.exe
```

The expected public GitHub Release asset name is:

```text
KeystoneClientSetup.exe
```

Client releases are automated from `main` when Deployment Impact reports `CLIENT_RELEASE=true` and a valid pending Client changeset exists. The release workflow bumps `keystone-client/VERSION`, builds `KeystoneClientSetup.exe`, pushes the release commit plus `client-vX.Y.Z` tag atomically, and publishes the GitHub Release.

### `keystone-worker`

Current API backend.

Responsibilities:

- Cloudflare Worker runtime;
- Hono HTTP API;
- auth, profile, character, keystone sync, team, invitation, and health routes;
- Cloudflare D1 persistence through binding `DB`;
- JSON persistence for additive addon/client data blocks.

Production API domain:

```text
https://api-keystonesync.esgarpe.dev
```

D1 database:

```text
keystone-sync
```

Useful scripts:

```bash
cd keystone-worker
npm run dev
npm run typecheck
npm test
npm run d1:migrate:local
npm run d1:migrate:remote
npm run deploy
```

Remote D1 migrations and `npm run deploy` are operational actions. They require explicit authorization in the current task and are not normal validation defaults.

### `keystone-web`

Current Web application.

Responsibilities:

- Next.js Web UI;
- login/register/profile flows;
- character, dashboard, summary, team, invitation, and settings views;
- consumes the Worker API through `NEXT_PUBLIC_API_URL`;
- links users to the current client installer GitHub Release asset.

Verified stack:

- Next.js `16.2.6`
- React `19.2.4`
- Tailwind CSS

API configuration:

```env
NEXT_PUBLIC_API_URL=https://api-keystonesync.esgarpe.dev
```

Build and validation:

```bash
cd keystone-web
npm run lint
npm run build
```

The Web application is currently documented as deployed through Vercel. The exact external Git Integration configuration is not versioned in this repository, so this README does not claim a checked-in workflow controls deployment.

---

## Data Flow

1. The user installs KeystoneClient.
2. KeystoneClient checks the canonical addon GitHub Releases in the background.
3. The user installs or updates the KeystoneSync addon from KeystoneClient.
4. The user logs into World of Warcraft Retail with level-90 characters.
5. The addon writes `KeystoneSyncDB` to WoW SavedVariables.
6. KeystoneClient discovers selected SavedVariables files.
7. KeystoneClient parses the Lua table, enriches with Raider.IO where relevant, and builds a JSON sync payload.
8. KeystoneClient posts the payload to `POST /api/keystones/update`.
9. `keystone-worker` persists character JSON blocks and current keystone snapshots in D1.
10. `keystone-web` reads character/team data from the Worker API and renders the dashboard, characters, teams, and summary views.

Primary source files for this flow:

- Addon source/releases: `Speeson/KeystoneSync`
- Addon updater/cache/install code: `keystone-client/addon_updater.py`, `keystone-client/addon_installer.py`
- SavedVariables discovery: `keystone-client/wow_path.py`
- Client parse/payload/sync: `keystone-client/sync_worker.py`
- Sync endpoint: `keystone-worker/src/routes/keystones.ts`
- D1 schema: `keystone-worker/migrations/0001_initial.sql`
- Read responses: `keystone-worker/src/routes/me.ts`, `keystone-worker/src/db.ts`, `keystone-worker/src/routes/teams.ts`
- Web API helper: `keystone-web/lib/auth.ts`
- Web consumers: `keystone-web/app/dashboard/page.tsx`, `keystone-web/app/characters/page.tsx`, `keystone-web/app/summary/page.tsx`, `keystone-web/app/teams/[id]/page.tsx`

---

## Deployment And Release Status

| Area | Status | Notes |
| --- | --- | --- |
| Web | Partial / external | Build and lint scripts are versioned. Deployment is documented as Vercel-based, but external Git Integration settings are not stored here. |
| Worker | Manual | Wrangler scripts are versioned. Deploy and remote D1 migration require explicit authorization. |
| Client | Automated release on qualifying `main` push | PyInstaller/Inno Setup build the app and installer. Release-impacting Client changes require a pending `.changes/` changeset and publish `KeystoneClientSetup.exe` under `client-vX.Y.Z`. |
| Addon | Independent external release | `Speeson/KeystoneSync` is the canonical addon source. KeystoneClient can install standalone addon release ZIPs without a new Client release. This repository does not publish addon releases. |
| Deployment Impact | Scripted | Run `python scripts/deploy_impact.py --files <changed-paths>` before deploy/release decisions. The script classifies impact only; it does not deploy or release. |

CI/CD workflow infrastructure is versioned under `.github/workflows/`:

- `deploy.yml` calculates Deployment Impact and calls only relevant validation/build workflows.
- `deploy-web.yml` validates the Web app; deployment remains documented as Vercel-managed externally.
- `deploy-worker.yml` validates Worker changes and supports guarded manual Worker deploy / remote D1 migration.
- `build-client.yml` builds the Windows installer artifact with read-only permissions for build-only validation/orchestration.
- `release-client.yml` supports `build-only`, `release-dry-run`, and `release`; `deploy.yml` calls release mode automatically for qualifying `main` pushes.

Standalone addon workflows are now owned by `Speeson/KeystoneSync`. This repository keeps only a pointer under `docs/workflow-handoff/addon/` and must not publish addon releases. No cross-repository token is used; each repository publishes only its own releases.

---

## Addon Updates

KeystoneClient does not bundle KeystoneSync addon files.

After startup, the Client checks stable GitHub Releases from `Speeson/KeystoneSync` in the background. It never installs automatically. The user must click Install, Update, or Reinstall.

The updater consumes only the dedicated `KeystoneSync-vX.Y.Z.zip` release asset, validates the package, stores the last validated ZIP under `%APPDATA%\KeystoneClient\addon-cache\`, and safely installs it into the selected WoW Retail AddOns folder.

Client releases are not required for ordinary addon-only updates.

---

## Historical Components

Previous implementations based on FastAPI / SQLAlchemy / PostgreSQL / Railway and the original script-only sync client were removed after migration to the current Worker/D1 and KeystoneClient architecture. Their implementation history remains available through Git.

Historical references may still appear in migration plans and retained design notes. Do not treat those documents as current setup instructions.

Removed paths:

- `keystone-api/` - former FastAPI / SQLAlchemy / PostgreSQL / Railway backend.
- `keystone-sync-client/` - former script-based synchronization client.

---

## Repository Structure

```text
weeklyChar/
|-- .agents/                         # Project agent skills
|-- docs/                            # Modernization plans and project context
|-- scripts/                         # Repository validation and impact tooling
|-- keystone-client/                 # Current Windows client
|   |-- sync_worker.py               # SavedVariables parse/payload/API sync
|   |-- wow_path.py                  # WoW install and SavedVariables discovery
|   |-- addon_installer.py           # Local addon state/install/rollback
|   `-- addon_updater.py             # GitHub release updater and cache
|-- keystone-worker/                 # Current Worker API and D1 integration
|   |-- src/
|   |-- migrations/
|   `-- wrangler.jsonc
|-- keystone-web/                    # Current Next.js Web app
`-- RELEASE_WORKFLOW.md              # Manual release/push rules
```

---

## Modernization Notes

Modernization work is governed by:

- `AGENTS.md`
- `docs/AGENT_CONTEXT.md`
- `docs/KEYSTONESYNC_ACTION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_CONTRACT.md`

Do not embed addon runtime files into KeystoneClient, create CI/CD workflows, deploy, release, tag, push, or run remote migrations unless the current task explicitly authorizes that work.

Before deciding what to build, deploy, migrate, or release, run:

```bash
python scripts/deploy_impact.py --files <changed-paths>
```

Use `--addon-changed` when the external canonical `Speeson/KeystoneSync` addon repository changed.

---

## License

This project is proprietary. The code is published for consultation and development transparency, but no permission is granted to copy, modify, redistribute, resell, republish, host, package, or create derivative works without prior written authorization.

See [LICENSE](LICENSE) for the complete terms.
