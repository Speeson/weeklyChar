# Bank Items And Character Visibility — Final Report

## Delivered

- KeystoneClient shows known Spark of Tides bank quantity beside the character total.
- KeystoneSync captures Scalebound Herald's Flute in bags, the personal bank including Reagent
  Bank, and the Warband Bank. It retains cached bank counts until the relevant bank can be read.
- KeystoneClient shows the flute icon and known count on an unobtained Trovehunter's Bounty card,
  with Wowhead item tooltip and a location breakdown. The 40px icon glows lightly and has the
  count at its lower-right corner.
- Web's existing hidden-character preference now filters the current user's characters on
  Dashboard, Summary, and Team detail views. Other Team members stay visible.
- The Client activity button is square and gold; it shows the crossed-out eye for the hide action
  and the open eye for the show action.
- Worker and D1 required no changes; currency snapshots are already persisted as JSON.
- Added Client and addon pending changesets without bumping versions or creating releases.

## Validation

- `npm run build` in `keystone-client`: passed.
- `npm run lint` in `keystone-web`: passed.
- `npm run build` in `keystone-web`: passed.
- `npm test -- --run src/pages/CharactersPage.test.tsx` in `keystone-client`: passed (32 tests).
- `python scripts/package_addon.py validate --version 0.5.0` in `KeystoneSync`: passed.
- `python scripts/release_changes.py validate` in `KeystoneSync`: passed.
- Addon runtime, deployment-impact and release suites: passed (84, 10 and 30 tests).
- Client changeset validation and `git diff --check`: passed.
- Strict Deployment Impact: Web, Client build/release, and addon build/release are true; Worker and
  DB are false. No unknown paths.
- After push, Web CI passed. The initial addon and Client release workflows each found a stale test;
  the addon tests now pass and its follow-up CI packaged a build-only artifact. No addon or Client
  release was published by these workflows.

## Limitations

- In-game capture behavior still needs manual validation in WoW with both bank types open.
- Source commits were pushed to both `main` branches. No manual release or deployment was run.
