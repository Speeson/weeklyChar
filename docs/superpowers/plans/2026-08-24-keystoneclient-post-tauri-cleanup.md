# KeystoneClient Post-Tauri Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the verified dead pre-Tauri client material and unify the production React, Rust/Tauri, NSIS, and Python sidecar implementation under one canonical `keystone-client/` tree without changing user-visible behavior.

**Architecture:** Keep `keystone-client/VERSION` as the single canonical Client version, move the flat production Python core into `keystone-client/sidecar/`, and then move the complete production Tauri project from `keystone-client-next/` into `keystone-client/`. Preserve the existing JSONL protocol, `%APPDATA%\KeystoneClient` schema, Inno 0.3.0 migration hook, Minisign updater, release state machine, addon integration, and release asset contract.

**Tech Stack:** Python 3.13, PyInstaller, React 19, TypeScript, Vite, Vitest, Playwright, Rust, Tauri 2, NSIS, GitHub Actions, PowerShell, unittest.

**Spec:** `docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md` Phase 17, `docs/ARCHITECTURE.md`, `docs/AGENT_CONTEXT.md`, and the completed TASK 7A post-cutover audit at production commit `b927d6721ab68272413f1035e583886927caf5ae`.

## Global Constraints

- Start from `main` at or descended from `b927d6721ab68272413f1035e583886927caf5ae`, with `client-v0.4.0` reachable and a clean worktree.
- Create and use `chore/keystoneclient-post-tauri-cleanup`; do not implement directly on `main`.
- Keep `TAURI_CLIENT_RELEASE_ENABLED` unset or disabled throughout cleanup.
- Do not manually change `keystone-client/VERSION`; it remains `0.4.0` throughout implementation and dry-run validation.
- Create one pending Client patch changeset for the complete cleanup. Its planned next version is `0.4.1`, but this plan does not publish it.
- Do not deploy Web or Worker, run D1 migrations, publish an addon, create a Client tag or GitHub Release, or publish `latest.json`.
- Do not alter the JSONL command/event protocol or user-visible Client behavior.
- Preserve `%APPDATA%\KeystoneClient`, including authentication tokens, session metadata, WoW install path, selected accounts, cached characters, addon cache/state, preferences, language, and update/changelog state.
- Preserve direct upgrades from public Inno 0.3.0 through AppId `{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}_is1`, registered legacy uninstaller execution, fail-closed behavior, AppData retention, and autostart migration.
- Preserve the Tauri updater public key, Minisign signing flow, canonical `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig`, `latest.json`, and release resume/repair behavior.
- Use `git mv` for retained files so history remains traceable. Use `apply_patch` for manual edits.
- Run Deployment Impact after every phase and stop on unknown paths or unexpected Web, Worker, DB, or addon impact.
- Each implementation phase is a separate commit and checkpoint. Do not begin the next phase while its targeted validation is failing.

---

## Final Canonical Tree

```text
keystone-client/
|-- .gitignore
|-- VERSION
|-- README.md
|-- package.json
|-- package-lock.json
|-- index.html
|-- vite.config.ts
|-- tsconfig.json
|-- tsconfig.node.json
|-- playwright.config.ts
|-- design/
|   |-- app-icon.png
|   |-- bg.jpg
|   `-- synchronization-master.png
|-- sidecar/
|   |-- requirements.txt
|   |-- addon_installer.py
|   |-- addon_service.py
|   |-- addon_updater.py
|   |-- auth_service.py
|   |-- bridge_main.py
|   |-- bridge_protocol.py
|   |-- character_service.py
|   |-- config.py
|   |-- profile_service.py
|   |-- settings_service.py
|   |-- sync_service.py
|   |-- sync_worker.py
|   |-- wow_path.py
|   `-- wow_service.py
|-- src/
|   |-- assets/
|   |-- components/
|   |-- core/
|   |-- generated/
|   |-- pages/
|   |-- styles/
|   |-- test/
|   |-- App.css
|   |-- App.test.tsx
|   |-- App.tsx
|   |-- main.tsx
|   `-- vite-env.d.ts
|-- src-tauri/
|   |-- binaries/
|   |-- capabilities/
|   |-- examples/
|   |-- icons/
|   |-- src/
|   |-- windows/
|   |   `-- installer-hooks.nsh
|   |-- build.rs
|   |-- Cargo.lock
|   |-- Cargo.toml
|   `-- tauri.conf.json
`-- tests/
    `-- visual/
