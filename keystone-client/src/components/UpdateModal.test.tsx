import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UpdaterSnapshot } from "../core/updater";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { UpdateModal } from "./UpdateModal";

const available: UpdaterSnapshot = {
  status: "available",
  currentVersion: "0.3.0",
  availableVersion: "0.4.0",
  notes: "# KeystoneClient 0.x.x\n\n## Cambios\n\n- Primera mejora\n- Segunda mejora\n\n**Importante**",
  releaseDate: "2026-08-23T12:00:00Z",
  downloadedBytes: 0,
  totalBytes: null,
  lastCheckedAt: "2026-08-23T12:00:00Z",
  error: null,
};

describe("UpdateModal", () => {
  it("renders release-note Markdown and requires explicit installation", async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    render(<UpdateModal onClose={vi.fn()} onInstall={onInstall} onRetry={vi.fn()} snapshot={available} />);

    expect(screen.getByRole("dialog")).toHaveTextContent("0.4.0");
    expect(screen.getByRole("heading", { level: 1, name: "KeystoneClient 0.x.x" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Cambios" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Importante").tagName).toBe("STRONG");
    expect(screen.queryByText("# KeystoneClient 0.x.x")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Instalar y reiniciar" }));
    expect(onInstall).toHaveBeenCalledOnce();
  });

  it("keeps the empty-note fallback", () => {
    render(
      <UpdateModal
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onRetry={vi.fn()}
        snapshot={{ ...available, notes: "" }}
      />,
    );

    expect(screen.getByText("No hay notas disponibles para esta version.")).toBeInTheDocument();
  });

  it("reports deterministic download progress", () => {
    render(
      <UpdateModal
        onClose={vi.fn()}
        onInstall={vi.fn()}
        onRetry={vi.fn()}
        snapshot={{ ...available, status: "downloading", downloadedBytes: 25, totalBytes: 100 }}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25%" )).toBeInTheDocument();
  });
});
