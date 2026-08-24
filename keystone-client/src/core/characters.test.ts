import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { listenCoreEvents } from "./events";
import { getCharacters, refreshCharacters, subscribeToCharacterEvents } from "./characters";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));
vi.mock("./events", () => ({ listenCoreEvents: vi.fn() }));

describe("character core wrapper", () => {
  beforeEach(() => {
    vi.mocked(coreRequest).mockReset().mockResolvedValue({ characters: [] });
    vi.mocked(listenCoreEvents).mockReset().mockResolvedValue(vi.fn());
  });

  it("uses only the allowlisted character commands", async () => {
    await getCharacters();
    await refreshCharacters();
    expect(coreRequest).toHaveBeenNthCalledWith(1, "characters.get");
    expect(coreRequest).toHaveBeenNthCalledWith(2, "characters.refresh");
  });

  it("forwards only character update events", async () => {
    const callback = vi.fn();
    await subscribeToCharacterEvents(callback);
    const listener = vi.mocked(listenCoreEvents).mock.calls[0][0];
    const state = { characters: [], refreshing: false, source: "remote" as const, lastRefreshAt: null, lastError: null };
    listener({ protocolVersion: 1, event: "characters.updated", data: state });
    expect(callback).toHaveBeenCalledWith(state);
  });
});
