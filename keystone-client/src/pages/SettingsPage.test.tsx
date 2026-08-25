import { render as testingLibraryRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "../core/settings";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { SettingsPage } from "./SettingsPage";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import { ThemeProvider } from "../theme/ThemeProvider";
import { THEME_STORAGE_KEY, type ThemeDefinition } from "../theme/theme.types";

vi.mock("../core/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../core/autostart", () => ({
  getAutostartEnabled: vi.fn(),
  setAutostartEnabled: vi.fn(),
}));

const getSettingsMock = vi.mocked(getSettings);
const updateSettingsMock = vi.mocked(updateSettings);
const getAutostartEnabledMock = vi.mocked(getAutostartEnabled);
const setAutostartEnabledMock = vi.mocked(setAutostartEnabled);

const initialSettings = {
  startMinimized: false,
  minimizeOnClose: false,
  lang: "es" as const,
};

const selectableThemes: readonly ThemeDefinition[] = [
  {
    id: "keystone",
    label: "Keystone",
    description: "Keystone theme",
    selectable: true,
  },
  {
    id: "poison",
    label: "Poison",
    description: "Poison theme",
    selectable: true,
  },
];

function renderSettingsWithSelectableThemes() {
  return testingLibraryRender(
    <ThemeProvider themes={selectableThemes}>
      <SettingsPage
        appVersion="0.4.1"
        initialSettings={initialSettings}
        onSettingsChanged={vi.fn()}
        preview
      />
    </ThemeProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
    getAutostartEnabledMock.mockReset();
    setAutostartEnabledMock.mockReset();
    getAutostartEnabledMock.mockResolvedValue(false);
    setAutostartEnabledMock.mockImplementation(async (enabled) => enabled);
  });

  it("hides unfinished Poison and the one-option theme control", () => {
    render(
      <SettingsPage
        appVersion="0.4.1"
        initialSettings={initialSettings}
        onSettingsChanged={vi.fn()}
        preview
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Tema visual" })).not.toBeInTheDocument();
    expect(screen.queryByText("Poison")).not.toBeInTheDocument();
  });

  it("applies, persists, and restores a selectable theme when Settings is reopened", async () => {
    const user = userEvent.setup();
    const firstView = renderSettingsWithSelectableThemes();
    const selector = screen.getByRole("combobox", { name: "Tema visual" });

    expect(selector).toHaveValue("keystone");
    await user.selectOptions(selector, "poison");
    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("poison");

    firstView.unmount();
    renderSettingsWithSelectableThemes();
    expect(screen.getByRole("combobox", { name: "Tema visual" })).toHaveValue("poison");
  });

  it("loads settings", async () => {
    getSettingsMock.mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);

    expect(await screen.findByLabelText("Arrancar minimizado")).toBeChecked();
    expect(screen.getByLabelText("Arrancar con Windows")).not.toBeChecked();
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
    expect(setAutostartEnabledMock).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
    expect(onSettingsChanged).toHaveBeenLastCalledWith({
      startMinimized: true,
      minimizeOnClose: false,
      lang: "en",
    });
  });

  it("updates real autostart and rolls the control back on failure", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    getAutostartEnabledMock.mockResolvedValueOnce(false);
    setAutostartEnabledMock.mockRejectedValueOnce(new Error("Windows rejected autostart")).mockResolvedValueOnce(false);

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.click(await screen.findByLabelText("Arrancar con Windows"));
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Windows rejected autostart");
    expect(screen.getByLabelText("Arrancar con Windows")).not.toBeChecked();
    expect(updateSettingsMock).not.toHaveBeenCalled();
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

  it("exposes manual update and release actions", async () => {
    const user = userEvent.setup();
    const onCheckUpdates = vi.fn();
    const onOpenUpdate = vi.fn();
    const onOpenReleases = vi.fn();
    getSettingsMock.mockResolvedValueOnce(initialSettings);

    render(
      <SettingsPage
        appVersion="0.3.0"
        initialSettings={initialSettings}
        onCheckUpdates={onCheckUpdates}
        onOpenReleases={onOpenReleases}
        onOpenUpdate={onOpenUpdate}
        onSettingsChanged={vi.fn()}
        updater={{
          status: "available",
          currentVersion: "0.3.0",
          availableVersion: "0.4.0",
          notes: "Novedades",
          releaseDate: null,
          downloadedBytes: 0,
          totalBytes: null,
          lastCheckedAt: "2026-08-23T12:00:00Z",
          error: null,
        }}
      />,
    );

    expect(await screen.findByText("Version 0.4.0 disponible")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await user.click(screen.getByRole("button", { name: "Ver releases" }));
    await user.click(screen.getByRole("button", { name: "Buscar actualizaciones" }));
    expect(onOpenUpdate).toHaveBeenCalledOnce();
    expect(onOpenReleases).toHaveBeenCalledOnce();
    expect(onCheckUpdates).toHaveBeenCalledOnce();
  });
});
