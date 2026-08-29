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
- Optional current-character KeystoneLoot public API v2 capture through isolated
  `KeystoneLootIntegration.lua`.

Does not own:

- Worker API calls.
- D1 schema or persistence rules.
- Web presentation.
- KeystoneClient desktop UX.

KeystoneClient does not embed addon runtime files. Addon installation and updates are consumed from `Speeson/KeystoneSync` releases.

### `keystone-client`

Current Windows desktop client.

Owns:

- The React/TypeScript presentation under `keystone-client/src/`.
- The Rust/Tauri host, native window/tray lifecycle, updater and NSIS packaging under `keystone-client/src-tauri/`.
- The packaged Python JSONL sidecar and domain services under `keystone-client/sidecar/`.
- WoW install and account SavedVariables discovery in `keystone-client/sidecar/wow_path.py`.
- Parsing `KeystoneSyncDB` with `slpp` in `keystone-client/sidecar/sync_worker.py`.
- Raider.IO enrichment for avatar URL, score, class, and equipped item level fallback.
- Sync payload construction and `POST /api/keystones/update`.
- Presence-sensitive KeystoneLoot transport, including Lua-array to JSON-array
  representation at the known V1-A array fields.
- Windows desktop/tray UX, login, account selection, and local config.
- Checking addon releases in the background without blocking startup.
- Downloading, validating, caching, and installing standalone addon releases from `Speeson/KeystoneSync` after explicit user action.
- PyInstaller sidecar packaging and the Tauri/NSIS build path for `KeystoneClientSetup.exe`.

Does not own:

- A second source of addon gameplay or seasonal tracking logic.
- D1 schema ownership.
- Web display semantics.

The Python sidecar remains authoritative for tokens, `%APPDATA%\KeystoneClient\config.json`, SavedVariables monitoring, character cache/API/Raider.IO enrichment, authenticated avatar updates and addon release operations. The synchronization view receives sanitized rendering DTOs only; React does not call Raider.IO or the Worker directly. A valid authenticated WoW configuration starts one monitor automatically, and successful synchronization schedules a coalesced character refresh.

The Tauri host owns frameless window behavior, controlled native close requests, explicit clean exit, OS autostart, the persistent dynamic tray and scoped browser navigation. Blocking Python requests run on Tauri's blocking executor so monitor shutdown cannot freeze the desktop event loop; tray hiding uses a scoped Rust command, and exit terminates the sidecar directly. React owns the localized ES/EN interface, internal login/registration and first-run WoW/account routing, Settings, profile dropdown and character-derived avatar picker. `auth.register` forwards the existing Worker registration contract without persisting credentials, while `profile.set_avatar` validates the requested URL against sanitized character state before Python calls `/api/me/avatar`. The historical `minimize_on_close` key remains in the private config contract for compatibility but does not silently override the Tauri close-choice flow.

### `keystone-worker`

Current API backend, implemented as a Cloudflare Worker with Hono.

Owns:

- HTTP routes mounted in `keystone-worker/src/index.ts`.
- Authentication and sync-token handling.
- `POST /api/keystones/update` write handling in `keystone-worker/src/routes/keystones.ts`.
- Focused KeystoneLoot validation in `keystone-worker/src/keystoneLoot.ts`.
- Pure KeystoneLoot recommendation scoring in `keystone-worker/src/keystoneRecommendations.ts`.
- Allowlisted KeystoneLoot objective projection/pagination in
  `keystone-worker/src/keystoneObjectives.ts` and Blizzard item enrichment/cache in
  `keystone-worker/src/blizzardItemMetadata.ts`.
- D1 access helpers and read response shaping in `keystone-worker/src/db.ts`.
- Character, profile, team, invitation, auth, privacy-preference, recommendation, and health API behavior.
- Wrangler deployment and D1 migration scripts.

Does not own:

- WoW API reads.
- Client-side SavedVariables parsing.
- Web-specific presentation assumptions.

### Cloudflare D1

Current production persistence.

Owns:

- Durable storage for users, characters, current keystone snapshots, teams, team members, invitations, and rate limits.
- The schema history in `keystone-worker/migrations/0001_initial.sql`,
  `0002_keystone_loot.sql`, and `0003_keystone_loot_sharing.sql`.

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
- Server-backed KeystoneLoot privacy control and presentation-only actual-team-stone
  planner using aggregate Worker recommendations.
- Owner-only per-character KeystoneLoot objective presentation through the allowlisted
  owner endpoint, with Web-local response validation and server-backed filters/pagination.
