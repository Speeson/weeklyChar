import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import accountsIcon from "../assets/keystone-ui/18-accounts-icon.png.png";
import charactersIcon from "../assets/keystone-ui/20-characters-icon.png.png";
import appIconHd from "../assets/keystone-ui/21-app-icon-hd.png";
import errorIcon from "../assets/keystone-ui/23-error-icon.png";
import warningIcon from "../assets/keystone-ui/24-warning-icon.png";
import syncIcon from "../assets/keystone-ui/27-sync-icon.png";
import infoIcon from "../assets/keystone-ui/28-info-icon.png";
import rightHeroPanelFrame from "../assets/keystone-ui/09-right-hero-panel-frame.png.png";
import lastSyncIcon from "../assets/keystone-ui/19-last-sync-icon.png.png";
import statusIcon from "../assets/keystone-ui/17-status-icon-success.png.png";
import versionIcon from "../assets/keystone-ui/22-version-icon.png";
import { forceSync, getSyncStatus, subscribeToSyncEvents } from "../core/sync";
import type { AddonStatus, CoreError, SyncState, SyncStatus, WowState } from "../core/types";

type SyncPageProps = {
  appVersion: string;
  initialAddon: AddonStatus;
  initialSync: SyncStatus;
  initialWow?: WowState;
  preview?: boolean;
};

type SyncAction = "refresh" | "force";

type CharacterRow = {
  id: string;
  name: string;
  realm: string;
  itemLevel: string;
  keystone: string;
  raiderIo: string;
  tone: string;
};

const previewRows: CharacterRow[] = [
  { id: "makabe", name: "Makabe", realm: "Zul'jin", itemLevel: "293", keystone: "+10 Kings' Rest", raiderIo: "2145", tone: "gold" },
  { id: "bakuhatsu", name: "Bakuhatsu", realm: "Zul'jin", itemLevel: "295", keystone: "+2 Temple of Sethraliss (ToS)", raiderIo: "-", tone: "pink" },
  { id: "dkimio", name: "Dkimio", realm: "Zul'jin", itemLevel: "289", keystone: "-", raiderIo: "-", tone: "red" },
  { id: "nakada", name: "Nakada", realm: "Zul'jin", itemLevel: "282", keystone: "-", raiderIo: "-", tone: "violet" },
  { id: "spee", name: "Spee", realm: "Zul'jin", itemLevel: "292", keystone: "+2 The Blinding Vale", raiderIo: "-", tone: "green" },
  { id: "speen", name: "Speen", realm: "Zul'jin", itemLevel: "288", keystone: "-", raiderIo: "-", tone: "cyan" },
  { id: "speeral-a", name: "Speeral", realm: "Zul'jin", itemLevel: "291", keystone: "+2 Murder Row", raiderIo: "-", tone: "orange" },
  { id: "speeral-b", name: "Speeral", realm: "Zul'jin", itemLevel: "291", keystone: "-", raiderIo: "-", tone: "blue" },
];

const emptyWow: WowState = {
  install: { detected: false, installPath: null, retailPath: null, addonsPath: null },
  accounts: [],
  selectedAccounts: [],
};

function formatError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return "No se pudo actualizar la sincronizacion.";
}

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Sin sincronizaciones";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

type SyncPresentation = {
  detail: string;
  icon: string;
  label: string;
  state: SyncState;
};

type AddonPresentation = {
  detail: string;
  icon: string;
  label: string;
  tone: "error" | "idle" | "info" | "success" | "warning";
};

function stateMeta(state: SyncState): SyncPresentation {
  switch (state) {
    case "watching":
      return { state, label: "Listo para sincronizar", detail: "Monitor activo", icon: infoIcon };
    case "syncing":
      return { state, label: "Sincronizando", detail: "Leyendo SavedVariables", icon: syncIcon };
    case "success":
      return { state, label: "Sincronizacion completada", detail: "Ultimo resultado: correcto", icon: statusIcon };
    case "error":
      return { state, label: "Error de sincronizacion", detail: "Revisa el ultimo resultado", icon: errorIcon };
    default:
      return { state, label: "Esperando sincronizacion", detail: "Monitor detenido", icon: warningIcon };
  }
}

