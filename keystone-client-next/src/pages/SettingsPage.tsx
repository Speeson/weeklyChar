import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { getSettings, updateSettings } from "../core/settings";
import type { ClientSettings, CoreError } from "../core/types";

type SettingsPageProps = {
  appVersion: string;
  initialSettings: ClientSettings;
  onSettingsChanged: (settings: ClientSettings) => void;
  preview?: boolean;
};

function formatSettingsError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return "No se pudieron guardar los ajustes.";
}

export function SettingsPage({ appVersion, initialSettings, onSettingsChanged, preview = false }: SettingsPageProps) {
  const [settings, setSettings] = useState<ClientSettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getSettings()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          onSettingsChanged(loaded);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(formatSettingsError(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onSettingsChanged, preview]);

  async function saveSettings() {
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await updateSettings(settings);
      setSettings(saved);
      onSettingsChanged(saved);
      setMessage("Ajustes guardados.");
    } catch (caught) {
      setError(formatSettingsError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="settings-block settings-general" aria-labelledby="settings-general-title">
        <h3 id="settings-general-title">General</h3>
        {loading ? <p className="muted">Cargando ajustes...</p> : null}
        <label className="check-row" title="Disponible cuando se integre el autoarranque de Tauri">
          <input checked={false} disabled type="checkbox" />
          Arrancar con Windows
        </label>
        <label className="check-row">
          <input
            checked={settings.startMinimized}
            type="checkbox"
            onChange={(event) =>
              setSettings((current) => ({ ...current, startMinimized: event.target.checked }))
            }
          />
          Arrancar minimizado
        </label>
        <label className="check-row">
          <input
            checked={settings.minimizeOnClose}
            type="checkbox"
            onChange={(event) =>
              setSettings((current) => ({ ...current, minimizeOnClose: event.target.checked }))
            }
          />
          Minimizar al cerrar
        </label>
      </section>

      <section className="settings-block settings-application" aria-labelledby="settings-application-title">
        <h3 id="settings-application-title">Aplicacion</h3>
        <div className="settings-language" role="group" aria-label="Idioma">
          <span>Idioma</span>
          <div className="settings-segmented">
            <button
              aria-pressed={settings.lang === "es"}
              onClick={() => setSettings((current) => ({ ...current, lang: "es" }))}
              type="button"
            >
              Espanol
            </button>
            <button
              aria-pressed={settings.lang === "en"}
              onClick={() => setSettings((current) => ({ ...current, lang: "en" }))}
              type="button"
            >
              English
            </button>
          </div>
        </div>
        <div className="settings-version-row">
          <strong>Version del cliente: {appVersion}</strong>
          <div className="actions">
            <button disabled title="Disponible en la fase de autoactualizacion de Tauri" type="button">Actualizar</button>
            <button disabled title="Disponible en la fase de autoactualizacion de Tauri" type="button">Ver releases</button>
            <button disabled title="Disponible en la fase de autoactualizacion de Tauri" type="button">Buscar actualizaciones</button>
          </div>
        </div>
        <p className="muted settings-last-check">Ultima comprobacion: sin comprobar</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        {message ? <p className="success" role="status">{message}</p> : null}
        <Button icon={<Save size={18} aria-hidden="true" />} onClick={saveSettings} disabled={saving || loading}>
          {saving ? "Guardando..." : "Guardar ajustes"}
        </Button>
      </section>
    </>
  );
}
