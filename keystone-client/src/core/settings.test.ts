import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { getSettings, updateSettings } from "./settings";

vi.mock("./client", () => ({
  coreRequest: vi.fn(),
}));

const coreRequestMock = vi.mocked(coreRequest);

describe("settings wrappers", () => {
  beforeEach(() => {
    coreRequestMock.mockReset();
  });

  it("calls settings.get", async () => {
    coreRequestMock.mockResolvedValueOnce({
      startMinimized: false,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "es",
    });

    await getSettings();

    expect(coreRequestMock).toHaveBeenCalledWith("settings.get");
  });

  it("calls settings.update with whitelisted values", async () => {
    const payload = { startMinimized: true, lang: "en" as const };
    coreRequestMock.mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "en",
    });

    await updateSettings(payload);

    expect(coreRequestMock).toHaveBeenCalledWith("settings.update", payload);
  });
});
