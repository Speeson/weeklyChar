# Cloudflare Workers D1 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Railway FastAPI/PostgreSQL backend with a clean Cloudflare Worker + D1 API while preserving the current REST contract used by the web app and desktop client.

**Architecture:** Add a new `keystone-worker/` package instead of modifying `keystone-api/` in place. The Worker uses Hono for routing, D1 migrations for persistence, JSON text columns for addon payloads, JWT bearer tokens for web auth, sync tokens for the client, and Resend via `fetch` for email.

**Tech Stack:** Cloudflare Workers, TypeScript, Hono, Wrangler, D1, bcryptjs, Web Crypto API, Resend HTTP API.

## Global Constraints

- Work on branch `feature/cloudflare-workers-d1`.
- Do not import Railway production data; users register again and characters are rebuilt by sync.
- Do not delete `keystone-api/` during the migration; keep it as a fallback/reference.
- Do not change the addon for this migration.
- Do not create a client release until the Worker API is deployed and validated.
- Keep existing endpoint paths and response shapes where possible.
- Keep Spanish `detail` error messages compatible with the current web/client.
- Store secrets in Cloudflare Worker secrets or local `.dev.vars`, never in Git.
- Keep `backup-railway.dump` out of Git.

---

## File Structure

Create:

- `keystone-worker/package.json`: Worker scripts and dependencies.
- `keystone-worker/tsconfig.json`: TypeScript config.
- `keystone-worker/wrangler.jsonc`: Worker config and D1 binding.
- `keystone-worker/.dev.vars.example`: local secret template.
- `keystone-worker/migrations/0001_initial.sql`: D1 schema.
- `keystone-worker/src/index.ts`: Worker entrypoint and route mounting.
- `keystone-worker/src/types.ts`: shared Env, payload, row, and response types.
- `keystone-worker/src/http.ts`: CORS, JSON response, error helpers.
- `keystone-worker/src/crypto.ts`: password hashing, token generation, SHA-256, JWT helpers.
- `keystone-worker/src/db.ts`: D1 query helpers and row mapping.
- `keystone-worker/src/auth.ts`: auth middleware and current-user resolution.
- `keystone-worker/src/email.ts`: Resend helper and email templates.
- `keystone-worker/src/rateLimit.ts`: D1-backed email rate limiting.
- `keystone-worker/src/routes/auth.ts`: auth endpoints.
- `keystone-worker/src/routes/me.ts`: profile and character list/enrich endpoints.
- `keystone-worker/src/routes/keystones.ts`: desktop sync endpoint.
- `keystone-worker/src/routes/teams.ts`: team and invitation endpoints.
- `keystone-worker/src/routes/health.ts`: health endpoint.
- `keystone-worker/README.md`: local dev/deploy notes.

Modify:

- `README.md`: document Worker/D1 deployment path after implementation.
- `keystone-web/.env.example` if present, or document `NEXT_PUBLIC_API_URL` in root `README.md`.
- Client API URL only after Worker is deployed and tested.

Tests/Verification:

- Use `wrangler dev` and `wrangler d1 execute --local`.
- Use PowerShell `Invoke-RestMethod` smoke tests for auth, sync, teams, invitations, and reset-password rate limits.
- Use `npm run typecheck` in `keystone-worker/`.

---

### Task 1: Scaffold Worker Package

**Files:**
- Create: `keystone-worker/package.json`
- Create: `keystone-worker/tsconfig.json`
- Create: `keystone-worker/wrangler.jsonc`
- Create: `keystone-worker/.dev.vars.example`
- Create: `keystone-worker/src/index.ts`
- Create: `keystone-worker/src/types.ts`
- Create: `keystone-worker/src/routes/health.ts`
- Create: `keystone-worker/README.md`

