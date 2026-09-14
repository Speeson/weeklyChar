# Keystone Planner external recommendations UX — final report

Date: 2026-09-14

## Outcome

The Windows Client now presents incomplete-party recommendations as visual, inspectable alternatives without changing the Web UI or allowing presentation data to affect Planner ranking.

- Compact Quick vacancies show up to four class icons; Advanced vacancies show up to four specialization icons. Overflow is represented by a `+` action.
- Expanded vacancies default to the selected completion and let the user compare the first four alternatives in place. Gain, buffs/debuffs, and utilities update with the selection.
- The complete Quick/Advanced comparison opens in a body portal, preventing isolated preview stacking contexts from appearing above the modal.
- Quick rows identify the class; Advanced rows identify class and exact specialization. Capability chips and the estimated offensive gain remain aligned in separate columns.
- Capability links retain the official Wowhead tooltip contract. Visible spell icons are resolved from Wowhead's tooltip response and fail to an empty themed placeholder without blocking the view.

## Contract and ranking boundary

Modern vacancy DTOs may add a bounded `recommendations` array. Each entry contains a stable response identity, class, optional Advanced spec, estimated offensive gain, and separate spell-backed `buffsDebuffs` and `utilities` lists.

The Worker derives these alternatives only after selecting the ranked external completion. The selected completion is moved to index zero for presentation. Alternative ordering never enters the Top 5 comparator, and legacy responses do not receive the field. The Python sidecar accepts and bounds the additive structure; older modern responses without it remain valid. No D1 persistence or migration was added.

## Validation

- Worker: `npm run typecheck` passed; `npm test` passed 231 tests.
- Ranking data: `node tools/planner-ranking-data/generate.mjs --check` passed.
- Client frontend: `npm test -- --run --reporter=dot` passed 295 tests; `npm run build` passed.
- Client visual flow: `npx playwright test tests/visual/teams-stone-selector.spec.ts` passed 8 tests; the two Quick/Advanced recommendation scenarios also passed after adding all-icon load assertions.
- Python: compileall passed; Client sidecar passed 115 tests; Client bridge passed 66 tests.
- Web compatibility: lint passed, 73 tests passed, and the production build passed. No Web presentation files changed.
- `git diff --check` passed after the final report was written.

## Deployment impact

The deterministic classifier reports `WORKER=true`, `CLIENT_BUILD=true`, and `CLIENT_RELEASE=true`; `WEB=false`, `DB=false`, `ADDON=false`, and `ADDON_RELEASE=false`. It reports `tools/planner-ranking-data/generate.mjs` as an unclassified tooling path. No remote action was performed.
