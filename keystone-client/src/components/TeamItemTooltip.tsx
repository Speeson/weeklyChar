import { PackageOpen } from "lucide-react";
import { useI18n } from "../core/i18n";
import type { KeystoneSelectorObjective } from "../core/types";
import { WowheadTooltip } from "./WowheadTooltip";

function bonusIdsFromVariantKey(variantKey: string): number[] {
  const match = variantKey.match(/^bonus:(\d+(?:,\d+)*)$/);
  return match ? match[1].split(",").map(Number) : [];
}

export function TeamItemTooltip({ objective }: { objective: KeystoneSelectorObjective }) {
  const { t } = useI18n();
  const name = objective.itemName ?? t("teams.itemFallback", { id: objective.itemId });
  const bonusIds = bonusIdsFromVariantKey(objective.variantKey);

  return <WowheadTooltip
    className={`teams-item teams-item--tier-${[1, 2, 3, 4, 5].includes(objective.tier) ? objective.tier : "other"}`}
    id={objective.itemId}
    label={name}
    options={{ bonus: bonusIds, ilvl: objective.itemLevel, spec: objective.specIds[0] }}
    type="item"
  >
    <>
      <span className="teams-item__icon">
        {objective.iconUrl ? <img alt="" src={objective.iconUrl} /> : <PackageOpen aria-hidden="true" />}
      </span>
      <span>{name}</span>
      {objective.voidcoreState === "voidcore_not_checked" ? <i aria-label={t("teams.voidcoreUnchecked")}>?</i> : null}
    </>
  </WowheadTooltip>;
}
