import { LogIn } from "lucide-react";
import { useState } from "react";
import { Button, TextField } from "../components/ui";
import { login } from "../core/auth";
import type { FormEvent } from "react";
import type { AuthState, CoreError } from "../core/types";

type LoginPageProps = {
  onAuthenticated: (auth: AuthState) => void;
};

function formatLoginError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return "No se pudo iniciar sesion.";
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      setError(formatLoginError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <div>
        <p className="shell__eyebrow">KeystoneClient</p>
        <h1 id="login-title">Iniciar sesion</h1>
      </div>
      <form className="form" onSubmit={submit}>
        <TextField
          autoComplete="username"
          label="Usuario"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextField
          autoComplete="current-password"
          label="Contrasena"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <Button
          icon={<LogIn size={18} aria-hidden="true" />}
          type="submit"
          disabled={loading || !username.trim() || !password}
        >
          {loading ? "Conectando..." : "Entrar"}
        </Button>
      </form>
    </section>
  );
}
