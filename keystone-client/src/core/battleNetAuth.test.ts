import { describe, expect, it, vi } from "vitest";
import { pollBattleNetUntilComplete } from "./battleNetAuth";

const future = () => new Date(Date.now() + 60_000).toISOString();

describe("Battle.net desktop polling", () => {
  it("waits at the bounded interval through pending and onboarding until ready", async () => {
    const poll = vi.fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "needs_onboarding" })
      .mockResolvedValueOnce({ status: "ready", auth: { authenticated: true, username: "player", avatarUrl: null } });
    const wait = vi.fn(() => Promise.resolve());
    const onboarding = vi.fn();
    await expect(pollBattleNetUntilComplete({ expiresAt: future(), poll, wait, cancelled: () => false, onNeedsOnboarding: onboarding }))
      .resolves.toEqual({ status: "ready", auth: { authenticated: true, username: "player", avatarUrl: null } });
    expect(wait).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(2_000);
    expect(onboarding).toHaveBeenCalledOnce();
  });

  it("stops without polling when cancelled", async () => {
    const poll = vi.fn();
    await expect(pollBattleNetUntilComplete({ expiresAt: future(), poll, cancelled: () => true }))
      .resolves.toEqual({ status: "cancelled" });
    expect(poll).not.toHaveBeenCalled();
  });

  it("returns timeout before issuing a request and propagates server errors", async () => {
    const poll = vi.fn();
    await expect(pollBattleNetUntilComplete({ expiresAt: new Date(0).toISOString(), poll, cancelled: () => false }))
      .resolves.toEqual({ status: "expired" });
    const failing = vi.fn().mockRejectedValue(new Error("server"));
    await expect(pollBattleNetUntilComplete({ expiresAt: future(), poll: failing, wait: async () => {}, cancelled: () => false }))
      .rejects.toThrow("server");
  });
});
