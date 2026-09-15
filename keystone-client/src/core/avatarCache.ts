const AVATAR_CACHE_NAME = "keystone-client-avatars-v1";
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

async function openAvatarCache(): Promise<Cache | null> {
  if (typeof globalThis.caches === "undefined") return null;
  try {
    return await globalThis.caches.open(AVATAR_CACHE_NAME);
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

export async function removeCachedAvatar(value: string): Promise<void> {
  const url = normalizeAvatarUrl(value);
  const cache = url ? await openAvatarCache() : null;
  if (cache && url) {
    try {
      await cache.delete(url);
    } catch {
      // Invalid cached media falls back to the remote source on the next retry.
    }
  }
}

export async function clearAvatarCache(): Promise<void> {
  inFlight.clear();
  if (typeof globalThis.caches === "undefined") return;
  try {
    await globalThis.caches.delete(AVATAR_CACHE_NAME);
  } catch {
    // Cache cleanup must never block logout.
  }
}

export const avatarCacheLimits = {
  maxBytes: MAX_AVATAR_BYTES,
  maxEntries: MAX_AVATAR_ENTRIES,
} as const;
