import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avatarCacheLimits,
  clearAvatarCache,
  getCachedAvatarSource,
  normalizeAvatarUrl,
} from "./avatarCache";

class MemoryCache {
  readonly entries = new Map<string, Response>();
  readonly deleted: string[] = [];

  async match(request: RequestInfo | URL) {
    return this.entries.get(this.key(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.entries.set(this.key(request), response.clone());
  }

  async delete(request: RequestInfo | URL) {
    const key = this.key(request);
    this.deleted.push(key);
    return this.entries.delete(key);
  }

  async keys() {
    return [...this.entries.keys()].map(url => ({ url }) as Request);
  }

  private key(request: RequestInfo | URL) {
    if (typeof request === "string") return request;
    if (request instanceof URL) return request.href;
    return request.url;
  }
}

let cache: MemoryCache;
let deleteCache: ReturnType<typeof vi.fn>;
const supportsBlobResponse = (() => {
  try { new Response(new Blob(["test"])); return true; } catch { return false; }
})();

function imageResponse(body = "jpeg", type = "image/jpeg", headers: Record<string, string> = {}) {
  const content = supportsBlobResponse ? new Blob([body], { type }) : body;
  return new Response(content, {
    headers: { "content-length": String(body.length), "content-type": type, ...headers },
    status: 200,
  });
}

beforeEach(() => {
  cache = new MemoryCache();
  deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("caches", {
    delete: deleteCache,
    open: vi.fn().mockResolvedValue(cache),
  });
  vi.stubGlobal("fetch", vi.fn());
  if (!supportsBlobResponse) {
    vi.stubGlobal("FileReader", class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      async readAsDataURL(blob: Blob) {
        const bytes = await blob.arrayBuffer();
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
        this.onload?.();
      }
    });
  }
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("avatar cache", () => {
  it("normalizes only credential-free HTTPS URLs", () => {
    expect(normalizeAvatarUrl("https://render.worldofwarcraft.com/eu/avatar.jpg"))
      .toBe("https://render.worldofwarcraft.com/eu/avatar.jpg");
    expect(normalizeAvatarUrl("http://render.worldofwarcraft.com/avatar.jpg")).toBeNull();
    expect(normalizeAvatarUrl("https://user:pass@example.test/avatar.jpg")).toBeNull();
    expect(normalizeAvatarUrl("not-a-url")).toBeNull();
  });

  it("downloads, persists and later serves avatar bytes as a data URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(imageResponse("portrait"));

    const first = await getCachedAvatarSource("https://img.test/avatar.jpg");
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"));
    const second = await getCachedAvatarSource("https://img.test/avatar.jpg");

    expect(first).toMatch(/^data:image\/jpeg;base64,/u);
    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.entries).toHaveLength(1);
  });

  it("coalesces concurrent downloads of the same avatar", async () => {
    let complete!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));

    const first = getCachedAvatarSource("https://img.test/shared.jpg");
    const second = getCachedAvatarSource("https://img.test/shared.jpg");
    complete(imageResponse());

    expect(await first).toBe(await second);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects unsupported or oversized responses without caching them", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(imageResponse("html", "text/html"))
      .mockResolvedValueOnce(imageResponse("x", "image/jpeg", {
        "content-length": String(avatarCacheLimits.maxBytes + 1),
      }));

    await expect(getCachedAvatarSource("https://img.test/not-image.jpg")).resolves.toBeNull();
    await expect(getCachedAvatarSource("https://img.test/too-large.jpg")).resolves.toBeNull();
    expect(cache.entries).toHaveLength(0);
  });

  it("evicts the oldest entry after reaching the bounded cache size", async () => {
    for (let index = 0; index < avatarCacheLimits.maxEntries; index += 1) {
      cache.entries.set(`https://img.test/${index}.jpg`, imageResponse());
    }
    vi.mocked(fetch).mockResolvedValueOnce(imageResponse("new"));

    await getCachedAvatarSource("https://img.test/new.jpg");

    expect(cache.entries).toHaveLength(avatarCacheLimits.maxEntries);
    expect(cache.deleted[0]).toBe("https://img.test/0.jpg");
  });

  it("clears the versioned cache without allowing cleanup failure to escape", async () => {
    await clearAvatarCache();
    expect(deleteCache).toHaveBeenCalledWith("keystone-client-avatars-v1");
    deleteCache.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(clearAvatarCache()).resolves.toBeUndefined();
  });
});