- Current-team KeystoneLoot objective presentation through the separate allowlisted Team
  endpoint, including contextual details inside the existing stone planner dialog.

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
- `.github/workflows/deploy-worker.yml` - validates Worker changes, applies required D1 migrations before deployment, and exposes production readiness only after health and Selector-route smoke checks pass.
- `.github/workflows/build-client.yml` - builds Client installer artifacts for build-only validation/orchestration with read-only permissions.
- `.github/workflows/release-client.yml` - supports Client `build-only`, `release-dry-run`, and gated `release` modes; only `deploy.yml` supplies the publication gate after required backend readiness.

For a qualifying automatic Client release, `scripts/release_orchestration.py` converts the
Deployment Impact result into explicit actions. Client-only changes remain independent. When the
same release range includes Worker changes, the Worker must deploy and pass production smoke
before publication; DB impact additionally forces migrations before deployment:

```text
D1 migrations (when DB=true)
  -> Worker deploy
  -> Worker production health + Selector authentication smoke
  -> Client release gate
  -> Client publication
```

Failure or cancellation before the gate prevents Client publication. Direct dispatch of
`release-client.yml` cannot publish; manual publication/recovery uses `deploy.yml` from `main`
with an explicitly confirmed complete impact range. Production `main`/manual orchestrator runs
share a non-cancelable concurrency group, preventing separate release chains from interleaving;
PR validation remains independently concurrent. Direct `deploy-worker.yml` dispatch validates
only, so production migration/deploy/smoke has one orchestrator entrypoint.

Standalone addon workflows are owned by `Speeson/KeystoneSync`. `weeklyChar/docs/workflow-handoff/addon/` is only a pointer and must not contain active duplicate addon workflow YAML.

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

The current schema is versioned through `keystone-worker/migrations/0001_initial.sql`
and additive migrations `0002_keystone_loot.sql`, `0003_keystone_loot_sharing.sql`,
`0004_keystone_loot_item_metadata.sql`, and
`0005_keystone_loot_item_tooltip_metadata.sql`.

### Web

The Web app consumes `NEXT_PUBLIC_API_URL`, with fallback `https://api-keystonesync.esgarpe.dev` in `keystone-web/lib/auth.ts`.

The Web application is documented as deployed through Vercel. The exact external Vercel Git Integration ownership/configuration is not versioned in this repository, and no checked-in deployment status, revision endpoint, or workflow output proves that a given Web revision is live. Web production verification therefore remains operational rather than an automatic Client-release dependency.

### Client

The Windows client defaults to `https://api-keystonesync.esgarpe.dev` in `keystone-client/sidecar/config.py` and normalizes the old Railway URL to the current API domain.

Current production build path:

```text
Python domain services
  -> packaged JSONL sidecar
  -> Tauri/Rust host + React UI
  -> NSIS KeystoneClientSetup.exe
  -> detached Tauri signature
  -> latest.json
  -> GitHub Releases static updater endpoint
```

- `keystone-client/VERSION` remains the canonical Client version. `scripts/tauri_release.py` synchronizes Tauri, Cargo and npm metadata and embeds changeset-derived notes.
- The stable Tauri identity is product/binary `KeystoneClient` with identifier `dev.esgarpe.keystoneclient`.
- React owns update state and presentation through a typed controller; the official Tauri updater plugin owns signed download and installation, and the process plugin owns relaunch. The Python sidecar is not an application updater.
- Release signing material is injected only in CI. `TAURI_SIGNING_PRIVATE_KEY` and its optional password remain secret; the production public verification key is committed in `keystone-client/src-tauri/tauri.conf.json`.
- The canonical release assets are `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig`, and `latest.json`. The manifest uses platform key `windows-x86_64` and endpoint `https://github.com/Speeson/weeklyChar/releases/latest/download/latest.json`.
- The release workflow retains Client changesets, `client-vX.Y.Z`, `build-only`, `release-dry-run`, gated `release`, resume/idempotency and atomic commit/tag publication. Automatic release on `main` remains gated by `TAURI_CLIENT_RELEASE_ENABLED=true` and, when backend impact exists, successful D1/Worker readiness. The Client runtime calls the Worker API directly through its sidecar; it does not require the Web deployment to use Teams or the Stone Selector.
- `%APPDATA%\KeystoneClient` remains owned by the Python sidecar and is not removed by the Tauri application. The retained NSIS hook supports direct migration from the public Inno 0.3.0 AppId, fails closed if legacy uninstall fails, preserves AppData and migrates legacy autostart.

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
SavedVariables discovery: keystone-client/sidecar/wow_path.py
SavedVariables parse/payload: keystone-client/sidecar/sync_worker.py
Sync write endpoint: keystone-worker/src/routes/keystones.ts
D1 schema: keystone-worker/migrations/0001_initial.sql + 0002_keystone_loot.sql + 0003_keystone_loot_sharing.sql
Read response shaping: keystone-worker/src/db.ts
User character reads: keystone-worker/src/routes/me.ts
Team character reads: keystone-worker/src/routes/teams.ts
Web API helper: keystone-web/lib/auth.ts
Web consumers: keystone-web/app/dashboard/page.tsx
               keystone-web/app/characters/page.tsx
               keystone-web/app/summary/page.tsx
               keystone-web/app/teams/[id]/page.tsx
