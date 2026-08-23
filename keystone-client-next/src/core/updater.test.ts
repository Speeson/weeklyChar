import { describe, expect, it, vi } from "vitest";
import { UpdateController, type NativeUpdate, type UpdaterAdapter } from "./updater";

function availableUpdate(): NativeUpdate {
  return {
    version: "0.4.0",
    date: "2026-08-23T12:00:00Z",
    body: "Cambios de prueba",
    downloadAndInstall: vi.fn(async (listener) => {
      listener({ event: "Started", data: { contentLength: 100 } });
      listener({ event: "Progress", data: { chunkLength: 40 } });
      listener({ event: "Progress", data: { chunkLength: 60 } });
      listener({ event: "Finished" });
    }),
  };
}

describe("UpdateController", () => {
  it("reports a current installation", async () => {
    const adapter: UpdaterAdapter = { check: vi.fn().mockResolvedValue(null), relaunch: vi.fn() };
    const controller = new UpdateController("0.3.0", adapter);

    await controller.check();

    expect(controller.snapshot.status).toBe("current");
    expect(controller.snapshot.lastCheckedAt).not.toBeNull();
  });

  it("retains release metadata when an update is available", async () => {
    const update = availableUpdate();
    const adapter: UpdaterAdapter = { check: vi.fn().mockResolvedValue(update), relaunch: vi.fn() };
    const controller = new UpdateController("0.3.0", adapter);

    await controller.check();

    expect(controller.snapshot).toMatchObject({
      status: "available",
      availableVersion: "0.4.0",
      notes: "Cambios de prueba",
    });
  });

  it("tracks download progress and explicitly relaunches after install", async () => {
    const update = availableUpdate();
    const relaunch = vi.fn().mockResolvedValue(undefined);
    const adapter: UpdaterAdapter = { check: vi.fn().mockResolvedValue(update), relaunch };
    const controller = new UpdateController("0.3.0", adapter);
    const states: string[] = [];
    controller.subscribe((snapshot) => states.push(snapshot.status));

    await controller.check();
    await controller.installAndRelaunch();

    expect(states).toContain("downloading");
    expect(states).toContain("installing");
    expect(controller.snapshot.downloadedBytes).toBe(100);
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it("converts check failures into a controlled error state", async () => {
    const adapter: UpdaterAdapter = {
      check: vi.fn().mockRejectedValue(new Error("manifest unavailable")),
      relaunch: vi.fn(),
    };
    const controller = new UpdateController("0.3.0", adapter);

    await controller.check();

    expect(controller.snapshot).toMatchObject({ status: "error", error: "manifest unavailable" });
  });

  it("ignores duplicate install requests while a download is active", async () => {
    let finishDownload: (() => void) | undefined;
    const downloadBarrier = new Promise<void>((resolve) => {
      finishDownload = resolve;
    });
    const update = availableUpdate();
    update.downloadAndInstall = vi.fn(async (listener) => {
      listener({ event: "Started", data: { contentLength: 10 } });
      await downloadBarrier;
      listener({ event: "Finished" });
    });
    const adapter: UpdaterAdapter = {
      check: vi.fn().mockResolvedValue(update),
      relaunch: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new UpdateController("0.3.0", adapter);
    await controller.check();

    const firstInstall = controller.installAndRelaunch();
    await controller.installAndRelaunch();

    expect(update.downloadAndInstall).toHaveBeenCalledOnce();
    finishDownload?.();
    await firstInstall;
  });

  it("surfaces install failures without attempting to relaunch", async () => {
    const update = availableUpdate();
    update.downloadAndInstall = vi.fn().mockRejectedValue(new Error("signature rejected"));
    const relaunch = vi.fn();
    const adapter: UpdaterAdapter = { check: vi.fn().mockResolvedValue(update), relaunch };
    const controller = new UpdateController("0.3.0", adapter);
    await controller.check();

    await controller.installAndRelaunch();

    expect(controller.snapshot).toMatchObject({ status: "error", error: "signature rejected" });
    expect(relaunch).not.toHaveBeenCalled();
  });
});
