import { ArrowLeft, CheckCircle2, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button, TextField } from "../components/ui";
import { login, register } from "../core/auth";
import { useI18n } from "../core/i18n";
import type { AuthState, CoreError, RegisterPayload } from "../core/types";

type LoginPageProps = {
  onAuthenticated: (auth: AuthState) => void;
};

type AuthMode = "login" | "register";

const emptyRegistration: RegisterPayload = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  dateOfBirth: "",
};

function formatLoginError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return fallback;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registration, setRegistration] = useState<RegisterPayload>(emptyRegistration);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setShowPassword(false);
  }

  function updateRegistration(field: keyof RegisterPayload, value: string) {
    setRegistration((current) => ({ ...current, [field]: value }));
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await login({ username: username.trim(), password });
      setPassword("");
      onAuthenticated(auth);
    } catch (caught) {
      setError(formatLoginError(caught, t("login.error")));
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }
    if (registration.password !== registration.confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await register({
        ...registration,
        firstName: registration.firstName.trim(),
        lastName: registration.lastName.trim(),
        email: registration.email.trim(),
        username: registration.username.trim(),
      });
      setRegistration((current) => ({ ...current, password: "", confirmPassword: "" }));
      setSuccess(result.message);
    } catch (caught) {
      setError(formatLoginError(caught, t("register.error")));
    } finally {
      setLoading(false);
    }
  }

  if (mode === "register") {
    return (
      <section className="auth-panel auth-panel--register" aria-labelledby="register-title">
        <div className="auth-panel__heading">
          <h1 id="register-title">{t("register.title")}</h1>
          <p>{t("register.description")}</p>
        </div>
        {success ? (
          <div className="auth-register-success">
            <CheckCircle2 aria-hidden="true" />
            <p className="success">{success}</p>
            <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={() => switchMode("login")}>
              {t("register.backToLogin")}
            </Button>
          </div>
        ) : (
          <form className="form" onSubmit={submitRegistration}>
            <div className="auth-register-grid">
              <TextField
                autoComplete="given-name"
                label={t("register.firstName")}
                required
                value={registration.firstName}
                onChange={(event) => updateRegistration("firstName", event.target.value)}
              />
              <TextField
                autoComplete="family-name"
                label={t("register.lastName")}
                required
                value={registration.lastName}
                onChange={(event) => updateRegistration("lastName", event.target.value)}
              />
            </div>
            <TextField
              autoComplete="email"
              label={t("register.email")}
              required
              type="email"
              value={registration.email}
              onChange={(event) => updateRegistration("email", event.target.value)}
            />
            <div className="auth-register-grid">
              <TextField
                autoComplete="username"
                label={t("login.username")}
                minLength={3}
                required
                value={registration.username}
                onChange={(event) => updateRegistration("username", event.target.value)}
              />
              <TextField
                autoComplete="bday"
                label={t("register.dateOfBirth")}
                max={new Date().toISOString().slice(0, 10)}
                required
                type="date"
                value={registration.dateOfBirth}
                onChange={(event) => updateRegistration("dateOfBirth", event.target.value)}
              />
            </div>
            <div className="auth-register-grid">
              <TextField
                autoComplete="new-password"
                label={t("login.password")}
                minLength={6}
                required
                type={showPassword ? "text" : "password"}
                value={registration.password}
                onChange={(event) => updateRegistration("password", event.target.value)}
              />
              <TextField
                autoComplete="new-password"
                label={t("register.confirmPassword")}
                minLength={6}
                required
                type={showPassword ? "text" : "password"}
                value={registration.confirmPassword}
                onChange={(event) => updateRegistration("confirmPassword", event.target.value)}
              />
            </div>
            <label className="auth-show-password">
              <input checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} type="checkbox" />
              <span>{showPassword ? t("login.hidePassword") : t("login.showPassword")}</span>
            </label>
            {error ? <p className="error" role="alert">{error}</p> : null}
            <div className="auth-register-actions">
              <Button icon={<ArrowLeft aria-hidden="true" size={18} />} onClick={() => switchMode("login")}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={loading}
                icon={<UserPlus aria-hidden="true" size={18} />}
                type="submit"
                variant="primary"
              >
                {loading ? t("register.creating") : t("register.create")}
              </Button>
            </div>
          </form>
        )}
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <div className="auth-panel__heading">
        <h1 id="login-title">{t("login.title")}</h1>
        <p>{t("login.description")}</p>
      </div>
      <form className="form" onSubmit={submitLogin}>
        <TextField
          autoComplete="username"
          label={t("login.username")}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <label className="ui-field">
          <span>{t("login.password")}</span>
          <span className="auth-password-field">
            <input
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")} onClick={() => setShowPassword((shown) => !shown)} type="button">
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <Button
          icon={<LogIn size={18} aria-hidden="true" />}
          type="submit"
          disabled={loading || !username.trim() || !password}
        >
          {loading ? t("login.connecting") : t("login.enter")}
        </Button>
        <button className="auth-register" disabled={loading} onClick={() => switchMode("register")} type="button">
          <UserPlus aria-hidden="true" size={18} />
          {t("login.register")}
        </button>
      </form>
    </section>
  );
}
