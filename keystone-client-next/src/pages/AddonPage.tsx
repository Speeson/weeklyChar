import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  Activity,
  Check,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import appIcon from "../assets/keystone-ui/21-app-icon-hd.png";
import {
  checkAddon,
  getAddonStatus,
  installAddon,
  reinstallAddon,
  subscribeToAddonEvents,
  updateAddon,
} from "../core/addon";
import type { AddonStatus, CoreError, WowState } from "../core/types";
import { selectWowInstall } from "../core/wow";

type AddonPageProps = {
  initialAddon: AddonStatus;
  initialWow: WowState;
  onWowChanged: (wow: WowState) => void;
  preview?: boolean;
};

type AddonAction = "check" | "install" | "update" | "reinstall";
type StatusTone = "default" | "good" | "bad" | "notice";

function formatError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }
  return "No se pudo gestionar el addon.";
}

function stateLabel(status: AddonStatus): string {
  switch (status.state) {
    case "current":
      return "Actualizado";
    case "update-available":
      return "Actualización disponible";
    case "local-newer":
      return "Versión local más reciente";
    case "offline-cache":
      return "Instalación disponible desde caché";
    case "unavailable":
      return "No disponible";
    case "error":
      return "Error";
    default:
      return "Instalación disponible";
  }
}

function stateTone(status: AddonStatus): StatusTone {
  switch (status.state) {
    case "current":
    case "local-newer":
      return "good";
    case "not-installed":
    case "update-available":
    case "offline-cache":
      return "notice";
    case "unavailable":
    case "error":
      return "bad";
  }
}

function formatVersion(version: string | null): string {
  if (!version) {
    return "-";
  }
  return version.startsWith("v") ? version : `v${version}`;
}

function formatLastCheck(value: string | null, preview: boolean): string {
  if (preview) {
    return "hace 2 min";
  }
  if (!value) {
    return "Sin comprobar";
  }

  const checkedAt = new Date(value);
  if (!Number.isFinite(checkedAt.getTime())) {
    return "Sin comprobar";
  }
  const elapsedMs = Date.now() - checkedAt.getTime();
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    if (elapsedMinutes < 1) {
      return "ahora";
    }
    if (elapsedMinutes < 60) {
      return `hace ${elapsedMinutes} min`;
    }
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `hace ${elapsedHours} h`;
    }
  }

  return checkedAt.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: AddonStatus["source"]): string {
  if (source === "remote") {
    return "KeystoneSync releases";
  }
  if (source === "cache") {
    return "Caché local";
  }
  return "No disponible";
}

function addonFolderPath(addonsPath: string): string {
  const separator = addonsPath.includes("\\") ? "\\" : "/";
  return `${addonsPath.replace(/[\\/]+$/, "")}${separator}KeystoneSync`;
}

