import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "../core/settings";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { SettingsPage } from "./SettingsPage";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import {
  beginOverlayShortcutCapture,
  configureOverlayShortcut,
  endOverlayShortcutCapture,
  getOverlayShortcutStatus,
  validateOverlayShortcut,
} from "../core/native";
import type { ClientSettings } from "../core/types";

vi.mock("../core/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../core/autostart", () => ({
  getAutostartEnabled: vi.fn(),
  setAutostartEnabled: vi.fn(),
}));

vi.mock("../core/native", () => ({
  beginOverlayShortcutCapture: vi.fn(),
  configureOverlayShortcut: vi.fn(),
  endOverlayShortcutCapture: vi.fn(),
  getOverlayShortcutStatus: vi.fn(),
  validateOverlayShortcut: vi.fn(),
}));

const getSettingsMock = vi.mocked(getSettings);
const updateSettingsMock = vi.mocked(updateSettings);
const getAutostartEnabledMock = vi.mocked(getAutostartEnabled);
const setAutostartEnabledMock = vi.mocked(setAutostartEnabled);
const configureOverlayShortcutMock = vi.mocked(configureOverlayShortcut);
const getOverlayShortcutStatusMock = vi.mocked(getOverlayShortcutStatus);
const beginOverlayShortcutCaptureMock = vi.mocked(beginOverlayShortcutCapture);
const endOverlayShortcutCaptureMock = vi.mocked(endOverlayShortcutCapture);
const validateOverlayShortcutMock = vi.mocked(validateOverlayShortcut);

