import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PackageOpen } from "lucide-react";
import { useI18n } from "../core/i18n";
import { SEASON_2_DUNGEON_BY_ID } from "../core/season2";
import { specName } from "../core/wowSpecs";
import type { KeystoneSelectorObjective } from "../core/types";

type Position = { left: number; top: number; scale: number };

function tooltipPosition(target: HTMLElement): Position {
  const rect = target.getBoundingClientRect();
  const frame = document.querySelector<HTMLElement>(".ks-app-frame");
  const scale = frame ? frame.getBoundingClientRect().width / 1672 : 1;
  const width = 320 * scale;
  const height = 330 * scale;
  const left = rect.right + 12 + width <= window.innerWidth ? rect.right + 12 : Math.max(8, rect.left - width - 12);
  return { left, top: Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - height - 8)), scale };
}

export function TeamItemTooltip({ objective }: { objective: KeystoneSelectorObjective }) {
  const { t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 0, top: 0, scale: 1 });
  const name = objective.itemName ?? t("teams.itemFallback", { id: objective.itemId });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => triggerRef.current && setPosition(tooltipPosition(triggerRef.current));
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!triggerRef.current?.contains(node) && !tooltipRef.current?.contains(node)) {
        setOpen(false); setPinned(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setPinned(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const source = typeof objective.sourceId === "number" ? SEASON_2_DUNGEON_BY_ID.get(objective.sourceId)?.name : String(objective.sourceId);
  const quality = objective.qualityType ?? "UNKNOWN";
  return <>
    <button
      aria-label={name}
      className={`teams-item teams-item--tier-${[1, 2, 3, 4, 5].includes(objective.tier) ? objective.tier : "other"}`}
      onBlur={() => !pinned && setOpen(false)}
      onClick={() => { setPinned(current => !current); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
      ref={triggerRef}
      type="button"
    >
      <span className="teams-item__icon">
        {objective.iconUrl ? <img alt="" src={objective.iconUrl} /> : <PackageOpen aria-hidden="true" />}
      </span>
      <span>{name}</span>
      {objective.voidcoreState === "voidcore_not_checked" ? <i aria-label={t("teams.voidcoreUnchecked")}>?</i> : null}
    </button>
    {open ? createPortal(
      <div
        className="teams-tooltip"
        data-quality={quality}
        ref={tooltipRef}
        role="tooltip"
        style={{ left: position.left, top: position.top, "--teams-tooltip-scale": position.scale } as CSSProperties}
      >
        <strong className={`teams-tooltip__name teams-tooltip__name--quality-${quality.toLowerCase()}`}>{name}</strong>
        {[objective.slotName, objective.itemClassName, objective.itemSubClassName].filter(Boolean).length > 0
          ? <p>{[objective.slotName, objective.itemClassName, objective.itemSubClassName].filter(Boolean).join(" · ")}</p> : null}
        {objective.statNames.length > 0 ? <ul className="teams-tooltip__stats">
          {objective.primaryStatNames.map(stat => <li className="teams-tooltip__primary-stat" key={stat}>{stat}</li>)}
          {objective.secondaryStatNames.map(stat => <li className="teams-tooltip__secondary-stat" key={stat}>{stat}</li>)}
          {objective.otherStatNames.map(stat => <li className="teams-tooltip__other-stat" key={stat}>{stat}</li>)}
        </ul> : null}
        <div className="teams-tooltip__meta">
          {source ? <span>{t("teams.source")}: {source}</span> : null}
          <span>{t("teams.spec")}: {objective.specIds.map(specName).join(" · ")}</span>
          <span>{t("teams.tier")}: {objective.tier}</span>
          <span>{t(`teams.voidcore.${objective.voidcoreState}`)}</span>
        </div>
      </div>, document.body,
    ) : null}
  </>;
}
