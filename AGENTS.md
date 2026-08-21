# KeystoneSync Agent Instructions

## Scope

These instructions apply to the entire repository. If a nested `AGENTS.md` exists, read it before working in that subtree and follow the nested rules in addition to these root rules. For `keystone-web/`, the nested `keystone-web/AGENTS.md` is authoritative for Web-specific Next.js guidance and is not overridden by this file.

## Operating Rules

- Inspect the relevant files before editing.
- Prefer the smallest change that satisfies the current task.
- Keep changes scoped to the requested component or document.
- Do not refactor, reformat, rename, or remove unrelated code.
- Do not speculate about suspected legacy components before the architecture audit.
- Do not declare a component obsolete or safe to delete until the modernization plan reaches the relevant audit/removal phase.
- Validate before claiming success. If validation is not possible, state the blocker clearly.
- Respect the current user task over older plans or stale documentation.
- After verified file changes that may affect product build, deployment, release, database migration, or addon distribution, run the Deployment Impact script instead of inferring impact from memory.

## Modernization Plan

`docs/KEYSTONESYNC_ACTION_PLAN.md` is the master execution plan for KeystoneSync modernization work.

- Read it before executing any modernization task.
- Execute only the phase or task explicitly requested by the user.
- Do not start later phases early.
- Mark tasks complete only after the requested files are coherent and validation has been performed.

## Persistent Project Context

`docs/AGENT_CONTEXT.md` is the durable project context for future agents.

- Read it when the task depends on architecture, current project state, versions, release rules, or prior durable decisions.
- Treat it as context, not as a replacement for inspecting source/configuration.
- Update it only when durable project state changes.
- Do not use it as a chronological work log, session transcript, or scratchpad.
- Store verified facts, explicit decisions, active limitations, important commands, and unresolved ambiguities.
- Do not store secrets, temporary debugging notes, or routine file-edit history.

## Component Boundaries

Use `docs/ARCHITECTURE.md` for detailed component boundaries and `docs/DATA_CONTRACT.md` before changing tracked data that crosses addon, client, Worker, D1, or Web.

The current intended boundaries are:

- `keystone-web` -> Web application.
- `keystone-worker` -> API / Cloudflare Worker / D1 integration.
- `keystone-client` -> Windows desktop client.
- `Speeson/KeystoneSync` -> canonical manually edited World of Warcraft addon repository.

These boundaries reflect the verified architecture through Phase 6.

Removed historical components:

- `keystone-api` was the former FastAPI/PostgreSQL/Railway backend and has been removed.
- `keystone-sync-client` was the former script-based synchronization client and has been removed.

Addon ownership rule:

- `Speeson/KeystoneSync` is the only manually edited addon source.
- `keystone-client/addon/KeystoneSync` is generated/synchronized client bundle content. Do not edit it directly.
- If the canonical addon checkout is unavailable, do not fake addon changes in the generated bundle; use or request a valid source path and run the sync/check scripts.

## Project Skills

Use the project skills under `.agents/skills/` when relevant:

- `keystonesync-addon` for addon, SavedVariables, packaging, versioning, or release work.
- `keystonesync-wow-patch` for WoW patch, Interface, Mythic+ season, dungeon, currency, quest, item, or API facts.
- `keystonesync-data-contract` for changes crossing addon, client, Worker, D1, or Web data contracts.
- `keystonesync-client` for Windows client, parser, Raider.IO enrichment, addon install/update, packaging, or release work.
- `keystonesync-worker-d1` for Worker, Hono routes, auth, D1, migrations, or Worker deployment work.
- `keystonesync-web` for Next.js Web changes.
- `deploy-impact` for deterministic build/deploy/release impact classification.

Patch-sensitive WoW facts must be verified from current reliable sources. Do not invent Interface values, currency IDs, item IDs, quest IDs, map IDs, dungeon pools, or API changes.

## Documentation Rules

- Keep documentation accurate when durable behavior, commands, architecture, or decisions change.
- Do not update the root `README.md` unless the current task explicitly requires it or verified behavior changed.
- Do not convert provisional architecture assumptions into hard facts.
- Prefer replacing obsolete context over appending a running history.

## Validation

Use the narrowest relevant validation for the files changed.

For documentation-only agent/bootstrap work:

- Inspect the edited files.
- Verify referenced repository paths exist.
- Check `git diff` and `git status --short`.

For component work, use the repository's actual scripts when relevant:

- Web: `cd keystone-web; npm run lint; npm run build`
- Worker: `cd keystone-worker; npm run typecheck; npm test`
- Worker local D1 migrations: `cd keystone-worker; npm run d1:migrate:local`
- Client: `cd keystone-client; build.bat`
- Client installer: `cd keystone-client; build_installer.bat`
- Addon: verify `.toc` metadata, required files, package layout, and manual in-game behavior when release readiness is claimed.

Remote migration, deployment, release, tag, and push commands are not validation defaults.

Deployment Impact:

- Run `python scripts/deploy_impact.py --files <changed-paths>` after relevant file changes.
- Use `--json --strict` for machine/CI-oriented checks.
- Use `--addon-changed` to represent changes in the external canonical `Speeson/KeystoneSync` addon repository.
- Script output reports required consideration; it does not authorize remote operations.

## Remote Operation Restrictions

Do not perform any of the following unless explicitly requested in the current user task:

- `git push`
- pull request creation
- tag creation
- GitHub Release creation or modification
- Vercel deployment
- `wrangler deploy`
- remote D1 migrations
- external repository write operations, including the standalone `Speeson/KeystoneSync` repository
- sending emails or using external credentials

Local commits are allowed only when explicitly requested. Never force-push or rewrite Git history unless the user explicitly instructs it and the scope is unambiguous.
