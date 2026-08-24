import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAutostartEnabled, setAutostartEnabled } from "./autostart";

vi.mock("@tauri-apps/plugin-autostart", () => ({
  disable: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn(),
}));

describe("autostart wrapper", () => {
  beforeEach(() => {
    vi.mocked(disable).mockReset();
    vi.mocked(enable).mockReset();
    vi.mocked(isEnabled).mockReset();
  });

  it("reads OS state and verifies enable/disable operations", async () => {
    vi.mocked(isEnabled).mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await getAutostartEnabled()).toBe(false);
    expect(await setAutostartEnabled(true)).toBe(true);
    expect(await setAutostartEnabled(false)).toBe(false);
    expect(enable).toHaveBeenCalledOnce();
    expect(disable).toHaveBeenCalledOnce();
  });
});
