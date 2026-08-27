# Midnight Season 2 Migration Report

## Outcome

KeystoneSync's Client, Worker contract coverage, and active Web views now use the canonical Midnight Season 2 dungeon and currency contract. No D1 schema change is required: the Worker continues to persist `currencies` as JSON and the complete Season 2 object round-trips unchanged.

The handoff was subsequently applied cleanly to the canonical `C:\DAM2\KeystoneSync` checkout. A small post-apply correction makes Trovehunter `bagCount` count bags only rather than bank storage, and focused runtime contract tests were added. Automated, changeset, package, and deployment-impact validation pass. The in-game smoke test remains outstanding.

## Canonical Contract

- Dungeons: 588/AOF, 587/MR, 586/DON, 584/BV, 585/VSA, 249/KR, 250/TOS, and 399/RLP.
- Currencies: `adventurerMistcrest`, `veteranMistcrest`, `championMistcrest`, `heroMistcrest`, `mythMistcrest`, `venomblightManaflux`, `tidalSparkDust`, `cofferKeyShards`, `restoredCofferKey`, `nebulousVoidcore`, `sparksOfTides`, and `trovehuntersBounty`.
- Spark of Tides: item 274476 plus Tidal Spark Dust currency 3509.
- Trovehunter's Bounty: item 274374, quest 86371, aura 1293799, readable `Completed`/`Incomplete` Web state, and same-week completion preservation in the addon handoff.
- Settings compatibility maps only old visibility preferences to canonical keys. Old currency payload quantities are not translated.

## Web And Browser Evidence

- Shared metadata drives Summary, Dashboard, Team dungeon filters, current-keystone abbreviations, and current marketing/settings copy.
- Summary renders direct Wowhead destinations for currency, item, and portal spell IDs.
- The seven requested live icon identifiers are used at 20 by 20 CSS pixels with decorative accessibility treatment. Live external image requests were denied by the sandbox, so the Playwright layout pass fulfilled those exact requested URLs with deterministic image bytes; the icon identifiers themselves were verified from current Wowhead metadata before implementation.
- Chromium fixture review at 1440 px and 390 px rendered all eight dungeon rows, all nine configured resource rows, `AOF +12`, and readable Trovehunter completion. A navbar page-width overflow found at 390 px was corrected by containing its horizontal navigation scroll.

## Validation

- Client: `python -m compileall -q keystone-client/sidecar scripts tests` passed.
- Client: `python -m unittest discover -s tests/client` passed, 77 tests.
- Client bridge: `python -m unittest discover -s tests/client_bridge` passed, 57 tests.
- Client frontend: `npm test` passed, 140 tests; the production frontend build passed.
- Client Playwright: `npm run test:visual` passed, 128 tests.
- Worker: `npm.cmd run typecheck` passed.
- Worker: `npm.cmd test` passed, 9 tests.
- Web: `npm.cmd test` passed, 15 tests; the production build passed.
- Web Chromium fixture assertions passed at desktop and mobile widths.
- Addon: 40 automated tests passed across runtime, release/workflow, and deployment-impact suites; changeset and package validation passed.
- Active-code audit found old Season 1 keys only in the intentional settings compatibility map and negative test assertions. Active Web code no longer references local Season 1 currency assets.
- `git diff --check` passed.
- Web lint reproduced the documented baseline exactly: 13 errors and 25 warnings. No new count was introduced.

## Deployment Impact

The weeklyChar classifier reports `WEB=true`, `CLIENT_BUILD=true`, and `CLIENT_RELEASE=true`; `WORKER=false` and `DB=false`. The Client flags come from shipped Client runtime changes; Client tests, fixtures, and snapshots are explicitly no-impact. The standalone addon classifier reports `ADDON_BUILD=true` and `ADDON_RELEASE=true`. Automatic Client and addon publication are disabled through repository-variable guards for this push; no migration, tag, release, or manual deployment is part of this migration commit.