**Interfaces:**
- Produces: `Env` type with `DB`, `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `WEB_BASE_URL`, `ALLOWED_ORIGINS`.
- Produces: Worker app listening on `/api/health`.

- [ ] **Step 1: Create package metadata**

Use dependencies:

```json
{
  "name": "keystone-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "d1:migrate:local": "wrangler d1 migrations apply KEYSTONE_DB --local",
    "d1:migrate:remote": "wrangler d1 migrations apply KEYSTONE_DB --remote"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260701.0",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.5.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Use Worker-compatible module settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create Wrangler config**

Start with a placeholder D1 database id. Replace it after creating the D1 DB with Wrangler/Cloudflare dashboard.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "keystone-sync-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-25",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "keystone-sync",
      "database_id": "replace-with-cloudflare-d1-database-id"
    }
  ]
}
```

- [ ] **Step 4: Create local secret template**

```env
JWT_SECRET=change-this-local-secret
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=KeystoneSync <noreply@keystonesync.esgarpe.dev>
WEB_BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://keystonesync.esgarpe.dev
```

- [ ] **Step 5: Create `Env` and health route**

`src/types.ts` must export:

```ts
export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  WEB_BASE_URL?: string
  ALLOWED_ORIGINS?: string
}
```

`src/routes/health.ts` must export:

```ts
import { Hono } from 'hono'
import type { Env } from '../types'

export const healthRoutes = new Hono<{ Bindings: Env }>()

healthRoutes.get('/api/health', c => {
  return c.json({ status: 'ok', service: 'keystone-worker' })
})
```

`src/index.ts` must mount the route:

```ts
import { Hono } from 'hono'
import type { Env } from './types'
import { healthRoutes } from './routes/health'

const app = new Hono<{ Bindings: Env }>()

app.route('/', healthRoutes)

export default app
```

- [ ] **Step 6: Install and typecheck**

Run:

```powershell
cd keystone-worker
npm install
npm run typecheck
```

Expected: TypeScript exits `0`.

- [ ] **Step 7: Commit**

```powershell
git add keystone-worker
git commit -m "Add Cloudflare Worker scaffold"
```

---

### Task 2: Add D1 Schema Migration

**Files:**
- Create: `keystone-worker/migrations/0001_initial.sql`
- Modify: `keystone-worker/README.md`

**Interfaces:**
- Produces D1 tables matching the current backend contract.
- Produces indexes used by auth, sync, team, and invitation routes.

- [ ] **Step 1: Create schema migration**

Create `keystone-worker/migrations/0001_initial.sql`:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  sync_token TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  date_of_birth TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verification_token_hash TEXT,
  email_verification_expires_at TEXT,
  password_reset_token_hash TEXT,
  password_reset_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  realm TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'eu',
  avatar_url TEXT,
  wow_account TEXT,
  rio_score REAL,
  wow_class TEXT,
  ilvl INTEGER,
  vault_json TEXT,
  prey_hunts_json TEXT,
  currencies_json TEXT,
  money_json TEXT,
  mythic_plus_season_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name, realm, region)
);

CREATE TABLE IF NOT EXISTS keystones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  has_keystone INTEGER NOT NULL DEFAULT 0,
  keystone_level INTEGER,
  keystone_challenge_map_id INTEGER,
  keystone_map_id INTEGER,
  keystone_dungeon TEXT,
  updated_reason TEXT,
  updated_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  invited_user_id INTEGER NOT NULL,
  invited_by_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  responded_at TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  attempts_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash ON users(email_verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash ON users(password_reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_sync_token ON users(sync_token);
CREATE INDEX IF NOT EXISTS idx_characters_user_name ON characters(user_id, name);
CREATE INDEX IF NOT EXISTS idx_keystones_character_updated ON keystones(character_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user_status ON team_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_user_status ON team_invitations(team_id, invited_user_id, status);
```

- [ ] **Step 2: Document migration commands**

Add to `keystone-worker/README.md`:

```md
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
```

- [ ] **Step 3: Verify migration locally**

Run:

