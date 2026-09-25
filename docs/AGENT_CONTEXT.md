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
- SavedVariables reset reconciliation uses addon top-level `savedVariablesInstanceId`, a private
  Client baseline per normalized WoW account/region in `%APPDATA%\KeystoneClient\config.json`, and
  authenticated `POST /api/me/keystone-loot/reset`. First observation is non-destructive; only a
  later A-to-B change clears matching `keystone_loot_json`, and baseline/mtime advance only after
  reset plus all current-character writes and config persistence succeed.
- `keystone-client/sidecar/character_service.py`: sanitizes cached/API character DTOs, preserves cached rows on refresh failure, enriches missing display fields server-side and publishes `characters.updated` without exposing tokens.
- `keystone-client/sidecar/sync_service.py`: owns the single SavedVariables monitor, reconciles it against authentication/WoW account prerequisites and schedules character refresh after successful sync.
- `keystone-client/src/`: consumes `characters.get` / `characters.refresh`; the `Characters` view renders account/realm-filtered addon snapshots for equipment, M+, vault, Prey, currencies, talents and Omnium. Raider.IO remains display enrichment only.
- The Tauri host owns the frameless window lifecycle, controlled close prompt, native minimize/tray actions, real Windows autostart and localized dynamic tray. Blocking sidecar requests run outside the UI thread, and explicit exit terminates the sidecar without waiting for the synchronization monitor. React owns the ES/EN presentation, login/onboarding routing and profile/avatar dialogs; account creation stays inside the client through the allowlisted `auth.register` bridge command and existing Worker endpoint. Remote character/profile portraits use a validated, bounded WebView Cache Storage copy for offline sessions and retry on restored connectivity. The active profile portrait also has a dedicated single-entry cache: existing profiles are promoted during connected startup, and a newly selected avatar is cached before the authenticated profile mutation is attempted. Logout or session expiry clears both presentation caches.
- The Client close policy is persisted as `close_behavior` (`ask`, `minimize`, or `exit`), can be changed in Settings, and can be remembered from the close-choice dialog. In `ask` mode, a repeated native close request while the dialog is open confirms exit, so a second Alt+F4 cannot leave the window blocked. The legacy `minimize_on_close` value is retained and migrated for compatibility.
- The Client sizes its initial window from 80% of the current monitor work area, capped at the 1672×941 canvas. Free resizing remains the default. `lock_window_aspect_ratio` in the sidecar config enables a Windows native drag constraint that keeps the client content at 1672:941, with an approximately 1280×720 logical minimum; Settings can switch it off to restore the 940×529 free-resize minimum.
- `keystone-worker/src/routes/keystones.ts`: receives sync payloads and persists character JSON blocks plus current keystone snapshots.
- `keystone-worker/src/db.ts`: `characterResponse()`, `charactersForUser()`, and `latestRealKeystone()` build read responses. Owner character lists load current keystones in one SQL query and include additive equipment/talents/Omnium JSON blocks.
- `keystone-worker/src/routes/me.ts`: `GET /api/me/characters` exposes user characters.
- Keystone Planner stores JWT-owner-only played preferences in `character_play_preferences` and,
  from additive migration `0011_planner_play_loot_separation.sql`, one primary plus zero or more
  secondary loot specs per character in `character_loot_preferences`. The old `loot_spec_id`
  column is only a compatibility mirror of the primary. `planner_user_settings` persists completion
  of the Client's two-step configuration guide. Role is derived from the Worker catalog, not stored.
- Battle.net Authentication V1 maps the official OIDC `sub` to the unchanged
  internal `users.id` through `user_identities`; BattleTag is display-only.
  Worker OAuth uses Authorization Code, cryptographic state, PKCE S256, and
  exactly `openid`. Migration `0009` makes `users.password_hash` nullable and
  adds expiring `oauth_flows`. State/handoff/poll secrets are stored only as
  SHA-256 hashes; the temporary PKCE verifier is erased at callback, and no
  Battle.net access or refresh token is persisted.
- Web exchanges a short-lived opaque ticket for the existing KeystoneSync JWT.
  KeystoneClient opens the system browser through a scoped Tauri command while
  its sidecar holds the desktop polling secret only in memory and persists only
  the resulting KeystoneSync session.
