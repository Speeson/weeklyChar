---
name: keystonesync-web
description: Work on KeystoneSync Web safely, respecting the project's current Next.js rules, API contract, seasonal metadata and build validation.
---

# KeystoneSync Web

## When to use

Load this skill for changes under `keystone-web`, including:

- Next.js pages/components
- React
- TypeScript
- Tailwind
- API data types
- summary displays
- Mythic+ seasonal metadata
- download links
- Web deployment configuration

## Nested instructions

Before editing, read any `AGENTS.md` inside `keystone-web`.

Nested instructions apply in addition to root repository rules.

If the nested file requires consulting the installed Next.js documentation for this version, follow it before writing code.

## Rules

1. Do not assume Next.js APIs from memory when repository instructions say otherwise.
2. Keep UI types aligned with Worker responses.
3. Load `keystonesync-data-contract` for tracked-data changes.
4. Recognize that current Web pages contain seasonal hardcodes and duplicated response interfaces; do not fix them unless the current task requires it.
5. Prefer central data/config for dungeon pools when practical during seasonal metadata work.
6. Preserve useful empty/loading/error states.
7. Do not overclaim Vercel CI/CD ownership; checked-in files do not prove the external Git Integration configuration.
8. Keep the client installer download URL compatible with the expected GitHub Release asset.
9. Do not deploy without explicit authorization.

## Seasonal data

When a WoW season changes, audit:

- dungeon pool
- map IDs
- display names
- abbreviations
- ordering
- currencies shown
- season labels
- icons/assets if hardcoded

Use `keystonesync-wow-patch` for patch-sensitive facts.

Use `keystonesync-data-contract` when seasonal UI work changes tracked fields or response shapes.

## Validation

At minimum, when available:

```text
npm run lint
npm run build
```

Run targeted tests if the project adds them.

Versioned workflow:

- `.github/workflows/deploy-web.yml` runs Web build and lint.
- Build is blocking.
- Lint is temporarily non-blocking because Phase 8 documented a pre-existing lint baseline.
- Do not add a duplicate Vercel deployment workflow unless external deployment ownership changes deliberately.