function addonMeta(addon: AddonStatus): AddonPresentation {
  if (addon.operation && addon.operation.state !== "failed") {
    const operationLabel = {
      install: "Instalando Addon",
      reinstall: "Reinstalando Addon",
      update: "Actualizando Addon",
    }[addon.operation.action];
    return {
      label: operationLabel,
      detail: addon.operation.message || "Operacion en curso",
      icon: syncIcon,
      tone: "info",
    };
  }

  switch (addon.state) {
    case "current":
      return {
        label: "Actualizado",
        detail: addon.installedVersion ? `Version ${addon.installedVersion} instalada` : "Ultima version instalada",
        icon: statusIcon,
        tone: "success",
      };
    case "update-available":
      return {
        label: "Actualizacion disponible",
        detail: addon.latestVersion ? `Version ${addon.latestVersion} disponible` : "Nueva version disponible",
        icon: warningIcon,
        tone: "warning",
      };
    case "local-newer":
      return {
        label: "Version local superior",
        detail: addon.installedVersion ? `Version ${addon.installedVersion} instalada` : "Version local detectada",
        icon: infoIcon,
        tone: "info",
      };
    case "offline-cache":
      return { label: "Sin conexion", detail: "Cache del Addon disponible", icon: infoIcon, tone: "info" };
    case "unavailable":
      return { label: "No disponible", detail: addon.message || "No se encontro una version valida", icon: errorIcon, tone: "error" };
    case "error":
      return { label: "Error del Addon", detail: addon.message || "Revisa la instalacion", icon: errorIcon, tone: "error" };
    default:
      return { label: "No instalado", detail: "Instalacion disponible", icon: errorIcon, tone: "error" };
  }
}

function rowsFromWow(wow: WowState): CharacterRow[] {
  return wow.accounts.map((account, index) => ({
    id: account.name,
    name: account.name,
    realm: "-",
    itemLevel: "-",
    keystone: account.savedVariablesExists ? "-" : "KeystoneSync.lua no encontrado",
    raiderIo: "-",
    tone: ["gold", "pink", "cyan", "green", "blue"][index % 5],
  }));
}

