# KeystoneSync Architecture

## Purpose

KeystoneSync tracks World of Warcraft Retail Mythic+ character state, moves it from local WoW SavedVariables into a Cloudflare Worker/D1 backend, and displays the resulting character, team, and summary data in the Web app.

## System Overview

```text
World of Warcraft
      |
      v
Speeson/KeystoneSync addon
      |
      v
KeystoneSyncDB SavedVariables
      |
      v
KeystoneClient
      |
      v
Cloudflare Worker / Hono
      |
      v
Cloudflare D1
      |
      v
KeystoneSync Web / Next.js
```

External enrichment:

```text
KeystoneClient
      |
      v
Raider.IO character profile API
```

## Repository Boundaries

### `Speeson/KeystoneSync`

Canonical manually edited WoW addon repository.

Owns:

- WoW addon source, version, changelog, and addon release history.
- `KeystoneSyncDB` SavedVariables production.
- WoW API reads, WoW event handling, local weekly-state capture, and weekly reset preservation rules.

Does not own:

- Worker API calls.
- D1 schema or persistence rules.
- Web presentation.
- KeystoneClient desktop UX.

KeystoneClient does not embed addon runtime files. Addon installation and updates are consumed from `Speeson/KeystoneSync` releases.

### `keystone-client`

Current Windows desktop client.

Owns:

- WoW install and account SavedVariables discovery in `keystone-client/wow_path.py`.
- Parsing `KeystoneSyncDB` with `slpp` in `keystone-client/sync_worker.py`.
- Raider.IO enrichment for avatar URL, score, class, and equipped item level fallback.
- Sync payload construction and `POST /api/keystones/update`.
- Windows desktop/tray UX, login, account selection, and local config.
- Checking addon releases in the background without blocking startup.
- Downloading, validating, caching, and installing standalone addon releases from `Speeson/KeystoneSync` after explicit user action.
- PyInstaller/Inno Setup build path for `KeystoneClientSetup.exe`.

Does not own:

- A second source of addon gameplay or seasonal tracking logic.
- D1 schema ownership.
- Web display semantics.

### `keystone-worker`

Current API backend, implemented as a Cloudflare Worker with Hono.

Owns:

- HTTP routes mounted in `keystone-worker/src/index.ts`.
- Authentication and sync-token handling.
- `POST /api/keystones/update` write handling in `keystone-worker/src/routes/keystones.ts`.
- D1 access helpers and read response shaping in `keystone-worker/src/db.ts`.
- Character, profile, team, invitation, auth, and health API behavior.
- Wrangler deployment and D1 migration scripts.

Does not own:

- WoW API reads.
- Client-side SavedVariables parsing.
- Web-specific presentation assumptions.

### Cloudflare D1

Current production persistence.

Owns:

- Durable storage for users, characters, current keystone snapshots, teams, team members, invitations, and rate limits.
- The schema in `keystone-worker/migrations/0001_initial.sql`.

Current database binding:

- Binding: `DB`
- Database name: `keystone-sync`
- Config: `keystone-worker/wrangler.jsonc`

### `keystone-web`

Current Next.js Web frontend.

Owns:

- Presentation and user interaction.
- Authenticated API calls through `keystone-web/lib/auth.ts`.
- Dashboard, characters, summary, teams, profile, and settings views.
- Web-local TypeScript shapes for Worker responses.

Does not own:

- Source-of-truth WoW tracked state.
- Addon capture rules.
- Worker persistence decisions.

## Runtime And Deployment Architecture

### Automation

Versioned workflow infrastructure is driven by Deployment Impact:

```text
Git changed paths
      |
      v
scripts/deploy_impact.py
      |
      v
selective GitHub Actions validation/build/deploy/release workflows
```

`deploy_impact.py` is the authoritative classifier. Workflow path filters are not the source of truth for product impact.

Primary workflow files:

- `.github/workflows/deploy.yml` - orchestrates impact calculation and selective workflow calls.
- `.github/workflows/deploy-web.yml` - validates Web build/lint without duplicating Vercel deployment.
- `.github/workflows/deploy-worker.yml` - validates Worker changes and supports guarded manual deploy/migrations.
- `.github/workflows/build-client.yml` - builds Client installer artifacts for validation/orchestration with read-only permissions.
- `.github/workflows/release-client.yml` - builds Client installer artifacts and supports explicit Client release publication.

