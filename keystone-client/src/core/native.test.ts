import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginOverlayShortcutCapture,
  configureOverlayShortcut,
  endOverlayShortcutCapture,
  getOverlayShortcutStatus,
  minimizeToTray,
  minimizeWindow,
  openBattleNetAuthorization,
  openForgotPassword,
  startWindowDragging,
  validateOverlayShortcut,
} from "./native";

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

  it("opens Battle.net through the dedicated scoped Rust command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);
    await openBattleNetAuthorization("https://oauth.battle.net/authorize?scope=openid");
    expect(invokeMock).toHaveBeenCalledWith("open_battlenet_authorization", {
      url: "https://oauth.battle.net/authorize?scope=openid",
    });
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

  it("configures and reads the native overlay shortcut runtime", async () => {
    const status = {
      enabled: true,
      shortcut: "Ctrl+Shift+KeyM",
      registered: true,
      lastError: null,
    };
    invokeMock.mockResolvedValueOnce(status).mockResolvedValueOnce(status);

    await expect(configureOverlayShortcut(true, "Ctrl+Shift+KeyM")).resolves.toEqual(status);
    await expect(getOverlayShortcutStatus()).resolves.toEqual(status);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "configure_overlay_shortcut", {
      enabled: true,
      shortcut: "Ctrl+Shift+KeyM",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "get_overlay_shortcut_status");
  });

  it("routes overlay shortcut capture lifecycle and validation through Rust", async () => {
    invokeMock.mockResolvedValue(undefined);

    await beginOverlayShortcutCapture();
    await validateOverlayShortcut("Ctrl+Shift+KeyJ");
    await endOverlayShortcutCapture();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "begin_overlay_shortcut_capture");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "validate_overlay_shortcut", {
      shortcut: "Ctrl+Shift+KeyJ",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "end_overlay_shortcut_capture");
  });
});
