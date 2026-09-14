import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { useI18n } from "../core/i18n";
import { buildWowheadTooltip, type WowheadOption, type WowheadType } from "../core/wowhead";

declare global {
  interface Window {
    whTooltips?: { colorLinks: boolean; iconizeLinks: boolean; renameLinks: boolean };
    $WowheadPower?: { refreshLinks?: () => void };
  }
}

const SCRIPT_ID = "keystonesync-wowhead-tooltips";
let refreshPending = false;

function scheduleWowheadRefresh() {
  if (refreshPending) return;
  refreshPending = true;
  queueMicrotask(() => {
    refreshPending = false;
    window.$WowheadPower?.refreshLinks?.();
  });
}

function ensureWowheadScript() {
  window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = "https://wow.zamimg.com/js/tooltips.js";
  script.addEventListener("load", scheduleWowheadRefresh);
  document.head.appendChild(script);
}

export function WowheadTooltipProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };
  }, []);
  return children;
}

export function WowheadTooltip({ children, type, id, options, label, className }: {
  children: ReactElement;
  type: WowheadType;
  id: number;
  options?: Record<string, WowheadOption>;
  label?: string | null;
  className?: string;
}) {
  const { language } = useI18n();
  const target = buildWowheadTooltip({ type, id, language, options });
  useEffect(() => {
    if (!target) return;
    ensureWowheadScript();
    scheduleWowheadRefresh();
  }, [target?.dataWowhead, target?.href]);
  if (!target) return <span className={className} title={label ?? undefined}>{children}</span>;
  return <a aria-label={label ?? undefined} className={className} data-wowhead={target.dataWowhead} href={target.href} onClick={(event) => event.preventDefault()}>{children}</a>;
}

const spellIconRequests = new Map<number, Promise<string | null>>();

function wowheadSpellIcon(spellId: number): Promise<string | null> {
  const existing = spellIconRequests.get(spellId);
  if (existing) return existing;
  const request = fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}`)
    .then(async response => response.ok ? response.json() as Promise<{ icon?: unknown }> : null)
    .then(payload => {
      const icon = payload?.icon;
      return typeof icon === "string" && /^[a-z0-9_-]+$/i.test(icon)
        ? `https://wow.zamimg.com/images/wow/icons/large/${icon.toLowerCase()}.jpg`
        : null;
    })
    .catch(() => null);
  spellIconRequests.set(spellId, request);
  return request;
}

export function WowheadSpellIcon({ className, spellId }: { className?: string; spellId: number }) {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setIconUrl(null);
    void wowheadSpellIcon(spellId).then(icon => { if (current) setIconUrl(icon); });
    return () => { current = false; };
  }, [spellId]);
  return <span aria-hidden="true" className={className} data-wowhead-spell-icon={spellId}>
    {iconUrl ? <img alt="" src={iconUrl} /> : null}
  </span>;
}