```

`keystone-client-next/`, `keystone-client/installer/`, the old flat Tkinter entrypoints, and legacy generated artifacts are absent in the final tree. The three `design/` files are retained as source references during this critical-path migration; a later evidence-based asset task may remove them.

## Compatibility Invariants

The following files/functions remain authoritative after all moves:

- `keystone-client/sidecar/config.py`: `%APPDATA%\KeystoneClient\config.json`, defaults merge, old API URL normalization, token/session validity, and preservation of unknown future keys.
- `keystone-client/sidecar/wow_path.py`: install discovery, account discovery, selected SavedVariables paths, and the legacy single `wow_path` fallback.
- `keystone-client/sidecar/addon_updater.py`: `%APPDATA%\KeystoneClient\addon-cache`, remote addon release validation, cache, and installation.
- `keystone-client/sidecar/bridge_protocol.py` and `bridge_main.py`: protocol version, request validation, handlers, events, and JSONL transport.
- `keystone-client/src-tauri/windows/installer-hooks.nsh`: Inno AppId lookup, legacy uninstall, fail-closed abort, AppData preservation by omission, and legacy autostart migration.
- `keystone-client/src-tauri/tauri.conf.json`: updater endpoint/public key, NSIS installer hook, sidecar declaration, product identity, and installer scope.
- `scripts/release_changes.py`, `scripts/release_state.py`, and `scripts/tauri_release.py`: changesets, version synchronization, release state, signature/manifest validation, and resume/repair.

---

### Task 1: Establish the Cleanup Branch and Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `.agents/skills/keystonesync-client/SKILL.md`
- Read: `.agents/skills/deploy-impact/SKILL.md`
- Read: `docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md`
- Read: `docs/AGENT_CONTEXT.md`
- Create later in Task 2: `.changes/pending/client-post-tauri-cleanup.json`

**Interfaces:**
- Consumes: production `main`, `client-v0.4.0`, and the disabled release gate.
- Produces: clean branch `chore/keystoneclient-post-tauri-cleanup` and recorded green baseline.

- [ ] **Step 1: Refresh and verify the production baseline**

Run:

```powershell
git fetch origin --prune --tags
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git rev-parse origin/main
git merge-base --is-ancestor b927d6721ab68272413f1035e583886927caf5ae HEAD
git status --short --untracked-files=all
Get-Content keystone-client/VERSION
git rev-parse client-v0.4.0
```

Expected: ancestry exits `0`; `HEAD` equals `origin/main`; status is empty; `VERSION` is `0.4.0`; `client-v0.4.0` resolves to `b927d6721ab68272413f1035e583886927caf5ae`.

- [ ] **Step 2: Verify the release safety gate and public baseline without changing them**

Run:

```powershell
gh variable list
git ls-remote --tags origin client-v0.4.1
gh release view client-v0.4.1
```

Expected: `TAURI_CLIENT_RELEASE_ENABLED` is absent or disabled; no `client-v0.4.1` tag exists; `gh release view client-v0.4.1` reports no release. Do not create or modify the variable.

- [ ] **Step 3: Create the dedicated branch**

Run:

```powershell
git switch -c chore/keystoneclient-post-tauri-cleanup
git status --short --untracked-files=all
```

Expected: branch name is `chore/keystoneclient-post-tauri-cleanup`; status remains empty.

- [ ] **Step 4: Run the baseline test suites**

Run:

```powershell
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/release
python -m unittest discover -s tests/deploy_impact
npm --prefix keystone-client-next test
npm --prefix keystone-client-next run build
cargo fmt --all --manifest-path keystone-client-next/src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path keystone-client-next/src-tauri/Cargo.toml
cargo test --locked --manifest-path keystone-client-next/src-tauri/Cargo.toml
python scripts/build_client_sidecar.py --clean
```

Expected: every command exits `0`; sidecar smoke reports ready, ping, state, second ping, and clean EOF.

- [ ] **Step 5: Record the checkpoint without committing**

Run:

```powershell
git status --short --untracked-files=all
git log -1 --oneline
```

Expected: clean branch at the verified production baseline. Task 1 creates no commit.

---

### Task 2 / Phase A: Remove Dead Generated Artifacts, Scaffold, and Discarded Assets

**Files:**
- Create: `.changes/pending/client-post-tauri-cleanup.json`
- Modify: `tests/deploy_impact/test_deploy_impact.py`
- Modify: `scripts/deploy_impact.py`
- Delete: `keystone-client/KeystoneClient.exe`
- Delete: `release-assets/KeystoneSync-v0.1.13.zip`
- Delete: `keystone-client-next/src/components/example.tsx`
- Delete: `keystone-client-next/src/assets/keystone-ui/01-header-shell.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/04-footer-decoration.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/06-footer-tray-button.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/07-info-card-frame.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/08-table-panel-frame.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/10-primary-sync-button.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/11-footer-shell.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/12-version-panel-frame.png.png`
- Delete: `keystone-client-next/src/assets/keystone-ui/14-user-dropdown-shell.png.png`

**Interfaces:**
- Consumes: the current Deployment Impact classifier and one coherent Client patch intent.
- Produces: no tracked legacy binary/ZIP, no unreferenced scaffold/assets, strict impact coverage for the deleted historical ZIP, and the sole cleanup changeset.

- [ ] **Step 1: Re-prove that each deleted asset has no runtime consumer**

Run:

```powershell
rg -n --hidden --glob '!.git/**' "01-header-shell|04-footer-decoration|06-footer-tray-button|07-info-card-frame|08-table-panel-frame|10-primary-sync-button|11-footer-shell|12-version-panel-frame|14-user-dropdown-shell|components/example|KeystoneSync-v0.1.13.zip|keystone-client/KeystoneClient.exe" .
git ls-files | Select-String -Pattern '\.(exe|zip|msi|msix|sig)$'
```

Expected: UI assets appear only in historical design documents; `example.tsx` appears only as a Deployment Impact fixture; the exe and ZIP have no production consumer. Stop if a new runtime/build consumer appears.

- [ ] **Step 2: Add failing Deployment Impact regression cases**

In `tests/deploy_impact/test_deploy_impact.py`:

- Replace the fake runtime fixture `keystone-client-next/src/components/example.tsx` with `keystone-client-next/src/components/KeystoneShell.tsx`.
- Add an exact assertion that `release-assets/KeystoneSync-v0.1.13.zip` is a known historical no-impact path rather than unknown.
- Keep an assertion that an unrelated new path under `release-assets/` remains unknown, preventing the entire directory from being silently ignored.

Run:

```powershell
python -m unittest discover -s tests/deploy_impact
```

Expected: FAIL because the exact historical ZIP is currently unknown.

- [ ] **Step 3: Make the narrow classifier correction**

In `scripts/deploy_impact.py`, add only `release-assets/KeystoneSync-v0.1.13.zip` to the exact known-no-impact set. Do not add a `release-assets/` prefix exemption.

Run:

```powershell
python -m unittest discover -s tests/deploy_impact
```

Expected: all Deployment Impact tests pass, including the unknown-path guard for any different release artifact.

- [ ] **Step 4: Create the single cleanup changeset**

Create `.changes/pending/client-post-tauri-cleanup.json` with exactly:

```json
{
  "components": ["client"],
  "type": "patch",
  "category": "changed",
  "summary": "Unifica la estructura interna de KeystoneClient tras la migracion a Tauri.",
  "details": [
    "El cliente conserva su comportamiento, configuracion y compatibilidad de actualizacion mientras elimina componentes historicos que ya no forman parte del producto.",
    "La interfaz Tauri, el host Rust y el sidecar Python pasan a compartir un unico arbol canonico de KeystoneClient."
  ]
}
```

Validate the plan without consuming the changeset:

```powershell
python scripts/release_changes.py plan --component client --version-file keystone-client/VERSION --bump auto --json
```

Expected: current version `0.4.0`, bump `patch`, next version `0.4.1`, tag `client-v0.4.1`.

- [ ] **Step 5: Delete only the audited dead files**

Use `apply_patch` for text files and `Remove-Item -LiteralPath` for the audited binary assets. Verify every absolute target is under the repository before deletion; do not use recursive wildcard deletion.

Expected: all listed files are absent; `keystone-client-next/design/**` and every currently imported UI asset remain.

- [ ] **Step 6: Validate Phase A**

Run:

```powershell
python -m unittest discover -s tests/deploy_impact
npm --prefix keystone-client-next test
npm --prefix keystone-client-next run build
git diff --check
git diff --name-status
git diff --name-only | python scripts/deploy_impact.py --stdin --json --strict
```

Expected impact: `CLIENT_BUILD=true`, `CLIENT_RELEASE=true`, and `WEB=false`, `WORKER=false`, `DB=false`, `ADDON=false`, `ADDON_RELEASE=false`, with no unknown paths.

- [ ] **Step 7: Review and commit Phase A**

Run:

```powershell
git diff --stat
git diff -- tests/deploy_impact/test_deploy_impact.py scripts/deploy_impact.py .changes/pending/client-post-tauri-cleanup.json
git status --short --untracked-files=all
git add .changes/pending/client-post-tauri-cleanup.json scripts/deploy_impact.py tests/deploy_impact/test_deploy_impact.py keystone-client/KeystoneClient.exe release-assets/KeystoneSync-v0.1.13.zip keystone-client-next/src/components/example.tsx keystone-client-next/src/assets/keystone-ui
git commit -m "Remove dead post-Tauri client artifacts"
```

Checkpoint: commit contains only Phase A and the one cleanup changeset. Do not proceed if imported assets disappeared from the Vite build.

---

### Task 3 / Phase B: Remove the Legacy Tkinter Presentation Layer

**Files:**
- Modify: `keystone-client/requirements.txt`
- Delete: `keystone-client/main.py`
- Delete: `keystone-client/main_window.py`
- Delete: `keystone-client/tray_app.py`
- Delete: `keystone-client/auth.py`
- Delete: `keystone-client/installer_window.py`
- Delete: `keystone-client/build.bat`
- Delete: `keystone-client/bg.jpg`
- Delete: `keystone-client/icon.ico`

**Interfaces:**
- Consumes: active flat Python service modules and current PyInstaller sidecar build.
- Produces: service-only Python root with no Tkinter/pystray presentation dependencies; requests, slpp, and PyInstaller remain.

- [ ] **Step 1: Establish the service-layer baseline**

Run:

```powershell
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python scripts/build_client_sidecar.py --clean
rg -n -g '*.py' "^(import|from) (tkinter|pystray|PIL)|from tkinter" keystone-client
```

Expected: tests and sidecar build pass; Tkinter is limited to `auth.py`, `installer_window.py`, and `main_window.py`; pystray/Pillow are limited to `tray_app.py` and `main_window.py`.

- [ ] **Step 2: Re-prove reachability boundaries**

Run:

```powershell
rg -n --hidden --glob '!.git/**' --glob '!docs/**' "from main_window|import main_window|from tray_app|import tray_app|from auth import|import auth|from installer_window|import installer_window"
rg -n "bridge_main.py|main.py|bg.jpg" scripts/build_client_sidecar.py tests/client_bridge/test_sidecar_build.py
```

Expected: only the legacy entrypoint connects the old presentation files; the sidecar builder uses `bridge_main.py` and its regression test explicitly excludes `main.py` and `bg.jpg`.

- [ ] **Step 3: Remove the presentation files and old one-file builder**

Delete the nine files listed for this task. Do not delete any service module listed in the final `sidecar/` tree.

- [ ] **Step 4: Remove only presentation-exclusive requirements**

Change `keystone-client/requirements.txt` from:

```text
requests
pystray
Pillow
slpp
pyinstaller
```

to:

```text
requests
slpp
pyinstaller
```

Run:

```powershell
rg -n -g '*.py' "tkinter|pystray|PIL" keystone-client tests/client tests/client_bridge
```

Expected: no matches.

- [ ] **Step 5: Validate Phase B**

Run:

```powershell
python -m pip install -r keystone-client/requirements.txt
python -m compileall -q keystone-client scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python scripts/build_client_sidecar.py --clean
git diff --check
git diff --name-only | python scripts/deploy_impact.py --stdin --json --strict
```

Expected impact: Client build/release only; no unknown, Web, Worker, DB, or addon impact.

- [ ] **Step 6: Review and commit Phase B**

Run:

```powershell
git diff --name-status
git status --short --untracked-files=all
git add keystone-client
git commit -m "Remove legacy Tkinter client shell"
```

Checkpoint: sidecar smoke passes without Tkinter, pystray, Pillow, `main.py`, `bg.jpg`, or `icon.ico`.

---

### Task 4 / Phase C: Remove Legacy Inno Build Tooling and Lock Migration Compatibility

**Files:**
- Modify: `tests/release/test_tauri_workflows.py`
- Delete: `keystone-client/build_installer.bat`
- Delete: `keystone-client/installer/KeystoneClient.iss`
- Delete: `keystone-client/installer/version.ini`
- Keep unchanged: `keystone-client-next/src-tauri/windows/installer-hooks.nsh`
- Keep unchanged: `keystone-client-next/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: verified public Inno 0.3.0 AppId and current NSIS hook.
- Produces: no historical Inno build pipeline, with a permanent regression guard for the supported Inno-to-NSIS migration.

- [ ] **Step 1: Run the existing migration contract tests**

Run:

```powershell
python -m unittest tests.release.test_tauri_workflows
```

Expected: tests prove the AppId, HKLM uninstall lookup, silent uninstaller flags, nonzero/error abort, AppData non-deletion, autostart rewrite, updater endpoint, and installer hook configuration.

- [ ] **Step 2: Add a failing dead-builder absence test**

Add a test to `tests/release/test_tauri_workflows.py` named `test_legacy_inno_build_entrypoints_are_removed_but_migration_hook_remains`. It must assert:

```python
legacy_build_paths = (
    REPO_ROOT / "keystone-client" / "build_installer.bat",
    REPO_ROOT / "keystone-client" / "installer" / "KeystoneClient.iss",
    REPO_ROOT / "keystone-client" / "installer" / "version.ini",
)
for path in legacy_build_paths:
    self.assertFalse(path.exists(), str(path))
self.assertTrue(
    (REPO_ROOT / "keystone-client-next" / "src-tauri" / "windows" / "installer-hooks.nsh").is_file()
)
```

Run:

```powershell
python -m unittest tests.release.test_tauri_workflows
```

Expected: FAIL because the three legacy build paths still exist.

- [ ] **Step 3: Delete only the old Inno build inputs**

Delete `build_installer.bat`, `KeystoneClient.iss`, and `version.ini`. Remove `keystone-client/installer/` only when empty. Do not edit or delete `installer-hooks.nsh`.

- [ ] **Step 4: Validate compatibility after deletion**

Run:

```powershell
python -m unittest tests.release.test_tauri_workflows
rg -n "B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910|UninstallString|VERYSILENT|SUPPRESSMSGBOXES|NORESTART|Abort|CurrentVersion\\Run|--autostart" keystone-client-next/src-tauri/windows/installer-hooks.nsh tests/release/test_tauri_workflows.py
rg -n "AppData|APPDATA|RemoveDir|RMDir" keystone-client-next/src-tauri/windows/installer-hooks.nsh
git diff --check
git diff --name-only | python scripts/deploy_impact.py --stdin --json --strict
```

Expected: migration tests pass; all required hook tokens are present; the hook contains no AppData deletion; impact is Client build/release only with no unknown paths.

- [ ] **Step 5: Review and commit Phase C**

Run:

```powershell
git diff --name-status
git diff -- tests/release/test_tauri_workflows.py keystone-client-next/src-tauri/windows/installer-hooks.nsh
git status --short --untracked-files=all
git add -A -- tests/release/test_tauri_workflows.py keystone-client
git commit -m "Remove legacy Inno build tooling"
```

Checkpoint: old Inno compilation is impossible from the current tree, while future NSIS installers still migrate public Inno 0.3.0.

---

### Task 5 / Phase D: Canonicalize the Python Sidecar

**Files:**
- Create directory: `keystone-client/sidecar/`
- Move: `keystone-client/requirements.txt` to `keystone-client/sidecar/requirements.txt`
- Move: all 14 active Python modules listed in the final tree into `keystone-client/sidecar/`
- Modify: `scripts/build_client_sidecar.py`
- Modify: `.github/workflows/build-client.yml`
- Modify: `.github/workflows/release-client.yml`
- Modify: `tests/client/test_addon_service.py`
- Modify: `tests/client/test_addon_updater.py`
- Modify: `tests/client/test_character_service.py`
- Modify: `tests/client/test_profile_service.py`
- Modify: `tests/client/test_sync_service.py`
- Modify: `tests/client/test_sync_worker.py`
- Modify: `tests/client/test_wow_path_accounts.py`
- Modify: `tests/client/test_wow_service.py`
- Modify: `tests/client_bridge/test_auth_settings_services.py`
- Modify: `tests/client_bridge/test_bridge_auth_handlers.py`
- Modify: `tests/client_bridge/test_bridge_process.py`
- Modify: `tests/client_bridge/test_bridge_protocol.py`
- Modify: `tests/client_bridge/test_sidecar_build.py`
- Modify: `tests/deploy_impact/test_deploy_impact.py`

**Interfaces:**
- Consumes: flat imports among sidecar modules, root `VERSION`, PyInstaller one-file console packaging, and current Tauri binary destination in `keystone-client-next/src-tauri/binaries/`.
- Produces: `keystone-client/sidecar/` as the only Python production source directory; automatic incremental source discovery; bundled canonical version; unchanged sidecar logical name and JSONL protocol.

- [ ] **Step 1: Add failing tests for the target sidecar layout**

Before moving files, update path expectations to the target paths:

```python
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
BRIDGE_MAIN = REPO_ROOT / "keystone-client" / "sidecar" / "bridge_main.py"
```

In `test_sidecar_build.py`, require the PyInstaller command to contain:

```python
str(REPO_ROOT / "keystone-client" / "sidecar" / "bridge_main.py")
str(REPO_ROOT / "keystone-client" / "sidecar")
str(REPO_ROOT / "keystone-client" / "VERSION")
```

In `tests/deploy_impact/test_deploy_impact.py`, add a target-layout assertion that `keystone-client/sidecar/requirements.txt` produces `client_build` and `client_release`.

Replace the fixed service-name coverage with a temporary-repository test that creates:

```text
keystone-client/sidecar/bridge_main.py
keystone-client/sidecar/new_domain_service.py
keystone-client/sidecar/requirements.txt
scripts/build_client_sidecar.py
```

and asserts `sidecar_sources(temp_root)` automatically includes both Python files, `requirements.txt`, root `VERSION`, and the build script while excluding `__pycache__` and non-source files.

Run:

```powershell
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
```

Expected: FAIL because `keystone-client/sidecar/` and the new source discovery do not exist yet.

- [ ] **Step 2: Move the active Python files with history**

Run one `git mv` per file for:

```text
requirements.txt
addon_installer.py
addon_service.py
addon_updater.py
auth_service.py
bridge_main.py
bridge_protocol.py
character_service.py
config.py
profile_service.py
settings_service.py
sync_service.py
sync_worker.py
wow_path.py
wow_service.py
```

For each filename in the preceding exact block, use `keystone-client/` as the source directory and `keystone-client/sidecar/` as the destination directory. Confirm `keystone-client/VERSION` did not move.

- [ ] **Step 3: Make sidecar dependency discovery automatic**

In `scripts/build_client_sidecar.py`, define the sidecar source directory once and implement `sidecar_sources(repo_root)` as:

```python
sidecar_dir = repo_root / "keystone-client" / "sidecar"
return [
    *sorted(sidecar_dir.glob("*.py")),
    sidecar_dir / "requirements.txt",
    repo_root / "keystone-client" / "VERSION",
    repo_root / "scripts" / "build_client_sidecar.py",
]
```

Update `pyinstaller_command()` so `--paths` and the entrypoint use `sidecar_dir`. Add root `keystone-client/VERSION` to the bundle as `VERSION` using PyInstaller `--add-data` with the platform path separator already available through `os.pathsep`. Keep `LOGICAL_SIDECAR_NAME = "keystone-client-core"`, `--onefile`, `--console`, hidden imports, temp paths, and output naming unchanged.

The command entries for the version resource must be:

```python
"--add-data",
f"{repo_root / 'keystone-client' / 'VERSION'}{os.pathsep}.",
```

- [ ] **Step 4: Correct Client version resolution in source and frozen modes**

In `keystone-client/sidecar/addon_service.py`, import `sys` and add this helper:

```python
def _client_version_path() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root) / "VERSION"
    return Path(__file__).resolve().parents[1] / "VERSION"
```

Change `_client_version()` to read `_client_version_path()`. Keep it returning `None` on read failure.

Add tests in `tests/client/test_addon_service.py` named `test_client_version_reads_canonical_root_in_source_mode` and `test_client_version_reads_bundled_resource_when_frozen`. Use `tempfile.TemporaryDirectory()` and construct the source-mode module path as `Path(tmp) / "keystone-client" / "sidecar" / "addon_service.py"`; patch `addon_service.__file__` to that value. For frozen mode, patch `addon_service.sys._MEIPASS` to `Path(tmp) / "bundle"` with `create=True`. Write distinct version strings to the corresponding temporary `VERSION` files and assert `_client_version()` returns the expected one. Do not introduce a second tracked canonical version file.

- [ ] **Step 5: Update Python dependency and workflow paths**

Change both Client workflows:

```text
keystone-client/requirements.txt
```

to:

```text
keystone-client/sidecar/requirements.txt
```

In `scripts/deploy_impact.py`, classify `keystone-client/sidecar/requirements.txt` as Client build/release. Keep the old root requirements path classified long enough for the move/deletion diff to remain known. Run the newly added Deployment Impact test first to verify it changes from failing to passing.

Update every `CLIENT_ROOT`, `BRIDGE_MAIN`, compile target, and direct test path found by:

```powershell
rg -n "keystone-client[/\\](requirements\.txt|bridge_main\.py|auth_service\.py|addon_service\.py|addon_installer\.py|addon_updater\.py|bridge_protocol\.py|character_service\.py|config\.py|profile_service\.py|settings_service\.py|sync_service\.py|sync_worker\.py|wow_path\.py|wow_service\.py)" .github scripts tests README.md RELEASE_WORKFLOW.md docs .agents
```

Operational documentation is completed in Task 7; tests, scripts, and workflows must be corrected now.

- [ ] **Step 6: Run targeted Python and incremental-build validation**

Run:

```powershell
python -m pip install -r keystone-client/sidecar/requirements.txt
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/release
python scripts/build_client_sidecar.py --clean
python scripts/build_client_sidecar.py
```

Expected: all tests pass; first build rebuilds and completes JSONL smoke; second build reports the existing sidecar is current. Touch a temporary copy through the unit test rather than changing production timestamps manually.

- [ ] **Step 7: Validate compatibility and impact**

Run:

```powershell
python -m unittest tests.client.test_wow_path_accounts tests.client_bridge.test_auth_settings_services tests.release.test_tauri_workflows
rg -n "APPDATA|KeystoneClient|wow_path|wow_accounts_selected|cached_characters|addon-cache" keystone-client/sidecar tests/client tests/client_bridge
git diff --check
git diff --name-only | python scripts/deploy_impact.py --stdin --json --strict
```

Expected: compatibility tests pass; root `VERSION` remains `0.4.0`; impact is Client build/release only, with no unknown or non-Client impact.

- [ ] **Step 8: Review and commit Phase D**

Run:

```powershell
git diff --name-status
git diff -- scripts/build_client_sidecar.py .github/workflows/build-client.yml .github/workflows/release-client.yml tests/client tests/client_bridge
git status --short --untracked-files=all
git add keystone-client/sidecar keystone-client/VERSION scripts/build_client_sidecar.py .github/workflows/build-client.yml .github/workflows/release-client.yml tests/client tests/client_bridge tests/release tests/deploy_impact
git commit -m "Move Python client core into sidecar"
```

Checkpoint: production Python exists only under `keystone-client/sidecar/`, the clean sidecar and JSONL smoke pass, and its output still targets `keystone-client-next/src-tauri/binaries/` until Task 6.

---

### Task 6 / Phase E: Unify the Tauri and React Project Under the Canonical Client Root

**Files:**
- Move: `keystone-client-next/.gitignore` to `keystone-client/.gitignore`
- Move: `keystone-client-next/README.md` to `keystone-client/README.md`
- Move: `keystone-client-next/package.json` to `keystone-client/package.json`
- Move: `keystone-client-next/package-lock.json` to `keystone-client/package-lock.json`
- Move: `keystone-client-next/index.html` to `keystone-client/index.html`
- Move: `keystone-client-next/vite.config.ts` to `keystone-client/vite.config.ts`
- Move: `keystone-client-next/tsconfig.json` to `keystone-client/tsconfig.json`
- Move: `keystone-client-next/tsconfig.node.json` to `keystone-client/tsconfig.node.json`
- Move: `keystone-client-next/playwright.config.ts` to `keystone-client/playwright.config.ts`
- Move: `keystone-client-next/src/` to `keystone-client/src/`
- Move: `keystone-client-next/src-tauri/` to `keystone-client/src-tauri/`
- Move: `keystone-client-next/tests/` to `keystone-client/tests/`
- Move: `keystone-client-next/design/` to `keystone-client/design/`
- Modify: `.github/workflows/build-client.yml`
- Modify: `.github/workflows/release-client.yml`
- Modify: `scripts/build_client_sidecar.py`
- Modify: `scripts/tauri_release.py`
- Modify: `scripts/deploy_impact.py`
- Modify: `tests/release/test_tauri_release.py`
- Modify: `tests/release/test_tauri_workflows.py`
- Modify: `tests/deploy_impact/test_deploy_impact.py`

**Interfaces:**
- Consumes: root `VERSION`, canonical sidecar, Tauri relative frontend and bundle paths, release metadata synchronizer, and current workflow contracts.
- Produces: one canonical `keystone-client/` product tree, no `keystone-client-next/`, and strict Deployment Impact coverage for every new canonical path class.

- [ ] **Step 1: Add failing canonical-path Deployment Impact tests**

In `tests/deploy_impact/test_deploy_impact.py`, require:

```text
keystone-client/src/App.tsx                         -> client_build, client_release
keystone-client/src-tauri/src/lib.rs                -> client_build, client_release
keystone-client/src-tauri/tauri.conf.json           -> client_build, client_release
keystone-client/package.json                        -> client_build, client_release
keystone-client/package-lock.json                   -> client_build, client_release
keystone-client/sidecar/bridge_main.py               -> client_build, client_release
keystone-client/tests/visual/preview.spec.ts         -> no impact
keystone-client/src/App.test.tsx                     -> no impact
keystone-client/design/synchronization-master.png    -> no impact
keystone-client/README.md                            -> no impact
keystone-client/VERSION                              -> client_build only
```

Also add a test that `keystone-client/unclassified-product-file.bin` remains unknown.

Run:

```powershell
python -m unittest discover -s tests/deploy_impact
```

Expected: FAIL for the new canonical React/Tauri/package paths.

- [ ] **Step 2: Redesign Client path classification around the final tree**

In `scripts/deploy_impact.py`:

- classify `keystone-client/src/**`, `keystone-client/src-tauri/**`, `keystone-client/package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, and `playwright.config.ts` as Client build/release;
- classify `keystone-client/sidecar/*.py` and `keystone-client/sidecar/requirements.txt` as Client build/release;
- keep `keystone-client/VERSION` build-only so release-generated commits do not recursively release;
- classify `keystone-client/tests/**`, frontend `*.test.*`, `keystone-client/design/**`, `keystone-client/README.md`, generated output, `node_modules`, Playwright reports, and Rust `target/` as no impact;
- retain explicit historical-path classification for the deleted flat sidecar modules, Tkinter files, root requirements/assets, executable, build scripts, and Inno inputs so comparisons against pre-cleanup refs pass `--strict`;
- retain the existing `keystone-client-next/**` release/test-output classification for comparisons against pre-unification refs, while the repository invariant test and reference scan prevent that directory from being recreated;
- leave unknown new canonical paths unknown.

Run:

```powershell
python -m unittest discover -s tests/deploy_impact
```

Expected: all tests pass and the unknown guard remains effective.

- [ ] **Step 3: Remove ignored local outputs after validating absolute paths**

From repository root, use this PowerShell guard before recursive deletion:

```powershell
$repo = (Resolve-Path .).Path.TrimEnd('\')
$targets = @(
  'keystone-client\dist',
  'keystone-client-next\dist',
  'keystone-client-next\node_modules',
  'keystone-client-next\test-results',
  'keystone-client-next\playwright-report',
  'keystone-client-next\src-tauri\target'
)
foreach ($relative in $targets) {
  $absolute = [System.IO.Path]::GetFullPath((Join-Path $repo $relative))
  if (-not $absolute.StartsWith($repo + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside repository: $absolute"
  }
  if (Test-Path -LiteralPath $absolute) {
    Remove-Item -LiteralPath $absolute -Recurse -Force
  }
}
```

Expected: only ignored build/dependency output is removed. Run `git status --short --untracked-files=all` and stop if a tracked file was affected.

- [ ] **Step 4: Move the Tauri/React tree with Git history**

Use the exact `git mv` source/destination pairs listed in this task. Move `.gitignore` explicitly because shell wildcards do not include it. Keep `design/` as retained source material. Do not overwrite `keystone-client/VERSION` or `keystone-client/sidecar/`.

Run:

```powershell
if (Test-Path keystone-client-next) { Get-ChildItem keystone-client-next -Force -Recurse }
git status --short --untracked-files=all
```

Expected: `keystone-client-next/` has no remaining tracked or generated content and disappears; all retained files appear as renames where Git can detect them.

- [ ] **Step 5: Update build and release path consumers atomically**

Apply these path changes:

```text
keystone-client-next/package-lock.json        -> keystone-client/package-lock.json
keystone-client-next/src-tauri                -> keystone-client/src-tauri
keystone-client-next/src-tauri/binaries       -> keystone-client/src-tauri/binaries
keystone-client-next/src-tauri/target         -> keystone-client/src-tauri/target
keystone-client-next/src                      -> keystone-client/src
working-directory: keystone-client-next       -> working-directory: keystone-client
```

Update:

- `.github/workflows/build-client.yml`: Node cache, npm install, Rust cache workspace, React working directory, Rust working directory, Tauri build, and NSIS artifact source.
- `.github/workflows/release-client.yml`: the same paths plus updater signature verification, release staging, and the atomic `git add` list.
- `scripts/build_client_sidecar.py`: default output directory becomes `keystone-client/src-tauri/binaries`.
- `scripts/tauri_release.py`: `_paths()` uses the single `keystone-client` root and generated release metadata goes to `keystone-client/src/generated/release.ts`.
- `tests/release/test_tauri_release.py`: temporary fixture tree and path assertions use `keystone-client`.
- `tests/release/test_tauri_workflows.py`: Tauri config, Cargo, hook, workflow, and canonical-path assertions use `keystone-client`.

The package script remains `python ../scripts/build_client_sidecar.py` because `package.json` stays one directory below repository root. Tauri `frontendDist: "../dist"`, `externalBin: ["binaries/keystone-client-core"]`, Cargo package names, and Playwright-relative paths remain unchanged unless a failing test proves otherwise.

- [ ] **Step 6: Prove there are no live `keystone-client-next` consumers**

Run:

```powershell
rg -n --hidden --glob '!.git/**' "keystone-client-next" .github scripts tests AGENTS.md README.md RELEASE_WORKFLOW.md docs .agents
```

Expected before Task 7 documentation: matches may remain only in historical migration/spec documents and current operational docs scheduled for Task 7. There must be no match in `.github/workflows/**`, `scripts/**`, executable tests, package files, Cargo/Tauri configuration, or Playwright configuration.

- [ ] **Step 7: Run targeted canonical-tree validation**

Run:

```powershell
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/release
python -m unittest discover -s tests/deploy_impact
npm ci --prefix keystone-client
npm --prefix keystone-client test
npm --prefix keystone-client run build
npm --prefix keystone-client run test:visual
cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml
cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml
python scripts/build_client_sidecar.py --clean
python scripts/tauri_release.py validate-versions --expected 0.4.0
```

Expected: all commands pass; visual snapshots still match; sidecar JSONL smoke passes; all version-bearing files remain `0.4.0`.

- [ ] **Step 8: Validate the complete branch impact and canonical inventory**

Run:

```powershell
git diff --check
$changed = @(
  git diff --name-only origin/main...HEAD
  git diff --name-only
) | Sort-Object -Unique
$changed | python scripts/deploy_impact.py --stdin --json --strict
git ls-files keystone-client-next
git ls-files keystone-client
```

Expected: no tracked `keystone-client-next` files; no unknown paths; Client build/release true only; Web, Worker, DB, addon, and addon release false.

- [ ] **Step 9: Review and commit Phase E**

Run:

```powershell
git diff --name-status
git diff -- .github/workflows/build-client.yml .github/workflows/release-client.yml scripts/build_client_sidecar.py scripts/tauri_release.py scripts/deploy_impact.py tests/release tests/deploy_impact
git status --short --untracked-files=all
git add -A
git commit -m "Unify KeystoneClient under canonical tree"
```

Checkpoint: `keystone-client-next/` is absent, all product builds use `keystone-client/`, and the canonical tree passes Python, React, visual, Rust, sidecar, release, and impact tests.

---

### Task 7 / Phase F: Update Operational Documentation and Run Full Local Validation

**Files:**
- Modify: `README.md`
- Modify: `RELEASE_WORKFLOW.md`
- Modify: `AGENTS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/AGENT_CONTEXT.md`
- Modify: `docs/DATA_CONTRACT.md`
- Modify: `docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md`
- Modify: `.agents/skills/keystonesync-client/SKILL.md`
- Modify: `.agents/skills/deploy-impact/SKILL.md`
- Modify: `keystone-client/README.md`
- Keep as history: `docs/superpowers/specs/**`
- Keep as history: `docs/superpowers/sdd/**`
- Keep as history: earlier `docs/superpowers/plans/**`

**Interfaces:**
- Consumes: the final canonical paths and unchanged production/release contracts.
- Produces: truthful current operating documentation, an explicit historical migration record, and a locally release-ready cleanup branch.

- [ ] **Step 1: Update current operating truth**

Apply these exact documentation outcomes:

- `README.md`: Client 0.4.0 is Tauri/React/Rust with a PyInstaller Python sidecar and NSIS installer; commands use `keystone-client`; release output remains `KeystoneClientSetup.exe`.
- `RELEASE_WORKFLOW.md`: replace PyInstaller/Inno application instructions with sidecar plus Tauri/NSIS build, signed updater artifacts, changesets, and release-dry-run/release modes.
- `AGENTS.md`: Client validation uses npm, Python sidecar, Cargo, and Tauri NSIS commands under the canonical tree; remove `build.bat` and `build_installer.bat` as current instructions.
- `docs/ARCHITECTURE.md`: describe one `keystone-client/` component with React frontend, Rust host, Python sidecar, NSIS, updater, and retained Inno migration hook.
- `docs/AGENT_CONTEXT.md`: mark Tauri 0.4.0 public and verified, record the canonical tree, preserve AppData/Inno compatibility facts, and remove the in-progress/0.3.0 statements.
- `docs/DATA_CONTRACT.md`: update active parser, payload, and SavedVariables references from flat `keystone-client/*.py` paths to `keystone-client/sidecar/*.py` without changing the documented contract.
- `.agents/skills/keystonesync-client/SKILL.md`: replace Tkinter/pystray/Inno current-UI guidance with canonical Tauri/React/Rust/sidecar/NSIS guidance and exact validation commands.
- `.agents/skills/deploy-impact/SKILL.md`: document canonical Client path classes and remove the historical generated `installer/version.ini` statement.
- `keystone-client/README.md`: document prerequisites, `npm ci`, tests, Playwright, sidecar build, Cargo checks, Tauri dev/build, output locations, version contract, AppData ownership, addon updater ownership, and migration-hook constraint.
- `docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md`: retain historical phase content and add a completion note stating that production 0.4.0 cut over at `b927d6721ab68272413f1035e583886927caf5ae` and post-cutover canonicalization completed on the cleanup branch. Do not rewrite historical commands as if they were current.

- [ ] **Step 2: Scan for stale operational claims**

Run:

```powershell
rg -n "0\.2\.1|0\.3\.0|Tkinter|pystray|Inno Setup|build_installer|build\.bat|keystone-client-next|Tauri is not yet|migration is in progress" README.md RELEASE_WORKFLOW.md AGENTS.md docs/ARCHITECTURE.md docs/AGENT_CONTEXT.md docs/DATA_CONTRACT.md keystone-client/README.md .agents/skills
```

Expected: remaining `0.3.0`/Inno matches describe supported migration history; no current instruction calls Tkinter/Inno the production shell or references `keystone-client-next`.

- [ ] **Step 3: Run all Python validation**

Run:

```powershell
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
python -m unittest discover -s tests/release
python -m unittest discover -s tests/deploy_impact
```

Expected: all commands exit `0`.

- [ ] **Step 4: Run frontend and visual validation**

Run:

```powershell
npm ci --prefix keystone-client
npm --prefix keystone-client test
npm --prefix keystone-client run build
npm exec --prefix keystone-client -- playwright install chromium
npm --prefix keystone-client run test:visual
```

Expected: Vitest, TypeScript/Vite build, and all committed visual snapshots pass without snapshot regeneration. Any intentional visual difference requires separate approval rather than silent snapshot updates.

- [ ] **Step 5: Run Rust and sidecar validation**

Run:

```powershell
cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml
cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml
python scripts/build_client_sidecar.py --clean
```

Expected: Rust formatting/check/tests pass; clean sidecar build and JSONL smoke pass.

- [ ] **Step 6: Build the real local NSIS installer**

Run:

```powershell
npm --prefix keystone-client run tauri:build -- --bundles nsis
Get-ChildItem keystone-client/src-tauri/target/release/bundle/nsis/*-setup.exe
```

Expected: Tauri produces one NSIS setup executable for version `0.4.0`. This local build does not create a tag, release, or public updater manifest.

- [ ] **Step 7: Verify version, release plan, secrets, references, and impact**

Run:

```powershell
python scripts/tauri_release.py validate-versions --expected 0.4.0
python scripts/release_changes.py plan --component client --version-file keystone-client/VERSION --bump auto --json
rg -n --hidden --glob '!.git/**' "keystone-client-next" .github scripts tests AGENTS.md README.md RELEASE_WORKFLOW.md docs/ARCHITECTURE.md docs/AGENT_CONTEXT.md keystone-client/README.md .agents/skills
git grep -n -E "TAURI_SIGNING_PRIVATE_KEY|TAURI_SIGNING_PRIVATE_KEY_PASSWORD|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY"
$changed = @(
  git diff --name-only origin/main...HEAD
  git diff --name-only
) | Sort-Object -Unique
$changed | python scripts/deploy_impact.py --stdin --json --strict
git diff --check
git status --short --untracked-files=all
```

Expected: synchronized version `0.4.0`; pending plan `0.4.1`; no live `keystone-client-next` references; secret scan contains variable names/documentation only and no private key material or value; impact is Client build/release only with no unknown paths; worktree contains only intended Task 7 documentation changes before commit.

- [ ] **Step 8: Self-review all cleanup requirements**

Verify directly:

```powershell
git ls-files keystone-client-next
git ls-files keystone-client | Sort-Object
git ls-files | Select-String -Pattern 'KeystoneClient\.exe$|KeystoneSync-v0\.1\.13\.zip$|build_installer\.bat$|KeystoneClient\.iss$|installer/version\.ini$|main_window\.py$|tray_app\.py$|installer_window\.py$'
rg -n "B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910|APPDATA|addon-cache|wow_path|wow_accounts_selected|cached_characters|latest\.json|KeystoneClientSetup\.exe\.sig" keystone-client scripts tests
```

Expected: no `keystone-client-next` or dead-file results; all compatibility and updater contracts remain represented in production code/tests.

- [ ] **Step 9: Review and commit Phase F**

Run:

```powershell
git diff -- README.md RELEASE_WORKFLOW.md AGENTS.md docs/ARCHITECTURE.md docs/AGENT_CONTEXT.md docs/DATA_CONTRACT.md docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md .agents/skills/keystonesync-client/SKILL.md .agents/skills/deploy-impact/SKILL.md keystone-client/README.md
git status --short --untracked-files=all
git add README.md RELEASE_WORKFLOW.md AGENTS.md docs/ARCHITECTURE.md docs/AGENT_CONTEXT.md docs/DATA_CONTRACT.md docs/KEYSTONECLIENT_TAURI_REACT_MIGRATION_PLAN.md .agents/skills/keystonesync-client/SKILL.md .agents/skills/deploy-impact/SKILL.md keystone-client/README.md
git commit -m "Document canonical Tauri client architecture"
```

Checkpoint: all local validation passes, the branch contains one pending patch changeset, `VERSION` remains `0.4.0`, and no production operation has occurred.

---

### Task 8: Remote Release-Dry-Run Gate and Optional Branch Housekeeping

**Files:**
- Modify: none during the dry-run.
- Delete only with separate authorization: local and remote `test/keystoneclient-tauri-release-dry-run` branch references.

**Interfaces:**
- Consumes: completed cleanup branch, GitHub Actions signing secrets, and explicit authorization for remote validation.
- Produces: signed `0.4.1` dry-run artifacts built from the exact cleanup SHA without publication.

- [ ] **Step 1: Obtain explicit authorization for remote actions**

Authorization must explicitly cover pushing `chore/keystoneclient-post-tauri-cleanup` and manually dispatching `release-client.yml` in `release-dry-run` mode. It must not imply authorization for `release`, tags, GitHub Releases, `latest.json`, Worker deploy, D1 migration, addon release, or production merge.

- [ ] **Step 2: Re-run release safety checks**

Run:

```powershell
git status --short --untracked-files=all
git rev-parse HEAD
Get-Content keystone-client/VERSION
python scripts/release_changes.py plan --component client --version-file keystone-client/VERSION --bump auto --json
gh variable list
git ls-remote --tags origin client-v0.4.1
gh release view client-v0.4.1
```

Expected: clean branch; version `0.4.0`; plan `0.4.1`; gate disabled; no tag or release.

- [ ] **Step 3: Push only the cleanup branch**

Run after authorization:

```powershell
git push -u origin chore/keystoneclient-post-tauri-cleanup
```

Do not push tags and do not force.

- [ ] **Step 4: Dispatch the signed release dry-run**

Run after authorization:

```powershell
gh workflow run release-client.yml --ref chore/keystoneclient-post-tauri-cleanup -f mode=release-dry-run -f version_bump=auto
$runId = gh run list --workflow release-client.yml --branch chore/keystoneclient-post-tauri-cleanup --limit 1 --json databaseId --jq '.[0].databaseId'
if ([string]::IsNullOrWhiteSpace($runId)) { throw "Release dry-run was not found." }
```

Inspect the captured run:

```powershell
gh run watch $runId --exit-status
gh run view $runId --log
```

Expected: exact cleanup SHA checked out; version plan `0.4.1`; Python, React, Rust, sidecar, signature and NSIS validation pass; signed dry-run artifacts upload; release preparation remains ephemeral.

- [ ] **Step 5: Prove that dry-run did not publish**

Run:

```powershell
git ls-remote --tags origin client-v0.4.1
gh release view client-v0.4.1
(Invoke-WebRequest -Uri 'https://github.com/Speeson/weeklyChar/releases/download/client-v0.4.1/latest.json' -Method Head -SkipHttpErrorCheck).StatusCode
git fetch origin --prune --tags
git rev-parse origin/main
```

Expected: no `client-v0.4.1` tag, no GitHub Release, manifest request is not successful, and `origin/main` is unchanged by the dry-run.

- [ ] **Step 6: Record the final implementation gate**

Report the cleanup branch SHA, all local test counts, NSIS artifact path, GitHub Actions run ID/URL, dry-run artifact names, Deployment Impact JSON, version `0.4.0`, planned `0.4.1`, and confirmation that no publication/deployment occurred. Stop before merge or release.

- [ ] **Step 7: Delete the old validation branch only as separately authorized housekeeping**

First prove ancestry again:

```powershell
git fetch origin --prune
git merge-base --is-ancestor test/keystoneclient-tauri-release-dry-run origin/main
git branch -r --contains 9a8c14a5475fd6e4938f0bd66e3c3b8bf4d45723
```

Expected: exit `0` and `origin/main` contains the old validation commit. With separate explicit branch-deletion authorization:

```powershell
git branch -d test/keystoneclient-tauri-release-dry-run
git push origin --delete test/keystoneclient-tauri-release-dry-run
```

This housekeeping is not required for accepting the canonical Client migration and must never be bundled with a force push.

---

## Changeset and Release Strategy

- Exactly one pending Client changeset is created in Task 2 and retained through all phase commits.
- The changeset type is `patch`, so `release_changes.py plan` resolves `0.4.0` to `0.4.1`.
- No task runs `release_changes.py prepare`; therefore the changeset is not consumed and `VERSION` is not changed.
- Tasks 2 through 6 are expected to report `CLIENT_BUILD=true` and `CLIENT_RELEASE=true`. Task 7 documentation alone is no-impact, but the cumulative branch remains Client build/release impacting.
- Every phase must report `WEB=false`, `WORKER=false`, `DB=false`, `ADDON=false`, and `ADDON_RELEASE=false` with zero unknown paths.
- The signed remote gate uses `release-dry-run`, never `release`. A production 0.4.1 release requires a later, separate authorization after merge readiness is reviewed.

## Rollback and Recovery

- Do not rewrite phase commits. If a checkpoint fails, repair it in the same unpushed phase or add a normal follow-up commit after push.
- Tasks 2 through 4 delete only audited dead material; Git history remains the recovery source. Do not restore it under a `legacy/` directory.
- Task 5 must be reverted as one unit if sidecar import, version resource, incremental rebuild, or JSONL smoke validation fails. Do not leave half of the Python modules at each path.
- Task 6 must be reverted as one unit if workflows, release tooling, Cargo/Tauri, Playwright, or Deployment Impact still reference split roots. Do not recreate `keystone-client-next/` as a compatibility shim.
- Never solve an AppData test failure by deleting, resetting, renaming, or migrating `%APPDATA%\KeystoneClient`; preserve the established schema and unknown keys.
- Never solve an installer test failure by removing the Inno AppId hook or weakening fail-closed behavior.
- Never regenerate updater keys. The committed public key and externally stored signing secrets remain unchanged.
- Local `dist/`, `node_modules/`, Rust `target/`, Playwright reports, and sidecar binaries may be rebuilt after guarded removal; they are not rollback sources.

## Final Acceptance Checklist

- [ ] All audited `DELETE_DEAD` files are absent.
- [ ] All 14 active Python modules and `requirements.txt` exist under `keystone-client/sidecar/`.
- [ ] `keystone-client/VERSION` is the only canonical source version and remains `0.4.0`.
- [ ] `keystone-client-next/` is absent.
- [ ] React, Rust/Tauri, NSIS, visual tests, and retained design sources live under `keystone-client/`.
- [ ] No build, workflow, release script, executable test, Playwright config, Cargo/Tauri config, operational doc, or skill uses `keystone-client-next`.
- [ ] `%APPDATA%\KeystoneClient` behavior and old config keys remain compatible.
- [ ] Inno AppId `{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}_is1`, uninstall flags, failure abort, AppData preservation, and autostart migration remain tested.
- [ ] JSONL protocol, addon integration, updater public key, signing, latest manifest, and release resume/repair remain tested.
- [ ] Incremental sidecar discovery automatically tracks every top-level sidecar Python module, requirements file, root version, and build script.
- [ ] Deployment Impact knows all canonical product/test/output paths and reports no unknown paths for the branch.
- [ ] One pending Client patch changeset resolves the eventual version to `0.4.1` without changing `VERSION`.
- [ ] Full local Python, React, Playwright, Rust, sidecar, NSIS, impact, diff, and secret validation passes.
- [ ] Separately authorized release-dry-run succeeds from the exact cleanup SHA without creating a tag, release, or public `latest.json`.
- [ ] `TAURI_CLIENT_RELEASE_ENABLED` remains disabled and no Web, Worker, DB, addon, or production Client operation occurs.
