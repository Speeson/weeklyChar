import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageErrorBoundary } from "./PageErrorBoundary";

function Content({ broken }: { broken: boolean }) {
  if (broken) throw new Error("broken page");
  return <p>Contenido disponible</p>;
}

describe("PageErrorBoundary", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it("keeps a recoverable fallback mounted and resets when navigation changes", () => {
    const recover = vi.fn();
    const { rerender } = render(
      <PageErrorBoundary detail="Detalle" onRecover={recover} recoverLabel="Volver" resetKey="characters" title="Error">
        <Content broken />
      </PageErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Error");
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(recover).toHaveBeenCalledOnce();

    rerender(
      <PageErrorBoundary detail="Detalle" onRecover={recover} recoverLabel="Volver" resetKey="sync" title="Error">
        <Content broken={false} />
      </PageErrorBoundary>,
    );
    expect(screen.getByText("Contenido disponible")).toBeInTheDocument();
  });
});
