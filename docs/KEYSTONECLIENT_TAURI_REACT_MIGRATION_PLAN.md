# KeystoneClient Tauri + React Migration Implementation Plan

> **For Codex / agentic workers:** execute this plan task-by-task. Prefer `superpowers:subagent-driven-development` or `superpowers:executing-plans` if available. Use an isolated Git worktree. Stop at every **HUMAN CHECKPOINT** and report before continuing.
>
> **Safety rule:** this is a migration beside the existing client, not a destructive rewrite. The Python/Tkinter KeystoneClient must remain buildable and usable until the explicit cutover phase.
>
> **Remote rule:** do not push, tag, publish a release, deploy, or modify production infrastructure without explicit user approval.

**Goal:** Replace KeystoneClient's Tkinter presentation layer with a Windows-first Tauri 2 + React + TypeScript desktop client, while initially preserving the working Python domain logic as a bundled sidecar. Reach functional parity first, then redesign the full UI from Figma Make with web-level visual fidelity, and only then cut over releases.

**Architecture:** React/TypeScript/Vite owns the UI. Tauri/Rust is intentionally thin and owns the native window, tray, lifecycle and a private persistent IPC bridge. Existing Python logic remains authoritative for WoW discovery, SavedVariables sync, config, API access, addon updater/cache/install/rollback, etc. Python is packaged as a sidecar so users do not need Python installed.

**Tech stack:** Tauri 2, Rust stable MSVC, React, TypeScript, Vite, Tailwind CSS, Lucide React, Vitest + Testing Library, Playwright visual tests, Python sidecar packaged with PyInstaller, existing GitHub Actions + changeset/release system.

---

# 1. Approved Architecture Contract

## 1.1 Windows-first

Initial target:

```text
Windows x86_64
Rust target: x86_64-pc-windows-msvc
```

macOS/Linux are not migration goals. Avoid needless Windows-only coupling in domain code, but do not add cross-platform complexity without a requirement.

## 1.2 Final runtime shape

```text
┌─────────────────────────────────────────────────────────────┐
│                    KeystoneClient.exe                       │
│                                                             │
│  React + TypeScript + CSS                                   │
│               │                                             │
│           Tauri invoke                                      │
│               ▼                                             │
│  thin Rust native layer                                     │
│     ├─ window / tray / lifecycle                            │
│     ├─ sidecar process supervision                          │
│     └─ typed allowlisted IPC                                │
│               │                                             │
│        private JSONL stdin/stdout                           │
│               ▼                                             │
│  bundled Python core sidecar                                │
│     ├─ config/session                                       │
│     ├─ WoW detection / accounts                             │
│     ├─ SavedVariables                                       │
│     ├─ sync / Raider.IO / API                               │
│     └─ addon updater/cache/install/rollback                 │
└─────────────────────────────────────────────────────────────┘
```

Do **not** use a localhost HTTP server for frontend/backend IPC.

## 1.3 Preserve initially

Keep the existing Python implementations wherever possible:

```text
addon_updater.py
addon_installer.py
sync_worker.py
wow_path.py
config.py
SavedVariables parsing
Raider.IO calls
Worker/API calls
addon cache validation
safe addon replacement + rollback
```

Do not rewrite this domain logic in Rust as part of the migration.

## 1.4 Replace

The migration ultimately replaces:

```text
Tkinter main UI
Tkinter login UI
Tkinter dialogs/settings
Tkinter Addon UI
Tkinter Sync UI
pystray tray integration
legacy application-window lifecycle
legacy PyInstaller+Inno application shell
```

## 1.5 Existing user data must survive

Preserve compatibility with:

```text
%APPDATA%\KeystoneClient\config.json
%APPDATA%\KeystoneClient\addon-cache\
```

Do not require users to reconfigure the client just because the UI stack changes.

## 1.6 Security boundary

React should receive only data needed to render/act.

Do not expose raw secrets such as:

```text
sync_token
access_token
```

to the frontend.

Python keeps sensitive domain state. Rust exposes only explicit allowlisted commands. Tauri capabilities must follow least privilege.

## 1.7 Visual workflow after migration

```text
approved mockup
→ Figma Make
→ get_design_context / App.tsx / CSS / assets
→ real React components
→ Playwright screenshots
→ visual comparison / iteration
```

