import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { ReleaseNotesMarkdown } from "./ReleaseNotesMarkdown";

describe("ReleaseNotesMarkdown", () => {
  it("renders supported Markdown without navigable links or raw HTML", () => {
    render(
      <ReleaseNotesMarkdown
        fallback="Sin notas"
        notes={[
          "### Detalles",
          "",
          "1. Primera",
          "2. Segunda",
          "",
          "*Énfasis* y `código inline`",
          "",
          "```text",
          "bloque de código",
          "```",
          "",
          "[Sitio externo](https://example.invalid/path)",
          "",
          '<img src="https://example.invalid/pixel.png" alt="inseguro">',
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Detalles" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Énfasis").tagName).toBe("EM");
    expect(screen.getByText("código inline").tagName).toBe("CODE");
    expect(screen.getByText("bloque de código").tagName).toBe("CODE");
    expect(screen.getByText("Sitio externo")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