const initialSettings = {
  startMinimized: false,
  minimizeOnClose: false,
  closeBehavior: "ask" as const,
  overlayEnabled: false,
  overlayShortcut: "Ctrl+Shift+K",
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
    configureOverlayShortcutMock.mockReset();
    getOverlayShortcutStatusMock.mockReset();
    beginOverlayShortcutCaptureMock.mockReset();
    endOverlayShortcutCaptureMock.mockReset();
    validateOverlayShortcutMock.mockReset();
    getAutostartEnabledMock.mockResolvedValue(false);
    setAutostartEnabledMock.mockImplementation(async (enabled) => enabled);
    configureOverlayShortcutMock.mockImplementation(async (enabled, shortcut) => ({
      enabled,
      shortcut,
      registered: enabled,
      lastError: null,
    }));
    getOverlayShortcutStatusMock.mockResolvedValue({
      enabled: false,
      shortcut: "Ctrl+Shift+K",
      registered: false,
      lastError: null,
    });
    beginOverlayShortcutCaptureMock.mockResolvedValue();
    endOverlayShortcutCaptureMock.mockResolvedValue();
    validateOverlayShortcutMock.mockResolvedValue();
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
      overlayEnabled: false,
      overlayShortcut: "Ctrl+Shift+K",
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
      overlayEnabled: false,
      overlayShortcut: "Ctrl+Shift+K",
      lang: "en",
    }).mockResolvedValueOnce({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      overlayEnabled: false,
      overlayShortcut: "Ctrl+Shift+K",
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
      overlayEnabled: false,
      overlayShortcut: "Ctrl+Shift+K",
      lang: "en",
    });
    expect(setAutostartEnabledMock).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
    expect(onSettingsChanged).toHaveBeenLastCalledWith({
      startMinimized: true,
      minimizeOnClose: false,
      closeBehavior: "ask",
      overlayEnabled: false,
      overlayShortcut: "Ctrl+Shift+K",
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

  it("saves the optional window proportion lock", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockResolvedValueOnce({ ...initialSettings, lockWindowAspectRatio: true });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    const checkbox = await screen.findByLabelText("Bloquear proporción al cambiar el tamaño");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ ...initialSettings, lockWindowAspectRatio: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
  });

  it("captures, registers, and persists an enabled overlay shortcut", async () => {
    const user = userEvent.setup();
    const saved = {
      ...initialSettings,
      overlayEnabled: true,
      overlayShortcut: "Ctrl+Shift+KeyM",
    };
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockResolvedValueOnce(saved);

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.click(await screen.findByLabelText("Activar overlay"));
    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M", ctrlKey: true, shiftKey: true });
    await vi.waitFor(() => expect(validateOverlayShortcutMock).toHaveBeenCalledWith("Ctrl+Shift+KeyM"));
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(beginOverlayShortcutCaptureMock).toHaveBeenCalledOnce();
    expect(endOverlayShortcutCaptureMock).toHaveBeenCalledOnce();
    expect(configureOverlayShortcutMock).toHaveBeenCalledWith(true, "Ctrl+Shift+KeyM");
    expect(updateSettingsMock).toHaveBeenCalledWith(saved);
    expect(await screen.findByRole("status")).toHaveTextContent("Ajustes guardados.");
  });

  it("restores the default overlay shortcut before saving", async () => {
    const user = userEvent.setup();
    const customSettings = { ...initialSettings, overlayShortcut: "Ctrl+Shift+KeyM" };
    getSettingsMock.mockResolvedValueOnce(customSettings);
    updateSettingsMock.mockResolvedValueOnce(initialSettings);

    render(<SettingsPage appVersion="0.1.0" initialSettings={customSettings} onSettingsChanged={vi.fn()} />);
    await screen.findByRole("button", { name: "Atajo del overlay: Ctrl + Shift + M" });
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(configureOverlayShortcutMock).toHaveBeenCalledWith(false, "Ctrl+Shift+K");
    expect(updateSettingsMock).toHaveBeenCalledWith(initialSettings);
  });

  it("keeps the working shortcut when native registration rejects a conflict", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    configureOverlayShortcutMock.mockRejectedValueOnce("Shortcut already registered");

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.click(await screen.findByLabelText("Activar overlay"));
    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyJ", key: "J", ctrlKey: true, shiftKey: true });
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Shortcut already registered");
    expect(screen.queryByText(/Haz clic y pulsa una combinación/)).not.toBeInTheDocument();
    expect(updateSettingsMock).not.toHaveBeenCalled();
    expect(configureOverlayShortcutMock).toHaveBeenCalledTimes(1);
  });

  it("reports a shortcut conflict during capture without waiting for save", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce({ ...initialSettings, overlayEnabled: true });
    validateOverlayShortcutMock.mockRejectedValueOnce("Shortcut already registered");

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    const recorder = await screen.findByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyJ", key: "J", ctrlKey: true, shiftKey: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("Shortcut already registered");
    expect(recorder).toHaveAttribute("aria-pressed", "true");
    expect(beginOverlayShortcutCaptureMock).toHaveBeenCalledOnce();
    expect(endOverlayShortcutCaptureMock).not.toHaveBeenCalled();
    expect(configureOverlayShortcutMock).not.toHaveBeenCalled();
    expect(updateSettingsMock).not.toHaveBeenCalled();

    fireEvent.keyDown(recorder, { code: "Escape", key: "Escape" });
    await vi.waitFor(() => expect(endOverlayShortcutCaptureMock).toHaveBeenCalledOnce());
  });

  it("rolls the native overlay binding back when local persistence fails", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockResolvedValueOnce(initialSettings);
    updateSettingsMock.mockRejectedValueOnce(new Error("disk failed"));

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);
    await user.click(await screen.findByLabelText("Activar overlay"));
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk failed");
    expect(configureOverlayShortcutMock).toHaveBeenNthCalledWith(1, true, "Ctrl+Shift+K");
    expect(configureOverlayShortcutMock).toHaveBeenNthCalledWith(2, false, "Ctrl+Shift+K");
  });

  it("shows a registration error detected during native startup", async () => {
    getSettingsMock.mockResolvedValueOnce({ ...initialSettings, overlayEnabled: true });
    getOverlayShortcutStatusMock.mockResolvedValueOnce({
      enabled: true,
      shortcut: "Ctrl+Shift+K",
      registered: false,
      lastError: "Shortcut is already in use",
    });

    render(<SettingsPage appVersion="0.1.0" initialSettings={initialSettings} onSettingsChanged={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Shortcut is already in use");
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
