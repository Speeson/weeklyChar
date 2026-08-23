import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { setProfileAvatar } from "./profile";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));

describe("profile wrappers", () => {
  beforeEach(() => vi.mocked(coreRequest).mockReset());

  it("sends only the selected avatar URL", async () => {
    vi.mocked(coreRequest).mockResolvedValueOnce({ authenticated: true, username: "player", avatarUrl: "https://img.test/a.jpg" });
    await setProfileAvatar({ avatarUrl: "https://img.test/a.jpg" });
    expect(coreRequest).toHaveBeenCalledWith("profile.set_avatar", { avatarUrl: "https://img.test/a.jpg" });
  });
});
