# Sparks and Username Identity — Final Validation Report

Date: 2026-08-31

## Scope

One coordinated maintenance phase across the standalone KeystoneSync addon and
weeklyChar repositories:

- Track Spark of Tides in carried inventory, normal personal bank, and personal
  Reagent Bank while excluding Warband/Account Bank.
- Preserve the last authoritative per-character bank snapshot when personal-bank
  data is unavailable.
- Display a positive, known bank quantity in Web Summary.
- Treat usernames as case-insensitive account identities while preserving their
  stored display casing.

## Validation evidence

### KeystoneSync addon

- Runtime suite: 59 passed.
- Deployment-impact suite: 10 passed.
- Release suite: 30 passed.
- Pending changeset validation: passed.
- Release plan: `0.2.5 -> 0.2.6` (patch), tag `v0.2.6`, asset
  `KeystoneSync-v0.2.6.zip`.
- Strict impact classification: `addon_build=true`, `addon_release=true`, no
  unknown or outside paths.
- `git diff --check`: passed (line-ending conversion notices only).

### weeklyChar Worker and D1

- TypeScript typecheck: passed.
- Full Worker suite: 113 passed.
- Migration suite: 2 passed.
- Local D1 migration check: passed; no migrations remained to apply.
- No remote D1 command was run.

### weeklyChar Web

- Unit suite: 63 passed, including all four Spark formatting cases.
- Next.js production build and TypeScript phase: passed.
- Repository-wide lint: blocked by 13 pre-existing React hook/static-component
  errors in existing pages. The failures include untouched files and the existing
  synchronous effect pattern in `app/summary/page.tsx`; this change introduces no
  new lint category or unrelated lint remediation.

### weeklyChar pipeline and impact

- Client parser/sync suite: 91 passed.
- Client bridge suite: 60 passed.
- Deployment-impact suite: 46 passed.
- Strict changed-path classification: `worker=true`, `db=true`, `web=true`,
  `client_build=false`, `client_release=false`, `addon=false`,
  `addon_release=false`; no unknown or outside paths.
- Strict external-addon classification: `addon=true`, `addon_release=true`, all
  weeklyChar build/release dimensions false.
- `git diff --check`: passed (line-ending conversion notices only).

## Production preparation

The production username collision preflight was not executed. The documented
read-only query uses `username COLLATE NOCASE`, exactly matching migration
identity semantics. A future rollout must stop for manual resolution if it finds
case-only collisions; it must not merge, delete, rename, or select users
automatically.

No files were staged or committed, and no push, merge, tag, deployment, release,
remote migration, or external repository write was performed.
