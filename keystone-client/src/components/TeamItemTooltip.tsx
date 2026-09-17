import { Check, PackageOpen } from "lucide-react";
import { useI18n } from "../core/i18n";
import { compactItemSlotLabel } from "../core/itemSlotLabel";
import type { KeystoneSelectorObjective } from "../core/types";
import { WowheadTooltip } from "./WowheadTooltip";
import { UpgradeTrackIcon } from "./UpgradeTrackIcon";

function bonusIdsFromVariantKey(variantKey: string): number[] {
  const match = variantKey.match(/^bonus:(\d+(?:,\d+)*)$/);
  return match ? match[1].split(",").map(Number) : [];
}

export function TeamItemTooltip({ objective }: { objective: KeystoneSelectorObjective }) {
  const { language, t } = useI18n();
  const name = objective.itemName ?? t("teams.itemFallback", { id: objective.itemId });
  const bonusIds = bonusIdsFromVariantKey(objective.variantKey);
  const slotLabel = compactItemSlotLabel(objective, language);

  return <WowheadTooltip
    className={`teams-item teams-item--tier-${[1, 2, 3, 4, 5].includes(objective.tier) ? objective.tier : "other"}${objective.owned ? " is-owned" : ""}`}
    id={objective.itemId}
    label={name}
    options={{ bonus: bonusIds, ilvl: objective.itemLevel, spec: objective.specIds[0] }}
    type="item"
  >
    <>
      <span className="teams-item__icon">
        {objective.iconUrl ? <img alt="" src={objective.iconUrl} /> : <PackageOpen aria-hidden="true" />}
        <UpgradeTrackIcon track={objective.upgradeTrack} className="upgrade-track-icon--badge" />
        {slotLabel ? <span className="teams-item__slot" aria-hidden="true">{slotLabel}</span> : null}
        {objective.owned ? <i className="teams-item__owned" aria-label={t("teams.owned")}><Check aria-hidden="true" /></i> : null}
      </span>
      {objective.voidcoreState === "voidcore_not_checked" ? <i aria-label={t("teams.voidcoreUnchecked")}>?</i> : null}
    </>
  </WowheadTooltip>;
}
