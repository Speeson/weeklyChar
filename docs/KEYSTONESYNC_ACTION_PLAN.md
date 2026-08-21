# KeystoneSync — Master Action Plan

> Operational roadmap for Codex and repository agents.
>
> Goal: first establish a reliable agentic working environment and a truthful project architecture, then clean legacy code, remove ambiguity, add deterministic validation/release automation, and finally perform the full World of Warcraft 12.1 / Midnight Season 2 update.

---

# 0. Confirmed starting state

## WoW 12.1 basic compatibility

**Status: COMPLETED / MANUALLY VERIFIED**

The addon has already been verified in WoW 12.1:

- it loads correctly;
- it produces no Lua errors;
- it still tracks Mythic+ keystones;
- it continues to update `KeystoneSyncDB`.

Therefore there is no need for an emergency compatibility hotfix before starting the modernization plan.

The `.toc` Interface value, seasonal data, hardcoded IDs and WoW APIs will be audited during the dedicated Season 2 phase.

---

# Global execution rules

These rules apply to the whole plan.

1. Work on one clearly scoped task at a time.
2. Inspect the repository before editing.
3. Repository code/configuration is a stronger source of truth than stale documentation.
4. Prefer the smallest relevant change.
5. Do not perform unrelated refactors.
6. Do not `git push`, create PRs, tags, releases, deploy, or run remote D1 migrations unless explicitly requested in the current task.
7. Validate before claiming success.
8. Update persistent project context when architecture, workflows, versions, contracts or durable decisions change.
9. Do not use `AGENT_CONTEXT.md` as a chronological diary or changelog.
10. Once Deployment Impact exists, agents must run it instead of inferring deployment/release impact from memory.
11. Never invent WoW currency IDs, item IDs, quest IDs, map IDs or API changes. Verify them.
12. The standalone `Speeson/KeystoneSync` repository is intended to become the canonical addon source; this must be confirmed and documented before duplicate copies are removed.

---

# Target production architecture

## Repositories

### `Speeson/KeystoneSync`

Canonical World of Warcraft addon repository.

```text
KeystoneSync
├── KeystoneSync.lua
├── KeystoneSync.toc
├── CHANGELOG.md
└── README.md
```

### `Speeson/weeklyChar`

Application and services repository.

```text
weeklyChar
├── .agents/
│   └── skills/
├── docs/
├── keystone-client/
├── keystone-web/
├── keystone-worker/
└── scripts/
```

## Target data flow

```text
World of Warcraft
      ↓
KeystoneSync addon
      ↓
SavedVariables / KeystoneSyncDB
      ↓
KeystoneClient
      ↓
Cloudflare Worker
      ↓
Cloudflare D1
      ↓
KeystoneSync Web
```

---

# PHASE 1 — Agentic bootstrap

**Priority: CRITICAL**

This phase must happen before architecture cleanup so Codex has repository rules and persistent context from the start.

---

## Task 1.1 — Create root `AGENTS.md`

**Status: COMPLETED**

Create a repository-wide `AGENTS.md`, inspired by the working philosophy used in NFCompra but adapted specifically to KeystoneSync.

It must define:

- inspect before editing;
- smallest relevant change;
- component boundaries;
- validation requirements;
- remote-operation restrictions;
- documentation update rules;
- how to use `docs/AGENT_CONTEXT.md`;
- how to use this master action plan;
- how nested `AGENTS.md` files interact with root rules;
- no speculative edits to suspected legacy code;
- no success claim without validation.

Initial component map:

```text
keystone-web          → Web
keystone-worker       → API / Cloudflare Worker / D1 integration
keystone-client       → Windows client
Speeson/KeystoneSync  → WoW addon repository
```

Potential legacy components must initially be marked **pending audit**, not automatically obsolete.

### Completion criteria

Codex can enter the repository and understand the working rules before touching product code.

---

## Task 1.2 — Create `docs/AGENT_CONTEXT.md`

**Status: COMPLETED**

Create the persistent repository context file.

Initial content should include only verified or explicitly provisional information.

Recommended sections:

```text
Project purpose
Current architecture status
Current production components
Potential legacy components pending audit
Canonical repositories
Data flow
Current versions
Deployment model
Build and validation commands
Important architectural decisions
Known limitations
Current WoW patch/season
Current modernization milestone
```

### Important rule

