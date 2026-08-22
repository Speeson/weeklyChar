import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";
import { forceSync, getSyncStatus, startSync, stopSync, subscribeToSyncEvents } from "./sync";

vi.mock("./client", () => ({
  coreRequest: vi.fn(),
}));

vi.mock("./events", () => ({
  listenCoreEvents: vi.fn(),
}));

const coreRequestMock = vi.mocked(coreRequest);
const listenCoreEventsMock = vi.mocked(listenCoreEvents);

describe("sync wrappers", () => {
  beforeEach(() => {
    coreRequestMock.mockReset();
    listenCoreEventsMock.mockReset();
  });

  it("calls typed sync lifecycle commands", async () => {
    coreRequestMock.mockResolvedValue({ running: false, state: "idle", selectedAccounts: 0 });

    await getSyncStatus();
    await startSync();
    await stopSync();
    await forceSync();

    expect(coreRequestMock).toHaveBeenNthCalledWith(1, "sync.get_status");
    expect(coreRequestMock).toHaveBeenNthCalledWith(2, "sync.start");
    expect(coreRequestMock).toHaveBeenNthCalledWith(3, "sync.stop");
    expect(coreRequestMock).toHaveBeenNthCalledWith(4, "sync.force");
  });

  it("filters non-sync bridge events", async () => {
    const dispose = vi.fn();
    const handler = vi.fn();
    listenCoreEventsMock.mockImplementationOnce(async (callback) => {
      callback({ protocolVersion: 1, event: "system.ready", data: { capabilities: [] } });
      callback({
        protocolVersion: 1,
        event: "sync.status",
        data: {
          running: true,
          state: "watching",
          lastSyncAt: null,
          lastSuccessAt: null,
          lastError: null,
          selectedAccounts: 1,
        },
      });
      return dispose;
    });

    const unlisten = await subscribeToSyncEvents(handler);
    unlisten();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].event).toBe("sync.status");
    expect(dispose).toHaveBeenCalledWith();
  });
});
