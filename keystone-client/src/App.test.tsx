import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { login, logout } from "./core/auth";
import { coreRequest } from "./core/client";
import { listenCoreEvents } from "./core/events";
import { getSettings, updateSettings } from "./core/settings";
import { setProfileAvatar } from "./core/profile";
import {
  clearTeamsSessionCache, getTeamsSessionSnapshot, loadTeams,
} from "./core/teamsSessionCache";
import {
  exitApplication,
  listenWindowCloseRequested,
  minimizeToTray,
  minimizeWindow,
} from "./core/native";
import type { CoreEvent, SystemState } from "./core/types";
import { renderWithTheme as render } from "./test/renderWithTheme";

vi.mock("./core/client", () => ({
  coreRequest: vi.fn(),
}));

vi.mock("./core/events", () => ({
  listenCoreEvents: vi.fn(),
}));

vi.mock("./core/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("./core/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("./core/autostart", () => ({
  getAutostartEnabled: vi.fn(() => Promise.resolve(false)),
  setAutostartEnabled: vi.fn((enabled: boolean) => Promise.resolve(enabled)),
}));

vi.mock("./core/profile", () => ({
  setProfileAvatar: vi.fn(),
}));

vi.mock("./core/native", () => ({
  exitApplication: vi.fn(() => Promise.resolve()),
  listenWindowCloseRequested: vi.fn(() => Promise.resolve(() => undefined)),
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

const incompleteWow = { ...emptyWow, configurationComplete: false };

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

const emptyCharacters = {
  characters: [],
  refreshing: false,
  source: "none" as const,
  lastRefreshAt: null,
  lastError: null,
};

const coreRequestMock = vi.mocked(coreRequest);
const listenCoreEventsMock = vi.mocked(listenCoreEvents);
const loginMock = vi.mocked(login);
const logoutMock = vi.mocked(logout);
const getSettingsMock = vi.mocked(getSettings);
const updateSettingsMock = vi.mocked(updateSettings);
const exitApplicationMock = vi.mocked(exitApplication);
const listenWindowCloseRequestedMock = vi.mocked(listenWindowCloseRequested);
const minimizeToTrayMock = vi.mocked(minimizeToTray);
const minimizeWindowMock = vi.mocked(minimizeWindow);
const setProfileAvatarMock = vi.mocked(setProfileAvatar);

const anonymousState: SystemState = {
  protocolVersion: 1,
  bridge: "ready",
  auth: { authenticated: false, username: null, avatarUrl: null },
  settings: { startMinimized: false, minimizeOnClose: false, closeBehavior: "ask", lang: "es" },
  wow: emptyWow,
  sync: idleSync,
  characters: emptyCharacters,
  addon: addonStatus,
};

const authenticatedState: SystemState = {
  protocolVersion: 1,
  bridge: "ready",
  auth: { authenticated: true, username: "player", avatarUrl: null },
  settings: { startMinimized: false, minimizeOnClose: false, closeBehavior: "ask", lang: "es" },
  wow: detectedWow,
  sync: { ...idleSync, state: "success", selectedAccounts: 1 },
  characters: {
    ...emptyCharacters,
    source: "remote",
    characters: [{
      id: "eu:zuljin:auralis",
      name: "Auralis",
      realm: "Zul'jin",
      region: "eu",
      wowAccount: "ACCOUNT_A",
      wowClass: "Mage",
      avatarUrl: null,
      ilvl: 297,
      rioScore: 2250,
      currentKeystone: null,
      keystoneDisplay: "\u2014",
    }],
  },
  addon: addonStatus,
};

function mockStartup(state = anonymousState) {
  coreRequestMock.mockResolvedValueOnce(state).mockResolvedValueOnce({ pong: true });
}

describe("App", () => {
  beforeEach(() => {
    clearTeamsSessionCache();
    window.history.pushState({}, "", "/");
    coreRequestMock.mockReset();
    listenCoreEventsMock.mockReset();
    loginMock.mockReset();
    logoutMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
    exitApplicationMock.mockClear();
    listenWindowCloseRequestedMock.mockReset();
    listenWindowCloseRequestedMock.mockResolvedValue(() => undefined);
    minimizeToTrayMock.mockClear();
    minimizeWindowMock.mockClear();
    setProfileAvatarMock.mockReset();
    listenCoreEventsMock.mockResolvedValue(vi.fn());
  });

  it("renders the branded login shell and loads safe anonymous auth state", async () => {
    mockStartup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "KeystoneClient" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(coreRequestMock).toHaveBeenNthCalledWith(1, "system.get_state");
    expect(coreRequestMock).toHaveBeenNthCalledWith(2, "system.ping");
  });

  it("renders the authenticated synchronization shell", async () => {
    mockStartup(authenticatedState);

    render(<App />);

    expect(await screen.findByText("player")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizacion" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Auralis")).toBeInTheDocument();
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

  it("opens Teams as a first-class page and loads it through the bridge commands", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    coreRequestMock
      .mockResolvedValueOnce([{ id: 7, name: "Mythiqueros 2.0", memberCount: 1 }])
      .mockResolvedValueOnce({ id: 7, name: "Mythiqueros 2.0", members: [] });

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Equipos" }));

    expect(screen.getByRole("button", { name: "Equipos" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("button", { name: "Mythiqueros 2.0" })).toHaveAttribute("aria-haspopup", "listbox");
    expect(coreRequestMock).toHaveBeenNthCalledWith(3, "teams.list");
    expect(coreRequestMock).toHaveBeenNthCalledWith(4, "teams.get", { teamId: 7 });
  });

  it("prefetches the Team list and first detail before navigation and deduplicates a concurrent entry", async () => {
    const user = userEvent.setup();
    let resolveTeams!: (value: Array<{ id: number; name: string; memberCount: number }>) => void;
    let resolveDetail!: (value: { id: number; name: string; members: [] }) => void;
    mockStartup(authenticatedState);
    coreRequestMock.mockImplementation((command) => {
      if (command === "teams.list") return new Promise(resolve => { resolveTeams = resolve; });
      if (command === "teams.get") return new Promise(resolve => { resolveDetail = resolve; });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    await screen.findByText("player");
    await waitFor(() => expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.list")).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Equipos" }));
    expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.list")).toHaveLength(1);

    resolveTeams([{ id: 7, name: "Mythiqueros 2.0", memberCount: 1 }]);
    await waitFor(() => expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.get")).toHaveLength(1));
    resolveDetail({ id: 7, name: "Mythiqueros 2.0", members: [] });

    expect(await screen.findByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();
    expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.get")).toHaveLength(1);
  });

  it("clears cached private Team data immediately on logout", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    logoutMock.mockResolvedValueOnce({ authenticated: false, username: null, avatarUrl: null });
    render(<App />);
    await screen.findByText("player");
    await loadTeams({
      listTeams: vi.fn(async () => [{ id: 7, name: "Private Team", memberCount: 1 }]),
      getTeam: vi.fn(),
      getKeystoneSelector: vi.fn(),
    });
    expect(getTeamsSessionSnapshot().teams?.[0]?.name).toBe("Private Team");

    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesion" }));

    expect(getTeamsSessionSnapshot()).toEqual({ teams: null, selectedTeamId: null });
  });

  it("keeps Teams rendered without refetching when Settings opens and closes", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    getSettingsMock.mockResolvedValueOnce(authenticatedState.settings);
    coreRequestMock
      .mockResolvedValueOnce([{ id: 7, name: "Mythiqueros 2.0", memberCount: 1 }])
      .mockResolvedValueOnce({ id: 7, name: "Mythiqueros 2.0", members: [] });
    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Equipos" }));
    expect(await screen.findByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();
    const listRequests = coreRequestMock.mock.calls.filter(([command]) => command === "teams.list").length;
    const detailRequests = coreRequestMock.mock.calls.filter(([command]) => command === "teams.get").length;

    await user.click(screen.getByRole("button", { name: "Configuracion" }));
    expect(screen.getByRole("dialog", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar configuracion" }));
    expect(screen.queryByRole("dialog", { name: "Ajustes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();
    expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.list")).toHaveLength(listRequests);
    expect(coreRequestMock.mock.calls.filter(([command]) => command === "teams.get")).toHaveLength(detailRequests);
  });

  it("restores Teams immediately after navigating to another section and back", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    coreRequestMock.mockImplementation((command) => {
      if (command === "teams.list") return Promise.resolve([{ id: 7, name: "Mythiqueros 2.0", memberCount: 1 }]);
      if (command === "teams.get") return Promise.resolve({ id: 7, name: "Mythiqueros 2.0", members: [] });
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Equipos" }));
    expect(await screen.findByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Addon" }));
    expect(screen.getByRole("heading", { name: "Addon" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Equipos" }));

    expect(screen.getByRole("button", { name: "Mythiqueros 2.0" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando equipos...")).not.toBeInTheDocument();
    expect(document.querySelector(".teams-page-skeleton")).not.toBeInTheDocument();
  });

  it("returns to the existing login flow when the Teams prefetch reports an expired session", async () => {
    let rejectTeams!: (reason: unknown) => void;
    mockStartup(authenticatedState);
    coreRequestMock.mockImplementation((command) => command === "teams.list"
      ? new Promise((_, reject) => { rejectTeams = reject; })
      : Promise.reject(new Error(`Unexpected command: ${command}`)));

    render(<App />);
    await screen.findByText("player");
    rejectTeams({ code: "SESSION_EXPIRED", message: "Caducada" });

    expect(await screen.findByRole("heading", { name: /Iniciar sesi/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Equipos" })).not.toBeInTheDocument();
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

  it("routes an authenticated user with incomplete WoW setup to onboarding", async () => {
    mockStartup({
      ...authenticatedState,
      wow: incompleteWow,
    });
    coreRequestMock.mockResolvedValue(incompleteWow);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Ubicación de World of Warcraft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sincronizacion" })).not.toBeInTheDocument();
  });

  it("refreshes state after login and routes into first-run onboarding", async () => {
    const user = userEvent.setup();
    mockStartup();
    loginMock.mockResolvedValueOnce({ authenticated: true, username: "player", avatarUrl: null });
    coreRequestMock.mockResolvedValueOnce({
      ...authenticatedState,
      wow: incompleteWow,
    });
    coreRequestMock.mockResolvedValue(incompleteWow);

    render(<App />);
    await user.type(await screen.findByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contraseña"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Ubicación de World of Warcraft" })).toBeInTheDocument();
    expect(coreRequestMock).toHaveBeenCalledWith("system.get_state");
  });

  it("uses native minimize and opens a controlled close-choice modal", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(minimizeWindowMock).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    const dialog = screen.getByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" });
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Minimizar a la bandeja" }));
    expect(minimizeToTrayMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" })).not.toBeInTheDocument();
  });

  it("treats a second native close request as confirmation", async () => {
    let closeHandler: () => void = () => undefined;
    listenWindowCloseRequestedMock.mockImplementationOnce(async (handler) => {
      closeHandler = handler;
      return () => undefined;
    });
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");
    closeHandler();
    closeHandler();

    expect(exitApplicationMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" })).not.toBeInTheDocument();
  });

  it("asks again after the close dialog is cancelled", async () => {
    const user = userEvent.setup();
    let closeHandler: () => void = () => undefined;
    listenWindowCloseRequestedMock.mockImplementationOnce(async (handler) => {
      closeHandler = handler;
      return () => undefined;
    });
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");
    act(() => closeHandler());
    await screen.findByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    act(() => closeHandler());

    expect(await screen.findByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" })).toBeInTheDocument();
    expect(exitApplicationMock).not.toHaveBeenCalled();
  });

  it("remembers the selected close action", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockResolvedValueOnce({
      ...authenticatedState.settings,
      minimizeOnClose: true,
      closeBehavior: "minimize",
    });
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    const dialog = screen.getByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Recordar mi elección" }));
    await user.click(within(dialog).getByRole("button", { name: "Minimizar a la bandeja" }));

    expect(updateSettingsMock).toHaveBeenCalledWith({ closeBehavior: "minimize" });
    expect(minimizeToTrayMock).toHaveBeenCalledOnce();
  });

  it("applies a stored close action without asking", async () => {
    mockStartup({
      ...authenticatedState,
      settings: { ...authenticatedState.settings, closeBehavior: "exit" },
    });

    render(<App />);
    await screen.findByText("player");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cerrar" }));

    expect(exitApplicationMock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the same native close dialog while the login view is active", async () => {
    let closeHandler: () => void = () => undefined;
    listenWindowCloseRequestedMock.mockImplementationOnce(async (handler) => {
      closeHandler = handler;
      return () => undefined;
    });
    mockStartup();

    render(<App />);
    await screen.findByRole("heading", { name: "Iniciar sesión" });
    closeHandler();

    expect(await screen.findByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" })).toBeInTheDocument();
  });

  it("selects a real character avatar and updates the header after success", async () => {
    const user = userEvent.setup();
    const state = {
      ...authenticatedState,
      characters: {
        ...authenticatedState.characters,
        characters: [{
          ...authenticatedState.characters.characters[0],
          avatarUrl: "https://img.test/auralis.jpg",
        }],
      },
    };
    setProfileAvatarMock.mockResolvedValueOnce({
      authenticated: true,
      username: "player",
      avatarUrl: "https://img.test/auralis.jpg",
    });
    mockStartup(state);

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cambiar avatar" }));
    await user.click(screen.getByRole("button", { name: /Auralis/ }));

    expect(setProfileAvatarMock).toHaveBeenCalledWith({ avatarUrl: "https://img.test/auralis.jpg" });
    expect(document.querySelector('.ks-user-menu__avatar-image[src="https://img.test/auralis.jpg"]')).toBeInTheDocument();
  });

  it("preserves the previous avatar when the mutation fails", async () => {
    const user = userEvent.setup();
    const state = {
      ...authenticatedState,
      auth: { ...authenticatedState.auth, avatarUrl: "https://img.test/old.jpg" },
      characters: {
        ...authenticatedState.characters,
        characters: [{
          ...authenticatedState.characters.characters[0],
          avatarUrl: "https://img.test/new.jpg",
        }],
      },
    };
    setProfileAvatarMock.mockRejectedValueOnce({ code: "PROFILE_UPDATE_FAILED", message: "No guardado." });
    mockStartup(state);

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cambiar avatar" }));
    await user.click(screen.getByRole("button", { name: /Auralis/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No guardado.");
    expect(document.querySelector('.ks-user-menu__avatar-image[src="https://img.test/old.jpg"]')).toBeInTheDocument();
  });

  it("updates character rows and count from core events", async () => {
    let eventHandler: (event: CoreEvent) => void = () => undefined;
    listenCoreEventsMock.mockImplementationOnce(async (handler) => {
      eventHandler = handler;
      return () => undefined;
    });
    mockStartup(authenticatedState);

    render(<App />);
    await screen.findByText("Auralis");

    eventHandler({
      protocolVersion: 1,
      event: "characters.updated",
      data: {
        ...authenticatedState.characters,
        characters: [
          ...authenticatedState.characters.characters,
          {
            ...authenticatedState.characters.characters[0],
            id: "eu:zuljin:second",
            name: "Second",
          },
        ],
      },
    });

    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.getByLabelText("Personajes: 2")).toBeInTheDocument();
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

  it("switches the whole shell language immediately from Settings", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    getSettingsMock.mockResolvedValueOnce(authenticatedState.settings);
    updateSettingsMock.mockResolvedValueOnce({ ...authenticatedState.settings, lang: "en" });

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Configuracion" }));
    await user.click(await screen.findByRole("button", { name: "English" }));

    expect(screen.getByRole("button", { name: "Sync" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Web" })).toBeInTheDocument();
  });

  it("logs out without exposing secrets", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    logoutMock.mockResolvedValueOnce({ authenticated: false, username: null, avatarUrl: null });

    render(<App />);
    await screen.findByText("player");

    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    const logoutButton = screen.getByRole("menuitem", { name: "Cerrar sesion" });
    expect(logoutButton.querySelector("svg")).toBeInTheDocument();
    await user.click(logoutButton);

    expect(logoutMock).toHaveBeenCalledWith();
    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("returns to login before the backend finishes stopping synchronization", async () => {
    const user = userEvent.setup();
    mockStartup(authenticatedState);
    logoutMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesion" }));

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("does not let a delayed logout overwrite a newer login", async () => {
    const user = userEvent.setup();
    let finishLogout: (auth: typeof anonymousState.auth) => void = () => undefined;
    const nextAuth = { authenticated: true, username: "next-player", avatarUrl: null };
    mockStartup(authenticatedState);
    coreRequestMock.mockResolvedValueOnce({ ...authenticatedState, auth: nextAuth });
    logoutMock.mockReturnValueOnce(new Promise((resolve) => {
      finishLogout = resolve;
    }));
    loginMock.mockResolvedValueOnce(nextAuth);

    render(<App />);
    await screen.findByText("player");
    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));
    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesion" }));
    await user.type(await screen.findByLabelText("Usuario"), "next-player");
    await user.type(screen.getByLabelText("Contraseña"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("next-player")).toBeInTheDocument();
    finishLogout(anonymousState.auth);
    await waitFor(() => expect(screen.getByText("next-player")).toBeInTheDocument());
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
