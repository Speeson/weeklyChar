# Cloudflare Workers + D1 Migration Design

## Goal

Move the KeystoneSync backend away from Railway/FastAPI/PostgreSQL to a clean Cloudflare stack using Workers, D1, and Resend, with no production data import. Existing users will register again and character data will be rebuilt through the desktop client sync.

## Current System

The current backend lives in `keystone-api/` and is a single FastAPI application backed by SQLAlchemy models. The web app and desktop client call the backend through the same REST paths under `/api/*`.

Current tables:

- `users`
- `characters`
- `keystones`
- `teams`
- `team_members`
- `team_invitations`

Current functional areas:

- Auth: register, login, email verification, resend verification, forgot/reset password, change password.
- Profile: current user data and avatar.
- Character sync: desktop client sync token writes character, keystone, vault, prey hunts, currencies, money, and Mythic+ season JSON.
- Teams: create, join by invite code, view team detail, invite by username, accept/decline invitations, remove member, leave team.
- Email: Resend for verification and password reset.

## Target Architecture

Create a new `keystone-worker/` package in the monorepo.

Runtime:

- Cloudflare Worker.
- TypeScript.
- Hono router.
- Cloudflare D1 for persistent data.
- Web Crypto APIs for token hashing and JWT signing/verification.
- Resend via direct `fetch` calls.

Deployment:

- Worker deployed with Wrangler.
- D1 schema managed with Wrangler migrations.
- The existing Next.js web app remains as-is initially, with only `NEXT_PUBLIC_API_URL` changed after the Worker is validated.
- The desktop client remains as-is initially, with only the API URL config changed after validation.

## API Compatibility

The Worker must preserve existing response shapes and endpoint paths where possible so web/client changes stay minimal.

Required public endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Required authenticated endpoints:

- `GET /api/me`
- `PATCH /api/me/avatar`
- `POST /api/me/change-password`
- `GET /api/me/characters`
- `POST /api/me/characters/enrich`
- `POST /api/keystones/update`
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

## Database Design

D1 is SQLite, so schemas will be explicit SQL migrations rather than SQLAlchemy models. Date/time values will be stored as ISO-8601 UTC text unless the existing API expects integer timestamps.

Tables:

- `users`: account, auth, sync token, email verification/reset state, profile fields.
- `characters`: one row per user/name/realm/region, plus addon JSON fields.
- `keystones`: historical real keystone snapshots per character.
- `teams`: team metadata and invite code.
- `team_members`: many-to-many users to teams.
- `team_invitations`: pending/accepted/declined username invitations.
- `rate_limits`: persistent email/reset rate limits because Workers cannot rely on in-memory counters.

Important constraints:

- `users.username` unique.
- `users.email` unique.
- `users.sync_token` unique.
- `characters(user_id, name, realm, region)` unique.
- `teams.invite_code` unique.
- `team_members(team_id, user_id)` unique.
- Add indexes for token hashes, team invitations, character owner, and team membership lookups.

JSON fields remain text columns to preserve the current addon/client payload model:

- `vault_json`
- `prey_hunts_json`
- `currencies_json`
- `money_json`
- `mythic_plus_season_json`

## Authentication And Security

The Worker will keep bearer JWTs for web login and sync tokens for the desktop client.

Requirements:

- JWT expiration remains 30 days.
- Sync token remains a permanent random token per user.
- Password hashes must use a Worker-compatible implementation. Use `bcryptjs` if native bcrypt is not viable in Workers.
- Email verification tokens and reset tokens are stored only as SHA-256 hashes.
- Forgot password and resend verification rate limits must be stored in D1 so they work across Worker isolates.
- CORS must allow local dev and production web origins through environment configuration.
- Secrets must be Cloudflare Worker secrets, not committed to Git.

Required Worker secrets/config:

- `JWT_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `WEB_BASE_URL`
- `ALLOWED_ORIGINS`

## Data Flow

Registration:

1. User submits full registration form.
2. Worker validates fields and uniqueness.
3. Worker creates user with `email_verified = 0`.
4. Worker sends Resend verification email.
5. Login is blocked until verification succeeds.

Desktop sync:

1. Client sends bearer sync token to `POST /api/keystones/update`.
2. Worker resolves user by `sync_token`.
3. Worker upserts character metadata and JSON addon fields.
4. Worker inserts a new keystone row only when the payload has a real keystone and is newer than the latest real keystone for that character.

Teams:

1. Authenticated users create or join teams.
2. Every team member can see the invite code.
3. Members can invite another account by username.
4. Invited users see pending invitations in the navbar endpoint.
5. Owners can remove members; members can leave teams.

## Error Handling

Responses should preserve the current API behavior:

- Validation errors return `400` with Spanish `detail` text.
- Unauthorized returns `401`.
- Forbidden team/member operations return `403`.
- Missing records return `404`.
- Rate-limited email endpoints return `429`.
- Resend failures return `502`.

The web and client currently expect `detail` for most failures, so the Worker error helper must produce JSON shaped as:

```json
{ "detail": "Mensaje" }
```

## Local Development

Local workflow:

- `npm install` inside `keystone-worker/`.
- `wrangler d1 migrations apply KEYSTONE_DB --local`.
- `wrangler dev`.
- Use `.dev.vars` locally for secrets.
- Point `keystone-web/.env.local` to the Worker dev URL when testing.

No production cutover happens until local Worker endpoints pass basic auth, sync, teams, invitations, and reset-password tests.

## Testing Strategy

Minimum verification before deploy:

- Register returns verification-required state and creates a user.
- Verify email enables login.
- Login returns access token.
- `/api/me` returns profile and sync token.
- Sync token can create/update characters and keystones.
- Characters endpoint returns the same shape the web expects.
- Team create/join/detail endpoints work.
- Invite/accept/decline/remove/leave flows work.
- Forgot/reset password rate limits persist in D1.
- CORS works from local web and production domain.

## Rollout Plan

1. Build Worker and D1 locally.
2. Deploy Worker to a temporary Cloudflare route.
3. Register a fresh test account.
4. Point local web to Worker and verify.
5. Point local desktop client to Worker and sync.
6. Update production web `NEXT_PUBLIC_API_URL`.
7. Update client default API URL only after production Worker is stable.

## Explicit Non-Goals

- No Railway data import.
- No addon changes for this migration.
- No web redesign.
- No client release until the Worker API is validated.
- No Battle.net login.
- No move of the web app to Cloudflare Pages in the first migration phase.
