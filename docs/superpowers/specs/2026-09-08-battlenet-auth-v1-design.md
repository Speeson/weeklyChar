# Battle.net Authentication V1 Design

## Objective

Add Battle.net as an optional KeystoneSync identity provider for Web and
KeystoneClient while preserving `users.id`, password login, existing ownership,
and the current KeystoneSync JWT/session model.

## Approved design

The Worker is the only OAuth client. It starts an Authorization Code flow with
cryptographic `state`, PKCE S256, and exactly the `openid` scope; exchanges the
code using the confidential client secret; calls the official global
`/userinfo` endpoint; retains only `sub` and BattleTag; and immediately discards
the Battle.net token response. D1 stores SHA-256 hashes of browser handoff,
onboarding, state, and desktop polling secrets. Flows expire, state and final
tickets are single-use, and no KeystoneSync JWT is placed in a URL.

`user_identities` maps Battle.net `sub` to an existing `users.id` with unique
provider/subject and user/provider constraints. BattleTag is display-only.
Battle.net-only registration requires a user-confirmed KeystoneSync username,
creates `password_hash = NULL`, and inserts the user and identity in one D1
batch. Existing-account linking requires the normal password and email
verification rules. Unlinking is rejected when the user has no password.

Web starts OAuth through the Worker, exchanges a short-lived opaque callback
ticket, and then uses the existing localStorage KeystoneSync JWT flow. Unknown
Battle.net identities enter Web onboarding for explicit registration or
credential-backed linking. Settings exposes the linked display name and
link/unlink actions.

KeystoneClient asks its private Python sidecar to create a desktop flow, asks a
scoped Tauri command to open only the returned Battle.net authorization URL,
and polls through the sidecar at a two-second interval until ready, expired,
cancelled, or failed. Only the resulting KeystoneSync JWT and existing `/api/me`
projection are persisted by the sidecar.

## API contract

- `POST /api/auth/battlenet/start`
- `GET /api/auth/battlenet/callback`
- `POST /api/auth/battlenet/exchange`
- `POST /api/auth/battlenet/onboarding/register`
- `POST /api/auth/battlenet/onboarding/link`
- `POST /api/auth/battlenet/desktop/start`
- `POST /api/auth/battlenet/desktop/exchange`
- `GET /api/me/identities`
- `POST /api/me/identities/battlenet/start`
- `DELETE /api/me/identities/battlenet`

## Verification

Run migration preservation tests and local D1 migrations; Worker typecheck and
full tests; Web unit, lint, build, and Playwright suites; Client Python compile,
sidecar and bridge suites, frontend unit/build/visual suites, Rust fmt/check/test,
sidecar build, and NSIS build. Finish with Deployment Impact, code review, and
`git diff --check`.

## Out of scope

- `wow.profile`, character import, profile ownership, and Battle.net refresh
  token use or storage.
- Moving Web JWTs to cookies or replacing the KeystoneSync session model.
- Custom desktop URI schemes.
- Remote D1 migration, deploy, release, tag, commit, or push.
