import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { ChangelogModal } from "./ChangelogModal";

const markdown = "# KeystoneClient 0.x.x\n\n## Cambios\n\n- Primera mejora\n- Segunda mejora\n\n**Importante**";

describe("ChangelogModal", () => {
  it("renders the post-update notes with the shared Markdown semantics", () => {
    render(<ChangelogModal version="0.x.x" notes={markdown} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "KeystoneClient 0.x.x" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Cambios" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Importante").tagName).toBe("STRONG");
    expect(screen.queryByText("# KeystoneClient 0.x.x")).not.toBeInTheDocument();
  });

  it("keeps the empty-note fallback", () => {
    render(<ChangelogModal version="0.x.x" notes="" onClose={vi.fn()} />);

    expect(screen.getByText("No hay notas disponibles para esta version.")).toBeInTheDocument();
  });
});
