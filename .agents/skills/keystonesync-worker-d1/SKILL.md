---
name: keystonesync-worker-d1
description: Work safely on the KeystoneSync Cloudflare Worker, Hono API, authentication, D1 persistence, migrations and Worker deployment.
---

# KeystoneSync Worker + D1

## When to use

Load this skill for:

- `keystone-worker`
- Hono routes
- API authentication
- request/response contracts
- D1 queries
- migrations
- Wrangler configuration
- Worker tests
- Worker deployment

## Production role

`keystone-worker` is the current API backend.

Cloudflare D1 database `keystone-sync` is the current production persistence.

Use `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACT.md` for current boundaries and sync-contract details.

Do not modify removed historical FastAPI/PostgreSQL/Railway code as a substitute for Worker changes.

## Rules

1. Inspect route and DB code before changing schema/contract.
2. Load `keystonesync-data-contract` for sync payload changes.
3. Prefer parameterized DB operations.
4. Preserve authentication boundaries.
5. Treat migrations as forward-moving schema history.
6. Never run remote D1 migrations without explicit authorization.
7. Never deploy Worker without explicit authorization.
8. Test type safety and Worker behavior before claiming readiness.
9. Distinguish local D1 validation from production migration.
10. Preserve compatibility with currently deployed clients where practical.

## Migration checklist

Before adding a migration:

- Is a schema change actually required?
- Can the field live inside an established JSON document instead?
- Is existing production data compatible?
- Is a backfill required?
- Does old client payload still work?
- Does Worker read/write both old and new state safely?
- Are tests added?

## Validation

Use the repository's actual scripts.

Default local checks:

- `npm run typecheck`
- `npm test`
- local D1 migration
- local Worker execution where useful

Remote commands are operational actions, not validation defaults.

## Deployment

Once Deployment Impact exists, use it to determine whether Worker and/or DB deployment is required.

Versioned workflow:

- `.github/workflows/deploy-worker.yml` validates Worker changes with `npm run typecheck` and `npm test`.
- Worker production deploy uses `npm run deploy` only behind manual workflow input.
- Remote D1 migrations use `npm run d1:migrate:remote` only behind manual workflow input and the `production` environment.
- Required GitHub secrets are `CLOUDFLARE_API_TOKEN` and, when Wrangler cannot infer it, `CLOUDFLARE_ACCOUNT_ID`.
