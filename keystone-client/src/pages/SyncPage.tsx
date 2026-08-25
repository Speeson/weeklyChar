import { useEffect, useMemo, useState } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
import {
  MISSING_CHARACTER_VALUE,
  MISSING_VALUE_COLOR,
  classColor,
  displayNumber,
  itemLevelColor,
  raiderIoColor,
  sortCharacters,
  type CharacterSortKey,
  type SortDirection,
} from "../core/characterDisplay";
import { openRaiderIoCharacter } from "../core/native";
import { useI18n, type TranslationKey } from "../core/i18n";
import { forceSync, getSyncStatus, subscribeToSyncEvents } from "../core/sync";
import type { AddonStatus, Character, CharacterState, CoreError, SyncState, SyncStatus, WowState } from "../core/types";
import type { ThemeAssetRole } from "../theme/asset.registry";
import { useThemeAsset } from "../theme/useThemeAsset";

type SyncPageProps = {
  appVersion: string;
  initialAddon: AddonStatus;
  initialCharacters?: CharacterState;
  initialSync: SyncStatus;
  initialWow?: WowState;
  preview?: boolean;
};

type SyncAction = "refresh" | "force";

const emptyWow: WowState = {
  install: { detected: false, installPath: null, retailPath: null, addonsPath: null },
  accounts: [],
  selectedAccounts: [],
};

function formatError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return fallback;
}

function formatTime(value: string | null, language: "es" | "en" = "es"): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null, language: "es" | "en" = "es", noSyncs = "Sin sincronizaciones"): string {
  if (!value) {
    return noSyncs;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

type SyncPresentation = {
  detail: string;
  icon: ThemeAssetRole;
  label: string;
  state: SyncState;
};

type AddonPresentation = {
  detail: string;
  icon: ThemeAssetRole;
  label: string;
  tone: "error" | "idle" | "info" | "success" | "warning";
};

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

function stateMeta(state: SyncState, t: Translate): SyncPresentation {
  switch (state) {
    case "watching":
      return { state, label: t("sync.watchingLabel"), detail: t("sync.watchingDetail"), icon: "sync-status-info" };
    case "syncing":
      return { state, label: t("sync.syncingLabel"), detail: t("sync.syncingDetail"), icon: "sync-status-syncing" };
    case "success":
      return { state, label: t("sync.successLabel"), detail: t("sync.successDetail"), icon: "sync-status-success" };
    case "error":
      return { state, label: t("sync.errorLabel"), detail: t("sync.errorDetail"), icon: "sync-status-error" };
    default:
      return { state, label: t("sync.idleLabel"), detail: t("sync.idleDetail"), icon: "sync-status-warning" };
  }
}

function addonMeta(addon: AddonStatus, t: Translate): AddonPresentation {
  if (addon.operation && addon.operation.state !== "failed") {
    const operationLabel = {
      install: t("addon.installing"),
      reinstall: t("addon.reinstalling"),
      update: t("addon.updating"),
    }[addon.operation.action];
    return {
      label: operationLabel,
      detail: addon.operation.message || t("addon.operation"),
      icon: "addon-status-operation",
      tone: "info",
    };
  }

  switch (addon.state) {
    case "current":
      return {
        label: t("addon.current"),
        detail: addon.installedVersion ? t("addon.installedVersion", { version: addon.installedVersion }) : t("addon.latestInstalled"),
        icon: "addon-status-current",
        tone: "success",
      };
    case "update-available":
      return {
        label: t("addon.updateAvailable"),
        detail: addon.latestVersion ? t("addon.versionAvailable", { version: addon.latestVersion }) : t("addon.newVersion"),
        icon: "addon-status-update",
        tone: "warning",
      };
    case "local-newer":
      return {
        label: t("addon.localVersion"),
        detail: addon.installedVersion ? t("addon.installedVersion", { version: addon.installedVersion }) : t("addon.localDetected"),
        icon: "addon-status-local-newer",
        tone: "info",
      };
    case "offline-cache":
      return { label: t("addon.offline"), detail: t("addon.cacheAvailable"), icon: "addon-status-offline-cache", tone: "info" };
    case "unavailable":
      return { label: t("common.notAvailable"), detail: addon.message || t("addon.notFound"), icon: "addon-status-unavailable", tone: "error" };
    case "error":
      return { label: t("addon.errorTitle"), detail: addon.message || t("addon.reviewInstall"), icon: "addon-status-error", tone: "error" };
    default:
      return { label: t("addon.notInstalled"), detail: t("addon.installAvailable"), icon: "addon-status-not-installed", tone: "error" };
  }
}

export function SyncPage({ appVersion, initialAddon, initialCharacters, initialSync, initialWow, preview = false }: SyncPageProps) {
  const { language, t } = useI18n();
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
        setMessage(t("sync.syncedCount", { count: event.data.syncedCharacters }));
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
          setError(formatError(caught, t("sync.errorGeneric")));
        }
      });

    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, [language, preview]);

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
      setError(formatError(caught, t("sync.errorGeneric")));
    } finally {
      setBusyAction(null);
    }
  }

  const status = stateMeta(sync.state, t);
  const addonStatus = addonMeta(initialAddon, t);
  const wow = initialWow ?? emptyWow;
  const characterState = initialCharacters ?? {
    characters: [],
    refreshing: false,
    source: "none" as const,
    lastRefreshAt: null,
    lastError: null,
  };
  const lastSyncAt = sync.lastSuccessAt ?? sync.lastSyncAt;
  const accountCount = preview ? 8 : sync.selectedAccounts || wow.selectedAccounts.length;
  const characterCount = characterState.characters.length;
  const syncing = sync.state === "syncing";
  const busy = busyAction !== null;
  const forceDisabled = busy || syncing || sync.selectedAccounts === 0;

  return (
    <section className="sync-screen" aria-labelledby="sync-title">
      <div className="sync-main">
        <h1 id="sync-title" className="sr-only">{t("shell.sync")}</h1>
        <SyncSummaryCards
          accountCount={accountCount}
          addon={addonStatus}
          characterCount={characterCount}
          lastSyncAt={lastSyncAt}
          language={language}
        />
        <CharactersTable
          characters={characterState.characters}
          error={characterState.lastError}
          loading={characterState.refreshing}
          onOpenError={(caught) => setError(formatError(caught, t("sync.errorGeneric")))}
        />
      </div>

      <SyncSidebar
        appVersion={appVersion}
        busy={busy}
        forceDisabled={forceDisabled}
        lastSyncAt={lastSyncAt}
        language={language}
        message={message}
        onForce={() => runAction("force", forceSync, t("sync.forced"))}
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
  language: "es" | "en";
};

