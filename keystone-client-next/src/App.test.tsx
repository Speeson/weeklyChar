import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { logout } from "./core/auth";
import { coreRequest } from "./core/client";
import { listenCoreEvents } from "./core/events";
import { getSettings } from "./core/settings";
import type { CoreEvent, SystemState } from "./core/types";

vi.mock("./core/client", () => ({
  coreRequest: vi.fn(),
}));

vi.mock("./core/events", () => ({
  listenCoreEvents: vi.fn(),
}));

vi.mock("./core/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("./core/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("./core/native", () => ({
  closeWindow: vi.fn(() => Promise.resolve()),
  minimizeToTray: vi.fn(() => Promise.resolve()),
  minimizeWindow: vi.fn(() => Promise.resolve()),
  openWeb: vi.fn(() => Promise.resolve()),
}));

vi.mock("./core/sync", () => ({
  forceSync: vi.fn(),
  getSyncStatus: vi.fn(() =>
    Promise.resolve({
      running: false,
      state: "idle",
      lastSyncAt: null,
      lastSuccessAt: null,
      lastError: null,
      selectedAccounts: 0,
    }),
  ),
  subscribeToSyncEvents: vi.fn(() => Promise.resolve(() => undefined)),
}));

vi.mock("./core/addon", () => ({
  checkAddon: vi.fn(),
  getAddonStatus: vi.fn(() =>
    Promise.resolve({
      installed: false,
      installedVersion: null,
      latestVersion: null,
      state: "not-installed",
      cacheAvailable: false,
      lastCheckAt: null,
      source: null,
      message: "",
      operation: null,
    }),
  ),
  installAddon: vi.fn(),
  reinstallAddon: vi.fn(),
  subscribeToAddonEvents: vi.fn(() => Promise.resolve(() => undefined)),
  updateAddon: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const emptyWow = {
  install: { detected: false, installPath: null, retailPath: null, addonsPath: null },
  accounts: [],
  selectedAccounts: [],
};

const detectedWow = {
  install: {
    detected: true,
    installPath: "C:\\Games\\World of Warcraft",
    retailPath: "C:\\Games\\World of Warcraft\\_retail_",
    addonsPath: "C:\\Games\\World of Warcraft\\_retail_\\Interface\\AddOns",
  },
  accounts: [
    {
      name: "ACCOUNT_A",
      savedVariablesPath: "C:\\Games\\World of Warcraft\\_retail_\\WTF\\Account\\ACCOUNT_A\\SavedVariables\\KeystoneSync.lua",
      savedVariablesExists: true,
      selected: true,
      modifiedAt: null,
    },
  ],
  selectedAccounts: ["ACCOUNT_A"],
};

const idleSync = {
  running: false,
  state: "idle" as const,
  lastSyncAt: null,
  lastSuccessAt: null,
  lastError: null,
  selectedAccounts: 0,
};

const addonStatus = {
  installed: false,
  installedVersion: null,
  latestVersion: null,
  state: "not-installed" as const,
  cacheAvailable: false,
  lastCheckAt: null,
  source: null,
  message: "",
  operation: null,
};

const coreRequestMock = vi.mocked(coreRequest);
const listenCoreEventsMock = vi.mocked(listenCoreEvents);
const logoutMock = vi.mocked(logout);
const getSettingsMock = vi.mocked(getSettings);

const anonymousState: SystemState = {
  protocolVersion: 1,
  bridge: "ready",
  auth: { authenticated: false, username: null, avatarUrl: null },
  settings: { startMinimized: false, minimizeOnClose: false, lang: "es" },
  wow: emptyWow,
  sync: idleSync,
  addon: addonStatus,
};

const authenticatedState: SystemState = {
  protocolVersion: 1,
  bridge: "ready",
  auth: { authenticated: true, username: "player", avatarUrl: null },
  settings: { startMinimized: false, minimizeOnClose: false, lang: "es" },
  wow: detectedWow,
  sync: { ...idleSync, state: "success", selectedAccounts: 1 },
  addon: addonStatus,
};

function mockStartup(state = anonymousState) {
  coreRequestMock.mockResolvedValueOnce(state).mockResolvedValueOnce({ pong: true });
}

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    coreRequestMock.mockReset();
    listenCoreEventsMock.mockReset();
    logoutMock.mockReset();
    getSettingsMock.mockReset();
    listenCoreEventsMock.mockResolvedValue(vi.fn());
  });

  it("renders the branded login shell and loads safe anonymous auth state", async () => {
    mockStartup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "KeystoneClient" })).toBeInTheDocument();
    expect(await screen.findByText("Bridge: ready")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Iniciar sesion" })).toBeInTheDocument();
    expect(coreRequestMock).toHaveBeenNthCalledWith(1, "system.get_state");
    expect(coreRequestMock).toHaveBeenNthCalledWith(2, "system.ping");
  });

  it("renders the authenticated synchronization shell", async () => {
    mockStartup(authenticatedState);

    render(<App />);

    expect(await screen.findByText("player")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizacion" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("ACCOUNT_A")).toBeInTheDocument();
    expect(screen.getByText("Version de la aplicacion")).toBeInTheDocument();
    expect(document.querySelector(".ks-user-menu__avatar-image")).not.toBeInTheDocument();
    expect(document.querySelector(".ks-user-menu__avatar-frame")).toBeInTheDocument();
  });

  it("opens the existing addon page from the Addon tab", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");

    await user.click(screen.getByRole("button", { name: "Addon" }));

    expect(screen.getByRole("button", { name: "Addon" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Addon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ruta de AddOns" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estado del addon" })).toBeInTheDocument();
  });

  it("updates the addon summary from core events", async () => {
    let eventHandler: (event: CoreEvent) => void = () => undefined;
    listenCoreEventsMock.mockImplementationOnce(async (handler) => {
      eventHandler = handler;
      return () => undefined;
    });
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");
    expect(screen.getByLabelText("Addon: No instalado")).toBeInTheDocument();

    eventHandler({
      protocolVersion: 1,
      event: "addon.install.progress",
      data: {
        action: "install",
        state: "installing",
        startedAt: "2026-08-22T00:00:00Z",
        finishedAt: null,
        message: "Instalando paquete validado.",
      },
    });
    expect(await screen.findByLabelText("Addon: Instalando Addon")).toHaveTextContent("Instalando paquete validado.");

    eventHandler({
      protocolVersion: 1,
      event: "addon.status.changed",
      data: {
        ...addonStatus,
        installed: true,
        installedVersion: "0.1.17",
        state: "current",
      },
    });

    expect(await screen.findByLabelText("Addon: Actualizado")).toBeInTheDocument();
  });

  it("opens settings and keeps WoW account controls reachable", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    getSettingsMock.mockResolvedValueOnce(authenticatedState.settings);

    render(<App />);
    await screen.findByText("player");

    await user.click(screen.getByRole("button", { name: "Configuracion" }));

    expect(screen.getByRole("dialog", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seleccion de cuentas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aplicacion" })).toBeInTheDocument();
  });

  it("logs out without exposing secrets", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    logoutMock.mockResolvedValueOnce({ authenticated: false, username: null, avatarUrl: null });

    render(<App />);
    await screen.findByText("player");

    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesion" }));

    expect(logoutMock).toHaveBeenCalledWith();
    expect(await screen.findByRole("heading", { name: "Iniciar sesion" })).toBeInTheDocument();
  });

  it("shows controlled startup failures", async () => {
    coreRequestMock.mockRejectedValueOnce({ code: "BRIDGE_UNHEALTHY", message: "Bridge stopped." });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Bridge stopped.");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("uses development preview state without calling the packaged core", async () => {
    window.history.pushState({}, "", "/?preview=sync-success");

    render(<App />);

    expect(await screen.findByText("Makabe")).toBeInTheDocument();
    expect(screen.getAllByText("Spee").length).toBeGreaterThan(0);
    expect(coreRequestMock).not.toHaveBeenCalled();

    window.history.pushState({}, "", "/");
  });
});
