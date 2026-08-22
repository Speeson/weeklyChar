import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAddon,
  getAddonStatus,
  installAddon,
  reinstallAddon,
  subscribeToAddonEvents,
  updateAddon,
} from "./addon";
import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";

vi.mock("./client", () => ({
  coreRequest: vi.fn(),
}));

vi.mock("./events", () => ({
  listenCoreEvents: vi.fn(),
}));

const coreRequestMock = vi.mocked(coreRequest);
const listenCoreEventsMock = vi.mocked(listenCoreEvents);

describe("addon core wrappers", () => {
  beforeEach(() => {
    coreRequestMock.mockReset();
    listenCoreEventsMock.mockReset();
  });

  it("uses typed addon command names", async () => {
    coreRequestMock.mockResolvedValue({});

    await getAddonStatus();
    await checkAddon();
    await installAddon();
    await updateAddon();
    await reinstallAddon();

    expect(coreRequestMock).toHaveBeenNthCalledWith(1, "addon.get_status");
    expect(coreRequestMock).toHaveBeenNthCalledWith(2, "addon.check");
    expect(coreRequestMock).toHaveBeenNthCalledWith(3, "addon.install");
    expect(coreRequestMock).toHaveBeenNthCalledWith(4, "addon.update");
    expect(coreRequestMock).toHaveBeenNthCalledWith(5, "addon.reinstall");
  });

  it("subscribes only to addon events", async () => {
    const handler = vi.fn();
    let listener: Parameters<typeof listenCoreEvents>[0] = () => undefined;
    listenCoreEventsMock.mockImplementation(async (callback) => {
      listener = callback;
      return () => undefined;
    });

    await subscribeToAddonEvents(handler);
    listener({
      protocolVersion: 1,
      event: "addon.status.changed",
      data: {
        installed: false,
        installedVersion: null,
        latestVersion: null,
        state: "not-installed",
        cacheAvailable: false,
        lastCheckAt: null,
        source: null,
        message: "",
        operation: null,
      },
    });
    listener({
      protocolVersion: 1,
      event: "sync.started",
      data: {
        running: true,
        state: "watching",
        lastSyncAt: null,
        lastSuccessAt: null,
        lastError: null,
        selectedAccounts: 1,
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