```powershell
cd keystone-worker
npm run d1:migrate:local
```

Expected: migration applies without SQL errors.

- [ ] **Step 4: Commit**

```powershell
git add keystone-worker/migrations/0001_initial.sql keystone-worker/README.md
git commit -m "Add D1 initial schema"
```

---

### Task 3: Add HTTP, Crypto, DB, And Auth Foundations

**Files:**
- Create: `keystone-worker/src/http.ts`
- Create: `keystone-worker/src/crypto.ts`
- Create: `keystone-worker/src/db.ts`
- Create: `keystone-worker/src/auth.ts`
- Modify: `keystone-worker/src/types.ts`
- Modify: `keystone-worker/src/index.ts`

**Interfaces:**
- Produces `jsonError(c, status, detail)`.
- Produces `createAccessToken(env, userId)` and `verifyAccessToken(env, token)`.
- Produces `getCurrentUser(c)` and `getCurrentUserFlexible(c)`.
- Produces D1 helpers for row retrieval.

- [ ] **Step 1: Add response and CORS helpers**

`http.ts` must include:

```ts
import type { Context, Next } from 'hono'
import type { Env } from './types'

export function jsonError(c: Context<{ Bindings: Env }>, status: number, detail: string) {
  return c.json({ detail }, status as 400)
}

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header('Origin') ?? ''
  const allowed = (c.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  if (allowed.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
  }
  c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Authorization,Content-Type')
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  await next()
}
```

- [ ] **Step 2: Add crypto helpers**

`crypto.ts` must provide exact exports:

```ts
export async function sha256Hex(value: string): Promise<string>
export function newPlainToken(bytes?: number): string
export function newSyncToken(): string
export function newInviteCode(): string
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
export async function createAccessToken(secret: string, userId: number): Promise<string>
export async function verifyAccessToken(secret: string, token: string): Promise<number | null>
```

Use `bcryptjs` for password hashing and Web Crypto HMAC SHA-256 for JWT signing.

- [ ] **Step 3: Add row types**

Add to `types.ts`:

```ts
export type UserRow = {
  id: number
  username: string
  password_hash: string
  sync_token: string
  avatar_url: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  date_of_birth: string | null
  email_verified: number
  email_verification_token_hash: string | null
  email_verification_expires_at: string | null
  password_reset_token_hash: string | null
  password_reset_expires_at: string | null
  created_at: string
}
```

- [ ] **Step 4: Add auth middleware**

`auth.ts` must export:

```ts
export async function getBearerToken(c: Context<{ Bindings: Env }>): Promise<string | null>
export async function getCurrentUser(c: Context<{ Bindings: Env }>): Promise<UserRow | Response>
export async function getCurrentUserFlexible(c: Context<{ Bindings: Env }>): Promise<UserRow | Response>
export async function getUserBySyncToken(c: Context<{ Bindings: Env }>): Promise<UserRow | Response>
```

JWT auth must resolve users by decoded `sub`; flexible auth must try JWT first, then `sync_token`.

- [ ] **Step 5: Mount CORS globally**

In `index.ts`, before routes:

```ts
import { corsMiddleware } from './http'

app.use('*', corsMiddleware)
```

- [ ] **Step 6: Typecheck**

Run:

```powershell
cd keystone-worker
npm run typecheck
```

