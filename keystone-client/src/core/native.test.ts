import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { minimizeToTray, minimizeWindow, openForgotPassword, startWindowDragging } from "./native";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const getCurrentWindowMock = vi.mocked(getCurrentWindow);

describe("native window actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getCurrentWindowMock.mockReset();
  });

  it("routes tray hiding through the scoped Rust command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await minimizeToTray();

    expect(invokeMock).toHaveBeenCalledWith("hide_to_tray");
    expect(getCurrentWindowMock).not.toHaveBeenCalled();
  });

  it("opens password recovery through a dedicated argument-free command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await openForgotPassword();

    expect(invokeMock).toHaveBeenCalledWith("open_forgot_password");
  });

  it("keeps taskbar minimization on the current native window", async () => {
    const minimize = vi.fn(() => Promise.resolve());
    getCurrentWindowMock.mockReturnValueOnce({ minimize } as never);

    await minimizeWindow();

    expect(minimize).toHaveBeenCalledOnce();
  });

  it("starts dragging through the current native window", async () => {
    const startDragging = vi.fn(() => Promise.resolve());
    getCurrentWindowMock.mockReturnValueOnce({ startDragging } as never);

    await startWindowDragging();

    expect(startDragging).toHaveBeenCalledOnce();
  });
});
