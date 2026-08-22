import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectWow, selectWowAccounts, selectWowInstall } from "../core/wow";
import type { WowState } from "../core/types";
import { WowPage } from "./WowPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../core/wow", () => ({
  detectWow: vi.fn(),
  selectWowAccounts: vi.fn(),
  selectWowInstall: vi.fn(),
}));

const openMock = vi.mocked(open);
const detectWowMock = vi.mocked(detectWow);
const selectWowInstallMock = vi.mocked(selectWowInstall);
const selectWowAccountsMock = vi.mocked(selectWowAccounts);

const initialWow: WowState = {
  install: {
    detected: true,
    installPath: "C:/Games/World of Warcraft",
    retailPath: "C:/Games/World of Warcraft/_retail_",
    addonsPath: "C:/Games/World of Warcraft/_retail_/Interface/AddOns",
  },
  accounts: [
    {
      name: "ACCOUNT_A",
      savedVariablesPath:
        "C:/Games/World of Warcraft/_retail_/WTF/Account/ACCOUNT_A/SavedVariables/KeystoneSync.lua",
      savedVariablesExists: true,
      selected: true,
      modifiedAt: 1700000000,
    },
    {
      name: "ACCOUNT_B",
      savedVariablesPath:
        "C:/Games/World of Warcraft/_retail_/WTF/Account/ACCOUNT_B/SavedVariables/KeystoneSync.lua",
      savedVariablesExists: false,
      selected: false,
      modifiedAt: null,
    },
  ],
  selectedAccounts: ["ACCOUNT_A"],
};

describe("WowPage", () => {
  beforeEach(() => {
    openMock.mockReset();
    detectWowMock.mockReset();
    selectWowInstallMock.mockReset();
    selectWowAccountsMock.mockReset();
  });

  it("renders install state and account statuses", () => {
    render(<WowPage initialWow={initialWow} onWowChanged={vi.fn()} />);

    expect(screen.getByDisplayValue("C:/Games/World of Warcraft")).toBeInTheDocument();
    expect(screen.getByLabelText("ACCOUNT_A KeystoneSync.lua presente")).toBeChecked();
    expect(screen.getByLabelText("ACCOUNT_B KeystoneSync.lua ausente")).not.toBeChecked();
  });

  it("uses the native folder picker then calls wow.select_install", async () => {
    const user = userEvent.setup();
    const onWowChanged = vi.fn();
    openMock.mockResolvedValueOnce("D:/World of Warcraft");
    selectWowInstallMock.mockResolvedValueOnce(initialWow);

    render(<WowPage initialWow={initialWow} onWowChanged={onWowChanged} />);
    await user.click(screen.getByRole("button", { name: "Cambiar" }));

    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Selecciona World of Warcraft",
    });
    expect(selectWowInstallMock).toHaveBeenCalledWith({ path: "D:/World of Warcraft" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Carpeta de World of Warcraft guardada.",
    );
    expect(onWowChanged).toHaveBeenCalledWith(initialWow);
  });

  it("redetects, selects all, and saves selected accounts through wrappers", async () => {
    const user = userEvent.setup();
    detectWowMock.mockResolvedValueOnce(initialWow);
    selectWowAccountsMock.mockResolvedValueOnce({
      ...initialWow,
      selectedAccounts: ["ACCOUNT_A", "ACCOUNT_B"],
    });

    render(<WowPage initialWow={initialWow} onWowChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Redetectar" }));
    await user.click(screen.getByRole("button", { name: "Seleccionar todas" }));
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));

    expect(detectWowMock).toHaveBeenCalledWith();
    expect(selectWowAccountsMock).toHaveBeenCalledWith({ accounts: ["ACCOUNT_A", "ACCOUNT_B"] });
  });

  it("shows controlled errors", async () => {
    const user = userEvent.setup();
    detectWowMock.mockRejectedValueOnce({ code: "WOW_INVALID_INSTALL", message: "No valido." });

    render(<WowPage initialWow={initialWow} onWowChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Redetectar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No valido.");
  });
});