`AGENT_CONTEXT.md` is persistent state, not a work log.

Good:

> The FastAPI backend was removed after confirming all production API traffic uses keystone-worker.

Bad:

> Today Codex edited three files and then fixed a typo.

### Completion criteria

Future Codex sessions can recover the important durable project state without re-reading the entire Git history.

---

## Task 1.3 — Register this master plan

**Status: COMPLETED**

Ensure this document lives at:

```text
docs/KEYSTONESYNC_ACTION_PLAN.md
```

Root `AGENTS.md` should instruct agents to read it when executing modernization tasks.

---

# PHASE 2 — Audit the real architecture

**Priority: CRITICAL**

Do not delete anything in this phase.

---

## Task 2.1 — Audit current production architecture

**Status: COMPLETED**

Confirm from source/configuration:

- current backend;
- current production database;
- current web application and deployment;
- current Windows client;
- standalone addon repository relationship;
- active build/release paths;
- active API endpoints;
- active configuration and deployment files.

Produce:

```text
CURRENT
LEGACY
UNKNOWN / REQUIRES REVIEW
DUPLICATION / ARCHITECTURAL RISKS
```

---

## Task 2.2 — Audit legacy references

**Status: COMPLETED**

Search at least for:

```text
Railway
FastAPI
PostgreSQL
keystone-api
keystone-sync-client
DATABASE_URL
uvicorn
```

Classify every meaningful occurrence.

---

## Task 2.3 — Update `docs/AGENT_CONTEXT.md` from audit results

**Status: COMPLETED**

Replace provisional assumptions with verified architecture.

Document:

- actual production components;
- confirmed legacy components;
- unresolved uncertainty;
- real deployment model;
- real data ownership.

Do not turn this into a chronological report.

---

# PHASE 3 — Correct README and documentation

**Priority: VERY HIGH**

---

## Task 3.1 — Update root README

**Status: COMPLETED**

Correct:

- Railway references;
- FastAPI references;
- PostgreSQL references;
- backend ownership;
- D1 usage;
- Vercel deployment;
- client status;
- addon repository;
- architecture diagram;
- versions and roadmap where stale.

### Completion criteria

A new developer should understand the real production architecture by reading the README.

---

## Task 3.2 — Update secondary documentation

**Status: COMPLETED**

Correct stale architecture/release/deployment references elsewhere.

Keep historical information only where it still adds value.

---

# PHASE 4 — Remove confirmed legacy code

**Priority: VERY HIGH**

Only remove components after Phase 2 proves they are unused.

---

## Task 4.1 — Remove `keystone-api` if fully replaced

**Status: COMPLETED**

Before deletion verify:

- no production endpoint depends on it;
- no client/web references remain;
- no active workflow depends on it;
- no current deployment requires it.

If confirmed obsolete:

- remove `keystone-api/`;
- clean documentation/config references;
- validate current components.

Do not move it into a `legacy/` directory.

---

## Task 4.2 — Remove `keystone-sync-client` if fully replaced

**Status: COMPLETED**

Compare it against `keystone-client`.

If no active responsibility remains:

- remove it;
- clean references;
- validate current client paths.

---

## Task 4.3 — Update persistent context

**Status: COMPLETED**

Record durable results in `docs/AGENT_CONTEXT.md`.

---

# PHASE 5 — Resolve addon duplication

**Priority: VERY HIGH**

Known copies to audit:

```text
Speeson/KeystoneSync
weeklyChar/KeystoneSync
weeklyChar/keystone-client/addon/KeystoneSync
```

---

## Task 5.1 — Verify canonical addon ownership

**Status: COMPLETED**

Confirm the standalone repository is the source of truth.

Document the decision in:

- root `AGENTS.md`;
- `docs/AGENT_CONTEXT.md`;
- architecture documentation.

---

## Task 5.2 — Remove redundant root addon copy

**Status: COMPLETED**

If `weeklyChar/KeystoneSync` has no required runtime/build role:

- remove it;
- correct references.

---

## Task 5.3 — Make the client copy generated/synchronized

**Status: COMPLETED**

While KeystoneClient bundles the addon:

- keep the bundled addon only as generated/synchronized content;
- create a synchronization mechanism;
- create a divergence check;
- document that the bundled copy must not be manually edited.

Suggested scripts:

```text
scripts/sync-addon.*
scripts/check-addon-sync.*
```

