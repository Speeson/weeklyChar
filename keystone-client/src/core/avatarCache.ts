import { invoke, isTauri } from "@tauri-apps/api/core";

const AVATAR_CACHE_NAME = "keystone-client-avatars-v1";
const PROFILE_AVATAR_CACHE_NAME = "keystone-client-profile-avatar-v1";
const MAX_AVATAR_BYTES = 256 * 1024;
const MAX_AVATAR_ENTRIES = 100;
const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const inFlight = new Map<string, { promise: Promise<string | null>; abort: () => void }>();

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

async function loadNativeAvatar(url: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string | null>("load_cached_avatar", { url });
  } catch {
    return null;
  }
}

async function storeNativeAvatar(url: string, dataUrl: string, profile = false): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await invoke<void>("store_cached_avatar", { dataUrl, profile, url });
    return true;
  } catch {
    return false;
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

async function resolveAvatar(url: string, signal: AbortSignal): Promise<string | null> {
  const native = await loadNativeAvatar(url);
  if (signal.aborted) return null;
  if (native) return native;

  const cache = await openAvatarCache();
  const cached = await cache?.match(url);
  if (cached) {
    const blob = await validatedBlob(cached);
    if (blob) {
      const source = await blobDataUrl(blob);
      if (signal.aborted) return null;
      if (source) await storeNativeAvatar(url, source);
      return source;
    }
    await cache?.delete(url);
  }

  const profileCache = await openAvatarCache(PROFILE_AVATAR_CACHE_NAME);
  const profileAvatar = await profileCache?.match(url);
  if (profileAvatar) {
    const blob = await validatedBlob(profileAvatar);
    if (blob) {
      const source = await blobDataUrl(blob);
      if (signal.aborted) return null;
      if (source) await storeNativeAvatar(url, source, true);
      return source;
    }
    await profileCache?.delete(url);
  }

  try {
    const response = await fetch(url, {
      cache: "default",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
    });
    const blob = await validatedBlob(response);
    if (!blob || signal.aborted) return null;
    if (cache) try {
      await cache.put(url, new Response(blob, {
        headers: { "content-length": String(blob.size), "content-type": blob.type },
        status: 200,
      }));
      await trimAvatarCache(cache);
    } catch {
      // A full or unavailable persistent cache must not block the live image.
    }
    const source = await blobDataUrl(blob);
    if (signal.aborted) return null;
    if (source) await storeNativeAvatar(url, source);
    return source;
  } catch {
    return null;
  }
}

export function getCachedAvatarSource(value: string): Promise<string | null> {
  const url = normalizeAvatarUrl(value);
  if (url === null) return Promise.resolve(null);
  const current = inFlight.get(url);
  if (current) return current.promise;
  const controller = new AbortController();
  const request = resolveAvatar(url, controller.signal).catch(() => null).finally(() => {
    if (inFlight.get(url)?.promise === request) inFlight.delete(url);
  });
  inFlight.set(url, { promise: request, abort: () => controller.abort() });
  return request;
}

export async function cacheProfileAvatar(value: string): Promise<boolean> {
  const url = normalizeAvatarUrl(value);
  if (url === null) return false;
  const source = await getCachedAvatarSource(url);
  if (source === null) return false;

  const nativeRequired = isTauri();
  const nativeStored = await storeNativeAvatar(url, source, true);

  const [avatarCache, profileCache] = await Promise.all([
    openAvatarCache(),
    openAvatarCache(PROFILE_AVATAR_CACHE_NAME),
  ]);
  if (!avatarCache || !profileCache) return nativeStored;
  const response = await avatarCache.match(url) ?? await profileCache.match(url);
  if (!response) return nativeStored;
  const blob = await validatedBlob(response);
  if (!blob) return nativeStored;
  try {
    const existing = await profileCache.keys();
    await Promise.all(existing.map(key => profileCache.delete(key)));
    await profileCache.put(url, new Response(blob, {
      headers: { "content-length": String(blob.size), "content-type": blob.type },
      status: 200,
    }));
    return nativeRequired ? nativeStored : true;
  } catch {
    return nativeStored;
  }
}

export async function removeCachedAvatar(value: string): Promise<void> {
  const url = normalizeAvatarUrl(value);
  if (!url) return;
  const nativeCleanup = isTauri()
    ? invoke<void>("remove_cached_avatar", { url }).catch(() => undefined)
    : Promise.resolve();
  const cachesToClean = await Promise.all([
    openAvatarCache(),
    openAvatarCache(PROFILE_AVATAR_CACHE_NAME),
  ]);
  await Promise.allSettled([
    nativeCleanup,
    ...cachesToClean.map(cache => cache?.delete(url)),
  ]);
}

export async function clearAvatarCache(): Promise<void> {
  const pending = [...inFlight.values()];
  pending.forEach(entry => entry.abort());
  await Promise.allSettled(pending.map(entry => entry.promise));
  inFlight.clear();
  const nativeCleanup = isTauri()
    ? invoke<void>("clear_cached_avatars").catch(() => undefined)
    : Promise.resolve();
  if (typeof globalThis.caches === "undefined") {
    await nativeCleanup;
    return;
  }
  await Promise.allSettled([
    nativeCleanup,
    globalThis.caches.delete(AVATAR_CACHE_NAME),
    globalThis.caches.delete(PROFILE_AVATAR_CACHE_NAME),
  ]);
}

export const avatarCacheLimits = {
  maxBytes: MAX_AVATAR_BYTES,
  maxEntries: MAX_AVATAR_ENTRIES,
} as const;
