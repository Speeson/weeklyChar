import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
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
import { useI18n, type TranslationKey } from "../core/i18n";
import type { ThemeIconRole } from "../theme/icon.registry";
import { useThemeAsset } from "../theme/useThemeAsset";

type AddonPageProps = {
  initialAddon: AddonStatus;
  initialWow: WowState;
  onWowChanged: (wow: WowState) => void;
  preview?: boolean;
};

type AddonAction = "check" | "install" | "update" | "reinstall";
type StatusTone = "default" | "good" | "bad" | "notice";

function formatError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }
  return fallback;
}

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

function stateLabel(status: AddonStatus, t: Translate): string {
  switch (status.state) {
    case "current":
      return t("addon.current");
    case "update-available":
      return t("addon.updateAvailable");
    case "local-newer":
      return t("addon.localNewer");
    case "offline-cache":
      return t("addon.offlineCache");
    case "unavailable":
      return t("common.notAvailable");
    case "error":
      return t("common.error");
    default:
      return t("addon.installAvailable");
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

function formatLastCheck(value: string | null, preview: boolean, language: "es" | "en", t: Translate): string {
  if (preview) {
    return t("addon.minutesAgo", { count: 2 });
  }
  if (!value) {
    return t("addon.notChecked");
  }

  const checkedAt = new Date(value);
  if (!Number.isFinite(checkedAt.getTime())) {
    return t("addon.notChecked");
  }
  const elapsedMs = Date.now() - checkedAt.getTime();
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
    const elapsedMinutes = Math.floor(elapsedMs / 60_000);
    if (elapsedMinutes < 1) {
      return t("addon.now");
    }
    if (elapsedMinutes < 60) {
      return t("addon.minutesAgo", { count: elapsedMinutes });
    }
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return t("addon.hoursAgo", { count: elapsedHours });
    }
  }

  return checkedAt.toLocaleString(language === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: AddonStatus["source"], t: Translate): string {
  if (source === "remote") {
    return "KeystoneSync releases";
  }
  if (source === "cache") {
    return t("addon.localCache");
  }
  return t("common.notAvailable");
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
  const { language, t } = useI18n();
  const appIcon = useThemeAsset("brand-emblem");
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
          setError(formatError(caught, t("addon.errorGeneric")));
        }
      });

    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, [language, preview]);

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
      setError(formatError(caught, t("addon.errorGeneric")));
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
        title: t("addon.folderDialog"),
      });
      if (typeof selectedPath !== "string") {
        return;
      }

      const nextWow = await selectWowInstall({ path: selectedPath });
      setWow(nextWow);
      onWowChanged(nextWow);
      setMessage(t("addon.folderUpdated"));
    } catch (caught) {
      setError(formatError(caught, t("addon.errorGeneric")));
    } finally {
      setFolderBusy(false);
    }
  }

  async function openAddonDirectory() {
    const addonsPath = wow.install.addonsPath;
    if (!addonsPath) {
      setError(t("addon.selectValidFolder"));
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
      setError(formatError(caught, t("addon.errorGeneric")));
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
      setError(formatError(caught, t("addon.errorGeneric")));
    }
  }

  const busy = busyAction !== null || addon.operation !== null || folderBusy;
  const canInstall = addon.state === "not-installed" || addon.state === "offline-cache";
  const canUpdate = addon.state === "update-available";
  const canReinstall = addon.installed;
  const statusText = addon.operation?.message || stateLabel(addon, t);
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
          {t("addon.description")}
        </p>

        <section className="addon-path-card" aria-labelledby="addon-path-title">
          <div className="addon-section-heading">
            <ThemedIcon name="folder" />
            <h2 id="addon-path-title">{t("addon.path")}</h2>
          </div>

          <div className="addon-path-field">
            <span title={addonsPath ?? undefined}>{addonsPath ?? t("addon.noPath")}</span>
            <button
              type="button"
              className="addon-copy-button"
              aria-label={copied ? t("addon.pathCopied") : t("addon.copyPath")}
              onClick={() => void copyAddonPath()}
              disabled={!addonsPath}
            >
              {copied ? <ThemedIcon name="confirm" /> : <ThemedIcon name="copy" />}
            </button>
          </div>

          <div className="addon-folder-actions">
            <button type="button" onClick={() => void chooseAddonFolder()} disabled={busy}>
              <ThemedIcon name="folder" />
              {t("addon.selectFolder")}
            </button>
            <button type="button" onClick={() => void openAddonDirectory()} disabled={!addonsPath || busy}>
              <ThemedIcon name="external-link" />
              {t("addon.openFolder")}
            </button>
          </div>
        </section>

        {canInstall ? (
          <button
            type="button"
            className="addon-primary-action"
            onClick={() => void runAction("install", installAddon, t("addon.installStarted"))}
            disabled={busy}
          >
            <ThemedIcon name="download" />
            {t("addon.install")}
          </button>
        ) : (
          <div className={`addon-primary-actions${canUpdate && canReinstall ? "" : " addon-primary-actions--single"}`}>
            {canUpdate ? (
              <button
                type="button"
                className="addon-primary-action"
                onClick={() => void runAction("update", updateAddon, t("addon.updateStarted"))}
                disabled={busy}
              >
                <ThemedIcon name="refresh" />
                {t("addon.update")}
              </button>
            ) : null}
            {canReinstall ? (
              <button
                type="button"
                className="addon-primary-action"
                onClick={() => void runAction("reinstall", reinstallAddon, t("addon.reinstallStarted"))}
                disabled={busy}
              >
                <ThemedIcon name="reinstall" />
                {t("addon.reinstall")}
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
            <ThemedIcon name="status-verified" />
            <h2 id="addon-status-title">{t("addon.statusTitle")}</h2>
          </div>

          <dl className="addon-status-list" aria-label={t("addon.statusTitle")}>
            <AddonStatusRow
              icon="status-installed"
              label={t("addon.installed")}
              value={addon.installed ? t("addon.yes") : t("addon.no")}
              tone={addon.installed ? "good" : "bad"}
              badge
            />
            <AddonStatusRow icon="status-version" label={t("addon.latest")} value={formatVersion(addon.latestVersion)} />
            <AddonStatusRow icon="status-activity" label={t("addon.state")} value={statusText} tone={statusTextTone} />
            <AddonStatusRow icon="status-source" label={t("addon.source")} value={sourceLabel(addon.source, t)} />
            <AddonStatusRow
              icon="status-cache"
              label={t("addon.cache")}
              value={addon.cacheAvailable ? t("addon.available") : t("addon.unavailable")}
              tone={addon.cacheAvailable ? "good" : "default"}
            />
            <AddonStatusRow
              icon="status-last-check"
              label={t("addon.lastCheck")}
              value={formatLastCheck(addon.lastCheckAt, preview, language, t)}
            />
          </dl>

          <button
            type="button"
            className="addon-check-action"
            onClick={() => void runAction("check", checkAddon, t("addon.statusUpdated"))}
            disabled={busy}
          >
            {busyAction === "check" ? <ThemedIcon className="addon-spin" name="loading" /> : <ThemedIcon name="search" />}
            {busyAction === "check" ? t("addon.checking") : t("addon.check")}
          </button>
        </section>
      </aside>
    </section>
  );
}

function AddonStatusRow({
  icon,
  label,
  value,
  tone = "default",
  badge = false,
}: {
  icon: ThemeIconRole;
  label: string;
  value: string;
  tone?: StatusTone;
  badge?: boolean;
}) {
  return (
    <div className="addon-status-row">
      <ThemedIcon name={icon} />
      <dt>{label}</dt>
      <dd className={`addon-status-row__value addon-status-row__value--${tone}${badge ? " addon-status-row__value--badge" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
