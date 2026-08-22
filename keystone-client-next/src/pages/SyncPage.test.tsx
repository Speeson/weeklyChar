import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forceSync, getSyncStatus, subscribeToSyncEvents } from "../core/sync";
import type { AddonStatus, CoreEvent, SyncStatus, WowState } from "../core/types";
import { SyncPage } from "./SyncPage";

vi.mock("../core/sync", () => ({
  forceSync: vi.fn(),
  getSyncStatus: vi.fn(),
  subscribeToSyncEvents: vi.fn(),
}));

const forceSyncMock = vi.mocked(forceSync);
const getSyncStatusMock = vi.mocked(getSyncStatus);
const subscribeToSyncEventsMock = vi.mocked(subscribeToSyncEvents);

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

type SyncEvent = Extract<CoreEvent, { event: `sync.${string}` }>;

describe("SyncPage", () => {
  beforeEach(() => {
    forceSyncMock.mockReset();
    getSyncStatusMock.mockReset();
    subscribeToSyncEventsMock.mockReset();
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
    expect(screen.getByLabelText("Addon: Actualizacion disponible")).toHaveTextContent("Version 0.1.17 disponible");
    expect(screen.getByLabelText("Addon: Actualizacion disponible")).toHaveClass("sync-summary-card--warning");
  });

  it("renders real account rows with unavailable character fields as dashes", () => {
    render(<SyncPage appVersion="0.1.0" initialAddon={addonStatus} initialSync={idleStatus} initialWow={wowState} />);

    expect(screen.getByText("ACCOUNT_A")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Piedra Angular" })).toBeInTheDocument();
    expect(screen.getByText("Version de la aplicacion")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Detectados")).toBeInTheDocument();
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