```

KeystoneLoot V1-B follows the normal sync path and keeps an explicit privacy split at
read time: `/api/me/characters` includes parsed `keystoneLoot` for the authenticated
owner, while `/api/teams/:teamId` omits it. V1-C adds a default-enabled user sharing
preference and a separate membership-protected recommendation endpoint. That endpoint
applies privacy before parsing, validates stored snapshots through the V1-B boundary,
and returns only one aggregate `(character, specId)` recommendation per member. V1-D Web
loads the account preference through the existing `/api/me` contracts, selects one real
current keystone from team detail, sends only its `challengeMapId`, and renders the
aggregate response. Web performs no scoring or Voidcore decisions.

KeystoneLoot V2-A extends the Worker contract without changing the raw team-detail or V1
recommendation responses. JWT-authenticated owners can request a paginated allowlisted
objective view for one owned character. A separate team-context endpoint permits the same
allowlisted view only after fresh D1 checks prove both requester and target owner are
current members of the requested team and the target owner has
`shareKeystoneLootWithTeams=true`. Removal from either membership revokes access on the
next request. The preference now governs both aggregate recommendation participation and
allowlisted objective visibility inside current shared teams; no second preference exists.

Objective processing validates the stored snapshot, filters by source/dungeon and spec,
deduplicates with the existing tier-weight helper, sorts and cursor-paginates, then enriches
only the current page. Item IDs remain canonical. Worker-side Blizzard client-credentials
OAuth and fixed regional Game Data hosts resolve Spanish item names and official media.
Migration `0004_keystone_loot_item_metadata.sql` adds a D1 cache keyed by
`(region, locale, item_id)`. Positive results last 30 days, confirmed 404 results last six
hours, stale positive data survives upstream failures, and unavailable metadata degrades
to null display fields.

Stone Selector S2 extends that same cache through additive migration
`0005_keystone_loot_item_tooltip_metadata.sql`. The Worker reads localized equipment slot,
item class, item subclass, and stat names from official Item API fields and exposes them through
the shared allowlisted objective projection used by owner, Team, and Selector responses. Only
bounded stat names are stored; numeric quantities and raw Blizzard responses remain outside the
contract. Pre-S2 positive rows continue serving name/icon data and lazily acquire the new fields
at their existing refresh boundary, avoiding an immediate cache-wide refresh. Optional malformed
or unavailable metadata degrades independently without failing an objective. Web and Client
tooltip rendering remain deferred.

KeystoneLoot V2-B adds only an owner-facing Web consumer. Each Characters-row action opens
a native responsive dialog for the exact character ID and calls
`/api/me/characters/:characterId/keystone-loot/objectives`; it does not read the raw
`keystoneLoot` field to render objectives. Web owns labels, fallbacks, relative freshness,
and interaction state, while Worker remains authoritative for filtering, objective identity,
Voidcore state, metadata enrichment, and authorization. Abort plus exact request identities
prevent late character, filter, pagination, or closed-dialog responses from updating UI.

KeystoneLoot V2-C adds two Team consumers without moving authorization into Web. Team
character rows open a filtered/paginated native drawer. Recommended planner cards open the
same allowlisted item presentation inside the existing planner dialog, constrained to the
selected `challengeMapId` and recommended `specId`; desktop uses a side panel and mobile a
drill-in view. Both call only
`/api/teams/:teamId/characters/:characterId/keystone-loot/objectives`, accept the Team-specific
status envelope, abort/invalidate stale work, and clear sensitive rows on a refreshed 403.
The Worker still performs live membership, sharing, filtering, scoring, deduplication,
Voidcore, metadata, and pagination decisions.

Stone Selector S3 replaces the Team header's exposed composition planner with a Web-only,
inline `Selector de piedra` between the Team header and member cards. The strip always renders
the eight dungeons from `keystone-web/lib/season2.ts`; counts come from current Team detail and
the selected dungeon is reconciled with the aggregate response. One strict Web parser and one
abortable request consume
`/api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`. Response identity prevents
late dungeon results from replacing a newer selection. Web preserves Worker character order and
does not score, compose, or reconstruct excluded members.

The inline panel owns compact summary, collapsed character cards, optional multi-spec filtering,
semantic tier grids, and a subdued completed-Voidcore disclosure. A shared portal-based
`KeystoneLootItemTooltip` now presents the S2 safe metadata on Selector tiles and the existing
owner/Team objective rows. It supports hover, keyboard focus, click/tap, outside dismissal, and
Escape without exposing numeric stats. The prior `KeystonePlanner` visual components are removed;
non-visual recommendation helpers remain isolated for the deferred planner. The Client Teams
counterpart is implemented in S5; the composition planner remains deferred.

Stone Selector S4 adds the Client data path without adding the Teams UI. React calls the typed
`teams.list`, `teams.get`, and `teams.keystone_selector` core wrappers; Rust accepts only those
explicit commands; and the Python sidecar applies the private access token to the existing Worker
Team list, Team detail, and aggregate Selector endpoints. Python projects allowlisted DTOs and
TypeScript validates them again, so bearer/sync tokens, invite codes, account names, raw
KeystoneLoot, vault data, and raw error bodies never enter the WebView. The protocol remains at
version 1 because capability additions are backward-compatible. The Worker Team detail does not
provide a member-profile avatar, so the Client member DTO intentionally omits one and retains only
per-character avatars.

Stone Selector S5 adds `TeamsPage` as a full Client shell route between Sync and Addon. React
depends on an injected `TeamsDataSource`; production delegates exclusively to the S4 typed bridge,
while development previews inject deterministic in-memory fixtures from `core/teamsPreview.ts`.
The page obtains Team list and detail once per selection, derives the eight rail counts locally,
and requests only the explicitly selected dungeon. Request generations prevent late Team-detail
or Selector responses from replacing newer state. Session expiration is handed back to `App` and
the existing login flow.

The fixed-frame layout contains a bounded horizontal member dashboard and an independently
scrollable Selector panel paired with an eight-entry vertical dungeon rail. The selected dungeon
and objectives panel remain separate rounded rectangles with a clean gap between them. Character
cards preserve Worker order and expose optional local spec filters, ordered actionable tier groups,
and a separate completed-Voidcore disclosure. `TeamItemTooltip` renders through `document.body` to
avoid scroll clipping and converts fixed-canvas coordinates using the active Client scale. It
accepts only the safe S2 tooltip projection and never renders numeric stat values. The Planner
control is visible but disabled and is not connected to recommendations.

KeystoneLoot V2-D validated the complete local chain with the current real SavedVariables,
the canonical Client parser, a disposable D1 migrated through `0001`-`0004`, the actual local
Worker, and a production-built Web. The owner drawer, team drawer, and contextual planner all
used their actual Worker routes. The same run covered live membership removal, sharing
disable/re-enable, authoritative empty and historical snapshots, pagination/filtering, exact
same-name/different-realm IDs, future tiers, dungeon/raid numeric-ID collisions, Voidcore,
metadata fallback/cache behavior, and raw team privacy. No V2-D runtime change was required.

V2 production rollout is backend-first:

```text
1. configure BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET as Cloudflare Worker secrets
2. apply additive D1 migration 0004_keystone_loot_item_metadata.sql
3. deploy the Worker
4. smoke owner/team objective endpoints
5. deploy the Web
6. smoke Characters, Team drawer, and planner in production
```

The old Worker ignores migration `0004`; the new Worker needs the cache table before its
objective routes run; the new Worker remains compatible with the old Web; and V2 Web requires
the new routes. The Blizzard bindings are optional in `Env`: if absent, authorization and
objective projection continue to work with nullable metadata, `Objeto #<itemId>`, and the
generic Web icon fallback.
Cloudflare owns these runtime secrets; they are not repository or Vercel secrets.

The validated zero-downtime V1 production order is:

```text
1. release the compatible standalone addon
2. release the compatible KeystoneClient
3. apply D1 migration 0002_keystone_loot
4. apply D1 migration 0003_keystone_loot_sharing
5. deploy the Worker
6. deploy the Web
```

The addon may precede the Client because older clients ignore the additive SavedVariables
block. The new Client may precede the backend because the pre-V1 Worker accepts and
ignores unknown additive JSON fields. Both migrations may precede the Worker because the
old Worker ignores the new columns. The Worker must follow both migrations because its
queries reference both columns, and the Web must follow the Worker because it consumes
the new preference and recommendation routes. The new Worker remains compatible with
older clients that omit `keystoneLoot`.

## Removed Historical Components

These paths are not current architecture:

- `keystone-api/` - former FastAPI/PostgreSQL/Railway backend, removed in Phase 4.
- `keystone-sync-client/` - former script-based sync client, removed in Phase 4.
- `KeystoneSync/` - former root addon duplicate, removed in Phase 5.

Historical planning documents may still mention Railway, FastAPI, PostgreSQL, or duplicate addon paths. Treat those as history unless a current source/configuration file proves otherwise.
