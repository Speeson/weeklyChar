# KeystoneClient Synchronization States Design

## Objective

Represent the five synchronization states consistently in both existing status panels without changing their dimensions, position, or surrounding layout.

## Approved Design

Both panels continue to read the same `SyncStatus.state` value:

- `idle`: waiting, monitor stopped, warning icon.
- `watching`: ready, monitor active, information icon.
- `syncing`: reading SavedVariables, animated sync icon.
- `success`: synchronization completed, success icon.
- `error`: synchronization failed, error icon and latest error detail.

The upper panel remains a compact summary. The right-side `Estado actual` panel retains the detailed message and timestamp. Labels and icons must agree between both panels.

## Architecture

- No Core protocol or Python service changes are required; all five states already exist end to end.
- `SyncPage.tsx` owns the state-to-presentation mapping.
- Existing KeystoneClient assets provide the state icons.
- Preview states and visual tests cover every mapping.

## Verification

- `npm test -- --run`
- `npm run build`
- `npx playwright test`
- Inspect the five generated state screenshots.

## Out Of Scope

- Changing panel sizes or layout.
- Adding or removing synchronization states.
- Changing watcher or force-sync behavior in the Python Core.
