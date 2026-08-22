import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAddon,
  getAddonStatus,
  installAddon,
  reinstallAddon,
  subscribeToAddonEvents,
  updateAddon,
} from "../core/addon";
import type { AddonStatus, CoreEvent, WowState } from "../core/types";
import { selectWowInstall } from "../core/wow";
import { AddonPage } from "./AddonPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
}));

vi.mock("../core/addon", () => ({
  checkAddon: vi.fn(),
  getAddonStatus: vi.fn(),
  installAddon: vi.fn(),
  reinstallAddon: vi.fn(),
  subscribeToAddonEvents: vi.fn(),
  updateAddon: vi.fn(),
}));

vi.mock("../core/wow", () => ({
  selectWowInstall: vi.fn(),
}));

const checkAddonMock = vi.mocked(checkAddon);
const getAddonStatusMock = vi.mocked(getAddonStatus);
const installAddonMock = vi.mocked(installAddon);
const updateAddonMock = vi.mocked(updateAddon);
const reinstallAddonMock = vi.mocked(reinstallAddon);
const subscribeToAddonEventsMock = vi.mocked(subscribeToAddonEvents);
const selectWowInstallMock = vi.mocked(selectWowInstall);
const openMock = vi.mocked(open);
const openPathMock = vi.mocked(openPath);

const baseStatus: AddonStatus = {
  installed: false,
  installedVersion: null,
  latestVersion: "0.1.17",
  state: "not-installed",
  cacheAvailable: false,
  lastCheckAt: null,
  source: "remote",
  message: "Addon install is available.",
  operation: null,
};

const initialWow: WowState = {
  install: {
    detected: true,
    installPath: "C:\\Games\\World of Warcraft",
    retailPath: "C:\\Games\\World of Warcraft\\_retail_",
    addonsPath: "C:\\Games\\World of Warcraft\\_retail_\\Interface\\AddOns",
  },
  accounts: [],
  selectedAccounts: [],
};

type AddonEvent = Extract<CoreEvent, { event: `addon.${string}` }>;

function renderAddon(
  initialAddon: AddonStatus = baseStatus,
  onWowChanged = vi.fn(),
  preview = true,
) {
  return render(
    <AddonPage
      initialAddon={initialAddon}
      initialWow={initialWow}
      onWowChanged={onWowChanged}
      preview={preview}
    />,
  );
}

describe("AddonPage", () => {
  beforeEach(() => {
    checkAddonMock.mockReset();
    getAddonStatusMock.mockReset();
    installAddonMock.mockReset();
    updateAddonMock.mockReset();
    reinstallAddonMock.mockReset();
    subscribeToAddonEventsMock.mockReset();
    selectWowInstallMock.mockReset();
    openMock.mockReset();
    openPathMock.mockReset();
    getAddonStatusMock.mockResolvedValue(baseStatus);
    subscribeToAddonEventsMock.mockResolvedValue(vi.fn());
    openPathMock.mockResolvedValue(undefined);
  });

  it("renders the approved content for functional addon states", () => {
    const { rerender } = renderAddon();

    expect(screen.getByRole("heading", { name: "Addon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ruta de AddOns" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estado del addon" })).toBeInTheDocument();
    expect(screen.getByText("Instalación disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar KeystoneSync" })).toBeInTheDocument();

    rerender(
      <AddonPage
        initialAddon={{ ...baseStatus, installed: true, installedVersion: "0.1.17", state: "current" }}
        initialWow={initialWow}
        onWowChanged={vi.fn()}
        preview
      />,
    );
    expect(screen.getByText("Actualizado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reinstalar KeystoneSync" })).toBeInTheDocument();

    rerender(
      <AddonPage
        initialAddon={{ ...baseStatus, installed: true, installedVersion: "0.1.16", state: "update-available" }}
        initialWow={initialWow}
        onWowChanged={vi.fn()}
        preview
      />,
    );
    expect(screen.getByText("Actualización disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar KeystoneSync" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reinstalar KeystoneSync" })).toBeInTheDocument();
  });

  it("calls only typed addon wrappers for user actions", async () => {
    const user = userEvent.setup();
    checkAddonMock.mockResolvedValueOnce(baseStatus);
    installAddonMock.mockResolvedValueOnce({
      ...baseStatus,
      operation: {
        action: "install",
        state: "starting",
        startedAt: "2026-08-22T00:00:00Z",
        finishedAt: null,
        message: "Starting addon operation.",
      },
    });

    renderAddon();
    await user.click(screen.getByRole("button", { name: "Buscar actualizaciones" }));
    await user.click(screen.getByRole("button", { name: "Instalar KeystoneSync" }));

    expect(checkAddonMock).toHaveBeenCalledWith();
    expect(installAddonMock).toHaveBeenCalledWith();
  });

  it("validates a selected AddOns path through wow.select_install", async () => {
    const user = userEvent.setup();
    const onWowChanged = vi.fn();
    const selectedWow = {
      ...initialWow,
      install: {
        ...initialWow.install,
        installPath: "D:\\World of Warcraft",
        addonsPath: "D:\\World of Warcraft\\_retail_\\Interface\\AddOns",
      },
    };
    openMock.mockResolvedValueOnce("D:\\World of Warcraft\\_retail_\\Interface\\AddOns");
    selectWowInstallMock.mockResolvedValueOnce(selectedWow);

    renderAddon(baseStatus, onWowChanged);
    await user.click(screen.getByRole("button", { name: "Seleccionar carpeta de AddOns" }));

    expect(selectWowInstallMock).toHaveBeenCalledWith({
      path: "D:\\World of Warcraft\\_retail_\\Interface\\AddOns",
    });
    expect(onWowChanged).toHaveBeenCalledWith(selectedWow);
    expect(await screen.findByText("Carpeta de AddOns actualizada.")).toBeInTheDocument();
  });

  it("opens the installed addon directory", async () => {
    const user = userEvent.setup();
    renderAddon({ ...baseStatus, installed: true, installedVersion: "0.1.17", state: "current" });

    await user.click(screen.getByRole("button", { name: "Abrir carpeta del addon" }));

    expect(openPathMock).toHaveBeenCalledWith(
      "C:\\Games\\World of Warcraft\\_retail_\\Interface\\AddOns\\KeystoneSync",
    );
  });

  it("updates from addon events and displays safe errors", async () => {
    let eventHandler: (event: AddonEvent) => void = () => undefined;
    subscribeToAddonEventsMock.mockImplementationOnce(async (handler) => {
      eventHandler = handler;
      return () => undefined;
    });

    renderAddon(baseStatus, vi.fn(), false);
    act(() => {
      eventHandler({
        protocolVersion: 1,
        event: "addon.install.progress",
        data: {
          action: "install",
          state: "installing",
          startedAt: "2026-08-22T00:00:00Z",
          finishedAt: null,
          message: "Installing validated addon package.",
        },
      });
    });
    expect(await screen.findAllByText("Installing validated addon package.")).toHaveLength(2);

    act(() => {
      eventHandler({
        protocolVersion: 1,
        event: "addon.install.failed",
        data: {
          operation: {
            action: "install",
            state: "failed",
            startedAt: "2026-08-22T00:00:00Z",
            finishedAt: "2026-08-22T00:00:01Z",
            message: "No valid addon release or cache is available.",
          },
          error: {
            code: "ADDON_INSTALL_FAILED",
            message: "No valid addon release or cache is available.",
          },
        },
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("No valid addon release or cache is available.");
  });
});
