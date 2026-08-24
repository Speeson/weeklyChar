import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("coreRequest", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("centralizes calls to the allowlisted Tauri command", async () => {
    invokeMock.mockResolvedValueOnce({ pong: true });

    await expect(coreRequest("system.ping")).resolves.toEqual({ pong: true });
    expect(invokeMock).toHaveBeenCalledWith("core_request", {
      command: "system.ping",
      payload: {},
    });
  });

  it("forwards object payloads without creating request ids in React", async () => {
    invokeMock.mockResolvedValueOnce({ protocolVersion: 1, bridge: "ready" });

    await coreRequest("system.get_state", { source: "test" });

    expect(invokeMock).toHaveBeenCalledWith("core_request", {
      command: "system.get_state",
      payload: { source: "test" },
    });
  });
});
