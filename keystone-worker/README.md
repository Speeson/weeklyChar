# Keystone Worker

Current KeystoneSync API implemented as a Cloudflare Worker with Hono and Cloudflare D1.

## Local Setup

Install dependencies:

```powershell
npm install
```

Copy local secrets:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Run the Worker locally:

```powershell
npm run dev
```

Health check:

```powershell
Invoke-RestMethod -Uri "http://localhost:8787/api/health"
```

## D1

Create the database:

```powershell
npx wrangler d1 create keystone-sync
```

Copy the returned `database_id` into `wrangler.jsonc`.

Apply local migrations:

```powershell
npm run d1:migrate:local
```

Apply remote migrations:

```powershell
npm run d1:migrate:remote
```

### Username NOCASE migration preflight

Migration `0007_users_username_nocase.sql` preserves stored username casing and
adds database-enforced `COLLATE NOCASE` uniqueness. Before a future production
migration, execute this read-only query using the same collation semantics:

```sql
SELECT
  username COLLATE NOCASE AS normalized_username,
  COUNT(*) AS account_count,
  GROUP_CONCAT(id || ':' || username, ', ') AS conflicting_accounts
FROM users
GROUP BY username COLLATE NOCASE
HAVING COUNT(*) > 1;
```

Exact production command (preparation only; do not run during implementation):

```powershell
npx wrangler d1 execute DB --remote --command "SELECT username COLLATE NOCASE AS normalized_username, COUNT(*) AS account_count, GROUP_CONCAT(id || ':' || username, ', ') AS conflicting_accounts FROM users GROUP BY username COLLATE NOCASE HAVING COUNT(*) > 1;"
```

No rows means the migration may proceed. Any row means stop rollout, report the
conflicting IDs/usernames, and resolve them manually before migration. The
application must never choose, merge, delete, rename, or lowercase an account.

## Cloudflare Setup

Remote Cloudflare operations require explicit authorization in the current task. Do not run remote migrations or deploy as routine validation.

Login:

```powershell
npx wrangler login
```

Create D1:

```powershell
npx wrangler d1 create keystone-sync
```

Copy the returned `database_id` into `wrangler.jsonc`.

Add secrets:

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put WEB_BASE_URL
npx wrangler secret put ALLOWED_ORIGINS
```

Apply remote migrations:

```powershell
npm run d1:migrate:remote
```

Deploy:

```powershell
npm run deploy
```
