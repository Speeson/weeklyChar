# Keystone Worker

Cloudflare Worker replacement for the KeystoneSync FastAPI backend.

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