---

# PHASE 6 — Formalize architecture and data contract

**Priority: HIGH**

---

## Task 6.1 — Create `docs/ARCHITECTURE.md`

**Status: COMPLETED**

Document:

```text
WoW
 ↓
SavedVariables
 ↓
KeystoneClient
 ↓
Worker
 ↓
D1
 ↓
Web
```

Include:

- component responsibilities;
- boundaries;
- authentication;
- Raider.IO enrichment;
- data ownership;
- deployments;
- addon/client relationship.

---

## Task 6.2 — Create `docs/DATA_CONTRACT.md`

**Status: COMPLETED**

Document the complete pipeline:

```text
KeystoneSyncDB
      ↓
sync_worker.py
      ↓
POST /api/keystones/update
      ↓
D1
      ↓
API reads
      ↓
Web
```

Cover at least:

- character identity;
- realm;
- region;
- item level;
- current keystone;
- vault;
- preyHunts;
- currencies;
- money;
- mythicPlusSeason;
- timestamps.

Rule:

> A new tracked field is not complete until every affected pipeline hop has been reviewed.

---

# PHASE 7 — Install/refine project skills

**Priority: HIGH**

Initial skills:

```text
.agents/skills/
├── keystonesync-addon/
├── keystonesync-wow-patch/
├── keystonesync-data-contract/
├── keystonesync-client/
├── keystonesync-worker-d1/
├── keystonesync-web/
└── deploy-impact/
```

The skill files may be created during bootstrap, but they must be reviewed after architecture cleanup so their facts match the verified repository.

---

## Task 7.1 — Review `keystonesync-addon`

**Status: COMPLETED**

Verify:

- canonical paths;
- build/package process;
- versioning;
- release conventions;
- SavedVariables rules.

---

## Task 7.2 — Review `keystonesync-wow-patch`

**Status: COMPLETED**

Verify current seasonal workflow and reliable sources.

---

## Task 7.3 — Review `keystonesync-data-contract`

**Status: COMPLETED**

Align it with `docs/DATA_CONTRACT.md`.

---

## Task 7.4 — Review component skills

**Status: COMPLETED**

Review:

- `keystonesync-client`;
- `keystonesync-worker-d1`;
- `keystonesync-web`.

Remove any stale assumptions discovered during audit.

---

# PHASE 8 — Improve validation and tests

**Priority: HIGH**

---

## Task 8.1 — Expand Worker tests

**Status: COMPLETED**

Cover:

- character update;
- current keystone;
- vault;
- preyHunts;
- currencies;
- money;
- Mythic+ season;
- weekly reset;
- partial payloads;
- stale vs newer data.

---

## Task 8.2 — Create SavedVariables fixtures

**Status: COMPLETED**

Suggested:

```text
tests/fixtures/savedvariables/
├── basic.lua
├── multiple-characters.lua
├── season2.lua
└── empty-or-partial.lua
```

---

## Task 8.3 — Test Client → Worker contract

**Status: COMPLETED**

Validate:

```text
SavedVariables
 ↓
Python parser
 ↓
payload
 ↓
Worker-compatible shape
```

---

## Task 8.4 — Web validation

**Status: COMPLETED**

At minimum:

```bash
npm run lint
npm run build
```

---

## Task 8.5 — Client validation

**Status: COMPLETED**

At minimum:

- Python syntax/imports;
- SavedVariables parsing;
- payload construction;
- PyInstaller build.

---

## Task 8.6 — Addon validation

**Status: COMPLETED**

Automate checks for:

- `.toc`;
- version coherence;
- required files;
- package structure;
- bundled-copy divergence.

---

# PHASE 9 — Deterministic Deployment Impact

**Priority: HIGH**

---

## Task 9.1 — Implement Deployment Impact script

**Status: COMPLETED**

Target dimensions:

```text
WEB
WORKER
DB
CLIENT_BUILD
CLIENT_RELEASE
ADDON
ADDON_RELEASE
```

Example rules:

```text
keystone-web/**
→ WEB

keystone-worker/src/**
→ WORKER

keystone-worker/migrations/**
→ WORKER + DB

keystone-client/**
→ CLIENT_BUILD

publishable client changes
→ CLIENT_RELEASE

canonical addon changes
→ ADDON + ADDON_RELEASE

docs/agent-only changes
→ no product deployment
```

