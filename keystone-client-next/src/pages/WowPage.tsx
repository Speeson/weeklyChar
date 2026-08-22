import { open } from "@tauri-apps/plugin-dialog";
import { ExternalLink, FolderOpen, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { detectWow, selectWowAccounts, selectWowInstall } from "../core/wow";
import type { AddonStatus, CoreError, WowState } from "../core/types";

type WowPageProps = {
  addonStatus?: AddonStatus;
  initialWow: WowState;
  onGoAddon?: () => void;
  onWowChanged: (wow: WowState) => void;
};

function formatWowError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return "No se pudo actualizar la configuracion de World of Warcraft.";
}

function formatModifiedAt(value: number | null): string {
  if (value === null) {
    return "Sin archivo";
  }

  return new Date(value * 1000).toLocaleString();
}

function formatAddonStatus(addonStatus?: AddonStatus): string {
  if (!addonStatus?.installed) {
    return "Addon no instalado";
  }

  if (addonStatus.state === "current") {
    return `Instalado: v${addonStatus.installedVersion ?? "desconocida"} - Ultimo addon: actualizado`;
  }

  if (addonStatus.state === "update-available") {
    return `Instalado: v${addonStatus.installedVersion ?? "desconocida"} - Actualizacion disponible`;
  }

  return `Instalado: v${addonStatus.installedVersion ?? "desconocida"} - ${addonStatus.message || addonStatus.state}`;
}

export function WowPage({ addonStatus, initialWow, onGoAddon, onWowChanged }: WowPageProps) {
  const [wow, setWow] = useState<WowState>(initialWow);
  const [selected, setSelected] = useState<string[]>(initialWow.selectedAccounts);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWow(initialWow);
    setSelected(initialWow.selectedAccounts);
  }, [initialWow]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function applyWow(nextWow: WowState) {
    setWow(nextWow);
    setSelected(nextWow.selectedAccounts);
    onWowChanged(nextWow);
  }

  async function runAction(action: () => Promise<WowState>, success: string) {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const nextWow = await action();
      applyWow(nextWow);
      setMessage(success);
    } catch (caught) {
      setError(formatWowError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function chooseFolder() {
    if (loading) {
      return;
    }

    setError(null);
    setMessage(null);
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "Selecciona World of Warcraft",
    });
    if (typeof selectedPath !== "string") {
      return;
    }

    await runAction(
      () => selectWowInstall({ path: selectedPath }),
      "Carpeta de World of Warcraft guardada.",
    );
  }

  async function saveFolder() {
    const installPath = wow.install.installPath;
    if (!installPath) {
      return;
    }

    await runAction(
      () => selectWowInstall({ path: installPath }),
      "Carpeta de World of Warcraft guardada.",
    );
  }

  function toggleAccount(name: string, checked: boolean) {
    setSelected((current) => {
      if (checked) {
        return current.includes(name) ? current : [...current, name];
      }
      return current.filter((item) => item !== name);
    });
  }

  return (
    <section className="wow-panel settings-block" aria-labelledby="wow-title">
      <h3 id="wow-title">Seleccion de cuentas</h3>

      <div className="wow-path-label">
        <label htmlFor="wow-install-path">Ruta de carpeta de instalacion</label>
        <span className="wow-path-row">
          <input id="wow-install-path" readOnly title={wow.install.installPath ?? undefined} value={wow.install.installPath ?? ""} />
          <button type="button" onClick={chooseFolder} disabled={loading}>
            <FolderOpen size={18} aria-hidden="true" />
            Cambiar
          </button>
          <button type="button" className="settings-gold-action" onClick={() => void saveFolder()} disabled={loading || !wow.install.installPath}>
            <Save size={18} aria-hidden="true" />
            Guardar
          </button>
        </span>
      </div>

      <p className="settings-field-label">Cuentas detectadas</p>
      <div className="account-list" aria-label="Cuentas de World of Warcraft">
        {wow.accounts.length === 0 ? (
          <p className="muted">No hay cuentas detectadas.</p>
        ) : (
          wow.accounts.map((account) => (
            <label className="account-row" key={account.name}>
              <input
                aria-label={`${account.name} ${
                  account.savedVariablesExists
                    ? "KeystoneSync.lua presente"
                    : "KeystoneSync.lua ausente"
                }`}
                checked={selectedSet.has(account.name)}
                type="checkbox"
                onChange={(event) => toggleAccount(account.name, event.target.checked)}
              />
              <span>
                <strong>{account.name}</strong>
                <small title={account.savedVariablesPath}>{account.savedVariablesPath}</small>
              </span>
              <time>{formatModifiedAt(account.modifiedAt)}</time>
            </label>
          ))
        )}
      </div>

      <p className={`wow-addon-status ${addonStatus?.installed ? "success" : "muted"}`}>
        {formatAddonStatus(addonStatus)}
      </p>

      <div className="actions settings-account-actions">
        <button type="button" onClick={() => runAction(detectWow, "Deteccion actualizada.")} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          Redetectar
        </button>
        <button type="button" onClick={() => setSelected(wow.accounts.map((account) => account.name))} disabled={loading || wow.accounts.length === 0}>
          Seleccionar todas
        </button>
        <button type="button" onClick={onGoAddon} disabled={!onGoAddon}>
          <ExternalLink size={18} aria-hidden="true" />
          Ir a Addon
        </button>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {message ? <p className="success" role="status">{message}</p> : null}

      <button
        type="button"
        onClick={() =>
          runAction(() => selectWowAccounts({ accounts: selected }), "Cuentas guardadas.")
        }
        disabled={loading || selected.length === 0 || wow.accounts.length === 0}
        className="settings-gold-action settings-save-accounts"
      >
        <Save size={18} aria-hidden="true" />
        Guardar cuentas
      </button>
    </section>
  );
}
