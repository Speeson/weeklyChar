import { open } from "@tauri-apps/plugin-dialog";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectWow, selectWowAccounts, selectWowInstall } from "../core/wow";
import type { WowState } from "../core/types";
import { OnboardingPage } from "./OnboardingPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../core/wow", () => ({
  detectWow: vi.fn(),
  selectWowAccounts: vi.fn(),
  selectWowInstall: vi.fn(),
}));

const empty: WowState = {
  install: { detected: false, installPath: null, retailPath: null, addonsPath: null },
  accounts: [],
  selectedAccounts: [],
  configurationComplete: false,
};
const oneAccount: WowState = {
  install: { detected: true, installPath: "C:/WoW", retailPath: "C:/WoW/_retail_", addonsPath: "C:/WoW/_retail_/Interface/AddOns" },
  accounts: [{ name: "ACCOUNT_A", savedVariablesPath: "C:/one.lua", savedVariablesExists: true, selected: false, modifiedAt: null }],
  selectedAccounts: [],
  configurationComplete: false,
};
const multipleAccounts: WowState = {
  ...oneAccount,
  accounts: [
    oneAccount.accounts[0],
    { ...oneAccount.accounts[0], name: "ACCOUNT_B", savedVariablesPath: "C:/two.lua" },
  ],
};

function renderOnboarding(initialWow: WowState, onComplete = vi.fn(), preview = true) {
  render(<OnboardingPage initialWow={initialWow} onComplete={onComplete} onOpenAddon={vi.fn()} onWowChanged={vi.fn()} preview={preview} />);
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
    vi.mocked(detectWow).mockReset();
    vi.mocked(selectWowAccounts).mockReset();
    vi.mocked(selectWowInstall).mockReset();
  });

  it("blocks an invalid installation and supports native Browse/save", async () => {
    const user = userEvent.setup();
    renderOnboarding(empty);
    expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeDisabled();

    vi.mocked(open).mockResolvedValueOnce("D:/World of Warcraft");
    vi.mocked(selectWowInstall).mockResolvedValueOnce(oneAccount);
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(selectWowInstall).toHaveBeenCalledWith({ path: "D:/World of Warcraft" });
    expect(screen.getByDisplayValue("C:/WoW")).toBeInTheDocument();
  });

  it("persists the only usable account and completes", async () => {
    const onComplete = vi.fn();
    vi.mocked(selectWowAccounts).mockResolvedValueOnce({ ...oneAccount, selectedAccounts: ["ACCOUNT_A"], configurationComplete: true });
    renderOnboarding(oneAccount, onComplete, false);
    await waitFor(() => expect(selectWowAccounts).toHaveBeenCalledWith({ accounts: ["ACCOUNT_A"] }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ configurationComplete: true })));
  });

  it("shows a selector for multiple usable accounts", async () => {
    const user = userEvent.setup();
    renderOnboarding(multipleAccounts);
    expect(screen.getByLabelText("Cuentas disponibles")).toBeInTheDocument();
    await user.click(screen.getByText("ACCOUNT_B"));
    expect(screen.getByLabelText("Cuentas disponibles").querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  });

  it("renders the zero-account recovery state", () => {
    renderOnboarding({ ...oneAccount, accounts: [] });
    expect(screen.getByText("No se encontraron datos de KeystoneSync.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a Addon" })).toBeInTheDocument();
  });
});
