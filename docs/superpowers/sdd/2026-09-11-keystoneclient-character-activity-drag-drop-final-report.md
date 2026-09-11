# KeystoneClient character activity drag/drop — final report

## Delivered

- Fixed HTML5 drag and drop in the packaged Windows client by disabling Tauri's native file-drop
  receiver for the main WebView2 window.
- Planner character cards now use 50 % opacity and a subtle blur from drag start until drop or
  cancellation, and continue to support the accessible Activate/Deactivate controls.
- The Characters rail now has always-visible Active and Inactive zones with independent scrolling,
  bidirectional drag/drop, equivalent controls, inactive dark styling and selection continuity.
- Character inactivity is stored defensively in versioned local client storage. It is a local
  presentation preference only and does not delete data, stop synchronization or change any
  addon, Worker, D1 or Web contract.
- Added regression coverage for the Tauri configuration, storage parser, controls, bidirectional
  drag/drop, drag feedback and persistence across reload.

## Validation

- `npm --prefix keystone-client test`: 46 files, 274 tests passed.
- `npm --prefix keystone-client run build`: passed.
- Targeted Playwright (`characters.spec.ts` and `teams-stone-selector.spec.ts`): 14 passed.
- Full `npm --prefix keystone-client run test:visual`: 172 passed; 7 pre-existing/out-of-scope Void
  screenshot comparisons differ. Six are animated raster differences of 9–49 pixels and one is the
  already changed Teams screen. No affected Characters or Planner scenario failed.
- Client Python compile plus suites: 109 client and 66 bridge tests passed.
- Rust format/check/full tests: passed; 25 tests passed. The focused Tauri configuration regression
  also passed after it was added.
- Clean sidecar build and protocol smoke: `ready`, `ping`, `second_ping`, `get_state` and `eof` passed.
- `tauri build --no-bundle`: passed and produced the release executable.
- `git diff --check`: passed (line-ending notices only).

## Portable artifact

Directory: `keystone-client/artifacts/KeystoneClient-0.9.0-drag-drop-v9-portable`

- `KeystoneClient.exe` SHA-256:
  `66658FAF07AB589E501DC62AC5079AD9AE9EB86B752B9FE27CC9CA15EF1F084D`
- `keystone-client-core.exe` SHA-256:
  `A1FF0B63995C4199121A00D903673DD5158D7C388DB22AB77D0561269FE90780`

The previous v8 client was still running during handoff, so v9 was not launched over it. Close v8
before opening v9 to avoid the single-instance guard redirecting the launch to the older process.

## Deployment impact

- Client build: required and completed locally.
- Client release: required for distribution, but no tag, release, push or remote action was made.
- Web, Worker, D1, addon and addon release: no impact.