- `keystone-worker/src/routes/teams.ts`: team detail responses expose member characters through shared DB helpers.
- `keystone-web/lib/auth.ts`: `apiFetch()` centralizes Web API calls.
- Keystone Planner V1 Web uses one shared `KeystonePlannerPanel` for session-wide and selected-
  dungeon planning, a defensive `lib/keystonePlanner.ts` transport boundary, and an owner-only
  `PlannerPreferencesDialog`. React does not reproduce solver, privacy, role, capability, or
  scoring rules. Capability spell IDs are shown with accessible text badges because no reliable
  direct Web icon resolver is currently part of the public contract.
- KeystoneClient Teams owns one page-local minimum-keystone-level filter in the shared Team/member
  header. It filters local dungeon counts, selected-dungeon keystone chips, and exact Planner stone
  choices while leaving dungeon objective cards and objective/tier totals unchanged.
- `keystone-web/app/dashboard/page.tsx`, `keystone-web/app/characters/page.tsx`, `keystone-web/app/summary/page.tsx`, and `keystone-web/app/teams/[id]/page.tsx`: consume character and team character data.

## Current versions

Verified from checked-out files:

- Canonical addon repo `Speeson/KeystoneSync`: released `v0.2.8`, `Version: 0.2.8`, `Interface: 120100`.
- Canonical Windows client `keystone-client/VERSION`: `0.10.3`
- Current public Tauri release: `0.10.1`, tag `client-v0.10.1`.
- Web package `keystone-web/package.json`: package version `0.1.0`, Next.js `16.2.6`
- Worker package `keystone-worker/package.json`: package version `0.1.0`
- Worker compatibility date `keystone-worker/wrangler.jsonc`: `2026-07-25`
- Keystone Planner production D1 migration `0010_keystone_planner.sql` was applied on 2026-09-10.
  Production Worker version `bb88b8ff-44b0-49f6-8da3-4f80ed725d1f`, deployed on 2026-09-14,
  includes the Planner API, exact-stone selection through the additive `stoneCharacterId` field,
  modern Quick/Advanced vacancy alternatives, optional `fillComposition`, class-level Quick scoring
  for external DPS recipients, their presentation-safe `damageProfile`, and the dense-recalculation
  CPU caches. Health
  and unauthenticated Selector/Planner boundary smoke passed after deployment. The Planner Web
  remains undeployed pending a separately authorized Web rollout.
