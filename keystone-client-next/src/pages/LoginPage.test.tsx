import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "../core/auth";
import { LoginPage } from "./LoginPage";

vi.mock("../core/auth", () => ({
  login: vi.fn(),
}));

const loginMock = vi.mocked(login);

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renders login fields", () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Iniciar sesion" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contrasena")).toBeInTheDocument();
  });

  it("submits credentials and reports safe auth state", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    loginMock.mockResolvedValueOnce({
      authenticated: true,
      username: "player",
      avatarUrl: null,
    });

    render(<LoginPage onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contrasena"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(loginMock).toHaveBeenCalledWith({ username: "player", password: "secret" });
    expect(onAuthenticated).toHaveBeenCalledWith({
      authenticated: true,
      username: "player",
      avatarUrl: null,
    });
    expect(screen.queryByDisplayValue("secret")).not.toBeInTheDocument();
  });

  it("shows controlled failures", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce({
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Credenciales no válidas.",
    });

    render(<LoginPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contrasena"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales no válidas.");
  });

  it("disables duplicate submit while loading", async () => {
    const user = userEvent.setup();
    loginMock.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contrasena"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("button", { name: "Conectando..." })).toBeDisabled();
  });
});
