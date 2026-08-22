# KeystoneClient Next

Non-production Tauri 2 + React + TypeScript migration scaffold for KeystoneClient.

The current production client remains `../keystone-client/`.

## Validation

```bash
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

This tree is build-only during migration: `CLIENT_BUILD=true`, `CLIENT_RELEASE=false`.