- Planner play/loot separation migration `0011_planner_play_loot_separation.sql` has passed local
  application tests and deliberately leaves legacy loot interests unselected; it has not been
  applied remotely. Its Client changes remain local only; the current Worker source is deployed,
  but no remote migration was run as part of that deployment.

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
- The Client workflows preserve `build-only`, `release-dry-run`, gated `release`, changeset planning, resume state and atomic tag/release publication. Automatic publication from a qualifying `main` push requires repository variable `TAURI_CLIENT_RELEASE_ENABLED=true`. Backend-dependent releases are ordered by `scripts/release_orchestration.py`; manual publication/recovery runs through the orchestrator from `main` with a confirmed complete impact range.
- Addon: changes go to canonical `Speeson/KeystoneSync` with version tags after explicit confirmation. Standalone addon releases use tag `vX.Y.Z`, asset `KeystoneSync-vX.Y.Z.zip`, and ZIP root `KeystoneSync/`. KeystoneClient checks these releases automatically in the background and installs/updates only after explicit user action.
- Client addon cache: `%APPDATA%\KeystoneClient\addon-cache\` stores the last successfully downloaded and validated addon ZIP for recovery. It is not canonical and must not cause automatic downgrade.
- Deterministic deployment-impact script: `scripts/deploy_impact.py`.
- Deployment Impact dimensions: `WEB`, `WORKER`, `DB`, `CLIENT_BUILD`, `CLIENT_RELEASE`, `ADDON`, `ADDON_RELEASE`.
- External canonical addon changes are represented with `python scripts/deploy_impact.py --addon-changed` because `Speeson/KeystoneSync` is outside this repository.
- Current addon/client coupling policy: external canonical addon changes imply `ADDON` and `ADDON_RELEASE` only. KeystoneClient updater/installer code changes imply `CLIENT_BUILD` and `CLIENT_RELEASE`, not `ADDON_RELEASE`.
- Unknown or outside-repository paths are reported by the impact script; `--strict` exits non-zero for them.
- CI/CD orchestrator: `.github/workflows/deploy.yml` calculates Deployment Impact in strict mode and calls relevant reusable workflows.
- Web workflow: `.github/workflows/deploy-web.yml` validates build and lint. Build is blocking; lint is temporarily non-blocking because of the documented Phase 8 baseline. Web production deployment remains documented as externally Vercel-managed.
- Worker workflow: `.github/workflows/deploy-worker.yml` validates `npm run typecheck` and `npm test`; independent production operations remain guarded, while a backend-dependent Client release forces impacted D1 migrations, then Worker deploy, then a non-destructive production smoke of `/api/health` and the authenticated Selector route. Production smoke targets the explicitly enabled `keystone-sync-api.estebangperez77.workers.dev` route and sends the environment secret `WORKER_SMOKE_BYPASS_TOKEN` as `X-KeystoneSync-Smoke-Token`. An earliest-order Worker guard permits only the two exact smoke GETs on that hostname and returns `404` otherwise; preview URLs are disabled and the custom domain is unaffected. A confirmed `recover_worker_readiness` orchestrator dispatch repeats only smoke after a previously successful migration/deploy and still gates Client publication.
- Client build workflow: `.github/workflows/build-client.yml` builds the Windows installer on `windows-latest` with read-only permissions and uploads `KeystoneClientSetup.exe` as a workflow artifact for validation/orchestration.
- Client release workflow: `.github/workflows/release-client.yml` supports `build-only`, `release-dry-run`, and orchestrator-gated `release`; direct dispatch cannot publish. PRs do not publish. A qualifying `main` push publishes only when Deployment Impact reports `CLIENT_RELEASE=true`, `TAURI_CLIENT_RELEASE_ENABLED=true`, and every required backend gate succeeds. Client-only releases do not wait for Worker.
- Guaranteed backend release order: impacted D1 migrations -> Worker deploy -> Worker production smoke -> Client publication. Migration, deploy, smoke, cancellation, or Worker validation failure blocks publication.
- Production pushes/manual orchestrator runs are serialized through one non-cancelable concurrency group so separate deploy/release chains cannot interleave. Direct Worker and Client workflow dispatches validate/build only; production and manual recovery enter through `deploy.yml`.
- Web production remains externally Vercel-managed. No checked-in machine-readable revision/readiness proof exists, so Web production verification is an operational step. KeystoneClient Teams/Selector calls the Worker directly and is not runtime-coupled to Web readiness.
- Client release tag convention: `client-vX.Y.Z`, derived from `keystone-client/VERSION`.
- Addon workflows: authoritative addon CI/CD lives in the standalone `Speeson/KeystoneSync` repository. `weeklyChar/docs/workflow-handoff/addon/` is only a pointer and must not contain active duplicate addon workflow YAML. weeklyChar must not publish addon releases.
- GitHub Actions operational status: user confirmed the required GitHub-side configuration was added and validation workflows passed. Required external configuration includes `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the GitHub `production` environment. Secret values and exact external settings are not versioned in this repository.

## Validation baseline

- Worker: `cd keystone-worker; npm run typecheck; npm test`. Worker tests cover weekly reset helpers plus route-level sync behavior using a local in-memory D1 test double.
- Client: compile and test `keystone-client/sidecar/`, run Vitest/Vite/Playwright under `keystone-client/`, run Cargo checks/tests against `keystone-client/src-tauri/Cargo.toml`, and build the sidecar with `python scripts/build_client_sidecar.py --clean`. Client tests parse synthetic SavedVariables fixtures and validate the outbound Worker payload shape without live Raider.IO calls.
- Addon updater tests live in `tests/client/test_addon_updater.py` and cover release metadata, ZIP security, cache fallback, safe install, rollback, and candidate selection.
- Web: `cd keystone-web; npm run lint; npm test; npm run build; npm run test:visual`. At the
  Keystone Planner Block E checkpoint these pass with zero lint issues, 73 unit tests, a complete
  Next.js production build, and 25 Playwright scenarios.
- Shared fixtures live under `tests/fixtures/`.
- Deployment Impact: `python scripts/deploy_impact.py --files <changed-paths>` and `python -m unittest discover -s tests/deploy_impact`.

## Important architectural decisions