The classification must live in code and have tests.

---

## Task 9.2 — Activate `deploy-impact` skill

**Status: COMPLETED**

Once the script exists:

1. agents must execute it;
2. agents must not infer deployment impact from memory;
3. agents must report required validation/deploy/release actions;
4. remote operations still require explicit authorization.

---

# PHASE 10 — CI/CD and release workflows

**Priority: MEDIUM-HIGH**

---

## Task 10.1 — Orchestrator

**Status: COMPLETED**

Create:

```text
.github/workflows/deploy.yml
```

Responsibilities:

- calculate impact;
- call only required workflows;
- support controlled manual execution.

---

## Task 10.2 — Web workflow

**Status: COMPLETED**

Create/refine:

```text
deploy-web.yml
```

Validate lint/build and avoid duplicate deployment if Vercel Git Integration already owns deployment.

---

## Task 10.3 — Worker workflow

**Status: COMPLETED**

Create:

```text
deploy-worker.yml
```

Recommended order:

```text
install
 ↓
typecheck
 ↓
tests
 ↓
migrations if required
 ↓
wrangler deploy
```

Keep remote migrations and deploy explicit and safe.

---

## Task 10.4 — Client release workflow

**Status: COMPLETED**

Create:

```text
release-client.yml
```

Use Windows runner.

Expected pipeline:

```text
VERSION
 ↓
dependencies
 ↓
PyInstaller
 ↓
Inno Setup
 ↓
KeystoneClientSetup.exe
 ↓
GitHub artifact/release
```

Preserve public asset name:

```text
KeystoneClientSetup.exe
```

---

## Task 10.5 — Addon workflows

**Status: COMPLETED / HANDOFF PREPARED**

In `Speeson/KeystoneSync`:

```text
validate-addon.yml
release-addon.yml
```

Validate:

- `.toc`;
- version;
- files;
- changelog;
- ZIP layout.

---

# PHASE 11 — Decouple addon releases from client releases

**Priority: MEDIUM**

---

## Task 11.1 — Design remote addon updater

KeystoneClient should query the latest `Speeson/KeystoneSync` GitHub Release.

Compare:

```text
installed version
vs
latest version
```

---

## Task 11.2 — Implement safe addon update

Target flow:

```text
Addon GitHub Release
       ↓
KeystoneClient detects update
       ↓
downloads ZIP
       ↓
validates package
       ↓
installs atomically
```

Handle:

- WoW install location;
- download errors;
- local version;
- backup/replacement;
- multiple installations if supported.

---

## Task 11.3 — Reassess bundled addon

Prefer initially:

```text
bundled bootstrap addon + remote updater
```

Avoid forcing a new Client release for every addon change.

---

# PHASE 12 — Full WoW 12.1 / Midnight Season 2 update

**Priority: HIGH after infrastructure preparation**

This should be the first major product update executed using the new agentic workflow.

---

## Task 12.1 — Addon metadata

- update `.toc` Interface for WoW 12.1;
- choose addon version;
- update changelog;
- update addon README if tracked data changes.

---

## Task 12.2 — Audit WoW APIs

Review all currently used APIs/events, especially:

```text
C_MythicPlus
C_ChallengeMode
C_WeeklyRewards
C_CurrencyInfo
C_QuestLog
C_PlayerInfo
```

Classify:

```text
UNCHANGED
CHANGED
DEPRECATED
REMOVED
NEW RELEVANT API
```

Do not modify working code without evidence.

---

## Task 12.3 — Audit currencies

For every hardcoded currency:

```text
key
ID
Season 1 status
Season 2 status
replacement
display name
```

No invented IDs.

---

## Task 12.4 — Audit tracked items

Review hardcoded item IDs and seasonal progression items.

---

## Task 12.5 — Audit Prey Hunts Season 2

Verify:

- Normal;
- Hard;
- Nightmare;
- quest IDs/ranges;
- weekly reset behavior;
- whether a less fragile API-driven approach now exists.

---

## Task 12.6 — Verify Great Vault

Check:

- Mythic+ activities;
- thresholds;
- reward level handling;
- weekly persistence/reset.

---

## Task 12.7 — Verify Mythic+ season tracking

Check:

- map table;
- scores;
- affixes;
- best runs;
- season rating.

Prefer dynamic data where possible.

