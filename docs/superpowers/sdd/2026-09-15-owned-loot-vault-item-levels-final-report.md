# Owned Loot And Great Vault Item Levels Final Report

Date: 2026-09-15

## Outcome

KeystoneSync now carries optional per-favorite `owned=true` from the canonical addon through
KeystoneClient and the Worker. Owned favorites stay visible in Client and Web with a muted,
desaturated treatment and a green lower-corner check, but no longer contribute to Stone Selector
pending counts or Keystone Planner loot inputs. Legacy snapshots remain actionable.
Ownership is normalized by item ID before duplicate/spec aggregation, so every representation of an
owned item is consistently display-only.

The addon now captures the current Blizzard reward item level for each unlocked raid, dungeon, and
world Great Vault chest. Client and Web show it once beside the corresponding chest progress. The
existing boss, completed Mythic+ run, and world activity lists remain visible without per-run ilvls.

The Web dashboard tooltip is available through hover, keyboard focus, and touch focus, and exposes
the tooltip relationship to assistive technology.

## Contract And Compatibility

- The canonical addon derives current ownership by item ID from equipped items, bags, and the
  personal bank. It writes only `owned=true`; omission means not known to be owned.
- The field is additive and validated as boolean when present. Existing `keystone_loot_json`
  persistence is reused, so no D1 migration is required.
- Owner, Team, and Selector presentation DTOs retain owned items. Selector counters and Planner
  objectives exclude them. Characters with only owned objectives remain visible with zero pending
  objectives; the prior behavior for characters with only Voidcore-completed items is unchanged.
- Ownership is current possession rather than permanent loot history. If an item is sold, traded,
  deleted, or disenchanted, it can become actionable again after a subsequent addon snapshot.

## Validation

- Worker: `npm run typecheck` and `npm test` passed, 247 tests.
- Web: `npm test` passed, 78 tests; `npm run lint` and `npm run build` passed.
- Web Playwright: `npm run test:visual` passed, 25 tests, including the owned-item check fixture.
- Client: `npm test -- --run` passed, 319 tests; `npm run build` passed.
- Client targeted Playwright: Characters and Teams Selector passed, 17 tests, including Vault
  `ilvl 318` and owned-item check assertions.
- Client full Playwright initially reached 177 passing tests; its changed Teams test still had the
  obsolete label and six unrelated Void snapshot comparisons differed by 0.01%. After updating the
  label, the affected Characters and Teams suites passed in isolation.
- Python: compileall passed; client parser passed 117 tests and bridge passed 66 tests.
- Addon: runtime passed 84 tests, release passed 30 tests, and deployment-impact passed 10 tests.
- Root release tooling passed 51 tests.
- `git diff --check` passed in both repositories.

## Deployment Impact

- WeeklyChar: Web, Worker, Client build, and Client release are required; DB, embedded addon, and
  embedded addon release are not.
- External canonical addon: addon build and addon release are required independently; it does not
  require a Client release by itself.
- No push, deployment, remote migration, version bump, tag, or release was performed.
