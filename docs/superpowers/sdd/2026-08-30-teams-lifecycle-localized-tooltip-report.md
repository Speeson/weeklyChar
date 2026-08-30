# Teams lifecycle and localized tooltip refinement report

## Outcome

The Client no longer destroys and rebuilds Teams data when unrelated App state rerenders. Team-list
freshness is event-driven, dungeon results use an isolated stale-while-revalidate cache, and Client
Selector requests now select Spanish or English Blizzard metadata without crossing cache locales.
The addon, Web, and D1 schema are unchanged.

## Root causes

- `I18nProvider` created a new translator and context object on every App render. Because Teams data
  effects depended on that translator, opening or closing Settings retriggered them and cleared the
  rendered data.
- Team discovery happened only on mount, while the picker refused to open when the cached list had
  one Team. The Worker list route queries live D1 membership on every request and the Python/React
  parsers have no persistent Team-list cache, so the durable stale-list cause was Client lifecycle,
  not a second authoritative local database.
- Every dungeon selection cleared the prior result. Cold Worker requests can also await bounded
  Blizzard item/media enrichment after D1 lookup; the bridge itself only forwards one HTTP request.
  The change removes repeated perceived delay without prefetching all eight dungeons.

## Implementation

- Memoize i18n context by language.
- Preserve the last valid Team list during revalidation on picker open, window focus, and visibility
  restoration; deduplicate concurrent requests and guard generations.
- Keep the active Team when present and fall back safely when membership disappears.
- Cache Selector results by `(teamId, challengeMapId, locale)`, render hits immediately, revalidate
  in the background, preserve cached data on refresh failure, and guard cross-Team/dungeon races.
- Send only `es_ES` or `en_US` through TypeScript, the generic bridge, and Python to the Worker.
  Reject unknown locales and use the existing `(region, locale, item_id)` D1 cache identity.
- Replace only the unselected Selector prompt's generic gem with the active theme `brand-mark` and
  increase its responsive typography.
- Keep item rarity sourced from existing Blizzard `qualityType`; objective tier colors remain
  independent. No item-level or favorite-variant contract was retained.

## Validation

- Client frontend: 183/183 passed.
- Client production TypeScript/Vite build: passed.
- Client Python: 90/90 passed; compileall passed.
- Client bridge: 59/59 passed.
- Worker typecheck: passed.
- Worker tests: 101/101 passed.
- Focused Teams Playwright: 4/4 passed.
- Release orchestration tests: 51/51 passed.
- Deployment-impact tests: 46/46 passed.
- Full Client Playwright: 150/150 passed. The release-sensitive visual harness now validates the
  current generated version and changelog before normalizing only that dynamic text to its stable
  visual fixture. No snapshot baselines were updated.

## Deployment impact

```text
CLIENT_BUILD=true
CLIENT_RELEASE=true
WORKER=true
WEB=false
DB=false
ADDON=false
ADDON_RELEASE=false
```

The pending Client patch changeset predicts 0.6.8 from the current 0.6.7. No remote operation was
performed.
