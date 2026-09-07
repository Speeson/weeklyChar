import { useEffect, type ReactElement, type ReactNode } from "react";
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