export function SyncPage({ appVersion, initialAddon, initialSync, initialWow, preview = false }: SyncPageProps) {
  const [sync, setSync] = useState<SyncStatus>(initialSync);
  const [busyAction, setBusyAction] = useState<SyncAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSync(initialSync);
  }, [initialSync]);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;
    const unlisten = subscribeToSyncEvents((event) => {
      if (cancelled) {
        return;
      }
      if (event.event === "sync.started" || event.event === "sync.status") {
        setSync(event.data);
      }
      if (event.event === "sync.completed") {
        setSync(event.data.status);
        setMessage(`${event.data.syncedCharacters} personajes sincronizados.`);
        setError(null);
      }
      if (event.event === "sync.error") {
        setMessage(null);
      }
    });

    void getSyncStatus()
      .then((status) => {
        if (!cancelled) {
          setSync(status);
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

  async function runAction(action: SyncAction, request: () => Promise<SyncStatus>, success: string) {
    if (busyAction !== null) {
      return;
    }

    setBusyAction(action);
    setMessage(null);
    setError(null);
    try {
      const status = await request();
      setSync(status);
      setMessage(success);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  const status = stateMeta(sync.state);
  const addonStatus = addonMeta(initialAddon);
  const wow = initialWow ?? emptyWow;
  const rows = useMemo(() => (preview ? previewRows : rowsFromWow(wow)), [wow, preview]);
  const lastSyncAt = sync.lastSuccessAt ?? sync.lastSyncAt;
  const accountCount = preview ? 8 : sync.selectedAccounts || wow.selectedAccounts.length;
  const characterCount = preview ? previewRows.length : rows.length;
  const syncing = sync.state === "syncing";
  const busy = busyAction !== null;
  const forceDisabled = busy || syncing || sync.selectedAccounts === 0;

  return (
    <section className="sync-screen" aria-labelledby="sync-title">
      <div className="sync-main">
        <h1 id="sync-title" className="sr-only">Sincronizacion</h1>
        <SyncSummaryCards
          accountCount={accountCount}
          addon={addonStatus}
          characterCount={characterCount}
          lastSyncAt={lastSyncAt}
        />
        <CharactersTable rows={rows} />
      </div>

      <SyncSidebar
        appVersion={appVersion}
        busy={busy}
        forceDisabled={forceDisabled}
        lastSyncAt={lastSyncAt}
        message={message}
        onForce={() => runAction("force", forceSync, "Sincronizacion forzada.")}
        status={status}
        sync={sync}
      />

      {error ? <p className="error sync-screen__message" role="alert">{error}</p> : null}
    </section>
  );
}

type SummaryProps = {
  accountCount: number;
  addon: AddonPresentation;
  characterCount: number;
  lastSyncAt: string | null;
};

function SyncSummaryCards({ accountCount, addon, characterCount, lastSyncAt }: SummaryProps) {
  return (
    <div className="sync-summary-grid" aria-label="Resumen de sincronizacion">
      <SummaryCard detail={addon.detail} icon={addon.icon} label="Addon" tone={addon.tone} value={addon.label} />
      <SummaryCard icon={accountsIcon} label="Cuentas" value={accountCount} detail="Cuentas conectadas" />
      <SummaryCard icon={lastSyncIcon} label="Ultima sync" value={formatTime(lastSyncAt)} detail={formatDate(lastSyncAt)} />
      <SummaryCard icon={charactersIcon} label="Personajes" value={characterCount} detail="Detectados" />
    </div>
  );
}

type SummaryCardProps = {
  detail: string;
  icon: string;
  label: string;
  tone?: "error" | "idle" | "info" | "success" | "warning";
  value: string | number;
};

function SummaryCard({ detail, icon, label, tone, value }: SummaryCardProps) {
  return (
    <article
      aria-label={`${label}: ${value}`}
      className={`sync-summary-card sync-summary-card--${tone ?? "metric"}`}
    >
      <img alt="" className="sync-summary-card__icon" src={icon} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function CharactersTable({ rows }: { rows: CharacterRow[] }) {
  return (
    <section className="sync-table-panel" aria-labelledby="characters-title">
      <h2 id="characters-title" className="sr-only">Personajes</h2>
      <div className="sync-table" role="table" aria-label="Personajes sincronizados">
        <div className="sync-table__header" role="row">
          <span role="columnheader">Nombre</span>
          <span role="columnheader">Reino</span>
          <span role="columnheader">ilvl</span>
          <span role="columnheader">Piedra Angular</span>
          <span role="columnheader">Raider.IO</span>
        </div>
        {rows.length === 0 ? (
          <p className="sync-table__empty">No hay cuentas o personajes disponibles.</p>
        ) : (
          rows.map((row) => (
            <div className="sync-table__row" key={row.id} role="row">
              <span className="sync-table__name" role="cell">
                <span className={`sync-avatar sync-avatar--${row.tone}`} aria-hidden="true">
                  {row.name.slice(0, 1)}
                </span>
                <strong>{row.name}</strong>
              </span>
              <span role="cell">{row.realm}</span>
              <span className="sync-table__ilvl" role="cell">{row.itemLevel}</span>
              <span className="sync-table__key" role="cell">{row.keystone}</span>
              <span className="sync-table__rio" role="cell">{row.raiderIo}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type SidebarProps = {
  appVersion: string;
  busy: boolean;
  forceDisabled: boolean;
  lastSyncAt: string | null;
  message: string | null;
  onForce: () => void;
  status: ReturnType<typeof stateMeta>;
  sync: SyncStatus;
};

function SyncSidebar({ appVersion, busy, forceDisabled, lastSyncAt, message, onForce, status, sync }: SidebarProps) {
  return (
    <aside className="sync-sidebar" aria-label="Estado de sincronizacion">
      <section className="sync-emblem-panel" aria-label="KeystoneClient">
        <div className="sync-emblem-panel__artwork">
          <img alt="" className="sync-emblem-panel__frame" src={rightHeroPanelFrame} />
          <img alt="" className="sync-emblem-panel__icon" src={appIconHd} />
        </div>
        <section className="sync-version-panel">
          <img alt="" className="sync-version-panel__icon" src={versionIcon} />
          <div>
            <p>Version de la aplicacion</p>
            <strong>v{appVersion}</strong>
            <span>Actualizada</span>
          </div>
        </section>
      </section>

      <section
        aria-label={`Estado actual: ${status.label}`}
        aria-live="polite"
        className={`sync-current-panel sync-current-panel--${status.state}`}
        data-sync-state={status.state}
      >
        <h2>Estado actual</h2>
        <div className="sync-current-panel__body">
          <img alt="" src={status.icon} />
          <div>
            <strong>{status.label}</strong>
            <span>{sync.lastError ?? status.detail}</span>
            <small>{message ?? formatCurrentTimestamp(lastSyncAt)}</small>
          </div>
        </div>
      </section>

      <button className="sync-primary-action" disabled={forceDisabled} onClick={onForce} type="button">
        <RefreshCw aria-hidden="true" size={34} />
        {busy ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
    </aside>
  );
}

function formatCurrentTimestamp(value: string | null): string {
  if (!value) {
    return "Sin resultados anteriores";
  }

  return `${formatTime(value)} - ${formatDate(value)}`;
}
