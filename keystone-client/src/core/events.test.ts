import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listenCoreEvents } from "./events";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

const listenMock = vi.mocked(listen);

describe("listenCoreEvents", () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  it("subscribes only to the namespaced core event", async () => {
    const unlisten = vi.fn();
    listenMock.mockResolvedValueOnce(unlisten);
    const handler = vi.fn();

    await expect(listenCoreEvents(handler)).resolves.toBe(unlisten);

    expect(listenMock).toHaveBeenCalledWith("core://event", expect.any(Function));
  });
});
