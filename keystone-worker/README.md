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
