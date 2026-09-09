import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { cancelBattleNetLogin, login, logout, pollBattleNetLogin, register, startBattleNetLogin } from "./auth";

vi.mock("./client", () => ({
  coreRequest: vi.fn(),
}));

const coreRequestMock = vi.mocked(coreRequest);

describe("auth wrappers", () => {
  beforeEach(() => {
    coreRequestMock.mockReset();
  });

  it("calls auth.login with credentials", async () => {
    coreRequestMock.mockResolvedValueOnce({
      authenticated: true,
      username: "player",
      avatarUrl: null,
    });

    await expect(login({ username: "player", password: "secret" })).resolves.toEqual({
      authenticated: true,
      username: "player",
      avatarUrl: null,
    });
    expect(coreRequestMock).toHaveBeenCalledWith("auth.login", {
      username: "player",
      password: "secret",
    });
  });

  it("calls auth.logout without exposing payload", async () => {
    coreRequestMock.mockResolvedValueOnce({
      authenticated: false,
      username: null,
      avatarUrl: null,
    });

    await logout();

    expect(coreRequestMock).toHaveBeenCalledWith("auth.logout");
  });

  it("forwards registration through the allowlisted bridge command", async () => {
    const payload = {
      firstName: "New",
      lastName: "Player",
      email: "new@example.com",
      username: "newplayer",
      password: "secret1",
      confirmPassword: "secret1",
      dateOfBirth: "1990-05-14",
    };
    coreRequestMock.mockResolvedValueOnce({
      username: "newplayer",
      email: "new@example.com",
      emailVerified: false,
      message: "Cuenta creada.",
    });

    await register(payload);

    expect(coreRequestMock).toHaveBeenCalledWith("auth.register", payload);
  });

  it("keeps Battle.net flow secrets below the TypeScript bridge contract", async () => {
    coreRequestMock
      .mockResolvedValueOnce({ authorizationUrl: "https://oauth.battle.net/authorize", expiresAt: "2026-09-08T00:10:00Z" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "cancelled" });
    await startBattleNetLogin();
    await pollBattleNetLogin();
    await cancelBattleNetLogin();
    expect(coreRequestMock.mock.calls).toEqual([
      ["auth.battlenet.start"], ["auth.battlenet.poll"], ["auth.battlenet.cancel"],
    ]);
  });
});
