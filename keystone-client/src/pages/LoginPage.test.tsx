import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, register } from "../core/auth";
import { exitApplication, openForgotPassword, openWeb } from "../core/native";
import { renderWithTheme as render } from "../test/renderWithTheme";
import { LoginPage } from "./LoginPage";

vi.mock("../core/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../core/native", () => ({
  exitApplication: vi.fn(),
  openForgotPassword: vi.fn(),
  openWeb: vi.fn(),
}));

const loginMock = vi.mocked(login);
const registerMock = vi.mocked(register);
const exitApplicationMock = vi.mocked(exitApplication);
const openForgotPasswordMock = vi.mocked(openForgotPassword);
const openWebMock = vi.mocked(openWeb);

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
    exitApplicationMock.mockReset();
    openForgotPasswordMock.mockReset();
    openWebMock.mockReset();
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

  it("opens the scoped password-recovery flow from the login view", async () => {
    const user = userEvent.setup();
    openForgotPasswordMock.mockResolvedValueOnce(undefined);
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Recuperar contraseña" }));

    expect(openForgotPasswordMock).toHaveBeenCalledOnce();
  });

  it("opens KeystoneSync Web and exits while unauthenticated", async () => {
    const user = userEvent.setup();
    openWebMock.mockResolvedValueOnce(undefined);
    exitApplicationMock.mockResolvedValueOnce(undefined);
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Acceder a la web" }));
    await user.click(screen.getByRole("button", { name: "Cerrar aplicación" }));

    expect(openWebMock).toHaveBeenCalledOnce();
    expect(exitApplicationMock).toHaveBeenCalledOnce();
  });

  it("keeps Web and exit actions available in registration", async () => {
    const user = userEvent.setup();
    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    expect(screen.getByRole("button", { name: "Acceder a la web" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar aplicación" })).toBeInTheDocument();
  });

  it("reports native failures without clearing login credentials", async () => {
    const user = userEvent.setup();
    openForgotPasswordMock.mockRejectedValueOnce({
      code: "OPEN_FORGOT_PASSWORD_FAILED",
      message: "No se pudo abrir la recuperación de contraseña.",
    });
    render(<LoginPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText("Usuario"), "player");
    await user.type(screen.getByLabelText("Contraseña"), "secret");

    await user.click(screen.getByRole("button", { name: "Recuperar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo abrir la recuperación de contraseña.");
    expect(screen.getByLabelText("Usuario")).toHaveValue("player");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("secret");
  });

  it("reports native failures after registration succeeds", async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValueOnce({
      username: "newplayer",
      email: "new@example.com",
      emailVerified: false,
      message: "Cuenta creada.",
    });
    openWebMock.mockRejectedValueOnce({
      code: "OPEN_WEB_FAILED",
      message: "No se pudo abrir KeystoneSync Web.",
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
    await screen.findByText("Cuenta creada.");

    await user.click(screen.getByRole("button", { name: "Acceder a la web" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo abrir KeystoneSync Web.");
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