Expected: exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add keystone-worker/src
git commit -m "Add Worker auth foundations"
```

---

### Task 4: Implement Auth And Email Endpoints

**Files:**
- Create: `keystone-worker/src/email.ts`
- Create: `keystone-worker/src/rateLimit.ts`
- Create: `keystone-worker/src/routes/auth.ts`
- Modify: `keystone-worker/src/index.ts`

**Interfaces:**
- Produces all `/api/auth/*` endpoints.
- Produces D1-backed rate limits for `forgot_password` and `resend_verification`.

- [ ] **Step 1: Add email helper**

`email.ts` must export:

```ts
export async function sendVerificationEmail(env: Env, user: UserRow, token: string): Promise<void>
export async function sendPasswordResetEmail(env: Env, user: UserRow, token: string): Promise<void>
```

Use `fetch('https://api.resend.com/emails', ...)` with headers:

```ts
{
  Authorization: `Bearer ${env.RESEND_API_KEY}`,
  'Content-Type': 'application/json',
  'User-Agent': 'KeystoneSync/1.0'
}
```

If Resend returns non-2xx, throw an error with status `502`.

- [ ] **Step 2: Add persistent rate limiter**

`rateLimit.ts` must export:

```ts
export async function checkEmailRateLimits(
  env: Env,
  action: 'forgot_password' | 'resend_verification',
  clientIp: string,
  identity: string,
): Promise<Response | null>
```

Use the same limits as the FastAPI app:

- IP: 5 attempts per 900 seconds.
- Identity: 3 attempts per 3600 seconds.
- Cooldown: 1 attempt per 120 seconds.

Store attempts as JSON arrays of epoch seconds in `rate_limits.attempts_json`.

- [ ] **Step 3: Implement register/login/verify/reset routes**

`routes/auth.ts` must preserve payload names:

```ts
type RegisterRequest = {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  confirmPassword: string
  dateOfBirth: string
}
```

Validation messages must match current Spanish behavior:

- `"El nombre de usuario debe tener al menos 3 caracteres"`
- `"Nombre y apellidos son obligatorios"`
- `"Email invalido"`
- `"La password debe tener al menos 6 caracteres"`
- `"Las passwords no coinciden"`
- `"Fecha de nacimiento invalida"`
- `"Nombre de usuario ya en uso"`
- `"Email ya en uso"`
- `"Credenciales incorrectas"`
- `"Email no verificado. Revisa tu correo antes de iniciar sesion."`

- [ ] **Step 4: Mount auth routes**

In `index.ts`:

```ts
import { authRoutes } from './routes/auth'
app.route('/', authRoutes)
```

- [ ] **Step 5: Smoke test locally**

Run:

```powershell
cd keystone-worker
npm run d1:migrate:local
npm run dev
```

In another PowerShell:

```powershell
$body = @{
  firstName = "Test"
  lastName = "User"
  email = "test@example.com"
  username = "testuser"
  password = "secret123"
  confirmPassword = "secret123"
  dateOfBirth = "1992-01-01"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/auth/register" -ContentType "application/json" -Body $body
```

Expected with no Resend key: API returns configured email error. Expected with local Resend key: account created and verification email sent.

- [ ] **Step 6: Commit**

```powershell
git add keystone-worker/src
git commit -m "Add Worker auth endpoints"
```

---

### Task 5: Implement Profile, Character, And Keystone Sync Endpoints

**Files:**
- Create: `keystone-worker/src/routes/me.ts`
- Create: `keystone-worker/src/routes/keystones.ts`
- Modify: `keystone-worker/src/db.ts`
- Modify: `keystone-worker/src/types.ts`
- Modify: `keystone-worker/src/index.ts`

**Interfaces:**
- Produces `GET /api/me`.
- Produces character responses matching `_character_response` from FastAPI.
- Produces `POST /api/keystones/update` with sync-token auth.

- [ ] **Step 1: Add character and keystone types**

`types.ts` must include:

```ts
export type CharacterRow = {
  id: number
  user_id: number
  name: string
  realm: string
  region: string
  avatar_url: string | null
  wow_account: string | null
  rio_score: number | null
  wow_class: string | null
  ilvl: number | null
  vault_json: string | null
  prey_hunts_json: string | null
  currencies_json: string | null
  money_json: string | null
  mythic_plus_season_json: string | null
  created_at: string
  updated_at: string
}

export type KeystoneRow = {
  id: number
  character_id: number
  has_keystone: number
  keystone_level: number | null
  keystone_challenge_map_id: number | null
  keystone_map_id: number | null
  keystone_dungeon: string | null
  updated_reason: string | null
  updated_at: number | null
  created_at: string
}
```

- [ ] **Step 2: Add JSON and response helpers**

`db.ts` must export:

```ts
export function jsonLoad(value: string | null): unknown | null
export function jsonDump(value: unknown): string
export function characterResponse(character: CharacterRow, latest: KeystoneRow | null): Record<string, unknown>
export async function latestRealKeystone(env: Env, characterId: number): Promise<KeystoneRow | null>
```

`latestRealKeystone` query:

```sql
SELECT * FROM keystones
WHERE character_id = ? AND has_keystone = 1 AND keystone_level IS NOT NULL
ORDER BY COALESCE(updated_at, 0) DESC, id DESC
LIMIT 1
```

- [ ] **Step 3: Implement profile and character routes**

`routes/me.ts` must implement:

- `GET /api/me`
- `GET /api/me/characters`
- `POST /api/me/characters/enrich`
- `PATCH /api/me/avatar`
- `POST /api/me/change-password`

The `/api/me` response must include:

```json
{
  "id": 1,
  "username": "user",
  "syncToken": "token",
  "avatarUrl": null,
  "firstName": "First",
  "lastName": "Last",
  "email": "user@example.com",
  "dateOfBirth": "1992-01-01",
  "emailVerified": true
}
```

- [ ] **Step 4: Implement keystone sync**

`routes/keystones.ts` must implement `POST /api/keystones/update` with the same insert rule as FastAPI:

```ts
const isNewer =
  latest === null ||
  latest.updated_at === null ||
  payload.updatedAt === null ||
  payload.updatedAt > latest.updated_at

const hasRealKeystone = payload.hasKeystone === true && payload.keystoneLevel !== null && payload.keystoneLevel !== undefined

if (isNewer && hasRealKeystone) {
  // insert keystone row
}
```

Character metadata and JSON fields must update on every sync payload when present.

- [ ] **Step 5: Mount routes**

In `index.ts`:

```ts
import { meRoutes } from './routes/me'
import { keystoneRoutes } from './routes/keystones'
app.route('/', meRoutes)
app.route('/', keystoneRoutes)
```

- [ ] **Step 6: Smoke test sync**

After creating a verified user locally, get `syncToken` from `/api/me` and run:

```powershell
$token = "SYNC_TOKEN_HERE"
$body = @{
  character = "Speen"
  realm = "Zul'jin"
  region = "eu"
  hasKeystone = $true
  keystoneLevel = 12
  keystoneDungeon = "Magisters' Terrace"
  updatedAt = 1234567890
  updatedReason = "MANUAL_COMMAND"
  wowAccount = "KAGUEMARO"
  wowClass = "MAGE"
  ilvl = 287
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/keystones/update" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
```

Expected: `/api/me/characters` returns the character with `currentKeystone.level = 12`.

- [ ] **Step 7: Commit**

```powershell
git add keystone-worker/src
git commit -m "Add Worker character sync endpoints"
```

---

### Task 6: Implement Team And Invitation Endpoints

**Files:**
- Create: `keystone-worker/src/routes/teams.ts`
- Modify: `keystone-worker/src/db.ts`
- Modify: `keystone-worker/src/types.ts`
- Modify: `keystone-worker/src/index.ts`

**Interfaces:**
- Produces all `/api/teams*` endpoints.
- Produces all `/api/team-invitations*` endpoints.
- Team detail response groups users with their characters, matching the current web contract.

- [ ] **Step 1: Add team row types**

Add to `types.ts`:

```ts
export type TeamRow = {
  id: number
  name: string
  invite_code: string
  created_by: number
  created_at: string
}

export type TeamInvitationRow = {
  id: number
  team_id: number
  invited_user_id: number
  invited_by_user_id: number
  status: string
  created_at: string
  expires_at: string
  responded_at: string | null
}
```

- [ ] **Step 2: Add team response helpers**

`db.ts` must export:

```ts
export async function teamResponse(env: Env, team: TeamRow, currentUserId: number): Promise<Record<string, unknown>>
export async function teamDetailResponse(env: Env, team: TeamRow, currentUserId: number): Promise<Record<string, unknown>>
export async function teamInvitationResponse(env: Env, invitation: TeamInvitationRow): Promise<Record<string, unknown>>
```

Team response shape:

```json
{
  "id": 1,
  "name": "PEW PEW",
  "inviteCode": "abcdef1234567890",
  "isOwner": true,
  "ownerId": 1,
  "currentUserId": 1,
  "memberCount": 2
}
```

- [ ] **Step 3: Implement team routes**

`routes/teams.ts` must implement:

- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/join`
- `GET /api/teams/:teamId`
- `POST /api/teams/:teamId/invites`
- `DELETE /api/teams/:teamId/members/:userId`
- `POST /api/teams/:teamId/leave`
- `GET /api/me/team-invitations`
- `POST /api/team-invitations/:invitationId/accept`
- `POST /api/team-invitations/:invitationId/decline`

Preserve key Spanish errors:

- `"No perteneces a este team"`
- `"Usuario no encontrado"`
- `"Ese usuario ya pertenece al equipo"`
- `"Ese usuario ya tiene una invitacion pendiente"`
- `"Solo el creador del equipo puede eliminar miembros"`
- `"El creador no puede salir mientras haya otros miembros"`

- [ ] **Step 4: Mount routes**

In `index.ts`:

```ts
import { teamRoutes } from './routes/teams'
app.route('/', teamRoutes)
```

- [ ] **Step 5: Smoke test teams**

Use two local users. With user A token:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/teams" -Headers @{ Authorization = "Bearer $tokenA" } -ContentType "application/json" -Body (@{ name = "PEW PEW" } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/teams/1/invites" -Headers @{ Authorization = "Bearer $tokenA" } -ContentType "application/json" -Body (@{ username = "testuser2" } | ConvertTo-Json)
```

With user B token:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8787/api/me/team-invitations" -Headers @{ Authorization = "Bearer $tokenB" }
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/team-invitations/1/accept" -Headers @{ Authorization = "Bearer $tokenB" }
```

Expected: user B appears as team member in `GET /api/teams/1`.

- [ ] **Step 6: Commit**

```powershell
git add keystone-worker/src
git commit -m "Add Worker team endpoints"
```

---

### Task 7: Worker Documentation And Cutover Notes

**Files:**
- Modify: `keystone-worker/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces exact Cloudflare setup steps.
- Produces exact environment variable list.
- Documents that users must register again after cutover.

- [ ] **Step 1: Document Cloudflare setup**

Add to `keystone-worker/README.md`:

```md
## Cloudflare Setup

1. Login:
   ```powershell
   npx wrangler login
   ```
2. Create D1:
   ```powershell
   npx wrangler d1 create keystone-sync
   ```
3. Copy `database_id` into `wrangler.jsonc`.
4. Add secrets:
   ```powershell
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put EMAIL_FROM
   npx wrangler secret put WEB_BASE_URL
   npx wrangler secret put ALLOWED_ORIGINS
   ```
5. Apply remote migrations:
   ```powershell
   npm run d1:migrate:remote
   ```
6. Deploy:
   ```powershell
   npm run deploy
   ```
```

- [ ] **Step 2: Document cutover**

Add to root `README.md`:

```md
### Cloudflare Workers + D1 API

The Railway/FastAPI backend is being replaced by `keystone-worker/`, a Cloudflare Worker backed by D1. This migration starts with an empty database: users register again and character data is rebuilt by the desktop sync.

After deployment, set the web variable:

```env
NEXT_PUBLIC_API_URL=https://<worker-domain>
```

The desktop client API URL should be changed only after the Worker has passed local and production smoke tests.
```

- [ ] **Step 3: Typecheck and status verification**

Run:

```powershell
cd keystone-worker
npm run typecheck
cd ..
git status --short
```

Expected: only planned doc changes before commit.

- [ ] **Step 4: Commit**

```powershell
git add keystone-worker/README.md README.md
git commit -m "Document Cloudflare API migration"
```

---

### Task 8: Deploy Worker To Cloudflare

**Files:**
- Modify: `keystone-worker/wrangler.jsonc` with real D1 database id.

**Interfaces:**
- Produces live Worker API URL.
- Produces remote D1 database with schema applied.

- [ ] **Step 1: Login to Cloudflare**

Run:

```powershell
cd keystone-worker
npx wrangler login
```

Expected: browser login succeeds.

- [ ] **Step 2: Create D1 database**

Run:

```powershell
npx wrangler d1 create keystone-sync
```

Expected: command prints `database_id`.

- [ ] **Step 3: Update Wrangler config**

Replace `replace-with-cloudflare-d1-database-id` with the returned database id.

- [ ] **Step 4: Add secrets**

Run each command and paste the value when prompted:

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put WEB_BASE_URL
npx wrangler secret put ALLOWED_ORIGINS
```

- [ ] **Step 5: Apply remote migrations and deploy**

Run:

```powershell
npm run d1:migrate:remote
npm run deploy
```

Expected: Wrangler prints the Worker URL.

- [ ] **Step 6: Production smoke test**

Run:

```powershell
Invoke-RestMethod -Uri "https://<worker-domain>/api/health"
```

Expected:

```json
{ "status": "ok", "service": "keystone-worker" }
```

- [ ] **Step 7: Commit deployment config**

Only commit `wrangler.jsonc` if it contains no secrets:

```powershell
git add keystone-worker/wrangler.jsonc
git commit -m "Configure Cloudflare D1 binding"
```

---

### Task 9: Web And Client Cutover

**Files:**
- Modify only after Worker production smoke tests pass.
- Potentially modify: `keystone-web/.env.local` locally.
- Potentially modify: client config/default API URL if the app has a baked default.

**Interfaces:**
- Web production uses Worker URL.
- Client sync uses Worker URL.

- [ ] **Step 1: Test web locally against Worker**

Set local web env:

```env
NEXT_PUBLIC_API_URL=https://<worker-domain>
```

Run:

```powershell
cd keystone-web
npm run dev
```

Expected:

- Register works.
- Verify email works.
- Login works.
- Dashboard loads.
- Teams and summary load with empty/new data.

- [ ] **Step 2: Test desktop client against Worker**

Set the client API URL to the Worker URL through existing settings/config. Then:

- Login.
- Sync from local SavedVariables.
- Confirm characters appear in web.

- [ ] **Step 3: Update production web environment**

In Vercel/Cloudflare Pages, set:

```env
NEXT_PUBLIC_API_URL=https://<worker-domain>
```

Redeploy web.

- [ ] **Step 4: Decide if a client release is needed**

If the client default API URL changes in source or installer metadata, follow `RELEASE_WORKFLOW.md`:

- Ask user confirmation before push.
- Push project repo.
- Provide release tag/title/changelog.
- User creates release manually.

- [ ] **Step 5: Commit source changes only**

If source files changed:

```powershell
git add <changed-source-files>
git commit -m "Point clients to Cloudflare API"
```

---

## Self-Review

- Spec coverage: The plan covers Worker scaffold, D1 schema, auth, profile, sync, teams, invitations, email, rate limits, deploy, and cutover.
- Placeholder scan: No task intentionally defers implementation details; all deferred production values are explicit user-supplied Cloudflare IDs/secrets.
- Type consistency: `Env`, `UserRow`, `CharacterRow`, `KeystoneRow`, `TeamRow`, and helper function names are defined before downstream route tasks consume them.