- Modernization work follows `docs/KEYSTONESYNC_ACTION_PLAN.md`.
- KeystoneClient's static theme registry ships three selectable skins: `keystone` (default), `poison`, and `void`. Void follows Keystone's shared page/layout behavior, uses centralized semantic artwork roles, and keeps `overlay1.png` as its production overlay; `overlay2.png` and `overlay3.png` are visual-review candidates only.
- `docs/AGENT_CONTEXT.md` stores durable project state, not chronological work history.
- Detailed system architecture is documented in `docs/ARCHITECTURE.md`.
- The end-to-end tracked-data contract is documented in `docs/DATA_CONTRACT.md`.
- Project skills live under `.agents/skills/` and were reviewed against the verified architecture/data contract in Phase 7.
- The data contract spans addon SavedVariables, client parsing/payloads, Worker API, D1 persistence, and Web rendering.
- Character absence alone never deletes remote KeystoneLoot. Explicit per-character `null` clears
  one snapshot; a baselined SavedVariables instance change authorizes only an owner/account/region
  scoped KeystoneLoot reset. The existing nullable D1 column is reused without a migration, and
  `wow_item_metadata` is outside this lifecycle.
- The root `KeystoneSync/` duplicate was removed in Phase 5. Phase 11 removed the remaining embedded Client addon bundle; do not recreate it without an explicit architecture change.
- Deployment/release impact must be determined by `scripts/deploy_impact.py`, not by memory. Reporting remote impact does not authorize deployment, remote D1 migration, tag, release, or push.
- Planner composition facts live in `keystone-worker/src/wowComposition.ts`: 40 current Retail
  specs, class/role, conservative DPS physical/magical affinity, DPS primary-stat family, and unique
  capability providers. Ambiguous damage affinity remains `null` until verified rather than being
  guessed; primary-stat family is tracked independently because attack-power specs can deal magical
  damage.
- Planner solving lives in the pure `keystone-worker/src/keystonePlanner.ts` domain boundary. It
  consumes normalized privacy-filtered inputs, enforces holder and 1/1/3 constraints, and ranks a
  deterministic Top 5 without D1, Hono, authorization, or presentation copy. Ranking covers tank
  and healer first, then level distance, fewer emergency and more preferred/available played specs,
  enabled utilities, same-armor sharing synergy, personal loot and stable identity. Loot choice
  never selects the played spec; primary loot wins when actionable, otherwise the strongest
  actionable secondary is used.
- Incomplete Planner recommendations are completed conceptually to 1 Tank / 1 Healer / 3 DPS by a
  Worker-owned resolver. Legacy requests keep the historical class-only behavior and comparator.
  Modern Quick jointly ranks class combinations; Advanced jointly ranks exact specs. Both use BL,
  BRez and offensive equivalence bands; Advanced adds group-defense and selected-dungeon utility
  bands. Quick includes external DPS as class-level offensive recipients using the mean profile of
  their role-compatible DPS specs, preventing support-only selected groups from degenerating into
  zero-gain all-class ties. Loot score/tiers regain priority inside the same composition bands, followed by exact
  offensive gain. Same-armor sharing remains a modern post-tier loot tie-break and stays in its
  historical position for legacy. Vacancy alternatives are limited to the selected completion's
  active composition stratum and keep their true rank; the Client preserves this additive list
  instead of reconstructing it from the selected class. Each alternative also carries an additive,
  presentation-safe damage profile. The Client recomputes the displayed physical/magical/mixed
  party profile when an external DPS alternative is selected; this is display-only and does not
  rerank or change loot. Derived explanations/spec identities are additive and non-persistent.
  Per-solve caches reuse each candidate's dungeon-loot evaluation and canonicalized completion
  scoring; immutable specialization capability and ranking profiles are memoized at module scope to
  keep dense recalculations within the Worker's CPU allowance without changing comparator semantics.
- Planner API adaptation lives in `keystone-worker/src/keystonePlannerApi.ts`; the authenticated
  Team route derives selected members, preferences, current stones, shareable objectives, item
  metadata, and capability metadata server-side before exposing the solver result.

## Known risks / ambiguities

- Historical FastAPI/Railway docs are retained for project history and should not be used as current architecture instructions.
- The canonical addon repository is external. This repository contains addon updater tests and a pointer to addon workflow ownership, but no active embedded addon source and no active addon release workflows.
- `KeystoneSyncDB.keystoneWeeklyResetKey` and `mythicPlusSeasonUpdatedAt` are written by the addon but are not currently included in the client sync payload.
- Web API response types remain duplicated in individual pages. Midnight Season 2 dungeon and currency metadata is shared by the active Web views under `keystone-web/lib/season2.ts` and `keystone-web/lib/season2Currencies.ts`.

