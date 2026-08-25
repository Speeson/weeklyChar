import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, register } from "../core/auth";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { LoginPage } from "./LoginPage";

vi.mock("../core/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const loginMock = vi.mocked(login);
const registerMock = vi.mocked(register);

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
  });

  it("renders login fields", () => {
    render(<LoginPage onAuthenticated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Contraseña"), "secret");
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
    await user.type(screen.getByLabelText("Contraseña"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales no válidas.");
  });

  it("disables duplicate submit while loading", async () => {
    const user = userEvent.setup();
    loginMock.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contraseña"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("button", { name: "Conectando..." })).toBeDisabled();
  });

  it("opens registration inside the client", async () => {
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("submits the complete registration contract and returns to login", async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValueOnce({
      username: "newplayer",
      email: "new@example.com",
      emailVerified: false,
      message: "Cuenta creada. Revisa tu email para verificarla.",
    });
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));
    await user.type(screen.getByLabelText("Nombre"), "New");
    await user.type(screen.getByLabelText("Apellidos"), "Player");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Fecha de nacimiento"), "1990-05-14");
    await user.type(screen.getByLabelText("Usuario"), "newplayer");
    await user.type(screen.getByLabelText("Contraseña"), "secret1");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "secret1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(registerMock).toHaveBeenCalledWith({
      firstName: "New",
      lastName: "Player",
      email: "new@example.com",
      dateOfBirth: "1990-05-14",
      username: "newplayer",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(await screen.findByText("Cuenta creada. Revisa tu email para verificarla.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Volver al inicio de sesión" }));
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});