export function AddonPage({
  initialAddon,
  initialWow,
  onWowChanged,
  preview = false,
}: AddonPageProps) {
  const [addon, setAddon] = useState<AddonStatus>(initialAddon);
  const [wow, setWow] = useState<WowState>(initialWow);
  const [busyAction, setBusyAction] = useState<AddonAction | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddon(initialAddon);
  }, [initialAddon]);

  useEffect(() => {
    setWow(initialWow);
  }, [initialWow]);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;
    const unlisten = subscribeToAddonEvents((event) => {
      if (cancelled) {
        return;
      }
      if (event.event === "addon.check.completed" || event.event === "addon.status.changed") {
        setAddon(event.data);
        setMessage(event.data.message || null);
        setError(null);
      }
      if (event.event === "addon.install.started" || event.event === "addon.install.progress") {
        setAddon((current) => ({ ...current, operation: event.data }));
        setMessage(event.data.message);
      }
      if (event.event === "addon.install.completed") {
        setAddon(event.data.status);
        setMessage(event.data.operation.message);
        setError(null);
        setBusyAction(null);
      }
      if (event.event === "addon.install.failed") {
        setAddon((current) => ({ ...current, operation: event.data.operation }));
        setError(event.data.error.message);
        setBusyAction(null);
      }
    });

    void getAddonStatus()
      .then((status) => {
        if (!cancelled) {
          setAddon(status);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(formatError(caught));
        }
      });

    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, [preview]);

  async function runAction(action: AddonAction, request: () => Promise<AddonStatus>, success: string) {
    if (busyAction !== null || addon.operation || folderBusy) {
      return;
    }
    setBusyAction(action);
    setMessage(null);
    setError(null);
    try {
      const status = await request();
      setAddon(status);
      setMessage(status.operation?.message || success);
      if (!status.operation) {
        setBusyAction(null);
      }
    } catch (caught) {
      setError(formatError(caught));
      setBusyAction(null);
    }
  }

  async function chooseAddonFolder() {
    if (folderBusy || addon.operation) {
      return;
    }

    setFolderBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selectedPath = await open({
        defaultPath: wow.install.addonsPath ?? wow.install.installPath ?? undefined,
        directory: true,
        multiple: false,
        title: "Selecciona la carpeta de AddOns",
      });
      if (typeof selectedPath !== "string") {
        return;
      }

      const nextWow = await selectWowInstall({ path: selectedPath });
      setWow(nextWow);
      onWowChanged(nextWow);
      setMessage("Carpeta de AddOns actualizada.");
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setFolderBusy(false);
    }
  }

  async function openAddonDirectory() {
    const addonsPath = wow.install.addonsPath;
    if (!addonsPath) {
      setError("Selecciona primero una carpeta de AddOns válida.");
      return;
    }

    setError(null);
    try {
      await openPath(addon.installed ? addonFolderPath(addonsPath) : addonsPath);
    } catch (caught) {
      if (addon.installed) {
        try {
          await openPath(addonsPath);
          return;
        } catch {
          // Report the original opener error below.
        }
      }
      setError(formatError(caught));
    }
  }

  async function copyAddonPath() {
    const addonsPath = wow.install.addonsPath;
    if (!addonsPath) {
      return;
    }

    setError(null);
    try {
      await navigator.clipboard.writeText(addonsPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  const busy = busyAction !== null || addon.operation !== null || folderBusy;
  const canInstall = addon.state === "not-installed" || addon.state === "offline-cache";
  const canUpdate = addon.state === "update-available";
  const canReinstall = addon.installed;
  const statusText = addon.operation?.message || stateLabel(addon);
  const statusTextTone: StatusTone = addon.operation ? "notice" : stateTone(addon);
  const addonsPath = wow.install.addonsPath;

  return (
    <section className="addon-screen" aria-labelledby="addon-title">
      <div className="addon-screen__main">
        <header className="addon-heading">
          <img src={appIcon} alt="" className="addon-heading__icon" />
          <div>
            <p className="addon-heading__eyebrow">KeystoneSync</p>
            <h1 id="addon-title">Addon</h1>
          </div>
        </header>

        <p className="addon-description">
          Instala o actualiza KeystoneSync desde las releases oficiales en tu carpeta de World of Warcraft.
        </p>

        <section className="addon-path-card" aria-labelledby="addon-path-title">
          <div className="addon-section-heading">
            <FolderOpen aria-hidden="true" />
            <h2 id="addon-path-title">Ruta de AddOns</h2>
          </div>

          <div className="addon-path-field">
            <span title={addonsPath ?? undefined}>{addonsPath ?? "No se ha detectado una carpeta de AddOns"}</span>
            <button
              type="button"
              className="addon-copy-button"
              aria-label={copied ? "Ruta copiada" : "Copiar ruta de AddOns"}
              onClick={() => void copyAddonPath()}
              disabled={!addonsPath}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          </div>

          <div className="addon-folder-actions">
            <button type="button" onClick={() => void chooseAddonFolder()} disabled={busy}>
              <FolderOpen aria-hidden="true" />
              Seleccionar carpeta de AddOns
            </button>
            <button type="button" onClick={() => void openAddonDirectory()} disabled={!addonsPath || busy}>
              <ExternalLink aria-hidden="true" />
              Abrir carpeta del addon
            </button>
          </div>
        </section>

        {canInstall ? (
          <button
            type="button"
            className="addon-primary-action"
            onClick={() => void runAction("install", installAddon, "Instalación iniciada.")}
            disabled={busy}
          >
            <Download aria-hidden="true" />
            Instalar KeystoneSync
          </button>
        ) : (
          <div className={`addon-primary-actions${canUpdate && canReinstall ? "" : " addon-primary-actions--single"}`}>
            {canUpdate ? (
              <button
                type="button"
                className="addon-primary-action"
                onClick={() => void runAction("update", updateAddon, "Actualización iniciada.")}
                disabled={busy}
              >
                <RefreshCw aria-hidden="true" />
                Actualizar KeystoneSync
              </button>
            ) : null}
            {canReinstall ? (
              <button
                type="button"
                className="addon-primary-action"
                onClick={() => void runAction("reinstall", reinstallAddon, "Reinstalación iniciada.")}
                disabled={busy}
              >
                <RotateCcw aria-hidden="true" />
                Reinstalar KeystoneSync
              </button>
            ) : null}
          </div>
        )}

        <div className="addon-feedback" aria-live="polite">
          {error ? <p className="addon-feedback__error" role="alert">{error}</p> : null}
          {!error && message ? <p className="addon-feedback__message" role="status">{message}</p> : null}
        </div>
      </div>

      <aside className="addon-status-column">
        <section className="addon-status-card" aria-labelledby="addon-status-title">
          <div className="addon-status-heading">
            <ShieldCheck aria-hidden="true" />
            <h2 id="addon-status-title">Estado del addon</h2>
          </div>

          <dl className="addon-status-list" aria-label="Estado del addon">
            <AddonStatusRow
              icon={Download}
              label="Instalado"
              value={addon.installed ? "Sí" : "No"}
              tone={addon.installed ? "good" : "bad"}
              badge
            />
            <AddonStatusRow icon={Tag} label="Última versión" value={formatVersion(addon.latestVersion)} />
            <AddonStatusRow icon={Activity} label="Estado" value={statusText} tone={statusTextTone} />
            <AddonStatusRow icon={Globe} label="Origen" value={sourceLabel(addon.source)} />
            <AddonStatusRow
              icon={Database}
              label="Caché local"
              value={addon.cacheAvailable ? "disponible" : "no disponible"}
              tone={addon.cacheAvailable ? "good" : "default"}
            />
            <AddonStatusRow
              icon={Clock3}
              label="Última comprobación"
              value={formatLastCheck(addon.lastCheckAt, preview)}
            />
          </dl>

          <button
            type="button"
            className="addon-check-action"
            onClick={() => void runAction("check", checkAddon, "Estado del addon actualizado.")}
            disabled={busy}
          >
            {busyAction === "check" ? <LoaderCircle className="addon-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
            {busyAction === "check" ? "Comprobando..." : "Buscar actualizaciones"}
          </button>
        </section>
      </aside>
    </section>
  );
}

function AddonStatusRow({
  icon: Icon,
  label,
  value,
  tone = "default",
  badge = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: StatusTone;
  badge?: boolean;
}) {
  return (
    <div className="addon-status-row">
      <Icon aria-hidden="true" />
      <dt>{label}</dt>
      <dd className={`addon-status-row__value addon-status-row__value--${tone}${badge ? " addon-status-row__value--badge" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
