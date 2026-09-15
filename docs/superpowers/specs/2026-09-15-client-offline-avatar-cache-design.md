# KeystoneClient Offline Avatar Cache Design

## Objective

Keep character and profile portraits visible across Client sessions without internet access, and
recover automatically when connectivity returns after an image request has failed.

## Approved design

- Keep the existing remote `avatarUrl` values as the canonical profile preference and API data.
- Store validated avatar responses in a small, versioned Cache Storage cache owned by the Client
  WebView. Cached bytes are resolved to local data URLs before display and remain available between
  normal application sessions.
- Accept only credential-free HTTPS URLs and JPEG, PNG or WebP responses up to 256 KiB. Omit
  credentials and referrer data from avatar fetches, coalesce concurrent requests and cap the cache
  at 100 entries.
- Use one shared resilient avatar component in the profile header, avatar picker, Sync, Characters,
  Teams and Planner preferences. It falls back to the existing initials/class treatment, resets when
  the URL changes and retries on the browser `online` event.
- Clear the avatar cache on explicit logout so private session presentation data follows the
  existing character-cache boundary. Cache API absence or failure degrades to the remote URL and
  does not block the UI.

## Architecture

`src/core/avatarCache.ts` owns validation, persistent Cache Storage access, download coalescing,
size/type limits and eviction. `src/components/RemoteAvatar.tsx` owns React lifecycle and retry
behavior. Existing avatar wrappers retain their sizing, framing, class colors and fallback text.
The Python sidecar, JSONL bridge, Worker, D1, Web and addon contracts do not change.

## Verification

- Focused cache tests for persistence, validation, coalescing, eviction and failure fallback.
- React tests for cached rendering, failed-image fallback, URL changes and online retry.
- Existing Client unit tests, TypeScript/Vite build and visual suite.
- Client Python/bridge/release tests, Rust formatting/check/tests, sidecar build, diff review and
  strict Deployment Impact classification.

## Out of scope

- Caching equipment, spell, dungeon or theme artwork.
- Changing avatar selection, Raider.IO enrichment or API persistence.
- Worker/Web/addon changes, remote operations, version preparation or publication.
