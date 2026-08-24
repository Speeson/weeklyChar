import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KeystoneShell } from "./KeystoneShell";

function renderShell(onChangeAvatar = vi.fn(), onStartWindowDrag = vi.fn()) {
  render(
    <KeystoneShell
      auth={{ authenticated: true, username: "player", avatarUrl: null }}
      busyLogout={false}
      currentView="sync"
      onChangeAvatar={onChangeAvatar}
      onCloseWindow={vi.fn()}
      onLogout={vi.fn()}
      onMinimizeToTray={vi.fn()}
      onMinimizeWindow={vi.fn()}
      onNavigate={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenWeb={vi.fn()}
      onStartWindowDrag={onStartWindowDrag}
    >
      <button type="button">Contenido</button>
    </KeystoneShell>,
  );
}

describe("KeystoneShell profile menu", () => {
  it("closes on outside click and Escape", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole("button", { name: "Menu de usuario de player" });

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Contenido" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps inside actions usable and orders avatar above logout", async () => {
    const user = userEvent.setup();
    const onChangeAvatar = vi.fn();
    renderShell(onChangeAvatar);
    await user.click(screen.getByRole("button", { name: "Menu de usuario de player" }));

    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Cambiar avatar", "Cerrar sesion"]);
    await user.click(items[0]);
    expect(onChangeAvatar).toHaveBeenCalledOnce();
  });
});

describe("KeystoneShell window dragging", () => {
  it("starts dragging from empty header space but not from interactive controls", () => {
    const onStartWindowDrag = vi.fn();
    renderShell(vi.fn(), onStartWindowDrag);

    fireEvent.pointerDown(screen.getByRole("banner"), { button: 0 });
    expect(onStartWindowDrag).toHaveBeenCalledOnce();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Sincronizacion" }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Configuracion" }), { button: 0 });
    expect(onStartWindowDrag).toHaveBeenCalledOnce();
  });

  it("ignores non-primary mouse buttons in empty header space", () => {
    const onStartWindowDrag = vi.fn();
    renderShell(vi.fn(), onStartWindowDrag);

    fireEvent.pointerDown(screen.getByRole("banner"), { button: 2 });

    expect(onStartWindowDrag).not.toHaveBeenCalled();
  });
});
