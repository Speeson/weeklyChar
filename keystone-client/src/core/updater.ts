export type UpdaterStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface NativeUpdate {
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall(listener: (event: DownloadEvent) => void): Promise<void>;
}

export interface UpdaterAdapter {
  check(): Promise<NativeUpdate | null>;
  relaunch(): Promise<void>;
}

export type UpdaterSnapshot = {
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  notes: string;
  releaseDate: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  lastCheckedAt: string | null;
  error: string | null;
};

type Listener = (snapshot: UpdaterSnapshot) => void;

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error || "Unknown updater error");
}

export class UpdateController {
  private adapter: UpdaterAdapter;
  private listeners = new Set<Listener>();
  private update: NativeUpdate | null = null;
  private state: UpdaterSnapshot;

  constructor(currentVersion: string, adapter: UpdaterAdapter) {
    this.adapter = adapter;
    this.state = {
      status: "idle",
      currentVersion,
      availableVersion: null,
      notes: "",
      releaseDate: null,
      downloadedBytes: 0,
      totalBytes: null,
      lastCheckedAt: null,
      error: null,
    };
  }

  get snapshot(): UpdaterSnapshot {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async check(): Promise<void> {
    if (["checking", "downloading", "installing"].includes(this.state.status)) {
      return;
    }
    this.update = null;
    this.patch({ status: "checking", error: null, downloadedBytes: 0, totalBytes: null });
    try {
      const update = await this.adapter.check();
      const checkedAt = new Date().toISOString();
      if (!update) {
        this.patch({
          status: "current",
          availableVersion: null,
          notes: "",
          releaseDate: null,
          lastCheckedAt: checkedAt,
        });
        return;
      }
      this.update = update;
      this.patch({
        status: "available",
        availableVersion: update.version,
        notes: update.body ?? "",
        releaseDate: update.date ?? null,
        lastCheckedAt: checkedAt,
      });
    } catch (error) {
      this.patch({
        status: "error",
        error: messageFrom(error),
        lastCheckedAt: new Date().toISOString(),
      });
    }
  }

  async installAndRelaunch(): Promise<void> {
    if (!this.update || this.state.status !== "available") {
      return;
    }
    this.patch({ status: "downloading", error: null, downloadedBytes: 0, totalBytes: null });
    try {
      await this.update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          this.patch({ totalBytes: event.data.contentLength ?? null });
        } else if (event.event === "Progress") {
          this.patch({ downloadedBytes: this.state.downloadedBytes + event.data.chunkLength });
        } else {
          this.patch({ status: "installing" });
        }
      });
      this.patch({ status: "installing" });
      await this.adapter.relaunch();
    } catch (error) {
      this.patch({ status: "error", error: messageFrom(error) });
    }
  }

  private patch(patch: Partial<UpdaterSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
