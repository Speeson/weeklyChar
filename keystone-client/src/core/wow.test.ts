import { describe, expect, it, vi, beforeEach } from "vitest";
import { coreRequest } from "./client";
import { detectWow, listWowAccounts, selectWowAccounts, selectWowInstall } from "./wow";

vi.mock("./client", () => ({
  coreRequest: vi.fn(),
}));

const coreRequestMock = vi.mocked(coreRequest);

describe("wow wrappers", () => {
  beforeEach(() => {
    coreRequestMock.mockReset();
  });

  it("calls wow.detect", async () => {
    coreRequestMock.mockResolvedValueOnce({ accounts: [] });

    await detectWow();

    expect(coreRequestMock).toHaveBeenCalledWith("wow.detect");
  });

  it("calls wow.list_accounts", async () => {
    coreRequestMock.mockResolvedValueOnce({ accounts: [] });

    await listWowAccounts();

    expect(coreRequestMock).toHaveBeenCalledWith("wow.list_accounts");
  });

  it("calls wow.select_install with a validated payload shape", async () => {
    const payload = { path: "C:/Games/World of Warcraft" };
    coreRequestMock.mockResolvedValueOnce({ accounts: [] });

    await selectWowInstall(payload);

    expect(coreRequestMock).toHaveBeenCalledWith("wow.select_install", payload);
  });

  it("calls wow.select_accounts with selected account names", async () => {
    const payload = { accounts: ["ACCOUNT_A", "ACCOUNT_B"] };
    coreRequestMock.mockResolvedValueOnce({ accounts: [] });

    await selectWowAccounts(payload);

    expect(coreRequestMock).toHaveBeenCalledWith("wow.select_accounts", payload);
  });
});
