import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme as render } from "../test/renderWithTheme";
import {
  formatShortcut,
  OverlayShortcutRecorder,
  shortcutFromKeyboardEvent,
} from "./OverlayShortcutRecorder";

describe("OverlayShortcutRecorder", () => {
  it("normalizes supported keyboard events and requires a modifier", () => {
    expect(shortcutFromKeyboardEvent({
      altKey: false,
      code: "KeyM",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
    })).toBe("Ctrl+Shift+KeyM");
    expect(shortcutFromKeyboardEvent({
      altKey: false,
      code: "KeyM",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })).toBeNull();
    expect(formatShortcut("Ctrl+Shift+KeyM")).toBe("Ctrl + Shift + M");
  });

  it("captures a shortcut and supports Escape cancellation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OverlayShortcutRecorder onChange={onChange} onRestore={vi.fn()} value="Ctrl+Shift+K" />);

    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    expect(recorder).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(recorder, { code: "Escape", key: "Escape" });
    expect(recorder).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M", ctrlKey: true, shiftKey: true });
    expect(onChange).toHaveBeenCalledWith("Ctrl+Shift+KeyM");
  });

  it("reports a missing modifier without replacing the shortcut", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OverlayShortcutRecorder onChange={onChange} onRestore={vi.fn()} value="Ctrl+Shift+K" />);

    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M" });

    expect(screen.getByRole("alert")).toHaveTextContent("El atajo necesita al menos una tecla modificadora.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("restores the default shortcut from the adjacent action", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(<OverlayShortcutRecorder onChange={vi.fn()} onRestore={onRestore} value="Ctrl+Shift+KeyM" />);

    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("shows a registration error in place of the help text", () => {
    render(
      <OverlayShortcutRecorder
        error="Shortcut already registered"
        onChange={vi.fn()}
        onRestore={vi.fn()}
        value="Ctrl+Shift+KeyJ"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Shortcut already registered");
    expect(screen.queryByText(/Haz clic y pulsa una combinación/)).not.toBeInTheDocument();
  });
});
