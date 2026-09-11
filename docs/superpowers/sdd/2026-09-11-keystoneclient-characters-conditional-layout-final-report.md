# KeystoneClient conditional Characters layout — final report

## Delivered

- Rounded the existing textured section-header illumination.
- Removed the vertical guide from the indented account/realm and character content.
- Removed the fixed Active/Inactive height split. Expanded Inactive now consumes its natural height
  up to its own cap; Active keeps its height while both lists fit and only shrinks and scrolls when
  their real combined content would overlap.
- Preserved closed-tray dropping, persistence, selection and accessible move controls.

## Validation

- The new Playwright assertions failed before the CSS change for square headers and unconditional
  Active contraction.
- `npm --prefix keystone-client test`: 46 files, 276 tests passed.
- `npx playwright test tests/visual/characters.spec.ts --workers=1`: 8 passed.
- The necklace image timing check passed three repeated focused runs after an intermittent unloaded
  image was isolated, and the complete Characters visual suite then passed.
- `npm --prefix keystone-client run build`: passed.
- `npm --prefix keystone-client run tauri:build -- --no-bundle`: passed; sidecar protocol smoke
  passed for `ready`, `ping`, `second_ping`, `get_state` and `eof`.
- `git diff --check`: passed with line-ending notices only.

## Portable artifact

Directory: `keystone-client/artifacts/KeystoneClient-0.9.0-characters-layout-v12-portable`

- `KeystoneClient.exe` SHA-256:
  `D54AEA6A649A5C2278550A9F5F29027FA7B3B100D859E599FB5C872A88D74350`
- `keystone-client-core.exe` SHA-256:
  `9DD81EED14E6148BA4B7D3057D63FCCA31F50C56C4E4425FA6F64E2C00F93A0C`

The v11 client was still running during handoff. Close it before opening v12 so the single-instance
guard does not redirect the new launch to the previous process.

## Deployment impact

- Client build: required and completed locally.
- Client release: required for distribution, but no tag, push, release or remote action was made.
- Web, Worker, D1 and addon: no impact.
