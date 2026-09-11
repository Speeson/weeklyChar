import { ChevronDown, ChevronRight, GripVertical, Power, PowerOff } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import medal1 from "../assets/medals/tier1.avif";
import medal2 from "../assets/medals/tier2.avif";
import medal3 from "../assets/medals/tier3.avif";
import { TalentModal } from "../components/TalentModal";
import { FloatingTooltip } from "../components/FloatingTooltip";
import { WowheadTooltip } from "../components/WowheadTooltip";
import { classColor } from "../core/characterDisplay";
import { loadInactiveCharacterIds, saveInactiveCharacterIds } from "../core/characterTracking";
import { CHARACTER_CURRENCIES, CHARACTER_CURRENCY_COLORS, currencyCapState, estimatedDungeonRating, keystoneColor } from "../core/characterSnapshots";
import { MIDNIGHT_SEASON_2_DUNGEONS } from "../core/season2";
import type { Character, CharacterCurrency, CharacterState, EquipmentItem, TalentTreeSnapshot } from "../core/types";
import { blizzardIconUrl } from "../core/wowhead";
import { useI18n } from "../core/i18n";
import { activeTalentEntry, localizedHeroTreeName, localizedSpecName, talentPurchasedRanks } from "../core/talentDisplay";

const qualityColors = ["#9d9d9d", "#fff", "#1eff00", "#0070dd", "#a335ee", "#ff8000", "#e6cc80"];
const medals = [medal1, medal1, medal2, medal3];
const number = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const safeImage = (value: string | null | undefined) => value && (/^(https?:\/\/|\/)/.test(value)) ? value : null;
const characterCopy = (language: "es" | "en") => language === "es" ? {
  account: "CUENTA", realm: "REINO", characters: "PERSONAJES",
  gear: "EQUIPO", itemLevel: "Nivel de objeto", setPieces: "Piezas de conjunto", talents: "TALENTOS",
  classTalents: "TALENTOS DE CLASE", heroTalents: "TALENTOS HEROICOS", specTalents: "TALENTOS DE ESPECIALIZACIÓN",
  dungeons: "MAZMORRAS", greatVault: "GRAN CÁMARA", preyHunts: "CACERÍAS", currencies: "MONEDAS", gold: "ORO",
  raids: "Bandas", world: "Mundo", weekly: "Semanal", season: "Temporada", maximum: "Máximo",
  noCap: "Sin límite relevante", completed: "Completado", showTalents: "Mostrar configuración completa", totalRating: "Rating total",
} : {
  account: "ACCOUNT", realm: "REALM", characters: "CHARACTERS",
  gear: "GEAR", itemLevel: "Item Level", setPieces: "Set Pieces", talents: "TALENTS",
  classTalents: "CLASS TALENTS", heroTalents: "HERO TALENTS", specTalents: "SPEC TALENTS",
  dungeons: "DUNGEONS", greatVault: "GREAT VAULT", preyHunts: "PREY HUNTS", currencies: "CURRENCIES", gold: "GOLD",
  raids: "Raids", world: "World", weekly: "Weekly", season: "Season", maximum: "Max",
  noCap: "No relevant cap", completed: "Completed", showTalents: "Show full build", totalRating: "Total rating",
};

const ENCHANT_ICON_FALLBACK = 463531;

function treeIdentity(tree: TalentTreeSnapshot | undefined, region: string) {
  const entry = tree?.nodes.flatMap(node => node.entries).find(candidate => candidate.selected)
    ?? tree?.nodes[0]?.entries[0];
  const treeIcon = safeImage(tree?.iconPath) ?? blizzardIconUrl(tree?.iconPath, region, tree?.iconFileID);
  const entryIcon = safeImage(entry?.iconPath) ?? blizzardIconUrl(entry?.iconPath, region, entry?.iconFileID);
  // Atlas file IDs are sprite sheets, not standalone CDN icons. The selected
  // talent entry is a stable, renderable identity fallback for the tree.
  return { name: tree?.name, icon: entryIcon ?? treeIcon };
}

function Portrait({ character }: { character: Character }) {
  const [failed, setFailed] = useState(false);
  return <span className="characters-portrait" style={{ "--class-color": classColor(character.wowClass) } as CSSProperties}>{character.avatarUrl && !failed ? <img alt="" onError={() => setFailed(true)} src={character.avatarUrl} /> : character.name[0]}</span>;
}