## Current WoW patch / season status

The application layers use the verified Midnight Season 2 pool (challenge map IDs 588, 587, 586, 584, 585, 249, 250, and 399) and canonical Season 2 currency keys. The standalone addon release `v0.2.3` implements Interface 120100, Season 2 currencies, Prey quest IDs, Trovehunter's Bounty, and the compatible KeystoneLoot V1 snapshot contract.

The KeystoneLoot snapshot now supports optional per-favorite `owned=true`, derived from current
equipment, bags, and personal-bank possession. Worker, Client, and Web keep owned objectives visible
but exclude them from pending Selector counts and Planner inputs; Client and Web render them muted
with a green check. The addon preserves the last valid ownership snapshot during `PLAYER_LOGOUT`
instead of recalculating against WoW APIs that may already be empty. Legacy snapshots that omit the
field stay actionable, and no D1 migration is required. Unlocked Great Vault raid, dungeon, and
world slots can include `rewardItemLevel` and
`rewardUpgradeTrack`, captured by the addon from Blizzard's current reward item link. Client and Web
show the exact track once beside the matching chest progress while retaining the existing activity
lists without per-activity item levels; they do not infer a track from overlapping item-level ranges.

## Next planned milestone

Keystone Planner V1 Blocks A through E are implemented. Production QA acceptance passed on
2026-09-10 with an isolated five-member `KSPQA_*` Team: the live Worker/D1 produced and validated a
Top 5, ranking criteria, 1/1/3 composition, utilities, locks, incomplete parties, per-stone mode and
privacy behavior. The fixture remains intact pending separately authorized review or cleanup. The
Web remains undeployed and any Web rollout still requires separate authorization.

Production password authentication has a verified limitation: bcrypt comparisons using the
product's cost-10 hashes can exceed the Worker's CPU allowance and return Cloudflare `1102`.
Acceptance used an explicitly authorized cost-4 exception on only the five isolated QA identities;
this is not a product fix and must not be applied to real accounts.

Stone Selector S1 added the backend-only aggregate route
`GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`. It uses live Team
membership and sharing, actionable Voidcore counters, cross-spec canonical deduplication,
deterministic character ordering, current weekly stone availability, and existing Blizzard
metadata enrichment. S2 additively extends the Worker-owned item cache and shared safe objective
projection with localized equipment slot, item class, item subclass, and bounded stat names;
numeric stat quantities and raw Blizzard payloads remain excluded. Existing positive cache rows
missing quality/classified-stat fields bootstrap through a bounded refresh with six-hour failure
backoff. Item rarity comes from Blizzard quality type, and stat classification uses stable
Blizzard stat type identifiers rather than localized names. Web tooltip rendering, Client UI/bridge, and
composition planning remain deferred. The Worker owns a minimal duplicate of the verified
Season 2 challenge-map allowlist; cross-surface consolidation is intentionally deferred.

Stone Selector S3 adds the Web-only inline Selector on the Team page. It always shows the eight
canonical Season 2 dungeons (including selectable zero-stone entries), consumes the S1 aggregate
route through a strict parser and abort/generation guards, and renders compact server-ordered
character summaries with multi-spec filtering and grouped item grids. A shared portal tooltip
applies S2 safe metadata to Selector, owner, and Team objective items on hover/focus/click/tap.
The exposed legacy Team planner UI and its visual components are removed; the disabled
`Planificar piedra · Próximamente` tab documents the future feature boundary. S4 and S5 carry
the same safe aggregate flow into KeystoneClient; composition planning remains deferred.

Stone Selector S4 adds the Client data/bridge layer only. The additive protocol-v1 commands are
`teams.list`, `teams.get`, and `teams.keystone_selector`, mapped respectively to the existing
Worker Team list, Team detail, and aggregate dungeon summary endpoints. Rust keeps an explicit
allowlist; the Python sidecar owns the authenticated HTTP session and safe response projection;
and TypeScript validates the projected DTO again. No token, invite code, raw KeystoneLoot, vault,
or WoW account field reaches React. The Worker does not expose a member-profile avatar, so the
Client member DTO intentionally omits it.