Standalone addon workflows are prepared as handoff files in `docs/workflow-handoff/addon/`; they are not active until copied to `Speeson/KeystoneSync`.

### API

Production API domain:

```text
https://api-keystonesync.esgarpe.dev
```

This is bound by `keystone-worker/wrangler.jsonc` through a Worker custom domain route.

Local/deployment scripts are in `keystone-worker/package.json`:

- `npm run dev`
- `npm run typecheck`
- `npm test`
- `npm run deploy`
- `npm run d1:migrate:local`
- `npm run d1:migrate:remote`

`npm run deploy` and remote D1 migrations are operational remote actions and require explicit authorization.

### Database

Production persistence is Cloudflare D1 database `keystone-sync`.

The current schema is versioned in `keystone-worker/migrations/0001_initial.sql`.

### Web

The Web app consumes `NEXT_PUBLIC_API_URL`, with fallback `https://api-keystonesync.esgarpe.dev` in `keystone-web/lib/auth.ts`.

The Web application is documented as deployed through Vercel. The exact external Vercel Git Integration ownership/configuration is not versioned in this repository.

### Client

The Windows client defaults to `https://api-keystonesync.esgarpe.dev` in `keystone-client/config.py` and normalizes the old Railway URL to the current API domain.

Build path:

- `keystone-client/build.bat` builds the executable with PyInstaller.
- `keystone-client/build_installer.bat` builds the installer with Inno Setup.
- Public installer asset convention: `KeystoneClientSetup.exe`.
- GitHub Release publication is manual.

### Addon

Canonical addon source and release ownership live in `Speeson/KeystoneSync`.

KeystoneClient executable/installer output must not include addon runtime files such as `KeystoneSync.toc` or `KeystoneSync.lua`.

## Addon Distribution Model

```text
Speeson/KeystoneSync
      |
      v
GitHub Release: vX.Y.Z
      |
      v
KeystoneSync-vX.Y.Z.zip
      |
      v
KeystoneClient addon updater
      |
      v
%APPDATA%/KeystoneClient/addon-cache/
      |
      v
WoW _retail_/Interface/AddOns/KeystoneSync
```

Rules:

- Edit addon source only in `Speeson/KeystoneSync`.
- Standalone addon releases use tag `vX.Y.Z`, asset `KeystoneSync-vX.Y.Z.zip`, and a `KeystoneSync/` ZIP root. The updater validates ZIP paths, `.toc` files, listed addon files, and version consistency before installing.
- The updater checks releases automatically in the background, but install/update/reinstall is always user-triggered.
- The local cache stores the last successfully downloaded and validated addon ZIP for recovery; it is not canonical and must not cause automatic downgrades.
- Addon-only releases no longer require a KeystoneClient release.

## Current Data Flow Implementation Points

```text
SavedVariables discovery: keystone-client/wow_path.py
SavedVariables parse/payload: keystone-client/sync_worker.py
Sync write endpoint: keystone-worker/src/routes/keystones.ts
D1 schema: keystone-worker/migrations/0001_initial.sql
Read response shaping: keystone-worker/src/db.ts
User character reads: keystone-worker/src/routes/me.ts
Team character reads: keystone-worker/src/routes/teams.ts
Web API helper: keystone-web/lib/auth.ts
Web consumers: keystone-web/app/dashboard/page.tsx
               keystone-web/app/characters/page.tsx
               keystone-web/app/summary/page.tsx
               keystone-web/app/teams/[id]/page.tsx
```

## Removed Historical Components

These paths are not current architecture:

- `keystone-api/` - former FastAPI/PostgreSQL/Railway backend, removed in Phase 4.
- `keystone-sync-client/` - former script-based sync client, removed in Phase 4.
- `KeystoneSync/` - former root addon duplicate, removed in Phase 5.

Historical planning documents may still mention Railway, FastAPI, PostgreSQL, or duplicate addon paths. Treat those as history unless a current source/configuration file proves otherwise.