---

## Task 12.8 — Update Web Season 2 dungeon metadata

Remove stale Season 1 pool assumptions.

Review:

- names;
- IDs;
- abbreviations;
- ordering;
- assets;
- rendering.

Centralize seasonal metadata where practical.

---

## Task 12.9 — Evaluate new Season 2 tracking

Only add data with clear user value.

For each new field:

```text
UX
 ↓
WoW source
 ↓
Addon
 ↓
SavedVariables
 ↓
Client
 ↓
Worker
 ↓
D1 decision
 ↓
Web
 ↓
Tests
```

---

# PHASE 13 — End-to-end Season 2 validation

**Priority: CRITICAL before release**

---

## Task 13.1 — Addon manual validation

Verify:

- login/logout;
- `/ksync`;
- current keystone;
- changed keystone;
- completed M+;
- currencies;
- Vault;
- Prey Hunts;
- Mythic+ rating;
- multiple characters;
- weekly reset where testable;
- no Lua errors.

---

## Task 13.2 — SavedVariables

Verify actual `KeystoneSyncDB` against expected contract and fixtures.

---

## Task 13.3 — Client

Verify:

```text
SavedVariables
 ↓
parse
 ↓
Raider.IO enrichment
 ↓
payload
 ↓
sync
```

---

## Task 13.4 — Worker + local D1

Verify:

- write;
- read;
- JSON preservation;
- reset behavior;
- existing-character compatibility.

---

## Task 13.5 — Web

Verify all tracked blocks and empty states.

---

## Task 13.6 — Run Deployment Impact

Use the repository script.

Do not infer manually.

---

# PHASE 14 — Releases and deployment

**Priority: FINAL**

Only with validation complete and explicit authorization.

---

## Task 14.1 — Addon release

- version;
- `.toc`;
- changelog;
- package;
- tag;
- GitHub Release.

---

## Task 14.2 — Client release

Only if Deployment Impact requires it.

Preserve:

```text
KeystoneClientSetup.exe
```

---

## Task 14.3 — Worker / D1

Only if required:

- remote migrations;
- Worker deploy;
- production smoke test.

---

## Task 14.4 — Web

Only if required:

- deploy;
- production verification.

---

# Required execution order

```text
[COMPLETED] P0 — WoW 12.1 basic functional compatibility
       ↓
Phase 1 — AGENTS + AGENT_CONTEXT + master plan
       ↓
Phase 2 — Architecture audit
       ↓
Phase 3 — README/documentation correction
       ↓
Phase 4 — Remove confirmed legacy code
       ↓
Phase 5 — Resolve addon duplication
       ↓
Phase 6 — Architecture + data contract docs
       ↓
Phase 7 — Review/refine project skills
       ↓
Phase 8 — Tests and fixtures
       ↓
Phase 9 — Deployment Impact
       ↓
Phase 10 — CI/CD and release workflows
       ↓
Phase 11 — Independent addon updater
       ↓
Phase 12 — WoW 12.1 / Season 2 update
       ↓
Phase 13 — End-to-end validation
       ↓
Phase 14 — Releases / deployments
```

---

# Task completion policy

A task must not be marked `[x]` merely because files were edited.

Before closing a task, Codex must:

1. summarize what changed;
2. run relevant validations;
3. inspect validation results;
4. disclose warnings/limitations;
5. update persistent documentation if durable state changed;
6. leave the working tree coherent;
7. avoid remote operations unless explicitly authorized.

Recommended report:

```text
TASK: 2.1 — Audit current production architecture

STATUS: PASS

Findings:
- ...

Changed:
- docs/AGENT_CONTEXT.md

Validation:
- ...

Deployment impact:
- Not available yet / None / output from script.

Remote operations:
- None.
```

---

# Global success criteria

The modernization plan is complete when:

- repository-wide agent rules exist;
- persistent context accurately reflects the project;
- stale architecture is removed;
- README/docs describe production truthfully;
- one canonical addon source exists;
- component/data-contract skills are in place;
- useful automated tests protect the data path;
- Deployment Impact is deterministic;
- Web, Worker, Client and Addon have reproducible workflows;
- addon releases can be independent from Client releases;
- all tracked data has been audited for WoW 12.1 / Midnight Season 2;
- the complete system has been validated end-to-end;
- releases/deployments are reproducible, selective and controlled.