type AccountRealmOption = { account: string; realms: string[] };

function AccountRealmSelect({ account, label, onChange, options, realm }: {
  account: string;
  label: string;
  onChange: (account: string, realm: string) => void;
  options: AccountRealmOption[];
  realm: string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState(account);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setExpandedAccount(account);
  }, [account, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div className={"characters-select" + (open ? " is-open" : "")} ref={rootRef}>
    <button
      aria-controls={menuId}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={label}
      className="characters-select__trigger"
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], .characters-account-tree__account')?.focus());
        }
      }}
      ref={triggerRef}
      type="button"
    ><span><strong>{account || "—"}</strong><small>{realm || "—"}</small></span><ChevronDown aria-hidden="true"/></button>
    {open ? <div aria-label={label} className="characters-select__popover" id={menuId} role="menu">
      <strong>{label}</strong>
      <div className="characters-account-tree">{options.map(option => {
        const expanded = expandedAccount === option.account;
        return <section key={option.account}>
          <button aria-expanded={expanded} className="characters-account-tree__account" onClick={() => setExpandedAccount(expanded ? "" : option.account)} role="menuitem" type="button">
            <span><i aria-hidden="true">{option.account === account ? "✓" : ""}</i>{option.account}</span><ChevronRight aria-hidden="true"/>
          </button>
          {expanded ? <div className="characters-account-tree__realms">{option.realms.map(optionRealm => <button
            aria-pressed={option.account === account && optionRealm === realm}
            key={optionRealm}
            onClick={() => {
              onChange(option.account, optionRealm);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            role="menuitem"
            type="button"
          ><i aria-hidden="true">{option.account === account && optionRealm === realm ? "✓" : ""}</i><span>{optionRealm}</span></button>)}</div> : null}
        </section>;
      })}</div>
    </div> : null}
  </div>;
}

function GearItem({ item, character }: { item: EquipmentItem; character: Character }) {
  const [iconFailed, setIconFailed] = useState(false);
  const stackGems = item.gems.length > 1 && !item.enchant;
  const setItems = item.setId ? character.equipment?.items.filter(candidate => candidate.setId === item.setId).map(candidate => candidate.itemId) : [];
  const icon = safeImage(item.iconPath) ?? blizzardIconUrl(item.iconPath, character.region, item.iconFileID);
  const enchantIcon = item.enchant ? blizzardIconUrl(
    item.enchant.spellId ? item.enchant.iconPath : null,
    character.region,
    item.enchant.spellId ? item.enchant.iconFileID : ENCHANT_ICON_FALLBACK,
  ) : null;
  return <span className="gear-item" style={{ "--quality": qualityColors[item.quality ?? 0] ?? qualityColors[0] } as CSSProperties}>
    <WowheadTooltip className="gear-item__piece" id={item.itemId} label={`${item.itemName ?? item.slotName} · ${item.itemLevel ?? "?"}`} options={{ ench: item.enchant?.enchantId, gems: item.gems.map(gem => gem.itemId), bonus: item.bonusIds, ilvl: item.itemLevel, lvl: character.talents?.characterLevel, pcs: setItems, spec: character.talents?.specId }} type="item"><span className="gear-item__base">
      {icon && !iconFailed ? <img alt="" onError={() => setIconFailed(true)} src={icon} /> : <b>{item.slotName.slice(0, 2)}</b>}
      <strong>{item.itemLevel ?? "—"}</strong>
    </span></WowheadTooltip>
    <span className="gear-item__extras"><span className={`gear-item__gems${stackGems ? " gear-item__gems--stacked" : ""}`}>{item.gems.map((gem, index) => { const gemIcon = blizzardIconUrl(gem.iconPath, character.region, gem.iconFileID); return <WowheadTooltip className="gear-item__gem" id={gem.itemId} key={`${gem.itemId}-${index}`} label={gem.name} type="item">{gemIcon ? <img alt="" src={gemIcon}/> : <i>◆</i>}</WowheadTooltip>; })}</span>
      {item.enchant ? item.enchant.spellId ? <WowheadTooltip className="gear-item__enchant" id={item.enchant.spellId} label={item.enchant.name} type="spell">{enchantIcon ? <img alt="" src={enchantIcon}/> : <em aria-hidden="true">✦</em>}</WowheadTooltip> : <FloatingTooltip className="gear-item__enchant" label={item.enchant.name ?? "Encantamiento"}>{enchantIcon ? <img alt="" src={enchantIcon}/> : <em aria-hidden="true">✦</em>}</FloatingTooltip> : null}
    </span>
  </span>;
}

function TalentPreview({ tree, label, level, region }: { tree?: TalentTreeSnapshot; label: string; level?: number | null; region: string }) {
  const nodes = tree?.nodes.slice(0, 6) ?? [];
  return <div className="talent-preview"><small>{label}</small><div>{nodes.map(node => {
    const entry = activeTalentEntry(node);
    const icon = safeImage(entry?.iconPath) ?? blizzardIconUrl(entry?.iconPath, region, entry?.iconFileID);
    const content = <span className={talentPurchasedRanks(node) ? "is-selected" : ""}>{icon ? <img alt="" src={icon}/> : entry?.name?.slice(0, 1) ?? "?"}</span>;
    return entry?.spellId ? <WowheadTooltip id={entry.spellId} key={node.nodeId} label={entry.description || entry.name} options={{ lvl: level }} type="spell">{content}</WowheadTooltip> : <span key={node.nodeId} title={entry?.description || entry?.name || undefined}>{content}</span>;
  })}</div></div>;
}

function CurrencyIcon({ fallbackIcon, fallbackIconID, info, region, symbol }: { fallbackIcon: string; fallbackIconID: number; info?: CharacterCurrency; region: string; symbol: string }) {
  const [failed, setFailed] = useState(false); const icon = blizzardIconUrl(info?.iconPath ?? `Interface/Icons/${fallbackIcon}`, region, info?.iconFileID ?? fallbackIconID);
  return <span className="currency-card__icon">{icon && !failed ? <img alt="" onError={() => setFailed(true)} src={icon}/> : symbol}</span>;
}

function CurrencyCard({ currencyKey, info, language, region }: { currencyKey: typeof CHARACTER_CURRENCIES[number]; info?: CharacterCurrency; language: "es" | "en"; region: string }) {
  const copy = characterCopy(language);
  const caps = currencyCapState(info);
  const value = currencyKey.key === "sparksOfTides" ? number(info?.itemQuantity, number(info?.quantity)) : number(info?.quantity);
  const isBounty = currencyKey.key === "trovehuntersBounty";
  const hasCap = number(info?.maxWeeklyQuantity) > 0 || number(info?.maxQuantity) > 0;
  const label = language === "es" ? currencyKey.labelEs : currencyKey.label;
  return <WowheadTooltip className="currency-card-link" id={currencyKey.wowheadId} label={label} type={currencyKey.wowheadType}>
    <article className={`currency-card${caps.isMaxed ? " is-maxed" : ""}`} data-currency={currencyKey.key}>
      <CurrencyIcon fallbackIcon={currencyKey.iconName} fallbackIconID={currencyKey.iconFileID} info={info} region={region} symbol={currencyKey.symbol}/><div className="currency-card__content"><small style={{ color: CHARACTER_CURRENCY_COLORS[currencyKey.key] }}>{label}</small>{isBounty ? <strong className="currency-card__completed">✓ {copy.completed}</strong> : <div className="currency-card__values"><strong>{value}</strong><footer>
        {!hasCap ? <span>{copy.noCap}</span> : null}
        {number(info?.maxWeeklyQuantity) > 0 ? <span className={caps.isWeeklyMaxed ? "is-maxed" : ""}>{copy.weekly} {number(info?.quantityEarnedThisWeek)} / {number(info?.maxWeeklyQuantity)}</span> : null}
        {number(info?.maxQuantity) > 0 ? <span className={caps.isSeasonMaxed || caps.isTotalMaxed ? "is-maxed" : ""}>{info?.useTotalEarnedForMaxQty ? copy.season : copy.maximum} {info?.useTotalEarnedForMaxQty ? number(info?.totalEarned) : value} / {number(info?.maxQuantity)}</span> : null}
      </footer></div>}</div>
    </article>
  </WowheadTooltip>;
}

function ProgressPanels({ character, language }: { character: Character; language: "es" | "en" }) {
  const copy = characterCopy(language);
  const vault = record(character.vault); const prey = record(character.preyHunts);
  const category = (name: string) => record(vault[name === "Raids" ? "raid" : name.toLowerCase()]);
  const vaultNames = [["Raids", copy.raids], ["Dungeons", copy.dungeons], ["World", copy.world]] as const;
  const preyNames = [["Normal", "Normal"], ["Hard", language === "es" ? "Difícil" : "Hard"], ["Nightmare", language === "es" ? "Pesadilla" : "Nightmare"]] as const;
  const detailLines = (name: string, data: Record<string, unknown>, slot: Record<string, unknown>) => {
    const threshold = number(slot.threshold); const lines: { text: string; completed?: boolean }[] = [];
    if (name === "Dungeons") {
      const runs = (Array.isArray(data.topRuns) ? data.topRuns : []).map(record).slice(0, threshold);
      lines.push(...runs.map(run => ({ text: `+${number(run.level)} ${String(run.name ?? "")}`.trim() })));
      const completed = record(data.completedRuns); let remaining = Math.max(0, threshold - runs.length);
      const mythic = Math.min(remaining, number(completed.mythic)); remaining -= mythic;
      const heroic = Math.min(remaining, number(completed.heroic));
      lines.push(...Array.from({ length: mythic }, () => ({ text: language === "es" ? "Mítica" : "Mythic" })));
      lines.push(...Array.from({ length: heroic }, () => ({ text: language === "es" ? "Heroica" : "Heroic" })));
    } else if (name === "Raids") {
      lines.push(...(Array.isArray(slot.encounters) ? slot.encounters : []).map(record).map(encounter => {
        const completed = number(encounter.bestDifficulty) > 0 ? "✓" : "—";
        return { text: `${completed} ${String(encounter.name ?? encounter.encounterID ?? "")}`, completed: number(encounter.bestDifficulty) > 0 };
      }));
    } else {
      let remaining = threshold;
      for (const tier of (Array.isArray(data.tierProgress) ? data.tierProgress : []).map(record)) {
        const count = Math.min(remaining, number(tier.numPoints)); if (count <= 0) continue;
        lines.push({ text: language === "es" ? `Nivel ${number(tier.difficulty)} × ${count}` : `Tier ${number(tier.difficulty)} × ${count}` });
        remaining -= count; if (remaining <= 0) break;
      }
    }
    return lines;
  };
  return <><section className="characters-panel vault-panel"><h2>{copy.greatVault}</h2>{vaultNames.map(([name, label]) => { const data = category(name); const slots = (Array.isArray(data.slots) ? data.slots : []).map(record).sort((left, right) => number(left.threshold) - number(right.threshold)); const max = name === "Raids" ? 6 : 8; const progress = Math.min(max, Math.max(0, ...slots.map(slot => number(slot.progress)))); return <div key={name}><span>{label}</span><i>{[0, 1, 2].map(index => { const slot = slots[index]; const details = slot ? detailLines(name, data, slot) : []; return <span className="vault-slot" key={index} tabIndex={slot ? 0 : -1}><b>{slot?.unlocked ? number(slot.level) || "✓" : "—"}</b>{slot ? <span className="vault-slot__tooltip" role="tooltip"><strong>{language === "es" ? "Desbloquear recompensa" : "Unlock reward"}</strong><small>{number(slot.progress)} / {number(slot.threshold)}</small>{details.length ? details.map((detail, detailIndex) => <em className={detail.completed ? "is-completed" : undefined} key={`${detail.text}-${detailIndex}`}>{detail.text}</em>) : <em>{language === "es" ? "Sin actividad registrada" : "No recorded activity"}</em>}</span> : null}</span>; })}</i><strong>{progress} / {max}</strong></div>; })}</section>
    <section className="characters-panel prey-panel"><h2>{copy.preyHunts}</h2>{preyNames.map(([name, label]) => { const data = record(prey[name.toLowerCase()] ?? prey[name]); const count = number(data.count, number(data.progress)); return <div key={name}><span>{label}</span><strong>{count ? `${count} / 4` : "—"}</strong></div>; })}</section></>;
}

export function CharactersPage({ state }: { state: CharacterState }) {
  const { language } = useI18n();
  const copy = characterCopy(language);
  const accounts = useMemo(() => [...new Set(state.characters.map(value => value.wowAccount).filter((value): value is string => Boolean(value)))], [state.characters]);
  const accountOptions = useMemo<AccountRealmOption[]>(() => accounts.map(optionAccount => ({
    account: optionAccount,
    realms: [...new Set(state.characters.filter(value => value.wowAccount === optionAccount).map(value => value.realm))],
  })), [accounts, state.characters]);
  const [account, setAccount] = useState(""); const [realm, setRealm] = useState(""); const [selectedId, setSelectedId] = useState(""); const [talentsOpen, setTalentsOpen] = useState(false);
  const [accountSectionOpen, setAccountSectionOpen] = useState(true);
  const [charactersSectionOpen, setCharactersSectionOpen] = useState(true);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [inactiveCharacterIds, setInactiveCharacterIds] = useState(loadInactiveCharacterIds);
  const [draggingCharacterId, setDraggingCharacterId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<"active" | "inactive" | null>(null);
  useEffect(() => { if (!accounts.includes(account)) setAccount(accounts[0] ?? ""); }, [account, accounts]);
  const accountCharacters = useMemo(() => state.characters.filter(value => !account || value.wowAccount === account), [account, state.characters]);
  const realms = useMemo(() => [...new Set(accountCharacters.map(value => value.realm))], [accountCharacters]);
  useEffect(() => { if (!realms.includes(realm)) setRealm(realms[0] ?? ""); }, [realm, realms]);
  const visible = useMemo(() => accountCharacters.filter(value => !realm || value.realm === realm), [accountCharacters, realm]);
  const activeVisible = useMemo(() => visible.filter(value => !inactiveCharacterIds.has(value.id)), [inactiveCharacterIds, visible]);
  const inactiveVisible = useMemo(() => visible.filter(value => inactiveCharacterIds.has(value.id)), [inactiveCharacterIds, visible]);
  useEffect(() => {
    if (!visible.some(value => value.id === selectedId)) setSelectedId(activeVisible[0]?.id ?? visible[0]?.id ?? "");
  }, [activeVisible, selectedId, visible]);
  const character = visible.find(value => value.id === selectedId) ?? activeVisible[0] ?? visible[0];
  if (!character) return <div className="characters-empty">Sin personajes sincronizados.</div>;
  const moveCharacter = (characterId: string, active: boolean) => {
    setInactiveCharacterIds(current => {
      const next = new Set(current);
      if (active) next.delete(characterId); else next.add(characterId);
      saveInactiveCharacterIds(next);
      return next;
    });
    if (!active && selectedId === characterId) {
      setSelectedId(activeVisible.find(value => value.id !== characterId)?.id ?? characterId);
    }
  };
  const dropCharacter = (event: DragEvent<HTMLElement>, active: boolean) => {
    event.preventDefault();
    const characterId = event.dataTransfer.getData("text/plain") || draggingCharacterId;
    if (characterId && visible.some(value => value.id === characterId)) moveCharacter(characterId, active);
    setDraggingCharacterId(null);
    setDropTarget(null);
  };
  const renderCharacterCard = (value: Character, active: boolean) => <article
    className={`characters-card${value.id === character.id ? " is-selected" : ""}${active ? "" : " is-inactive"}${draggingCharacterId === value.id ? " is-dragging" : ""}`}
    data-character-id={value.id}
    draggable
    key={value.id}
    onDragEnd={() => { setDraggingCharacterId(null); setDropTarget(null); }}
    onDragStart={event => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", value.id);
      setDraggingCharacterId(value.id);
    }}
    style={{ "--class-color": classColor(value.wowClass) } as CSSProperties}
  >
    <GripVertical aria-hidden="true" className="characters-card__drag" />
    <button aria-pressed={value.id === character.id} className="characters-card__select" onClick={() => setSelectedId(value.id)} type="button">
      <Portrait character={value}/><span><strong>{value.name}</strong><small>{value.wowClass ?? "—"}</small></span><b aria-hidden="true">›</b>
    </button>
    <button
      aria-label={active ? (language === "es" ? "Mover a inactivos" : "Move to inactive") : (language === "es" ? "Mover a activos" : "Move to active")}
      className="characters-card__move"
      onClick={() => moveCharacter(value.id, !active)}
      title={active ? (language === "es" ? "Mover a inactivos" : "Move to inactive") : (language === "es" ? "Mover a activos" : "Move to active")}
      type="button"
    >{active ? <PowerOff aria-hidden="true"/> : <Power aria-hidden="true"/>}</button>
  </article>;
  const runs = character.mythicPlusSeason?.dungeons ?? [];
  const seasonRating = number(character.mythicPlusSeason?.rating, -1);
  const totalRating = seasonRating > 0 ? seasonRating : number(character.rioScore, -1);
  const tierSummary = character.equipment?.tierPieces?.filter(value => Number.isInteger(value?.tier) && value.tier > 0 && Number.isInteger(value?.count) && value.count > 0)
    .map(value => `${value.count} ${copy.setPieces} (T${value.tier})`).join(" · ");
  const trees = character.talents?.trees ?? [];
  const heroTree = trees.find(tree => tree.type === "hero" && tree.active) ?? trees.find(tree => tree.type === "hero");
  const specIdentity = treeIdentity(trees.find(tree => tree.type === "spec"), character.region);
  const heroIdentity = treeIdentity(heroTree, character.region);
  const specName = localizedSpecName(character.talents?.specId, character.talents?.specName, language);
  const heroName = localizedHeroTreeName(heroTree, language);
  const specIcon = safeImage(character.talents?.specIconPath) ?? blizzardIconUrl(character.talents?.specIconPath, character.region, character.talents?.specIconFileID) ?? specIdentity.icon;
  const bounty = CHARACTER_CURRENCIES.find(meta => meta.key === "trovehuntersBounty")!;
  const regularCurrencies = CHARACTER_CURRENCIES.filter(meta => meta.key !== "trovehuntersBounty");
  const goldIcon = blizzardIconUrl(null, character.region, 133785);
  return <div className="characters-page">
    <aside className="characters-rail">
      <section className="characters-rail-section" data-expanded={accountSectionOpen}>
        <button aria-expanded={accountSectionOpen} className="characters-rail-section__toggle" onClick={() => setAccountSectionOpen(current => !current)} type="button">
          <span><strong>{language === "es" ? "CUENTA Y REINO" : "ACCOUNT AND REALM"}</strong></span><ChevronDown aria-hidden="true"/>
        </button>
        {accountSectionOpen ? <div className="characters-rail-section__body"><AccountRealmSelect account={account} label={language === "es" ? "Cuenta y reino" : "Account and realm"} onChange={(nextAccount, nextRealm) => { setAccount(nextAccount); setRealm(nextRealm); }} options={accountOptions} realm={realm}/></div> : null}
      </section>
      <section className="characters-rail-section characters-rail-section--characters" data-expanded={charactersSectionOpen}>
        <button aria-expanded={charactersSectionOpen} className="characters-rail-section__toggle" onClick={() => setCharactersSectionOpen(current => !current)} type="button">
          <span><strong>{copy.characters}</strong></span><ChevronDown aria-hidden="true"/>
        </button>
        {charactersSectionOpen ? <div className="characters-list" data-inactive-expanded={inactiveOpen}>
          <section className="characters-zone" data-drop-active={dropTarget === "active"} data-zone="active" onDragEnter={() => setDropTarget("active")} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={event => dropCharacter(event, true)}>
            <header><span>{language === "es" ? "Activos" : "Active"}</span><b>{activeVisible.length}</b></header>
            <div>{activeVisible.length ? activeVisible.map(value => renderCharacterCard(value, true)) : <p>{language === "es" ? "Arrastra aquí los personajes activos" : "Drag active characters here"}</p>}</div>
          </section>
          <section className="characters-zone characters-zone--inactive" data-drop-active={dropTarget === "inactive"} data-expanded={inactiveOpen} data-zone="inactive" onDragEnter={() => setDropTarget("inactive")} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={event => dropCharacter(event, false)}>
            <button aria-expanded={inactiveOpen} className="characters-inactive-tray" onClick={() => setInactiveOpen(current => !current)} type="button"><span>{language === "es" ? "Inactivos" : "Inactive"}</span><b>{inactiveVisible.length}</b><ChevronDown aria-hidden="true"/></button>
            {inactiveOpen ? <div className="characters-inactive-tray__panel">{inactiveVisible.length ? inactiveVisible.map(value => renderCharacterCard(value, false)) : <p>{language === "es" ? "Arrastra aquí los que no quieras mostrar" : "Drag characters you want to hide here"}</p>}</div> : null}
          </section>
        </div> : null}
      </section>
    </aside>
    <div className="characters-dashboard">
      <div className="characters-top">
        <section className="characters-panel gear-panel"><h2>{copy.gear} <span>{character.equipment?.averageItemLevel ?? character.ilvl ?? "—"} {copy.itemLevel}</span><span>{tierSummary || `${character.equipment?.setPieces?.reduce((sum, set) => sum + set.count, 0) ?? 0} ${copy.setPieces}`}</span></h2>{character.equipment?.items.length ? <div className="gear-row">{character.equipment.items.map(item => <GearItem character={character} item={item} key={`${character.id}-${item.slotId}-${item.itemId}`}/>)}</div> : <p>Sin datos de equipo. Entra con este personaje y sincroniza.</p>}</section>
        <section className="characters-panel talents-panel"><h2>{copy.talents}</h2><div className="talents-panel__content"><div className="talents-panel__identity"><span>{specIcon ? <img alt="" src={specIcon}/> : null}<strong>{specName ?? "—"}</strong></span><span>{heroIdentity.icon ? <img alt="" src={heroIdentity.icon}/> : null}<strong>{heroName ?? "—"}</strong></span></div><div className="talents-panel__previews"><TalentPreview label={copy.classTalents} level={character.talents?.characterLevel} region={character.region} tree={trees.find(tree => tree.type === "class")}/><TalentPreview label={copy.heroTalents} level={character.talents?.characterLevel} region={character.region} tree={heroTree}/><TalentPreview label={copy.specTalents} level={character.talents?.characterLevel} region={character.region} tree={trees.find(tree => tree.type === "spec")}/></div><button aria-label={copy.showTalents} disabled={!character.talents?.trees.length} onClick={() => setTalentsOpen(true)} type="button">{copy.showTalents}</button></div></section>
      </div>
      <div className="characters-content"><div className="characters-main-column"><section className="characters-panel dungeons-panel"><h2>{copy.dungeons}<span className="dungeons-panel__rating"><small>{copy.totalRating}</small><strong>{totalRating > 0 ? Math.round(totalRating).toLocaleString(language === "es" ? "es-ES" : "en-US") : "—"}</strong></span></h2><div className="dungeon-grid">{MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => { const run = runs.find(value => number(value.challengeMapId) === dungeon.id); const level = number(run?.level); const upgrade = Math.min(number(run?.upgradeLevel), 3); const rating = estimatedDungeonRating(run); return <article key={dungeon.id}><img alt="" src={dungeon.teleportIconUrl}/><div><span>{language === "es" ? dungeon.nameEs : dungeon.name}</span><section><strong style={{ color: keystoneColor(level) }}>+{level || "—"}</strong>{upgrade > 0 ? <img alt={`+${upgrade}`} className="dungeon-medal" src={medals[upgrade]}/> : null}</section></div><b>{rating || "—"}<small>rating</small></b></article>; })}</div></section>
        <section className="characters-panel currencies-panel"><h2>{copy.currencies}</h2><div className="currencies-grid">{regularCurrencies.map(meta => <CurrencyCard currencyKey={meta} info={character.currencies?.[meta.key]} key={meta.key} language={language} region={character.region}/>)}<CurrencyCard currencyKey={bounty} info={character.currencies?.[bounty.key]} language={language} region={character.region}/></div></section></div>
        <div className="characters-sidebar"><ProgressPanels character={character} language={language}/><section className="characters-panel money-card"><h2>{copy.gold}</h2><span className="money-card__icon">{goldIcon ? <img alt="" src={goldIcon}/> : "◉"}</span><div><span><strong>{number(character.money?.gold).toLocaleString(language === "es" ? "es-ES" : "en-US")}</strong><i className="money-coin money-coin--gold"/></span><span><b className="money-card__silver">{number(character.money?.silver)}</b><i className="money-coin money-coin--silver"/></span><span><b className="money-card__copper">{number(character.money?.copperOnly, number(character.money?.copper) % 100)}</b><i className="money-coin money-coin--copper"/></span></div></section></div></div>
    </div>
    {talentsOpen ? <TalentModal character={character} onClose={() => setTalentsOpen(false)}/> : null}
  </div>;
}
