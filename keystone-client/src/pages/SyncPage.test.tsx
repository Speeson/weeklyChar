import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forceSync, getSyncStatus, subscribeToSyncEvents } from "../core/sync";
import { openRaiderIoCharacter } from "../core/native";
import type { AddonStatus, CharacterState, CoreEvent, SyncStatus, WowState } from "../core/types";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { SyncPage } from "./SyncPage";

vi.mock("../core/sync", () => ({
  forceSync: vi.fn(),
  getSyncStatus: vi.fn(),
  subscribeToSyncEvents: vi.fn(),
}));
vi.mock("../core/native", () => ({ openRaiderIoCharacter: vi.fn() }));

const forceSyncMock = vi.mocked(forceSync);
const getSyncStatusMock = vi.mocked(getSyncStatus);
const subscribeToSyncEventsMock = vi.mocked(subscribeToSyncEvents);
const openRaiderIoCharacterMock = vi.mocked(openRaiderIoCharacter);

const idleStatus: SyncStatus = {
  running: false,
  state: "idle",
  lastSyncAt: null,
  lastSuccessAt: null,
  lastError: null,
  selectedAccounts: 1,
};

const wowState: WowState = {
  install: { detected: true, installPath: "C:\\WoW", retailPath: "C:\\WoW\\_retail_", addonsPath: "C:\\WoW\\_retail_\\Interface\\AddOns" },
  accounts: [
    {
      name: "ACCOUNT_A",
      savedVariablesPath: "C:\\WoW\\_retail_\\WTF\\Account\\ACCOUNT_A\\SavedVariables\\KeystoneSync.lua",
      savedVariablesExists: true,
      selected: true,
      modifiedAt: null,
    },
  ],
  selectedAccounts: ["ACCOUNT_A"],
};

const addonStatus: AddonStatus = {
  installed: false,
  installedVersion: null,
  latestVersion: "0.1.17",
  state: "not-installed",
  cacheAvailable: false,
  lastCheckAt: null,
  source: "remote",
  message: "",
  operation: null,
};

const characterState: CharacterState = {
  refreshing: false,
  source: "remote",
  lastRefreshAt: "2026-08-23T12:00:00Z",
  lastError: null,
  characters: [
    { id: "low", name: "Alpha", realm: "Dun Modr", region: "eu", wowAccount: "ACCOUNT_A", wowClass: "Mage", avatarUrl: null, ilvl: 250, rioScore: 0, currentKeystone: null, keystoneDisplay: "\u2014" },
    { id: "high", name: "Zulu", realm: "Ragnaros", region: "eu", wowAccount: "ACCOUNT_A", wowClass: "Warrior", avatarUrl: "https://example.test/avatar.jpg", ilvl: 344, rioScore: 4500, currentKeystone: { level: 10, dungeon: "The Stonevault", challengeMapId: 403, mapId: null }, keystoneDisplay: "+10 Stonevault (SV)" },
  ],
};

type SyncEvent = Extract<CoreEvent, { event: `sync.${string}` }>;

