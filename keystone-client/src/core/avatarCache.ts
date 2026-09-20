const AVATAR_CACHE_NAME = "keystone-client-avatars-v1";
const PROFILE_AVATAR_CACHE_NAME = "keystone-client-profile-avatar-v1";
const MAX_AVATAR_BYTES = 256 * 1024;
const MAX_AVATAR_ENTRIES = 100;
const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const inFlight = new Map<string, Promise<string | null>>();

export function normalizeAvatarUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function openAvatarCache(name = AVATAR_CACHE_NAME): Promise<Cache | null> {
  if (typeof globalThis.caches === "undefined") return null;
  try {
    return await globalThis.caches.open(name);
  } catch {
    return null;
  }
}

function contentType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
}

async function validatedBlob(response: Response): Promise<Blob | null> {
  if (!response.ok || !AVATAR_CONTENT_TYPES.has(contentType(response))) return null;
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_AVATAR_BYTES) return null;
  const blob = await response.blob();
  return blob.size > 0 && blob.size <= MAX_AVATAR_BYTES ? blob : null;
}

function blobDataUrl(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(blob);
  });
}

async function trimAvatarCache(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  const excess = keys.length - MAX_AVATAR_ENTRIES;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)));
}

async function resolveAvatar(url: string): Promise<string | null> {
  const cache = await openAvatarCache();
  if (cache === null) return null;

  const cached = await cache.match(url);
  if (cached) {
    const blob = await validatedBlob(cached);
    if (blob) return blobDataUrl(blob);
    await cache.delete(url);
  }

  const profileCache = await openAvatarCache(PROFILE_AVATAR_CACHE_NAME);
  const profileAvatar = await profileCache?.match(url);
  if (profileAvatar) {
    const blob = await validatedBlob(profileAvatar);
    if (blob) return blobDataUrl(blob);
    await profileCache?.delete(url);
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    const response = await fetch(url, {
      cache: "default",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    const blob = await validatedBlob(response);
    if (!blob) return null;
    try {
      await cache.put(url, new Response(blob, {
        headers: { "content-length": String(blob.size), "content-type": blob.type },
        status: 200,
      }));
      await trimAvatarCache(cache);
    } catch {
      // A full or unavailable persistent cache must not block the live image.
    }
    return blobDataUrl(blob);
  } catch {
    return null;
  }
}

export function getCachedAvatarSource(value: string): Promise<string | null> {
  const url = normalizeAvatarUrl(value);
  if (url === null) return Promise.resolve(null);
  const current = inFlight.get(url);
  if (current) return current;
  const request = resolveAvatar(url).catch(() => null).finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

export async function cacheProfileAvatar(value: string): Promise<boolean> {
  const url = normalizeAvatarUrl(value);
  if (url === null) return false;
  const source = await getCachedAvatarSource(url);
  if (source === null) return false;

  const [avatarCache, profileCache] = await Promise.all([
    openAvatarCache(),
    openAvatarCache(PROFILE_AVATAR_CACHE_NAME),
  ]);
  if (!avatarCache || !profileCache) return false;
  const response = await avatarCache.match(url) ?? await profileCache.match(url);
  if (!response) return false;
  const blob = await validatedBlob(response);
  if (!blob) return false;
  try {
    const existing = await profileCache.keys();
    await Promise.all(existing.map(key => profileCache.delete(key)));
    await profileCache.put(url, new Response(blob, {
      headers: { "content-length": String(blob.size), "content-type": blob.type },
      status: 200,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function removeCachedAvatar(value: string): Promise<void> {
  const url = normalizeAvatarUrl(value);
  if (!url) return;
  const cachesToClean = await Promise.all([
    openAvatarCache(),
    openAvatarCache(PROFILE_AVATAR_CACHE_NAME),
  ]);
  await Promise.allSettled(cachesToClean.map(cache => cache?.delete(url)));
}

export async function clearAvatarCache(): Promise<void> {
  inFlight.clear();
  if (typeof globalThis.caches === "undefined") return;
  await Promise.allSettled([
    globalThis.caches.delete(AVATAR_CACHE_NAME),
    globalThis.caches.delete(PROFILE_AVATAR_CACHE_NAME),
  ]);
}

export const avatarCacheLimits = {
  maxBytes: MAX_AVATAR_BYTES,
  maxEntries: MAX_AVATAR_ENTRIES,
} as const;
