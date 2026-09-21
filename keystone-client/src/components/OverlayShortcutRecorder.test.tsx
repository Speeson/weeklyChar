import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    const onRecordingStart = vi.fn(() => Promise.resolve());
    const onRecordingStop = vi.fn(() => Promise.resolve());
    const onValidate = vi.fn(() => Promise.resolve());
    render(
      <OverlayShortcutRecorder
        onChange={onChange}
        onRecordingStart={onRecordingStart}
        onRecordingStop={onRecordingStop}
        onRestore={vi.fn()}
        onValidate={onValidate}
        value="Ctrl+Shift+K"
      />,
    );

    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    expect(recorder).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(recorder, { code: "Escape", key: "Escape" });
    await waitFor(() => expect(recorder).toHaveAttribute("aria-pressed", "false"));
    expect(onRecordingStop).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M", ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Shift+KeyM"));
    expect(onValidate).toHaveBeenCalledWith("Ctrl+Shift+KeyM");
    expect(onRecordingStart).toHaveBeenCalledTimes(2);
    expect(onRecordingStop).toHaveBeenCalledTimes(2);
  });

  it("reports an unavailable shortcut immediately and keeps recording", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRecordingStop = vi.fn(() => Promise.resolve());
    const onValidate = vi.fn(() => Promise.reject("Shortcut already registered"));
    render(
      <OverlayShortcutRecorder
        onChange={onChange}
        onRecordingStart={() => Promise.resolve()}
        onRecordingStop={onRecordingStop}
        onRestore={vi.fn()}
        onValidate={onValidate}
        value="Ctrl+Shift+K"
      />,
    );

    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyJ", key: "J", ctrlKey: true, shiftKey: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("Shortcut already registered");
    expect(recorder).toHaveAttribute("aria-pressed", "true");
    expect(onChange).not.toHaveBeenCalled();
    expect(onRecordingStop).not.toHaveBeenCalled();
  });

  it("validates only one candidate at a time and ignores a result after focus leaves", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let resolveValidation!: () => void;
    const validation = new Promise<void>((resolve) => { resolveValidation = resolve; });
    const onValidate = vi.fn(() => validation);
    render(
      <OverlayShortcutRecorder
        onChange={onChange}
        onRecordingStart={() => Promise.resolve()}
        onRecordingStop={() => Promise.resolve()}
        onRestore={vi.fn()}
        onValidate={onValidate}
        value="Ctrl+Shift+K"
      />,
    );

    const recorder = screen.getByRole("button", { name: "Atajo del overlay: Ctrl + Shift + K" });
    await user.click(recorder);
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(recorder, { code: "KeyM", key: "M", ctrlKey: true, shiftKey: true, repeat: true });
    expect(onValidate).toHaveBeenCalledOnce();

    fireEvent.blur(recorder);
    resolveValidation();

    await waitFor(() => expect(recorder).toHaveAttribute("aria-pressed", "false"));
    expect(onChange).not.toHaveBeenCalled();
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
