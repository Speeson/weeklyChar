---
name: deploy-impact
description: Run KeystoneSync's deterministic build, deployment and release impact classifier and report required local/remote actions without authorizing them.
---

# KeystoneSync Deployment Impact

## Current State

The deterministic Deployment Impact script exists at:

```text
scripts/deploy_impact.py
```

The script is authoritative for repository path classification. Do not duplicate its full rule table in this skill or infer final build/deploy/release impact solely from memory.

GitHub Actions consume this script through `.github/workflows/deploy.yml`.

## When To Run

Run this skill after verified file changes that may affect product build, deployment, release, database migration, or addon distribution.

Do not require it for purely conversational tasks or read-only analysis with no file changes.

## Dimensions

```text
WEB
WORKER
DB
CLIENT_BUILD
CLIENT_RELEASE
ADDON
ADDON_RELEASE
```

Use the script output for the exact booleans and triggering paths.

## Canonical Commands

Explicit changed paths:

```text
python scripts/deploy_impact.py --files <path> [<path> ...]
```

Machine-readable output:

```text
python scripts/deploy_impact.py --files <path> --json
```

CI/strict mode:

```text
python scripts/deploy_impact.py --files <path> --json --strict
```

External canonical addon repository changed:

```text
python scripts/deploy_impact.py --addon-changed
```

Unknown or outside-repository paths must be surfaced. In `--strict` mode they make the script exit non-zero.

Workflow files under `.github/` are classified as known no-product-impact by the script; they change automation behavior, not product deployment impact by themselves.

## Report Format

```text
Deployment impact:
- WEB: true/false
- WORKER: true/false
- DB: true/false
- CLIENT_BUILD: true/false
- CLIENT_RELEASE: true/false
- ADDON: true/false
- ADDON_RELEASE: true/false

Required validation:
- ...

Remote actions that would be required:
- ...
```

Required local validation should follow the impacted component skills and `docs/AGENT_CONTEXT.md`.

## Safety

Reporting required remote actions does not authorize them.

Do not deploy, migrate remote D1, tag, release, push, or write to external repositories unless explicitly authorized in the current request.
