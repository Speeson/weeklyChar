# KeystoneClient Overlay Settings Design

## Objective

Turn the validated Windows overlay POC into an opt-in Client feature with a user-selected global shortcut, while preserving the existing UI and keeping World of Warcraft as the permanent keyboard recipient.

## Approved Design

- Settings adds an `Enable overlay` checkbox and a keyboard shortcut recorder. The feature defaults off, the default shortcut remains `Ctrl+Shift+K`, and a `Restore` action resets the edited shortcut to that default.
- Shortcut capture accepts one main key plus at least one Ctrl, Shift, Alt, or Super modifier. Escape cancels capture. Invalid or OS-conflicting combinations show an error and do not replace the working shortcut.
- Enabling, disabling, and rebinding take effect immediately without restarting. Disabling an active overlay restores the existing main window to normal focusable, taskbar-visible behavior.
- The existing `main` window and complete React state remain the only UI. The successful Tauri `set_focusable(false)` strategy remains unchanged; no Win32 fallback is added.

## Architecture

- The Python sidecar adds `overlayEnabled` and `overlayShortcut` to the existing local `settings.get` / `settings.update` whitelist and `%APPDATA%\KeystoneClient\config.json`. These device-specific values do not go to Worker, D1, Web, or the addon.
- Rust owns global shortcut parsing, registration, replacement, rollback, status, and overlay window lifecycle. Startup reads the local settings after the bridge is managed. A registration conflict is non-fatal to Client startup and is exposed through native status.
- React Settings captures the combination, asks Rust to apply it before persistence, and rolls Rust back to the last persisted configuration if the local settings write fails.
- The existing JSONL protocol version remains unchanged because the additive settings fields use existing commands.

## Verification

- `python -m compileall -q keystone-client/sidecar scripts tests`
- `python -m unittest discover -s tests/client_bridge`
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- Focused manual checks for initial registration, rebind, conflict rollback, disable/restore, restart persistence, and the approved WoW keyboard/mouse acceptance sequence.
- Strict Deployment Impact for all changed paths.

## Out Of Scope

- Worker, D1, Web, addon, account-level shortcut synchronization, macOS/Linux support, automatic WoW detection, layout changes, a compact overlay UI, Win32 `WS_EX_NOACTIVATE`, and `WM_MOUSEACTIVATE` interception.
