import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "../core/settings";
import { SettingsPage } from "./SettingsPage";

vi.mock("../core/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const getSettingsMock = vi.mocked(getSettings);
const updateSettingsMock = vi.mocked(updateSettings);

const initialSettings = {
  startMinimized: false,
  minimizeOnClose: false,
  lang: "es" as const,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
  });

  it("loads settings", async () => {
    getSettingsMock.mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);

    expect(await screen.findByLabelText("Arrancar minimizado")).toBeChecked();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates settings", async () => {
    const user = userEvent.setup();
    const onSettingsChanged = vi.fn();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await screen.findByRole("button", { name: "Guardar ajustes" });
    await user.click(screen.getByLabelText("Arrancar minimizado"));
    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
    expect(onSettingsChanged).toHaveBeenLastCalledWith({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });
  });

  it("shows controlled update failures", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockRejectedValueOnce({
      code: "SETTINGS_INVALID_PAYLOAD",
      message: "No guardado.",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await screen.findByRole("button", { name: "Guardar ajustes" });
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No guardado.");
  });
});
