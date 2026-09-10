# Keystone Planner V1 — Block D implementation plan

1. Correct the Web specialization catalog and add the Devourer/40-spec regression.
2. Add `lib/keystonePlanner.ts` with exact transport types, strict parsers, builders, identity helpers, UI defaults, participant/lock helpers, and exhaustive presentation maps.
3. Add unit tests for the contract and pure UI state helpers.
4. Build the accessible full-replacement preferences dialog against the two owner endpoints.
5. Build the shared planner panel with participant selection, level/options, advanced locks, request cancellation, HTTP states, diagnostics, and response-only recommendation cards.
6. Activate the Selector planner tab and add the team-header session entry, both using the shared panel.
7. Extend Playwright fixtures and scenarios for desktop, mobile, keyboard, stale requests, all terminal states, and retry paths.
8. Run Web lint/test/build/visual validation, the Worker regression suite and migration test, `git diff --check`, self-review, and strict deployment-impact classification.
9. Write the Block D implementation report. Do not commit, push, deploy, release, or migrate remotely.