describe("SyncPage", () => {
  beforeEach(() => {
    forceSyncMock.mockReset();
    getSyncStatusMock.mockReset();
    subscribeToSyncEventsMock.mockReset();
    openRaiderIoCharacterMock.mockReset().mockResolvedValue(undefined);
    getSyncStatusMock.mockResolvedValue(idleStatus);
    subscribeToSyncEventsMock.mockResolvedValue(vi.fn());
  });

  it("renders idle, watching, syncing, success and error states", () => {
    const { container, rerender } = render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={idleStatus} initialWow={wowState} preview />);
    expect(screen.getAllByText("Esperando sincronizacion")).toHaveLength(1);
    expect(container.querySelectorAll('[data-sync-state="idle"]')).toHaveLength(1);

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={{ ...idleStatus, running: true, state: "watching" }} initialWow={wowState} preview />);
    expect(screen.getAllByText("Listo para sincronizar")).toHaveLength(1);
    expect(container.querySelectorAll('[data-sync-state="watching"]')).toHaveLength(1);

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={{ ...idleStatus, state: "syncing" }} initialWow={wowState} preview />);
    expect(screen.getAllByText("Sincronizando")).toHaveLength(1);
    expect(container.querySelectorAll('[data-sync-state="syncing"]')).toHaveLength(1);

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={{ ...idleStatus, state: "success" }} initialWow={wowState} preview />);
    expect(screen.getAllByText("Sincronizacion completada")).toHaveLength(1);
    expect(container.querySelectorAll('[data-sync-state="success"]')).toHaveLength(1);

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={{ ...idleStatus, state: "error", lastError: "Fallido" }} initialWow={wowState} preview />);
    expect(screen.getAllByText("Error de sincronizacion")).toHaveLength(1);
    expect(container.querySelectorAll('[data-sync-state="error"]')).toHaveLength(1);
    expect(screen.getAllByText("Fallido").length).toBeGreaterThan(0);
  });

  it("tracks addon status in the first summary card", () => {
    const notInstalledView = render(
      <SyncPage
        appVersion="0.1.0"
        initialAddon={addonStatus}
        initialSync={idleStatus}
        initialWow={wowState}
        preview
      />,
    );
    expect(screen.getByLabelText("Addon: No instalado")).toHaveClass("sync-summary-card--error");
    notInstalledView.unmount();

    const { rerender } = render(
      <SyncPage
        appVersion="0.1.0"
        initialAddon={{ ...addonStatus, installed: true, installedVersion: "0.1.17", state: "current" }}
        initialSync={idleStatus}
        initialWow={wowState}
        preview
      />,
    );
    expect(screen.getByLabelText("Addon: Actualizado")).toHaveTextContent("Version 0.1.17 instalada");

    rerender(
      <SyncPage
        appVersion="0.1.0"
        initialAddon={{ ...addonStatus, installed: true, installedVersion: "0.1.16", state: "update-available" }}
        initialSync={idleStatus}
        initialWow={wowState}
        preview
      />,
    );
    expect(screen.getByLabelText("Addon: Actualización disponible")).toHaveTextContent("Version 0.1.17 disponible");
    expect(screen.getByLabelText("Addon: Actualización disponible")).toHaveClass("sync-summary-card--warning");
  });

  it("renders real characters and reports a character count independent from accounts", () => {
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={characterState} initialSync={idleStatus} initialWow={wowState} />);

    expect(screen.getByText("Zulu")).toHaveStyle({ color: "#C69B3A" });
    expect(screen.getByText("Alpha")).toHaveStyle({ color: "#3FC7EB" });
    expect(screen.getByText("4500")).toHaveStyle({ color: "#FF9100" });
    expect(screen.getByText("0")).toHaveStyle({ color: "#00C800" });
    expect(screen.getByLabelText("Personajes: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Cuentas: 1")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Piedra Angular" })).toBeInTheDocument();
    expect(screen.getByText("Version de la aplicacion")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Detectados")).toBeInTheDocument();
  });

  it("sorts by Raider.IO descending by default and toggles headers", async () => {
    const user = userEvent.setup();
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={characterState} initialSync={idleStatus} initialWow={wowState} />);

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Zulu");
    await user.click(screen.getByRole("button", { name: /Nombre/ }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Alpha");
    await user.click(screen.getByRole("button", { name: /Nombre/ }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Zulu");
  });

  it("keeps more than eight rows inside the scrollable body with sorting and row actions", async () => {
    const user = userEvent.setup();
    const characters = Array.from({ length: 12 }, (_, index) => ({
      ...characterState.characters[0],
      id: `character-${index}`,
      name: `Character ${String(index).padStart(2, "0")}`,
      rioScore: index * 100,
    }));
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={{ ...characterState, characters }} initialSync={idleStatus} initialWow={wowState} />);

    const body = screen.getByRole("rowgroup");
    expect(body).toHaveClass("sync-table__body");
    expect(within(body).getAllByRole("row")).toHaveLength(12);
    expect(within(body).getAllByRole("row")[0]).toHaveTextContent("Character 11");

    await user.click(screen.getByRole("button", { name: /Nombre/ }));
    expect(within(body).getAllByRole("row")[0]).toHaveTextContent("Character 00");
    await user.click(within(body).getByRole("row", { name: "Abrir Character 11 en Raider.IO" }));
    expect(openRaiderIoCharacterMock).toHaveBeenCalledWith("eu", "Dun Modr", "Character 11");
  });

  it("opens a row through the scoped native Raider.IO command", async () => {
    const user = userEvent.setup();
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={characterState} initialSync={idleStatus} initialWow={wowState} />);

    await user.click(screen.getByRole("row", { name: "Abrir Zulu en Raider.IO" }));
    expect(openRaiderIoCharacterMock).toHaveBeenCalledWith("eu", "Ragnaros", "Zulu");
  });

  it("replaces a failed remote avatar with the class-colored initial", () => {
    const { container } = render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={characterState} initialSync={idleStatus} initialWow={wowState} />);
    const avatar = container.querySelector('img[src="https://example.test/avatar.jpg"]');
    expect(avatar).toBeInTheDocument();
    fireEvent.error(avatar!);
    expect(container.querySelector('img[src="https://example.test/avatar.jpg"]')).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: "Abrir Zulu en Raider.IO" }).querySelector(".sync-avatar")).toHaveTextContent("Z");
  });

  it("shows controlled loading, empty and refresh error states", () => {
    const { rerender } = render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={{ ...characterState, characters: [], refreshing: true }} initialSync={idleStatus} initialWow={wowState} />);
    expect(screen.getByText("Cargando personajes...")).toBeInTheDocument();

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={{ ...characterState, characters: [], refreshing: false }} initialSync={idleStatus} initialWow={wowState} />);
    expect(screen.getByText("No hay personajes sincronizados.")).toBeInTheDocument();

    rerender(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialCharacters={{ ...characterState, characters: [], refreshing: false, lastError: "No se pudieron actualizar los personajes." }} initialSync={idleStatus} initialWow={wowState} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron actualizar los personajes.");
  });

  it("calls force sync through the existing wrapper", async () => {
    const user = userEvent.setup();
    forceSyncMock.mockResolvedValueOnce({ ...idleStatus, state: "syncing" });

    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={idleStatus} initialWow={wowState} />);

    await user.click(screen.getByRole("button", { name: "Sincronizar ahora" }));

    expect(forceSyncMock).toHaveBeenCalledWith();
  });

  it("updates from sync events and shows command errors", async () => {
    const user = userEvent.setup();
    let eventHandler: (event: SyncEvent) => void = () => undefined;
    subscribeToSyncEventsMock.mockImplementationOnce(async (handler) => {
      eventHandler = handler;
      return () => undefined;
    });
    getSyncStatusMock.mockResolvedValueOnce(idleStatus);
    forceSyncMock.mockRejectedValueOnce({
      code: "SYNC_NOT_AUTHENTICATED",
      message: "Sign in before syncing.",
    });

    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={idleStatus} initialWow={wowState} />);
    eventHandler({
      protocolVersion: 1,
      event: "sync.completed",
      data: { status: { ...idleStatus, state: "success" }, syncedCharacters: 2 },
    });
    expect(await screen.findByText("2 personajes sincronizados.")).toBeInTheDocument();

    eventHandler({
      protocolVersion: 1,
      event: "sync.error",
      data: { code: "SYNC_NETWORK_ERROR", message: "Network failed." },
    });
    eventHandler({
      protocolVersion: 1,
      event: "sync.status",
      data: { ...idleStatus, state: "error", lastError: "Network failed." },
    });
    expect(await screen.findByLabelText("Estado actual: Error de sincronizacion")).toHaveTextContent("Network failed.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in before syncing.");
  });

  it("disables force when no selected account exists", () => {
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={{ ...idleStatus, selectedAccounts: 0 }} initialWow={wowState} />);

    expect(screen.getByRole("button", { name: "Sincronizar ahora" })).toBeDisabled();
  });
});
