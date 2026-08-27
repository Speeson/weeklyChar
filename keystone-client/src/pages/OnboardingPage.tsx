import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
import { detectWow, selectWowAccounts, selectWowInstall } from "../core/wow";
import type { CoreError, WowState } from "../core/types";
import { useI18n } from "../core/i18n";
import { useThemeAsset } from "../theme/useThemeAsset";

type OnboardingPageProps = {
  initialWow: WowState;
  onComplete: (wow: WowState) => void;
  onOpenAddon: () => void;
  onWowChanged: (wow: WowState) => void;
  preview?: boolean;
};

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }
  return fallback;
}

export function OnboardingPage({
  initialWow,
  onComplete,
  onOpenAddon,
  onWowChanged,
  preview = false,
}: OnboardingPageProps) {
  const { t } = useI18n();
  const appIcon = useThemeAsset("brand-mark");
  const [wow, setWow] = useState(initialWow);
  const [stage, setStage] = useState<"install" | "accounts">(
    initialWow.install.detected ? "accounts" : "install",
  );
  const [selected, setSelected] = useState(() => {
    if (initialWow.selectedAccounts.length > 0) {
      return initialWow.selectedAccounts;
    }
    const usable = initialWow.accounts.filter((account) => account.savedVariablesExists);
    return usable.length === 1 ? [usable[0].name] : [];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startupActionStarted = useRef(false);
  const usableAccounts = useMemo(
    () => wow.accounts.filter((account) => account.savedVariablesExists),
    [wow.accounts],
  );

  function applyWow(nextWow: WowState) {
    setWow(nextWow);
    setSelected(nextWow.selectedAccounts.filter((name) =>
      nextWow.accounts.some((account) => account.name === name && account.savedVariablesExists),
    ));
    onWowChanged(nextWow);
    return nextWow;
  }

  async function run(action: () => Promise<WowState>) {
    if (busy) {
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      return applyWow(await action());
    } catch (caught) {
      setError(errorMessage(caught, t("onboarding.error")));
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (preview || startupActionStarted.current) {
      return;
    }
    startupActionStarted.current = true;
    const initialUsableAccounts = initialWow.accounts.filter((account) => account.savedVariablesExists);
    let cancelled = false;
    setBusy(true);
    const startupAction = initialWow.install.detected && initialUsableAccounts.length === 1
      ? selectWowAccounts({ accounts: [initialUsableAccounts[0].name] })
      : initialWow.install.detected
        ? Promise.resolve(initialWow)
        : detectWow();
    startupAction
      .then((detected) => {
        if (!cancelled) {
          applyWow(detected);
          if (initialWow.install.detected && initialUsableAccounts.length === 1) {
            onComplete(detected);
          }
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(errorMessage(caught, t("onboarding.error")));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function browse() {
    const path = await open({ directory: true, multiple: false, title: t("onboarding.folderDialog") });
    if (typeof path === "string") {
      await run(() => selectWowInstall({ path }));
    }
  }

  async function continueFromInstall() {
    if (!wow.install.detected) {
      setError(t("onboarding.invalidInstall"));
      return;
    }
    if (usableAccounts.length === 1) {
      const saved = await run(() => selectWowAccounts({ accounts: [usableAccounts[0].name] }));
      if (saved) {
        onComplete(saved);
      }
      return;
    }
    setSelected(usableAccounts.map((account) => account.name));
    setStage("accounts");
  }

  async function saveAccounts() {
    const usableSelected = selected.filter((name) => usableAccounts.some((account) => account.name === name));
    if (usableSelected.length === 0) {
      setError(t("onboarding.selectAccount"));
      return;
    }
    const saved = await run(() => selectWowAccounts({ accounts: usableSelected }));
    if (saved) {
      onComplete(saved);
    }
  }

  return (
    <section className="ks-onboarding" aria-labelledby="onboarding-title">
      <header className="ks-onboarding__brand">
        <img alt="" src={appIcon} />
        <div><p className="shell__eyebrow">KeystoneClient</p><strong>{t("onboarding.firstRun")}</strong></div>
      </header>

      {stage === "install" ? (
        <div className="ks-onboarding__content">
          <div>
            <h1 id="onboarding-title">{t("onboarding.locationTitle")}</h1>
            <p>{t("onboarding.locationDescription")}</p>
          </div>
          <label className="ks-onboarding__path">
            <span>{t("onboarding.installFolder")}</span>
            <span>
              <input readOnly value={wow.install.installPath ?? ""} placeholder={t("onboarding.notDetected")} />
              <button disabled={busy} onClick={() => void browse()} type="button"><ThemedIcon name="folder" />{t("onboarding.change")}</button>
            </span>
          </label>
          <p className={wow.install.detected ? "success" : "muted"} role="status">
            {busy ? t("onboarding.searching") : wow.install.detected ? t("onboarding.valid") : t("onboarding.selectRetail")}
          </p>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <div className="ks-onboarding__actions">
            <button disabled={busy} onClick={() => void run(detectWow)} type="button"><ThemedIcon name="refresh" />{t("onboarding.detectAgain")}</button>
            <button className="settings-gold-action" disabled={busy || !wow.install.detected} onClick={() => void continueFromInstall()} type="button"><ThemedIcon name="save" />{t("onboarding.saveContinue")}</button>
          </div>
        </div>
      ) : (
        <div className="ks-onboarding__content">
          <div>
            <h1 id="onboarding-title">{t("onboarding.accountsTitle")}</h1>
            <p>{t("onboarding.accountsDescription")}</p>
          </div>
          {usableAccounts.length === 0 ? (
            <div className="ks-onboarding__empty">
              <strong>{t("onboarding.noData")}</strong>
              <p>{t("onboarding.noDataHelp")}</p>
            </div>
          ) : (
            <div className="ks-onboarding__accounts" aria-label={t("onboarding.accountsAvailable")}>
              {usableAccounts.map((account) => (
                <label key={account.name}>
                  <input
                    checked={selected.includes(account.name)}
                    onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, account.name])] : current.filter((name) => name !== account.name))}
                    type="checkbox"
                  />
                  <span><strong>{account.name}</strong><small>{t("onboarding.dataDetected")}</small></span>
                </label>
              ))}
            </div>
          )}
          {error ? <p className="error" role="alert">{error}</p> : null}
          <div className="ks-onboarding__actions">
            <button disabled={busy} onClick={() => void run(detectWow)} type="button"><ThemedIcon name="refresh" />{t("onboarding.redetect")}</button>
            {usableAccounts.length === 0 ? <button onClick={onOpenAddon} type="button">{t("onboarding.goAddon")}</button> : null}
            <button className="settings-gold-action" disabled={busy || selected.length === 0} onClick={() => void saveAccounts()} type="button">{t("onboarding.continue")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
