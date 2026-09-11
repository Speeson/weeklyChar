# KeystoneClient Characters rail organization — final report

## Delivered

- Replaced the separate account and realm controls with one hierarchical `Cuenta y reino` selector.
- Accounts form the first menu level and expose their realms through a right-facing expandable
  subsection; choosing a realm updates both values together.
- Added independently collapsible `Cuenta y reino` and `Personajes` sections to recover vertical
  space after making a selection.
- Changed the inactive-character area into a compact tray that is closed by default, accepts drops
  while closed and opens upward into a bounded, scrollable panel.
- Kept character activation bidirectional through drag/drop and the accessible alternative buttons.
- Moved the selected state to the complete draggable character card and replaced the inner outline
  with a themed glow that does not scale the card.
- Updated unit and visual coverage for the hierarchy, collapsible sections, closed drop target,
  upward expansion, persistence, selection styling and minimum-window bounds.

## Validation

- `npm --prefix keystone-client test`: 46 files, 275 tests passed.
- `npm --prefix keystone-client run build`: passed.
- Targeted Playwright `characters.spec.ts --workers=1`: 7 passed.
- Full `npm --prefix keystone-client run test:visual`: 172 passed; the same 7 known, out-of-scope
  Void snapshot comparisons differ. No Characters or Planner scenario failed.
- Clean sidecar build and protocol smoke: `ready`, `ping`, `second_ping`, `get_state` and `eof` passed.
- `npm --prefix keystone-client run tauri:build -- --no-bundle`: passed and produced the release
  executable.
- `git diff --check`: passed (line-ending notices only).

## Portable artifact

Directory: `keystone-client/artifacts/KeystoneClient-0.9.0-characters-rail-v10-portable`

- `KeystoneClient.exe` SHA-256:
  `C3B9769D705A3FD5ECEFF953085EDBD7B3BC82EFFD8869C4F70B08BCFE76D1BA`
- `keystone-client-core.exe` SHA-256:
  `9DD81EED14E6148BA4B7D3057D63FCCA31F50C56C4E4425FA6F64E2C00F93A0C`

The v9 client was still running during handoff, so v10 was not launched over it. Close v9 before
opening v10 to avoid the single-instance guard redirecting the launch to the older process.

## Deployment impact

- Client build: required and completed locally.
- Client release: required for distribution, but no tag, release, push or remote action was made.
- Web, Worker, D1, addon and addon release: no impact.
