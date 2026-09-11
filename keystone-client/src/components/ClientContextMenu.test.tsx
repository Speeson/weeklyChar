import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithTheme } from "../test/renderWithTheme";
import { ClientContextMenu } from "./ClientContextMenu";

it("renders four actions, clamps to the viewport and dismisses after selection", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 300 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 250 });
  const dismiss = vi.fn();
  const sync = vi.fn();
  renderWithTheme(<ClientContextMenu labels={["Sync", "Avatar", "Settings", "Tray"]} onActions={[sync, vi.fn(), vi.fn(), vi.fn()]} onDismiss={dismiss} x={290} y={240}/>);
  const menu = screen.getByRole("menu");
  expect(menu).toHaveStyle({ left: "72px", top: "66px" });
  expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  await userEvent.setup().click(screen.getByRole("menuitem", { name: "Sync" }));
  expect(sync).toHaveBeenCalledOnce();
  expect(dismiss).toHaveBeenCalledOnce();
});

it("dismisses on Escape and outside pointer input", () => {
  const dismiss = vi.fn();
  renderWithTheme(<ClientContextMenu labels={["Sync", "Avatar", "Settings", "Tray"]} onActions={[vi.fn(), vi.fn(), vi.fn(), vi.fn()]} onDismiss={dismiss} x={10} y={10}/>);
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.pointerDown(document.body);
  expect(dismiss).toHaveBeenCalledTimes(2);
});
