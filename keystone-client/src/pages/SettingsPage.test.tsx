import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "../core/settings";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { SettingsPage } from "./SettingsPage";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import type { ClientSettings } from "../core/types";

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
  closeBehavior: "ask" as const,
  lang: "es" as const,
};

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

  it("renders the canonical selectable themes in Settings", () => {
    render(
      <SettingsPage
        appVersion="0.4.1"
        initialSettings={initialSettings}
        onSettingsChanged={vi.fn()}
        preview
      />,
    );

    const selector = screen.getByRole("combobox", { name: "Tema visual" });
    expect(selector).toHaveValue("keystone");
    expect(Array.from(selector.querySelectorAll("option")).map((option) => option.textContent)).toEqual([
      "Keystone",
      "Poison",
      "Void",
    ]);
  });

  it("loads settings", async () => {
    getSettingsMock.mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
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
      startMinimized: false,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "en",
    }).mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "en",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await screen.findByRole("button", { name: "Guardar ajustes" });
    await user.click(screen.getByLabelText("Arrancar minimizado"));
    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(updateSettingsMock).toHaveBeenNthCalledWith(1, { lang: "en" });
    expect(updateSettingsMock).toHaveBeenNthCalledWith(2, {
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "en",
    });
    expect(setAutostartEnabledMock).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
    expect(onSettingsChanged).toHaveBeenLastCalledWith({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      lang: "en",
    });
  });

  it("edits the close behavior preference", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockResolvedValueOnce({ ...initialSettings, closeBehavior: "exit" });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.selectOptions(await screen.findByLabelText("Al cerrar la ventana"), "exit");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ ...initialSettings, closeBehavior: "exit" });
  });

  it("persists language immediately without saving unrelated drafts", async () => {
    const user = userEvent.setup();
    const onSettingsChanged = vi.fn();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockResolvedValueOnce({ ...initialSettings, lang: "en" });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await user.click(await screen.findByLabelText("Arrancar minimizado"));
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ lang: "en" });
    expect(await screen.findByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Arrancar minimizado")).toBeChecked();
    expect(onSettingsChanged).toHaveBeenLastCalledWith({ ...initialSettings, lang: "en" });
  });

  it("reverts language and reports a controlled persistence failure", async () => {
    const user = userEvent.setup();
    const onSettingsChanged = vi.fn();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockRejectedValueOnce(new Error("disk failed"));

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await user.click(await screen.findByRole("button", { name: "English" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk failed");
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    expect(onSettingsChanged).toHaveBeenLastCalledWith(initialSettings);
  });

  it("serializes rapid language writes so the final selection wins", async () => {
    const user = userEvent.setup();
    const onSettingsChanged = vi.fn();
    let resolveEnglish!: (value: ClientSettings) => void;
    const english = new Promise<ClientSettings>(resolve => { resolveEnglish = resolve; });
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock
      .mockReturnValueOnce(english)
      .mockResolvedValueOnce(initialSettings);

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await screen.findByRole("button", { name: "English" });
    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "Español" }));
    expect(updateSettingsMock).toHaveBeenCalledTimes(1);

    resolveEnglish({ ...initialSettings, lang: "en" });
    expect(await screen.findByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() => expect(updateSettingsMock).toHaveBeenNthCalledWith(2, { lang: "es" }));
    expect(onSettingsChanged).toHaveBeenLastCalledWith(initialSettings);
  });

  it("ignores a stale initial settings response but still loads native autostart", async () => {
    const user = userEvent.setup();
    let resolveInitial!: (value: ClientSettings) => void;
    getSettingsMock.mockReturnValueOnce(new Promise(resolve => { resolveInitial = resolve; }));
    getAutostartEnabledMock.mockResolvedValueOnce(true);
    updateSettingsMock.mockResolvedValueOnce({ ...initialSettings, lang: "en" });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "English" }));
    resolveInitial({ ...initialSettings, startMinimized: true, lang: "es" });

    expect(await screen.findByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Arrancar con Windows")).toBeChecked();
    expect(screen.getByLabelText("Arrancar minimizado")).not.toBeChecked();
  });

  it("keeps the persisted language after Settings is reopened", async () => {
    const user = userEvent.setup();
    const onSettingsChanged = vi.fn();
    getSettingsMock.mockResolvedValueOnce(initialSettings).mockResolvedValueOnce({ ...initialSettings, lang: "en" });
    updateSettingsMock.mockResolvedValueOnce({ ...initialSettings, lang: "en" });
    const first = render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={onSettingsChanged} />);
    await user.click(await screen.findByRole("button", { name: "English" }));
    await vi.waitFor(() => expect(onSettingsChanged).toHaveBeenLastCalledWith({ ...initialSettings, lang: "en" }));
    first.unmount();

    render(<SettingsPage appVersion="0.1.0" initialSettings={{ ...initialSettings, lang: "en" }} onSettingsChanged={onSettingsChanged} />);
    expect(await screen.findByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(onSettingsChanged).toHaveBeenLastCalledWith({ ...initialSettings, lang: "en" });
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