Figma controls presentation, not domain behavior.

---

# 2. Global Constraints

- No Phase 12 / WoW 12.1 / Midnight Season 2 work.
- No addon runtime or SavedVariables contract changes.
- No Worker/D1/API schema change unless a proven blocker is separately approved.
- No cross-repo addon changes.
- No Electron.
- No full Python-to-Rust rewrite.
- No localhost IPC server.
- Legacy Tkinter remains buildable until cutover.
- Existing Client changesets remain `patch | minor | major`.
- Existing release modes remain `build-only | release-dry-run | release`.
- Existing release states remain `fresh | resume | complete | inconsistent`.
- Existing tag convention remains `client-vX.Y.Z`.
- Existing Spanish release-note convention remains.
- Existing atomic push + transient retry guarantees remain.
- Migration code must be testable independently.
- Do not recreate another monolithic UI file like the current large `main_window.py`.
- Prefer small React/Rust/Python files with one responsibility.
- Do not copy entire unused Figma/shadcn component libraries.
- The sidecar must not require Python on the end user's machine.

---

# 3. Target Repository Shape

Do not move the legacy client at the start.

```text
weeklyChar/
├── keystone-client/                    # existing Python/Tkinter client
│   ├── main.py
│   ├── main_window.py
│   ├── addon_updater.py
│   ├── addon_installer.py
│   ├── sync_worker.py
│   ├── wow_path.py
│   ├── config.py
│   ├── bridge_protocol.py              # new
│   ├── bridge_main.py                  # new
│   └── ...
│
├── keystone-client-next/               # new Tauri/React client
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── app/
│   │   │   ├── AppShell.tsx
│   │   │   └── routes.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SyncPage.tsx
│   │   │   ├── AddonPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── core/
│   │   │   ├── client.ts
│   │   │   ├── events.ts
│   │   │   └── types.ts
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── tokens.css
│   │   └── test/
│   │       └── coreMock.ts
│   │
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── capabilities/default.json
│       ├── binaries/
│       └── src/
│           ├── lib.rs
│           ├── main.rs
│           ├── bridge.rs
│           ├── state.rs
│           ├── tray.rs
│           └── window.rs
│
├── tests/
│   ├── client/
│   ├── client_bridge/
│   └── fixtures/client_bridge/
│
├── scripts/
│   ├── build_client_sidecar.py
│   ├── deploy_impact.py
│   └── ...
│
└── .github/workflows/
    ├── deploy.yml
    ├── release-client.yml
    └── build-client-next.yml           # optional temporary migration workflow
```

Create files only when the owning task begins.

---

# 4. IPC Contract v1

Define this before real UI work.

## Request

```json
{
  "protocolVersion": 1,
  "id": "request-id",
  "command": "system.ping",
  "payload": {}
}
```

## Success response

```json
{
  "protocolVersion": 1,
  "type": "response",
  "id": "request-id",
  "ok": true,
  "data": {},
  "error": null
}
```

## Error response

```json
{
  "protocolVersion": 1,
  "type": "response",
  "id": "request-id",
  "ok": false,
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "User-safe error message"
  }
}
```

## Event

```json
{
  "protocolVersion": 1,
  "type": "event",
  "event": "sync.completed",
  "data": {}
}
```

Rules:

- UTF-8.
- One JSON object per newline.
- Maximum inbound line size: 1 MiB.
- Unknown commands fail safely; never dynamically execute arbitrary names.
- Malformed requests must not crash the process.
- Python stdout is protocol-only; diagnostics go to stderr.
- No secrets in responses/events/logs.
- Python emits `system.ready`.
- Rust owns exactly one sidecar process.
- Closing the app must not orphan the sidecar.
- Long operations report progress via events.

Initial command allowlist:

```text
system.ping
system.get_state

auth.login
auth.logout

settings.get
settings.update

wow.detect
wow.list_accounts
wow.select_accounts
wow.select_install

sync.get_status
sync.start
sync.stop
sync.force

addon.get_status
addon.check
addon.install
addon.update
addon.reinstall

client.get_version
```

Initial events:

```text
system.ready
system.error

auth.changed
wow.changed

sync.started
sync.completed
sync.error
sync.status

addon.check.started
addon.check.completed
addon.install.started
addon.install.progress
addon.install.completed
addon.install.failed
addon.status.changed
```

