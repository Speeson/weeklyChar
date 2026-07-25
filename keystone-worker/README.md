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