Stone Selector S5 adds the first-class Client `Equipos` / `Teams` page. It derives all eight
Season 2 stone counts from one Team-detail response, requests only the selected dungeon through
the S4 bridge, rejects stale results by generation, and returns expired sessions to the existing
login flow. The Poison-aligned page keeps the member dashboard compact, preserves Worker order,
supports multi-spec filtering and ordered item grids, and separates completed Voidcore items.
Its body-portal tooltip uses safe S2 metadata only and accounts for the fixed Client scale.
Deterministic `teams-*` preview data sources cover single/multiple/no Team plus populated,
multi-spec, empty, loading, and error Selector states.
Web, Worker, and Client intentionally retain small local Season 2 display allowlists until a
separate shared-build-boundary decision is approved.

KeystoneClient now exposes exact-stone planning from the existing Teams tab. Its 300 px
configuration column uses the level slider only to filter visible current-stone chips; selecting a
chip fixes `stoneCharacterId`, forces its owner into the manually selected 2–5 available members,
and requires an explicit Top 5 calculation. Player characters/specs/roles are chosen automatically
from owner-authored preferences; the Client never emits manual role locks. Entering Planner is
blocked by a four-state (`preferred`, `available`, `emergency`, `disabled`) owner configuration
dialog until the current user enables at least one specialization and chooses a primary loot spec
for each active character. Clicking a spec opens a themed direct selector with semantic heart,
check, warning and X states. A separate square control uses the official WoW loot-bag icon until a
primary is selected, then shows that specialization icon and opens the one-primary/many-secondary/
no-interest loot matrix. A second primary is rejected with an explicit warning until the current
one is cleared; promoting a secondary removes it from that set. Moving characters between active
and inactive remains drag/drop-only; inactivation disables every played spec. The first configuration
shows a persisted two-step loot-then-play guide whose completion is owner data rather than local UI
state. Team detail exposes only the
privacy-safe aggregate `plannerConfigured`; explicitly unconfigured teammates and their stones are
unavailable, while a missing field from an older Worker stays provisionally selectable until the
Planner endpoint validates it. Up to five equal full-width recommendation cards form an exclusive accordion; the
expanded composition lays Tank/Healer above three DPS cards and then shows loot and utilities. A
gold `Crown` group-leader marker identifies the exact stone owner in compact and expanded views,
and role markers use Blizzard's LFG role artwork. The Planner sidebar defaults to Quick with an
accessible `Rellenar la composición` switch followed by a 50/50 Quick/Advanced selector between
character configuration and minimum level. The switch defaults on; turning it off sends the modern
additive `fillComposition: false`, suppresses external vacancies, and centers the remaining detail
cards within their Tank/Healer and DPS role rows. Compact incomplete parties are centered
horizontally while retaining the normal five-slot card width. In expanded detail, exactly two cards
sharing the upper Tank/Healer row or lower DPS row are centered vertically as a pair; mixed-row
combinations and the default role coordinates are unchanged. The sidebar owns an inner scroll area with hidden
scrollbars and shows a bottom overlay cue only while more content remains; the cue scrolls directly
to the end. Quick
shows BL/BRez/Offensive Synergy; Advanced additionally shows Group Defense and Dungeon Utility while
preserving hidden Advanced switch state in memory. External compact cards stay icon-only: up to four
class alternatives in Quick or exact-spec alternatives in Advanced, plus a plain gold overflow `+`.
Expanded party cards keep fixed role slots (Tank upper-left, Healer upper-right, then three DPS), so
an external vacancy occupies its role's position instead of moving the other cards. Expanded external
cards default to the selected completion and expose an in-place four-choice selector, the alternative's
estimated offensive gain at the left edge just below the shared separator, and one Buffs / Defensives / Utilities row
with five capability icons before a plain gold overflow `+`. The complete
comparison dialog is rendered through a body portal so isolated previews cannot overlap its backdrop;
its capability links use the existing official Wowhead tooltip integration with per-link iconization.
Capability artwork is requested from Wowhead's large icon source and reduced to the 42 px display box
instead of enlarging the small thumbnails.
Capability overflow popups are also rendered through a body portal and open on hover or focus. The
expanded composition footer keeps three icon-only sections: Composition uses physical, magical, or
the dedicated mixed-damage asset plus the official green LFG eye and external-player count; Party
Essentials shows lit/dimmed Bloodlust and battle resurrection; and Buffs / Defensives / Utilities uses
the remaining flexible width and calculates how many same-sized icons fit before its plain gold `+`.
That last section combines distinct party capabilities with those of the currently selected external
alternative. External slots never affect visible
loot/objective/preference totals.
The private flow is React → typed core → Tauri JSONL → Python sidecar → Worker, with no access token
in React and no Client-side scoring. The Worker field is additive, so existing Web behavior remains
compatible when `stoneCharacterId` is omitted.