Host self-update is a Tauri responsibility, not Python.

---

# 5. Phase 0 — Safe Baseline and Worktree

## Goal

Establish a reversible migration workspace and a complete parity inventory before touching architecture.

### Actions

- [ ] Create isolated worktree/branch, preferably:

```text
feat/keystoneclient-tauri
```

Use the worktree skill if available; otherwise native Git.

- [ ] Verify:

```bash
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short --untracked-files=all
```

- [ ] Run current baseline:

```bash
python -m compileall -q keystone-client scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/deploy_impact
python -m unittest discover -s tests/release
```

- [ ] Build the current Client installer using the documented legacy flow.

- [ ] Record:
  - current version;
  - installer output path;
  - release asset name;
  - current tests;
  - startup behavior;
  - current config/cache paths.

- [ ] Create a parity matrix for:

```text
login/logout
session reuse
profile/avatar
open web
WoW auto-detection
manual WoW path selection
multiple account discovery/selection
SavedVariables monitoring
force sync
sync success/error
start minimized
minimize on close
tray menu
settings
addon status
addon remote check
addon cache fallback
addon install
addon update
addon reinstall
open addon folder
client self-update
changelog/update dialog
```

For each behavior identify:
- current Python owner;
- UI trigger;
- persisted fields;
- test needed in Tauri.

- [ ] Document hidden UI/domain coupling found in `main_window.py`.

### Gate

The old client must still be PASS.

### HUMAN CHECKPOINT 1

Report baseline + parity inventory before scaffolding if any critical behavior cannot be mapped.

---

# 6. Phase 1 — Scaffold Tauri + React Beside Legacy

## Goal

Produce a minimal Windows Tauri app that builds and runs without replacing anything.

### Prerequisites

Check:

```bash
node --version
npm --version
rustc --version
cargo --version
rustup show active-toolchain
```

Use:
- current active Node LTS compatible with Tauri;
- Rust stable;
- MSVC target;
- WebView2/C++ prerequisites.

Pin the chosen Node version using the repository's preferred mechanism.

### Create

```text
keystone-client-next/
```

with:
- Tauri 2;
- React;
- TypeScript;
- Vite;
- Tailwind;
- Lucide React;
- Vitest;
- Testing Library.

Do not add large UI libraries yet.

### Minimal UI

Only:

```text
KeystoneClient Next
Tauri migration shell
```

No Figma redesign.

### Validation