function SyncSummaryCards({ accountCount, addon, characterCount, lastSyncAt, language }: SummaryProps) {
  const { t } = useI18n();
  return (
    <div className="sync-summary-grid" aria-label={t("sync.summary")}>
      <SummaryCard detail={addon.detail} icon={addon.icon} label={t("common.addon")} tone={addon.tone} value={addon.label} />
      <SummaryCard icon="sync-summary-accounts" label={t("sync.accounts")} value={accountCount} detail={t("sync.connectedAccounts")} />
      <SummaryCard icon="sync-summary-last" label={t("sync.last")} value={formatTime(lastSyncAt, language)} detail={formatDate(lastSyncAt, language, t("sync.noSyncs"))} />
      <SummaryCard icon="sync-summary-characters" label={t("sync.characters")} value={characterCount} detail={t("sync.detected")} />
    </div>
  );
}

type SummaryCardProps = {
  detail: string;
  icon: ThemeAssetRole;
  label: string;
  tone?: "error" | "idle" | "info" | "success" | "warning";
  value: string | number;
};

function SummaryCard({ detail, icon, label, tone, value }: SummaryCardProps) {
  const iconSource = useThemeAsset(icon);
  return (
    <article
      aria-label={`${label}: ${value}`}
      className={`sync-summary-card sync-summary-card--${tone ?? "metric"}`}
    >
      <img alt="" className="sync-summary-card__icon" src={iconSource} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

type CharactersTableProps = {
  characters: Character[];
  error: string | null;
  loading: boolean;
  onOpenError: (error: unknown) => void;
};

function CharactersTable({ characters, error, loading, onOpenError }: CharactersTableProps) {
  const { t } = useI18n();
  const columns: Array<{ key: CharacterSortKey; label: string }> = [
    { key: "name", label: t("sync.name") }, { key: "realm", label: t("sync.realm") },
    { key: "ilvl", label: "ilvl" }, { key: "keystone", label: t("sync.keystone") },
    { key: "rioScore", label: "Raider.IO" },
  ];
  const [sortKey, setSortKey] = useState<CharacterSortKey>("rioScore");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const rows = useMemo(
    () => sortCharacters(characters, sortKey, direction),
    [characters, direction, sortKey],
  );

  function changeSort(nextKey: CharacterSortKey) {
    if (nextKey === sortKey) {
      setDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setDirection(nextKey === "name" || nextKey === "realm" ? "asc" : "desc");
  }

  function openCharacter(character: Character) {
    void openRaiderIoCharacter(character.region, character.realm, character.name).catch(onOpenError);
  }

  return (
    <section className="sync-table-panel" aria-labelledby="characters-title">
      <h2 id="characters-title" className="sr-only">{t("sync.characters")}</h2>
      <div className="sync-table" role="table" aria-label={t("sync.characterTable")}>
        <div className="sync-table__header" role="row">
          {columns.map((column) => {
            const active = sortKey === column.key;
            const sortIcon = active ? direction === "asc" ? "sort-ascending" : "sort-descending" : "sort-unsorted";
            return (
              <span aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} key={column.key} role="columnheader">
                <button className="sync-table__sort" onClick={() => changeSort(column.key)} type="button">
                  {column.label}
                  <ThemedIcon name={sortIcon} size={15} />
                </button>
              </span>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <p className="sync-table__empty" role={error ? "alert" : "status"}>
            {loading ? t("sync.loadingCharacters") : error ?? t("sync.noCharacters")}
          </p>
        ) : (
          <div className="sync-table__body" role="rowgroup">
          {rows.map((row) => (
            <div
              aria-label={t("sync.openRaiderIo", { name: row.name })}
              className="sync-table__row"
              key={row.id}
              onClick={() => openCharacter(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCharacter(row);
                }
              }}
              role="row"
              tabIndex={0}
            >
              <span className="sync-table__name" role="cell">
                <CharacterAvatar character={row} />
                <strong style={{ color: classColor(row.wowClass) }}>{row.name}</strong>
              </span>
              <span role="cell">{row.realm}</span>
              <span className="sync-table__ilvl" role="cell" style={{ color: itemLevelColor(row.ilvl) ?? MISSING_VALUE_COLOR }}>{displayNumber(row.ilvl)}</span>
              <span className="sync-table__key" role="cell">{row.keystoneDisplay || MISSING_CHARACTER_VALUE}</span>
              <span className="sync-table__rio" role="cell" style={{ color: raiderIoColor(row.rioScore) ?? MISSING_VALUE_COLOR }}>{displayNumber(row.rioScore)}</span>
            </div>
          ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CharacterAvatar({ character }: { character: Character }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [character.avatarUrl]);
  const color = classColor(character.wowClass);
  const showImage = Boolean(character.avatarUrl) && !failed;

  return (
    <span aria-hidden="true" className="sync-avatar" style={{ backgroundColor: color }}>
      <span>{character.name.slice(0, 1).toUpperCase()}</span>
      {showImage ? (
        <img
          alt=""
          onError={() => setFailed(true)}
          src={character.avatarUrl ?? undefined}
        />
      ) : null}
    </span>
  );
}

type SidebarProps = {
  appVersion: string;
  busy: boolean;
  forceDisabled: boolean;
  lastSyncAt: string | null;
  language: "es" | "en";
  message: string | null;
  onForce: () => void;
  status: ReturnType<typeof stateMeta>;
  sync: SyncStatus;
};

function SyncSidebar({ appVersion, busy, forceDisabled, lastSyncAt, language, message, onForce, status, sync }: SidebarProps) {
  const { t } = useI18n();
  const brandEmblem = useThemeAsset("brand-emblem");
  const heroFrame = useThemeAsset("sync-hero-frame");
  const statusIcon = useThemeAsset(status.icon);
  const versionIcon = useThemeAsset("sync-version");
  return (
    <aside className="sync-sidebar" aria-label={t("sync.status")}>
      <section className="sync-emblem-panel" aria-label="KeystoneClient">
        <div className="sync-emblem-panel__artwork">
          <img alt="" className="sync-emblem-panel__frame" src={heroFrame} />
          <img alt="" className="sync-emblem-panel__icon" src={brandEmblem} />
        </div>
        <section className="sync-version-panel">
          <img alt="" className="sync-version-panel__icon" src={versionIcon} />
          <div>
            <p>{t("sync.appVersion")}</p>
            <strong>v{appVersion}</strong>
            <span>{t("sync.updated")}</span>
          </div>
        </section>
      </section>

      <section
        aria-label={t("sync.currentAria", { status: status.label })}
        aria-live="polite"
        className={`sync-current-panel sync-current-panel--${status.state}`}
        data-sync-state={status.state}
      >
        <h2>{t("sync.currentStatus")}</h2>
        <div className="sync-current-panel__body">
          <img alt="" src={statusIcon} />
          <div>
            <strong>{status.label}</strong>
            <span>{sync.lastError ?? status.detail}</span>
            <small>{message ?? formatCurrentTimestamp(lastSyncAt, language, t("sync.noPrevious"), t("sync.noSyncs"))}</small>
          </div>
        </div>
      </section>

      <button className="sync-primary-action" disabled={forceDisabled} onClick={onForce} type="button">
        <ThemedIcon name="refresh" size={34} />
        {busy ? t("sync.syncing") : t("sync.now")}
      </button>
    </aside>
  );
}

function formatCurrentTimestamp(value: string | null, language: "es" | "en", noPrevious: string, noSyncs: string): string {
  if (!value) {
    return noPrevious;
  }

  return `${formatTime(value, language)} - ${formatDate(value, language, noSyncs)}`;
}
