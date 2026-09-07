import { useMemo, useState, type CSSProperties } from "react";
import type { Character, TalentEntrySnapshot, TalentNodeSnapshot, TalentTreeSnapshot } from "../core/types";
import { useI18n } from "../core/i18n";
import { WowheadTooltip } from "./WowheadTooltip";
import { blizzardIconUrl, talentTooltipSpellId } from "../core/wowhead";
import { classColor } from "../core/characterDisplay";
import { activeTalentEntry, localizedClassName, localizedHeroTreeName, localizedSpecName, talentPurchasedRanks } from "../core/talentDisplay";

function TalentIcon({ entry, region }: { entry?: TalentEntrySnapshot; region: string }) {
  const [failed, setFailed] = useState(false);
  const icon = entry?.iconPath?.startsWith("/") ? entry.iconPath : blizzardIconUrl(entry?.iconPath, region, entry?.iconFileID);
  return icon && !failed ? <img alt="" onError={() => setFailed(true)} src={icon} /> : <b>{(entry?.name ?? "?").slice(0, 1)}</b>;
}

function TalentTree({ tree, level, region, compact = false }: { tree?: TalentTreeSnapshot; level?: number | null; region: string; compact?: boolean }) {
  const geometry = useMemo(() => {
    const nodes = tree?.nodes ?? [];
    const xs = nodes.map(node => node.posX);
    const ys = nodes.map(node => node.posY);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const hero = tree?.type === "hero";
    const normalize = (value: number, minimum: number, maximum: number) => maximum === minimum
      ? 0.5
      : (value - minimum) / (maximum - minimum);
    const locate = (node: TalentNodeSnapshot) => ({
      x: (compact ? 14 : hero ? 11 : 8) + normalize(node.posX, minX, maxX) * (compact ? 72 : hero ? 78 : 84),
      y: 10 + normalize(node.posY, minY, maxY) * 80,
    });
    return { nodes, locate, byId: new Map(nodes.map(node => [node.nodeId, node])) };
  }, [compact, tree]);

  if (!tree || geometry.nodes.length === 0) return <div className="ks-talent-tree ks-talent-tree--empty">Sin datos</div>;
  return (
    <div className={`ks-talent-tree${compact ? " ks-talent-tree--compact" : ""}`} data-tree-type={tree.type}>
      <svg aria-hidden="true" className="ks-talent-tree__edges" viewBox="0 0 100 100" preserveAspectRatio="none">
        {geometry.nodes.flatMap(node => node.visibleEdges.map((edge, index) => {
          const target = geometry.byId.get(edge.targetNodeId); if (!target) return null;
          const from = geometry.locate(node); const to = geometry.locate(target);
          return <line className={edge.active ? "is-active" : ""} key={`${node.nodeId}-${edge.targetNodeId}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        }))}
      </svg>
      {geometry.nodes.map(node => {
        const entry = activeTalentEntry(node); const point = geometry.locate(node); const spellId = talentTooltipSpellId(entry?.spellId, entry?.overriddenSpellId); const purchasedRanks = talentPurchasedRanks(node);
        const content = (
          <span
            aria-label={`${entry?.name ?? `Nodo ${node.nodeId}`}, ${purchasedRanks}/${node.maxRanks}`}
            className={`ks-talent-node${purchasedRanks > 0 ? " is-selected" : ""}${node.entries.length > 1 ? " is-choice" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <TalentIcon entry={entry} region={region} />
            {node.maxRanks > 1 ? <em>{purchasedRanks}/{node.maxRanks}</em> : null}
            {node.entries.length > 1 ? <i aria-hidden="true">◆</i> : null}
          </span>
        );
        return spellId ? <WowheadTooltip id={spellId} key={node.nodeId} label={entry?.description || entry?.name} options={{ lvl: level }} type="spell">{content}</WowheadTooltip> : <span key={node.nodeId} title={entry?.description || entry?.name || undefined}>{content}</span>;
      })}
    </div>
  );
}

export function TalentModal({ character, onClose }: { character: Character; onClose: () => void }) {
  const { language } = useI18n();
  const [copied, setCopied] = useState(false);
  const talents = character.talents;
  const classTree = talents?.trees.find(tree => tree.type === "class");
  const heroTree = talents?.trees.find(tree => tree.type === "hero" && tree.active)
    ?? talents?.trees.find(tree => tree.type === "hero");
  const specTree = talents?.trees.find(tree => tree.type === "spec");
  const omnium = character.omniumFolio?.trees[0];
  const labels = language === "es" ? { class: "CLASE", hero: "TALENTOS HEROICOS", spec: "ESPECIALIZACIÓN", omnium: "FOLIO ÓMNIUM", close: "Cerrar", copy: "Copiar build", copied: "Build copiada" }
    : { class: "CLASS", hero: "HERO TALENTS", spec: "SPEC", omnium: "OMNIUM FOLIO", close: "Close", copy: "Copy build", copied: "Build copied" };
  const copy = async () => {
    if (!talents?.importString) return;
    await navigator.clipboard.writeText(talents.importString);
    setCopied(true);
  };
  const characterClass = talents?.className ?? talents?.class ?? character.wowClass ?? "";
  const localizedClass = localizedClassName(characterClass, language);
  const localizedSpec = localizedSpecName(talents?.specId, talents?.specName, language);
  const localizedHero = localizedHeroTreeName(heroTree, language);
  const identity = [character.name, [localizedClass, localizedSpec].filter(Boolean).join(" "), localizedHero].filter(Boolean).join(" - ");
  return (
    <div aria-labelledby="talent-modal-title" aria-modal="true" className="ks-talent-modal" role="dialog">
      <div className="ks-talent-modal__panel" style={{ "--class-color": classColor(character.wowClass ?? characterClass) } as CSSProperties}>
        <header><h2 className="ks-talent-modal__identity" id="talent-modal-title">{identity}</h2><button aria-label={labels.close} onClick={onClose} type="button">×</button></header>
        <div className="ks-talent-modal__content"><div className="ks-talent-modal__trees">
          {[[labels.class, classTree], [localizedHero ?? labels.hero, heroTree], [labels.spec, specTree]].map(([label, tree]) => (
            <section key={String(label)}><h3>{String(label)}</h3><TalentTree level={talents?.characterLevel} region={character.region} tree={tree as TalentTreeSnapshot | undefined} /></section>
          ))}
        </div>
          <section className="ks-talent-modal__omnium"><h3>{labels.omnium.split(" ").map(part => <span key={part}>{part}</span>)}</h3><TalentTree compact level={talents?.characterLevel} region={character.region} tree={omnium} /></section>
        </div>
        <footer><button disabled={!talents?.importString} onClick={() => void copy()} type="button">{copied ? labels.copied : labels.copy}</button></footer>
      </div>
    </div>
  );
}