```bash
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

### Deployment Impact during migration

Teach `scripts/deploy_impact.py` that:

```text
keystone-client-next/** => CLIENT_BUILD=true
keystone-client-next/** => CLIENT_RELEASE=false
```

Add tests.

This is critical: unfinished Tauri work must never trigger an automatic Client release.

### Commit

Local commit only:

```text
feat: scaffold Tauri KeystoneClient shell
```

---

# 7. Phase 2 — Python UI-Independent JSONL Bridge

## Goal

Expose existing Python functionality through a strict UI-independent protocol.

### Create

```text
keystone-client/bridge_protocol.py
keystone-client/bridge_main.py
tests/client_bridge/
tests/fixtures/client_bridge/
```

### TDD first

Tests must cover:

```text
system.ping
valid request IDs
malformed JSON
missing protocolVersion
unsupported protocolVersion
unknown command
oversized input
stdout protocol purity
stderr diagnostics
clean EOF/shutdown
```

Expected ping data:

```json
{"pong": true}
```

### Python helpers

Use explicit functions/dataclasses, e.g.:

```python
PROTOCOL_VERSION = 1
MAX_LINE_BYTES = 1024 * 1024

def success_response(request_id: str, data: dict) -> dict: ...
def error_response(request_id: str | None, code: str, message: str) -> dict: ...
def event_message(event: str, data: dict) -> dict: ...
```

Explicit registry:

```python
COMMANDS = {
    "system.ping": handle_ping,
    "system.get_state": handle_get_state,
}
```

Never use `eval`, reflection-based arbitrary command execution, or shell forwarding.

### `system.ready`

On startup emit:

```json
{
  "protocolVersion": 1,
  "type": "event",
  "event": "system.ready",
  "data": {
    "capabilities": ["system.ping", "system.get_state"]
  }
}
```

### Validate

```bash
python -m unittest discover -s tests/client_bridge
python -m compileall -q keystone-client tests/client_bridge
```

### Commit

```text
feat: add KeystoneClient sidecar protocol
```

---

# 8. Phase 3 — Rust Sidecar Supervisor + Typed React Client

## Goal

Make Tauri own one persistent Python process and hide all process details from React.

### Rust files

```text
src-tauri/src/bridge.rs
src-tauri/src/state.rs
src-tauri/src/lib.rs
```

Rust owns:
- spawn;
- stdin writer;
- stdout reader;
- stderr logging;
- pending request map;
- timeouts;
- lifecycle;
- clean shutdown;
- controlled sidecar failure.

### Public Tauri command

Conceptually:

```rust
#[tauri::command]
async fn core_request(
    state: tauri::State<'_, CoreBridgeState>,
    command: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, BridgeError>
```

Rust also checks the command against its own allowlist before forwarding.

### Events

Map Python events to one namespaced Tauri event:

```text
core://event
```

### React types

Create:

```text
src/core/types.ts
src/core/client.ts
src/core/events.ts
```

Example:

```ts
export type CoreError = {
  code: string;
  message: string;
};

export async function coreRequest<T>(
  command: CoreCommand,
  payload: unknown = {},
): Promise<T> {
  return invoke<T>("core_request", { command, payload });
}
```

`CoreCommand` is a literal union, not arbitrary `string`.

### Proof UI

Temporary button:

```text
Ping Python core
```

Repeated ping must succeed.

### Failure tests

Verify:
- sidecar killed => controlled UI error;
- app close => no orphan;
- repeated calls correlate by request ID;
- sidecar does not multiply unexpectedly.

### HUMAN CHECKPOINT 2

Do not port real domain features until this bridge is stable.

---

# 9. Phase 4 — Package Python as a Real Tauri Sidecar

## Goal

The end user must not install Python.

### Create

```text
scripts/build_client_sidecar.py
```

Use:

```text
keystone-client/bridge_main.py
```

as PyInstaller entrypoint.

### Build flow

```text
build Python sidecar
→ run binary ping smoke test
→ copy/place using Tauri external-binary target naming
→ build React
→ build Tauri
```

For Windows x86_64, respect Tauri's target-triple sidecar naming requirements. Derive it from the build target rather than inventing a fragile name.

### Requirements

The sidecar must not import Tkinter just to start.

Initially prefer compatibility over aggressive dependency pruning; shrink UI-only Python dependencies after parity tests.

### Smoke test

Execute the built sidecar `.exe`, send `system.ping`, verify response, terminate cleanly.

---

# 10. Phase 5 — Authentication + Settings

## Goal

Extract login/settings logic from Tkinter without changing backend semantics.

### Python

Create a UI-independent auth service if needed:

```text
keystone-client/auth_service.py
```

Suitable interface:

```python
def login(api_url: str, username: str, password: str) -> dict:
    ...
```

Legacy Tkinter should preferably call the same service during migration so logic does not diverge.

### Security

React should receive safe state only:

```json
{
  "authenticated": true,
  "username": "name",
  "avatarUrl": "..."
}
```

Do not return tokens.

### Bridge commands

```text
auth.login
auth.logout
settings.get
settings.update
```

Settings must be whitelisted.

### React

Create functional, plain:
- LoginPage;
- auth state;
- settings state.

No final visual redesign yet.

### Tests

Cover:
- success;
- bad credentials;
- network error;
- persistence;
- frontend response contains no secret tokens.

---

# 11. Phase 6 — WoW Discovery + Accounts

## Goal

Keep existing `wow_path.py` semantics and expose them to React.

### Commands

```text
wow.detect
wow.list_accounts
wow.select_accounts
wow.select_install
```

### Unit fixtures

Use a temporary filesystem:

```text
World of Warcraft/
└── _retail_/
    ├── Wow.exe
    ├── Interface/AddOns/
    └── WTF/Account/
        ├── ACCOUNT_A/SavedVariables/KeystoneSync.lua
        └── ACCOUNT_B/SavedVariables/KeystoneSync.lua
```

Automated tests must not depend on the developer's real WoW installation.

### Native folder picker

Tauri opens the native picker.

The selected path is sent to Python for:
- normalization;
- validation;
- discovery;
- persistence.

React must not duplicate Python path rules.

### React Sync page

Functional only:
- WoW path;
- accounts;
- SavedVariables found/missing;
- selected accounts;
- refresh.

---

# 12. Phase 7 — Synchronization Lifecycle

## Goal

Reuse the existing `SyncWorker` without Tkinter callbacks.

### Introduce a UI-independent coordinator if required

Example:

```python
class SyncService:
    def start(self, emit): ...
    def stop(self): ...
    def force(self): ...
    def get_status(self) -> dict: ...
```

It can internally own the existing worker.

### Commands

```text
sync.get_status
sync.start
sync.stop
sync.force
```

### Events

```text
sync.started
sync.completed
sync.error
sync.status
```

### Preserve existing semantics

Do not casually change:
- SavedVariables handling;
- multi-account semantics;
- Raider.IO;
- Worker/API payload;
- retry/error behavior.

### Important

`sync.start` must be idempotent. Never create duplicate monitor threads.

Sidecar shutdown must stop the worker.

---

# 13. Phase 8 — KeystoneSync Addon Management

## Goal

Port the Phase 11 addon updater UI without changing the updater architecture.

### Commands

```text
addon.get_status
addon.check
addon.install
addon.update
addon.reinstall
```

### States to test

```text
not installed + remote available
installed + current
installed + update available
installed + local newer than remote
offline + valid cache
offline + no cache
corrupt cache
invalid remote package
install failure + rollback
```

### Frontend-safe DTO

Conceptually:

```ts
export type AddonStatus = {
  installed: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  state:
    | "not-installed"
    | "current"
    | "update-available"
    | "offline-cache"
    | "unavailable"
    | "error";
  cacheAvailable: boolean;
  lastCheckAt: string | null;
  source: "github-release" | "cache" | null;
};
```

Adapt to the existing updater semantics rather than inventing misleading states.

### Long operations

Use events:

```text
addon.install.started
addon.install.progress
addon.install.completed
addon.install.failed
```

### Safe testing

Use a temporary AddOns directory. Automated tests must not overwrite real WoW AddOns.

### HUMAN CHECKPOINT 3 — Core Functional Parity

The Tauri app must demonstrate:

```text
login
persisted session/settings
WoW detection
account selection
sync start/force/result/error
addon status/check
addon install
addon update/reinstall
cache fallback
```

The UI may still be deliberately plain.

Do not begin the full visual redesign until this is stable.

---

# 14. Phase 9 — Native Desktop Behavior

## Goal

Replace `pystray` and Tkinter window lifecycle with Tauri-native behavior.

### Implement

```text
src-tauri/src/tray.rs
src-tauri/src/window.rs
```

Tray:
- Show/Open;
- Open Web;
- Exit.

Honor:

```text
start_minimized
minimize_on_close
```

Explicit Exit must:
- stop sync;
- stop sidecar;
- terminate app.

### Single instance

Use the current Tauri single-instance mechanism/plugin.

Second launch should focus/show the existing app rather than start a duplicate sync process.

### External actions

Use scoped Tauri functionality for:
- opening URLs;
- opening folders;
- selecting directories.

Do not expose arbitrary shell execution to React.

---

# 15. Phase 10 — React Design System for Figma Make

## Goal

Create the web-native visual foundation before redesigning screens.

### Use

- Tailwind CSS;
- CSS variables;
- Lucide React;
- small project-owned reusable components.

### Semantic tokens

Example:

```css
:root {
  --background: ...;
  --foreground: ...;
  --surface: ...;
  --surface-elevated: ...;
  --primary: ...;
  --primary-foreground: ...;
  --border: ...;
  --success: ...;
  --danger: ...;
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
}
```

### Build only needed primitives

```text
Button
Card
Badge
IconButton
Field
Dialog
StatusRow
Tooltip if actually needed
```

Do not import a huge unused shadcn component set.

### Assets/icons

- Normal icons: Lucide React.
- Custom Figma artwork: exact exported assets.
- Do not redraw custom assets if Figma provides the real file.

### Fonts

If Figma uses a non-system font:
- verify redistribution license;
- bundle only if legally allowed;
- otherwise use an approved close substitute.
- Never copy system/private font files from the machine.

### Deterministic preview states

Development-only visual fixtures:

```text
?preview=addon-installed
?preview=addon-not-installed
?preview=sync-idle
...
```

They must not ship as fake production state.

### Visual tests

Use Playwright with a fixed viewport and screenshot baselines.

---

# 16. Phase 11 — Full UI Redesign from Figma Make

This is where React/Tauri should save time.

Recommended screen order:

```text
A. Global shell
B. Login
C. Synchronization
D. Addon
E. Settings/profile/dialogs
F. Changelog/update UI
```

For **each screen**:

- [ ] Obtain user-approved mockup/Figma Make.
- [ ] Call Figma `get_design_context`.
- [ ] Inspect returned App.tsx/CSS/assets/screenshot.
- [ ] Identify visual structure; do not adopt Figma demo state.
- [ ] Map it to existing React components.
- [ ] Reuse exact CSS dimensions/colors/gradients/shadows/assets where sensible.
- [ ] Bind to real typed Core state.
- [ ] Render deterministic preview states.
- [ ] Capture Playwright screenshot.
- [ ] Compare to approved visual reference.
- [ ] Iterate.
- [ ] Get user approval.
- [ ] Commit screen separately.

Visual priority:

```text
1. geometry/layout
2. spacing
3. typography hierarchy
4. colors/gradients
5. borders/shadows
6. icons/assets
7. hover/focus/disabled
8. decorative details
```

Do not claim pixel-perfect based only on code inspection.

### Expected fidelity

React/CSS can directly reproduce:

```text
Grid/Flexbox
precise padding/gaps
rounded corners
box shadows
linear/radial/conic gradients
opacity
SVG
Lucide icons
CSS transitions
web typography
```

Remaining differences can still come from:
- font availability;
- DPI;
- WebView2 version;
- antialiasing;
- asset scaling.

These are tuning/validation issues, not Tkinter-style framework limitations.

### HUMAN CHECKPOINT 4 — Visual Approval

Do not proceed to release cutover until the user approves the redesigned Tauri client.

---

# 17. Phase 12 — Tauri Host Self-Updater

## Goal

Replace the legacy host self-update mechanism with Tauri's signed updater.

### Rule

Python manages the **addon** updater.

Tauri manages **KeystoneClient itself**.

### Requirements

Use the official Tauri updater plugin and signed updater artifacts.

Production private update key:
- never commit;
- store as protected GitHub secret;
- back up securely.

Public verification key may be included in app config.

Tauri updater signing is separate from optional Windows Authenticode signing.

### Release model

Keep:

```text
client-vX.Y.Z
```

GitHub Release should eventually include:
- human installer;
- updater artifact(s);
- `.sig` signature(s);
- updater metadata JSON.

### UX

Preserve the product intent:
- check;
- display version/release notes;
- install/relaunch in an explicit, safe flow.

Test using staged/local releases before production.

---

# 18. Phase 13 — Legacy Inno Installer → Tauri Installer Migration

This is a hard release gate.

The current stable client is installed via Inno Setup. The new Tauri/NSIS application must not create confusing duplicate installations.

### Audit current legacy installer

Record:
- AppId;
- install directory;
- executable;
- uninstall registry entry;
- shortcuts;
- admin/per-user semantics.

### Test in Windows VM/sandbox

```text
install current stable Tkinter client
→ configure test session/settings
→ run the exact Tauri migration installer
→ launch Tauri
→ validate preserved config
→ validate shortcuts/uninstall entries
```

### Must preserve

```text
%APPDATA%\KeystoneClient\config.json
addon-cache
selected WoW accounts
relevant settings
```

### Must prevent

```text
two active startup entries
two confusing app shortcuts
two concurrently running clients
stale legacy exe launched by old shortcut
orphan legacy uninstall entry if avoidable
```

If custom NSIS migration logic is necessary, keep it minimal.

### Uninstall test

The new uninstaller must remove application binaries cleanly.

Do not silently delete user data unless that behavior is intentionally designed.

### HUMAN CHECKPOINT 5 — Upgrade Path

No production workflow cutover until:
- clean install PASS;
- old → new upgrade PASS;
- config preservation PASS;
- uninstall PASS.

---

# 19. Phase 14 — CI/CD Migration

## Before cutover

The new Tauri tree remains:

```text
CLIENT_BUILD=true
CLIENT_RELEASE=false
```

CI may validate:
- npm clean install;
- TypeScript;
- Vitest;
- frontend build;
- Rust fmt/check/test;
- Python bridge tests;
- sidecar packaging;
- Tauri build.

Legacy release remains official.

## At cutover

Change the Client build pipeline from:

```text
legacy PyInstaller app
→ Inno Setup
```

to:

```text
PyInstaller Python sidecar
→ React build
→ Tauri build
→ installer/updater artifacts
```

Preserve all Phase 11 guarantees:

```text
build-only
release-dry-run
release

auto/patch/minor/major

fresh/resume/complete/inconsistent

git push --atomic

GitHub 500/502/503/504 retry:
2s / 5s / 10s / 20s

Spanish release notes

client-vX.Y.Z
```

### Canonical version

Avoid two editable version sources.

Recommended migration approach:
- keep `keystone-client/VERSION` canonical initially;
- release preparation syncs/injects it into Tauri config/package metadata before build.

Revisit only after stabilization.

### PR rule

PRs must never publish.

### HUMAN CHECKPOINT 6 — Release Dry Run

Run a real `release-dry-run` and manually inspect the generated Windows installer and updater metadata before any production release.

---

# 20. Phase 15 — Full Parity Gate

Every behavior from Phase 0 gets:

```text
PASS
INTENTIONALLY REMOVED (user-approved)
BLOCKED
```

No silent omissions.

Minimum Windows matrix:

```text
fresh install
upgrade from current stable Tkinter
first launch
existing configured user launch
login success/failure
session reuse
logout
WoW auto-detection
manual WoW selection
one account
multiple accounts
missing SavedVariables
sync success
sync API error
offline start
tray minimize/restore
close-to-tray
explicit exit
addon absent
addon current
addon update available
addon offline cache
addon install
addon update
addon reinstall
addon rollback path
client update available
client update install/relaunch
DPI 100%
DPI 125%
DPI 150%
```

Automated gate:

```bash
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/deploy_impact
python -m unittest discover -s tests/release

cd keystone-client-next
npm test
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Also build and smoke the sidecar and Tauri installer.

---

# 21. Phase 16 — Cutover

Only after every previous gate.

### Client changeset

Do not create the final user-visible migration changeset at the beginning of development.

At cutover, likely use `minor` while the project remains pre-1.0 unless project policy says otherwise.

Suggested Spanish change:

```json
{
  "components": ["client"],
  "type": "minor",
  "category": "changed",
  "summary": "Renueva KeystoneClient con una nueva aplicación de escritorio basada en Tauri.",
  "details": [
    "La interfaz ha sido reconstruida para mejorar fidelidad visual, rendimiento y mantenibilidad.",
    "Se conserva la sincronización, la gestión del addon, la configuración y las actualizaciones del cliente."
  ]
}
```

### Make Tauri official

Release workflow now publishes Tauri Client.

### Keep legacy source temporarily

Do not delete all Tkinter source in the same cutover commit/release.

Mark it legacy/non-release for one stabilization window.

This provides a rollback/reference path.

### Production release

Only with explicit user approval.

Final real-world verification:

```text
last Tkinter stable
→ auto/manual update
→ new Tauri stable
```

must pass.

---

# 22. Phase 17 — Legacy Cleanup

Separate follow-up after Tauri stability is proven.

Candidates:

```text
main_window.py
Tkinter-only login UI
Tkinter-only dialogs
pystray
legacy PyInstaller app entrypoint
legacy Inno app build path
obsolete UI assets
temporary compatibility shims
migration-only CI
```

Do **not** delete Python domain modules still used by the sidecar.

Update:
- README;
- architecture docs;
- release workflow docs;
- agent context;
- project skills;
- deploy-impact docs.

Final architecture documentation should show:

```text
WoW
→ KeystoneSync addon
→ SavedVariables
→ Python Core Sidecar
→ Worker/D1
→ Web

React
↕
Tauri/Rust
↕
Python Core Sidecar
```

---

# 23. Release Impact Strategy

## During migration

```text
legacy keystone-client runtime changes
→ current rules

keystone-client-next/**
→ CLIENT_BUILD=true
→ CLIENT_RELEASE=false
```

The migration must not auto-release an unfinished Tauri app.

## At cutover

Authoritative Client release-impact paths should include the distributed runtime, e.g.:

```text
keystone-client-next/src/**
keystone-client-next/src-tauri/src/**
relevant Tauri config
runtime npm dependencies
Python bridge/runtime code used by sidecar
```

Build tooling/tests remain build-only where appropriate.

Update impact rules and tests together.

---

# 24. Main Risks and Mitigations

## Fragile IPC

Mitigate with:
- JSONL contract tests;
- IDs;
- timeouts;
- stdout purity;
- stderr logs;
- explicit command allowlists;
- sidecar lifecycle tests.

## Duplicate sync workers

Mitigate with:
- one Tauri instance;
- one sidecar;
- idempotent `sync.start`;
- explicit shutdown.

## Lost user config

Mitigate by:
- reusing `%APPDATA%\KeystoneClient`;
- preserving schema initially;
- upgrade fixtures;
- VM testing.

## Inno vs Tauri installer conflict

Mitigate with a dedicated upgrade phase. Do not release before the matrix passes.

## Accidental early release

Mitigate by:
- `keystone-client-next/**` build-only until cutover;
- no final migration changeset early;
- no PR publishing;
- release-dry-run.

## Figma demo code contaminates architecture

Mitigate by:
- typed real state;
- Figma controls visuals only;
- reuse existing components;
- copy only used assets/components.

## Secrets leaked to frontend

Mitigate with safe DTOs and whitelisted settings.

## Scope becomes Python→Rust rewrite

Reject it unless separately approved. Rust stays thin.

---

# 25. Definition of Done

```text
[ ] Tauri/React is the official KeystoneClient UI.
[ ] End user needs no Python installation.
[ ] No localhost IPC server exists.
[ ] Existing config/session/account selections survive upgrade.
[ ] WoW detection works.
[ ] Multi-account selection works.
[ ] SavedVariables sync works.
[ ] Raider.IO/API behavior remains equivalent.
[ ] Addon install/update/reinstall/cache/rollback work.
[ ] Tray/start-minimized/close-to-tray work.
[ ] Signed Tauri self-update works.
[ ] Upgrade from current Tkinter installer works cleanly.
[ ] CI builds Tauri on Windows.
[ ] build-only/release-dry-run/release still work.
[ ] patch/minor/major changesets still work.
[ ] client-vX.Y.Z release contract remains.
[ ] recovery/retry/atomic push guarantees remain.
[ ] User approves redesigned screens.
[ ] Playwright visual regression covers key states.
[ ] Tkinter was not removed before successful cutover.
[ ] No Phase 12 gameplay/data changes were mixed in.
```

---

# 26. What Codex Should Do in the First Session

When this file is first provided tomorrow, execute only:

```text
Phase 0 — Safe Baseline and Worktree
Phase 1 — Scaffold Tauri + React Beside Legacy
```

Do **not** attempt to migrate the entire client in one session.

The desired end state of session 1:

```text
Legacy Python/Tkinter Client: still PASS
+
New Tauri placeholder: builds and launches
+
Deployment Impact: knows keystone-client-next but cannot release it
+
Parity matrix: documented
+
No production behavior changed
```

## Required first-session report

Return:

```text
STATUS: PASS / PARTIAL / BLOCKED

REPOSITORY
- root
- worktree
- branch
- origin

LEGACY BASELINE
- version
- test results
- build result
- installer output

PARITY INVENTORY
- behaviors mapped
- hidden couplings/blockers

TAURI SCAFFOLD
- Node version
- Rust version
- Tauri version
- React version
- npm test
- npm build
- cargo check
- tauri build/run

DEPLOYMENT IMPACT
- keystone-client-next runtime => CLIENT_BUILD=true
- keystone-client-next runtime => CLIENT_RELEASE=false

FILES CHANGED

LOCAL COMMITS

REMOTE OPERATIONS
- expected: None

NEXT RECOMMENDED PHASE
- Phase 2 — Python UI-independent JSONL bridge
```
