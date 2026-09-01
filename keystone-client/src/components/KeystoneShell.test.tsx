import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { KeystoneShell } from "./KeystoneShell";

function renderShell(onChangeAvatar = vi.fn(), onStartWindowDrag = vi.fn(), onNavigate = vi.fn()) {
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
      onNavigate={onNavigate}
      onOpenSettings={vi.fn()}
      onOpenWeb={vi.fn()}
      onStartWindowDrag={onStartWindowDrag}
    >
      <button type="button">Contenido</button>
    </KeystoneShell>,
  );
}

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("KeystoneShell profile menu", () => {
  it("mounts Poison shell artwork around the existing interactive controls and real avatar", () => {
    localStorage.setItem("keystone-client.theme", "poison");
    render(
      <KeystoneShell
        auth={{ authenticated: true, username: "player", avatarUrl: "https://img.test/player.jpg" }}
        busyLogout={false}
        currentView="sync"
        onChangeAvatar={vi.fn()}
        onCloseWindow={vi.fn()}
        onLogout={vi.fn()}
        onMinimizeToTray={vi.fn()}
        onMinimizeWindow={vi.fn()}
        onNavigate={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenWeb={vi.fn()}
        onStartWindowDrag={vi.fn()}
      >
        <span>Contenido</span>
      </KeystoneShell>,
    );

    expect(document.querySelector('.ks-brand__icon[src$="app-badge.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-tab__decoration--active[src$="tab-active-decoration.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-tab__decoration--inactive[src$="tab-inactive-decoration.png"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizacion" }).querySelector(".ks-tab__label")).toHaveTextContent("Sincronizacion");
    expect(screen.getByRole("button", { name: "Equipos" }).querySelector(".ks-tab__label")).toHaveTextContent("Equipos");
    expect(screen.getByRole("button", { name: "Addon" }).querySelector(".ks-tab__label")).toHaveTextContent("Addon");
    expect(document.querySelector('.ks-user-menu__shell[src$="profile-frame.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-user-menu__avatar-image[src="https://img.test/player.jpg"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-footer-action__asset[src$="web-button-frame.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-footer-action__asset[src$="tray-button-frame.png"]')).toBeInTheDocument();
  });

  it.each(["keystone", "poison", "void"] as const)("keeps shell state hooks, ARIA, and navigation behavior under the %s theme", async (theme) => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    document.documentElement.dataset.theme = theme;
    renderShell(vi.fn(), vi.fn(), onNavigate);

    const frame = screen.getByRole("banner").parentElement;
    const syncTab = screen.getByRole("button", { name: "Sincronizacion" });
    const addonTab = screen.getByRole("button", { name: "Addon" });
    const teamsTab = screen.getByRole("button", { name: "Equipos" });
    const trigger = screen.getByRole("button", { name: "Menu de usuario de player" });

    expect(frame).toHaveAttribute("data-ui", "keystone-shell");
    expect(syncTab).toHaveAttribute("data-ui", "shell-tab");
    expect(syncTab).toHaveAttribute("data-state", "selected");
    expect(syncTab).toHaveAttribute("aria-current", "page");
    expect(addonTab).toHaveAttribute("data-state", "default");
    await user.click(teamsTab);
    expect(onNavigate).toHaveBeenCalledWith("teams");
    await user.click(addonTab);
    expect(onNavigate).toHaveBeenCalledWith("addon");

    expect(trigger).toHaveAttribute("data-ui", "user-menu-trigger");
    expect(trigger).toHaveAttribute("data-state", "closed");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("data-state", "open");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("uses Void shell artwork and decorates only the active tab", () => {
    localStorage.setItem("keystone-client.theme", "void");
    renderShell();

    expect(document.querySelector('.ks-brand__icon[src$="app-icon.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-user-menu__shell[src$="user-panel-frame.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-user-menu__dropdown-icon[src$="dropdown-icon.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-footer-action--web img[src$="web-button.png"]')).toBeInTheDocument();
    expect(document.querySelector('.ks-footer-action--tray img[src$="tray-button.png"]')).toBeInTheDocument();
    expect(document.querySelectorAll('.ks-tab__decoration--active[src$="active-tab-indicator.png"]')).toHaveLength(1);
    expect(document.querySelectorAll(".ks-tab__decoration--inactive")).toHaveLength(0);
  });

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