KeystoneClient disables Tauri's native window file-drop receiver with `dragDropEnabled: false`, as
required by WebView2 on Windows for frontend HTML5 drag and drop. Planner preference cards can
therefore move between active/inactive zones in the packaged client, with 50 % opacity and a subtle
blur while dragging. The Characters rail uses the same interaction and stores inactive character
IDs in versioned local client storage. Character inactivity is presentation-only: it does not stop
synchronization, delete data, or alter the addon/Worker/D1/Web contract.
The Characters rail groups account and realm selection into one hierarchical account-to-realms
menu. Account/realm and Characters are independently collapsible, while Inactive is a compact
closed drop tray whose content opens upward in normal layout flow. Rounded section headers are
title-only and visually distinct from their slightly indented controls, without vertical guides.
Active sizes to its cards and only yields height and scrolls when expanded Inactive would otherwise
overlap it. The selected character
illuminates the full card without scaling it or drawing an inner selection outline.

The Client Teams page keeps its last valid Team/detail UI during event-driven list revalidation on
picker open, window focus, and visibility restoration. Concurrent Team-list and per-dungeon
Selector requests are deduplicated; Selector cache identity is `(teamId, challengeMapId, locale)`
and cached results revalidate without blanking the panel. The Client passes `es_ES` or `en_US`
through its existing bridge to the Worker so Blizzard tooltip metadata follows the Client language;
the existing D1 locale key prevents cross-language cache reuse. This refinement does not change the
addon SavedVariables contract.

The exact-variant refinement additively extends that contract with a normalized bonus-based
`variantKey`, nullable exact `itemLevel`, and nullable exact in-game `qualityType`. Exact variants
remain distinct through Worker/Client Selector aggregation; Blizzard item quality is legacy
fallback only. Client language selection is an immediate serialized partial settings write and no
longer depends on the general Save action. The fields remain in `keystone_loot_json`; no migration
or Web change is required.

Upgrade-track presentation uses Blizzard's exact item-link upgrade track when available. The
optional `upgradeTrack` Favorite field passes through the existing KeystoneLoot JSON and objective,
Selector, and Planner DTOs. Until every published component emits that field, the Client restores
Champion, Hero, and Myth from the verified Midnight Season 2 exact-variant bonus-list ranges in
`variantKey`; base and unknown variants show no icon. Client and Web render icons on owned UI,
without modifying Wowhead tooltip HTML or inferring tracks from item level.

Trovehunter's Bounty presentation in Client Characters and Web Summary uses the existing additive
currency snapshot (`questCompleted`, `bagCount`, and `hasBuff`). It displays obtained/not obtained
plus active, unused in bags, or claimed with separate status icons. Quest `92887` is not used for
the claimed state because current addon data ties it to a weekly Scalebound Herald's Flute object and it may
already be complete while the map remains held. Claimed is inferred from a complete post-obtained
snapshot with neither a held map nor the active bounty aura; it cannot distinguish a genuinely
claimed trove from a map moved outside the tracked character bags.

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
`0005_keystone_loot_item_tooltip_metadata.sql`, then
`0006_keystone_loot_item_quality_and_stat_groups.sql`, deploy the backward-compatible Worker, smoke
the owner/team objective routes, and only then deploy Web. Missing Blizzard credentials do not
break objective routes, but metadata falls back to `Objeto #<itemId>` and the generic icon;
deployment is technically safe without them, while configuring them first is the recommended
product rollout.

KeystoneClient enriches its existing equipment JSON with optional Raider.IO-derived
`tierPieces: [{ tier, count }]`, counted from `gear.items[*].tier` without another HTTP request or
D1 migration. Local SavedVariables equipment remains authoritative while preserving this remote
tier annotation. The Characters view displays mixed tier counts with a generic `setPieces`
fallback and shows total Mythic+ rating in the Dungeons header (`mythicPlusSeason.rating`, then
`rioScore`). The native WebView context menu is suppressed and authenticated users receive the
compact client action menu; avatar selection now marks the card edge instead of its portrait.
