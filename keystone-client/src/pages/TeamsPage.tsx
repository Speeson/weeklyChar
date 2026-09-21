import { ArrowUpRight, Check, ChevronDown, CircleHelp, Crown, Gem, Settings2, Users, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import battleRezIcon from "../assets/planner/battle-rez.jpg";
import bloodlustIcon from "../assets/planner/bloodlust.jpg";
import classBuffsIcon from "../assets/planner/class-buffs.jpg";
import damageSynergyIcon from "../assets/planner/damage-synergy.jpg";
import dungeonUtilityIcon from "../assets/planner/dungeon-utility.jpg";
import groupDefenseIcon from "../assets/planner/group-defense.jpg";
import lfgEyeIcon from "../assets/planner/lfg-eye.png";
import mixedDamageIcon from "../assets/planner/mix-damage.png";
import offensiveSynergyIcon from "../assets/planner/offensive-synergy.jpg";
import { PlannerPreferencesModal } from "../components/PlannerPreferencesModal";
import { RemoteAvatar } from "../components/RemoteAvatar";
import { TeamItemTooltip } from "../components/TeamItemTooltip";
import { UpgradeTrackIcon } from "../components/UpgradeTrackIcon";
import { WowRoleIcon } from "../components/WowRoleIcon";
import { WowheadSpellIcon, WowheadTooltip } from "../components/WowheadTooltip";
import { classColor } from "../core/characterDisplay";
import { useI18n } from "../core/i18n";
import { MIDNIGHT_SEASON_2_DUNGEONS, SEASON_2_DUNGEON_BY_ID } from "../core/season2";
import {
  groupSelectorObjectives, liveTeamsDataSource, selectorObjectivesForSpec, teamStoneCounts,
  type SelectorObjectiveGroup, type TeamsDataSource,
} from "../core/teams";
import {
  getCachedSelector, getCachedTeamDetail, getTeamsSessionSnapshot, loadSelector, loadTeamDetail,
  loadTeams, preferredTeamId, removeTeamFromSessionCache, setSelectedTeamId,
} from "../core/teamsSessionCache";
import { specName, wowClassIconUrl, wowLootBagIconUrl, wowSpecializationIconUrl } from "../core/wowSpecs";
import { DEFAULT_KEYSTONE_PLANNER_OPTIONS } from "../core/keystonePlanner";
import { useThemeAsset } from "../theme/useThemeAsset";
import type {
  ClientTeamDetail, ClientTeamSummary, CoreError, KeystoneSelectorCharacter, KeystoneSelectorResponse,
  KeystoneSelectorStone, KeystoneSelectorTierCounts, KeystonePlannerAssignment, KeystonePlannerObjective, KeystonePlannerRecommendation,
  ClientPlannerPreferenceUpdate, ClientPlannerPreferences, KeystonePlannerResponse,
  KeystonePlannerOptions, KeystonePlannerVacancy, KeystonePlannerVacancyCapability, KeystonePlannerVacancyRecommendation,
} from "../core/types";

type TeamsPageProps = { currentUsername?: string; dataSource?: TeamsDataSource; onOpenWeb: () => void; onSessionExpired: () => void };

function errorInfo(error: unknown, fallback: string): CoreError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error
    ? { code: String((error as CoreError).code), message: String((error as CoreError).message) }
    : { code: "API_UNAVAILABLE", message: fallback };
}

function Portrait({ avatarUrl, name, wowClass }: { avatarUrl: string | null; name: string; wowClass: string | null }) {
  return <span className="teams-portrait" style={{ backgroundColor: classColor(wowClass) }}>
    <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
    <RemoteAvatar url={avatarUrl} />
  </span>;
}

function TierSummary({ counts }: { counts: KeystoneSelectorTierCounts }) {
  return <span className="teams-tier-line">
    <span><b>{counts.bestInSlot}</b> BiS</span><span><b>{counts.mustHave}</b> Must</span>
    <span><b>{counts.niceToHave}</b> Nice</span><span><b>{counts.catalyst}</b> Cat</span>
  </span>;
}

function StoneOwnerChips({ detail, stones }: { detail: ClientTeamDetail | null; stones: KeystoneSelectorStone[] }) {
  const classByCharacterId = new Map(
    detail?.members.flatMap(member => member.characters.map(character => [character.characterId, character.wowClass] as const)) ?? [],
  );
  return <div className="teams-stone-owner-chips">
    {stones.map(stone => <span
      className="teams-stone-owner-chip"
      key={stone.characterId}
      style={{ "--teams-owner-color": classColor(classByCharacterId.get(stone.characterId) ?? null) } as React.CSSProperties}
    >
      <strong>{stone.characterName}</strong>
      <span className="teams-stone-owner-chip__level">+{stone.level}</span>
      <small>({stone.ownerUsername})</small>
    </span>)}
  </div>;
}

const EMPTY_SELECTOR_TIERS: KeystoneSelectorTierCounts = {
  bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0,
};

function filterSelectorByMembers(selector: KeystoneSelectorResponse, selectedUsers: Set<number>): KeystoneSelectorResponse {
  const selectorUserIds = new Set([
    ...selector.characters.map(character => character.userId),
    ...selector.availability.stones.map(stone => stone.ownerUserId),
  ]);
  if ([...selectorUserIds].every(userId => selectedUsers.has(userId))) return selector;
  const characters = selector.characters.filter(character => selectedUsers.has(character.userId));
  const stones = selector.availability.stones.filter(stone => selectedUsers.has(stone.ownerUserId));
  const tiers = characters.reduce<KeystoneSelectorTierCounts>((total, character) => ({
    bestInSlot: total.bestInSlot + character.tierCounts.bestInSlot,
    mustHave: total.mustHave + character.tierCounts.mustHave,
    niceToHave: total.niceToHave + character.tierCounts.niceToHave,
    catalyst: total.catalyst + character.tierCounts.catalyst,
    transmog: total.transmog + character.tierCounts.transmog,
    other: total.other + character.tierCounts.other,
  }), { ...EMPTY_SELECTOR_TIERS });
  return {
    ...selector,
    availability: { stoneCount: stones.length, stones },
    summary: {
      charactersWithObjectives: characters.filter(character => character.totalObjectives > 0).length,
      totalObjectives: characters.reduce((total, character) => total + character.totalObjectives, 0),
      tiers,
    },
    characters,
  };
}

const PLANNER_COPY = {
  es: {
    noObjectives: "Sin objetivos", owner: "Dueño de la piedra", ownerTitle: "Dueño de la piedra · líder",
    noLoot: "Sin objetivos de botín", item: "Objeto", value: "Valor de botín", buffs: "Buffos y sinergias",
    objectives: "objetivos", players: "jugadores", preferred: "Preferidos", available: "disponibles",
    damage: "Daño", vacancies: "huecos", bloodlust: "Ansia de sangre", battleRez: "Resurrección en combate",
    composition: "Composición", utilities: "Utilidades", partyEssentials: "Esenciales del grupo", capabilitySummary: "Buffs / Defensivos / Utilidades", externalPlayers: "Número de jugadores externos", objectiveSummary: "Objetivos", preferenceSummary: "Preferidos",
    lootBreakdown: "Desglose de objetivos", moreLoot: "Ver todos los objetivos", closeLoot: "Cerrar desglose",
    minimum: "Nivel mínimo",
    filterHelp: "La barra solo filtra las piedras disponibles.", stones: "Piedras disponibles",
    noStones: "No hay piedras visibles con este filtro.", options: "Prioridades del grupo", configure: "Configurar mis personajes",
    loadingPreferences: "Cargando configuración del Planner…",
    quick: "Rápido · Clases", advanced: "Avanzado · Specs", recommendationMode: "Modo de recomendación",
    fillComposition: "Rellenar la composición", scrollToEnd: "Ir al final del panel",
    offensiveSynergy: "Sinergia ofensiva", groupDefense: "Defensiva de grupo", dungeonUtility: "Utilidad de mazmorra",
    calculate: "Calcular Top 5", recalculate: "Recalcular Top 5",
    calculating: "Calculando…", recalculating: "Recalculando…", results: "Top 5 de configuraciones", resultTitle: "Top 5 para la piedra seleccionada",
    playedSpec: "Especialización jugada", lootSpec: "Especialización de botín",
    externalSlot: "Plaza externa", externalCardTitle: "Externo", recommendedClasses: "Clases recomendadas", recommendedSpecs: "Specs recomendadas", viewClasses: "Ver clases recomendadas",
    expand: "Expandir", collapse: "Contraer",
    closeClasses: "Cerrar recomendaciones", noExtraUtility: "Sin utilidad adicional", buffsDebuffs: "Buffs / Debuffs",
    estimatedGain: "Ganancia ofensiva estimada para esta alternativa", selectRecommendation: "Seleccionar recomendación",
    moreUtilities: (count: number) => `Mostrar ${count} utilidades más`,
    noBuffsDebuffs: "Sin aportación nueva", role: { tank: "Tank", healer: "Healer", dps: "DPS" },
    selectError: "Selecciona una piedra exacta y entre 2 y 5 participantes.", requestError: "No se pudo calcular el Top 5.",
    stale: "La piedra exacta ya no está disponible. Actualiza el equipo y vuelve a seleccionarla.",
    unconfigured: "Hay participantes sin preferencias configuradas para el Planner.",
    invalid: "Revisa los miembros disponibles.", noComposition: "No existe una composición válida para esta selección.",
    instruction: "Elige una piedra, marca de 2 a 5 participantes y calcula.",
    availability: { guaranteed: "garantizada", conditional: "condicional", none: "ausente" },
    profile: { physical: "físico", magical: "mágico", mixed: "mixto", unknown: "desconocido" },
    capabilities: { CHAOS_BRAND: "Marca del caos", MYSTIC_TOUCH: "Toque místico", MARK_OF_THE_WILD: "Marca de lo salvaje", ARCANE_INTELLECT: "Intelecto Arcano", BATTLE_SHOUT: "Grito de batalla", POWER_WORD_FORTITUDE: "Palabra de poder: entereza", SKYFURY: "Furia del cielo" },
    capabilityHints: { CHAOS_BRAND: "Daño mágico", MYSTIC_TOUCH: "Daño físico", MARK_OF_THE_WILD: "Versatilidad", ARCANE_INTELLECT: "Intelecto", BATTLE_SHOUT: "+5% AP", POWER_WORD_FORTITUDE: "Aguante", SKYFURY: "Maestría" },
    tiers: { 3: "BiS", 2: "Must", 1: "Nice", 5: "Catalyst", 4: "Transfiguración", other: "Otros" },
  },
  en: {
    noObjectives: "No objectives", owner: "Keystone owner", ownerTitle: "Keystone owner · leader",
    noLoot: "No loot objectives", item: "Item", value: "Loot value", buffs: "Buffs and synergies",
    objectives: "objectives", players: "players", preferred: "Preferred", available: "available",
    damage: "Damage", vacancies: "vacancies", bloodlust: "Bloodlust", battleRez: "Battle Resurrection",
    composition: "Composition", utilities: "Utilities", partyEssentials: "Party Essentials", capabilitySummary: "Buffs / Defensives / Utilities", externalPlayers: "Number of external players", objectiveSummary: "Objectives", preferenceSummary: "Preferred",
    lootBreakdown: "Objective breakdown", moreLoot: "View all objectives", closeLoot: "Close breakdown",
    minimum: "Minimum level",
    filterHelp: "The slider only filters available keystones.", stones: "Available keystones",
    noStones: "No keystones are visible with this filter.", options: "Group priorities", configure: "Configure my characters",
    loadingPreferences: "Loading Planner configuration…",
    quick: "Quick · Classes", advanced: "Advanced · Specs", recommendationMode: "Recommendation mode",
    fillComposition: "Fill the composition", scrollToEnd: "Go to the bottom of the panel",
    offensiveSynergy: "Offensive synergy", groupDefense: "Group defense", dungeonUtility: "Dungeon utility",
    calculate: "Calculate Top 5", recalculate: "Recalculate Top 5",
    calculating: "Calculating…", recalculating: "Recalculating…", results: "Top 5 configurations", resultTitle: "Top 5 for the selected keystone",
    playedSpec: "Played specialization", lootSpec: "Loot specialization",
    externalSlot: "External slot", externalCardTitle: "External", recommendedClasses: "Recommended classes", recommendedSpecs: "Recommended specs", viewClasses: "View recommended classes",
    expand: "Expand", collapse: "Collapse",
    closeClasses: "Close recommendations", noExtraUtility: "No additional utility", buffsDebuffs: "Buffs / Debuffs",
    estimatedGain: "Estimated offensive gain for this alternative", selectRecommendation: "Select recommendation",
    moreUtilities: (count: number) => `Show ${count} more utilities`,
    noBuffsDebuffs: "No new contribution", role: { tank: "Tank", healer: "Healer", dps: "DPS" },
    selectError: "Select one exact keystone and between 2 and 5 participants.", requestError: "The Top 5 could not be calculated.",
    stale: "The exact keystone is no longer available. Refresh the Team and select it again.",
    unconfigured: "Some participants have no Planner preferences configured.",
    invalid: "Review the available members.", noComposition: "No valid composition exists for this selection.",
    instruction: "Choose a keystone, select 2 to 5 participants, and calculate.",
    availability: { guaranteed: "guaranteed", conditional: "conditional", none: "missing" },
    profile: { physical: "physical", magical: "magical", mixed: "mixed", unknown: "unknown" },
    capabilities: { CHAOS_BRAND: "Chaos Brand", MYSTIC_TOUCH: "Mystic Touch", MARK_OF_THE_WILD: "Mark of the Wild", ARCANE_INTELLECT: "Arcane Intellect", BATTLE_SHOUT: "Battle Shout", POWER_WORD_FORTITUDE: "Power Word: Fortitude", SKYFURY: "Skyfury" },
    capabilityHints: { CHAOS_BRAND: "Magic damage", MYSTIC_TOUCH: "Physical damage", MARK_OF_THE_WILD: "Versatility", ARCANE_INTELLECT: "Intellect", BATTLE_SHOUT: "+5% AP", POWER_WORD_FORTITUDE: "Stamina", SKYFURY: "Mastery" },
    tiers: { 3: "BiS", 2: "Must", 1: "Nice", 5: "Catalyst", 4: "Transmog", other: "Other" },
  },
} as const;

function usePlannerCopy() {
  const { language } = useI18n();
  return PLANNER_COPY[language];
}

function localizedCapabilityName(copy: (typeof PLANNER_COPY)[keyof typeof PLANNER_COPY], capabilityId: string, fallback: string) {
  const key = capabilityId.toUpperCase() as keyof typeof copy.capabilities;
  return copy.capabilities[key] ?? fallback;
}

const PLANNER_CAPABILITY_ICON_NAMES: Readonly<Record<number, string>> = {
  1490: "ability_demonhunter_empowerwards", 1126: "spell_nature_regeneration", 1459: "spell_holy_magicalsentry",
  6673: "ability_warrior_battleshout", 21562: "spell_holy_wordfortitude", 113746: "ability_monk_sparring",
  462854: "achievement_raidprimalist_windelemental",
};

function plannerCapabilityIcon(spellId: number, type: KeystonePlannerRecommendation["compositionSummary"]["uniqueCapabilities"][number]["type"]) {
  const iconName = PLANNER_CAPABILITY_ICON_NAMES[spellId];
  return iconName ? `https://render.worldofwarcraft.com/eu/icons/56/${iconName}.jpg`
    : type === "damage_debuff" ? damageSynergyIcon : classBuffsIcon;
}

function PlannerSpecIcon({ loot = false, specId }: { loot?: boolean; specId: number }) {
  const copy = usePlannerCopy();
  const specializationIcon = wowSpecializationIconUrl(specId);
  const label = `${loot ? copy.lootSpec : copy.playedSpec}: ${specName(specId)}`;
  return <span className={`planner-spec-marker${loot ? " planner-spec-marker--loot" : ""}`}>
    <span aria-label={label} className="planner-spec-icon" role="img" title={label}>
      {specializationIcon ? <img alt="" className="planner-spec-icon__specialization" src={specializationIcon} /> : <span aria-hidden="true">?</span>}
    </span>
    {loot ? <span aria-hidden="true" className="planner-loot-pouch"><img alt="" src={wowLootBagIconUrl()} /></span> : null}
  </span>;
}

type PlannerPartySlot = "tank" | "healer" | "dps-1" | "dps-2" | "dps-3";

function PlannerAssignmentPreview({ assignment, avatarUrl, owner, partySlot }: { assignment: KeystonePlannerAssignment; avatarUrl: string | null; owner: boolean; partySlot: PlannerPartySlot }) {
  const copy = usePlannerCopy();
  return <span className="planner-assignment-preview" data-party-slot={partySlot} data-role={assignment.role} style={{ "--planner-class-color": classColor(assignment.wowClass) } as React.CSSProperties}>
    <span className="planner-role-watermark"><WowRoleIcon role={assignment.role} /></span>
    {owner ? <span aria-label={copy.owner} className="planner-owner-crown" role="img" title={copy.ownerTitle}><Crown aria-hidden="true" /></span> : null}
    <PlannerSpecIcon specId={assignment.specId} />
    <PlannerSpecIcon loot specId={assignment.lootSpecId} />
    <Portrait avatarUrl={avatarUrl} name={assignment.characterName} wowClass={assignment.wowClass} />
    <span className="planner-assignment-preview__identity"><strong>{assignment.characterName}</strong><small>{assignment.username}</small></span>
  </span>;
}

const FALLBACK_CAPABILITY_SPELLS: Readonly<Record<string, { name: string; spellId: number }>> = {
  BLOODLUST: { name: "Bloodlust", spellId: 2825 }, BATTLE_REZ: { name: "Rebirth", spellId: 20484 },
  CHAOS_BRAND: { name: "Chaos Brand", spellId: 1490 }, MYSTIC_TOUCH: { name: "Mystic Touch", spellId: 113746 },
  MARK_OF_THE_WILD: { name: "Mark of the Wild", spellId: 1126 }, ARCANE_INTELLECT: { name: "Arcane Intellect", spellId: 1459 },
  BATTLE_SHOUT: { name: "Battle Shout", spellId: 6673 }, POWER_WORD_FORTITUDE: { name: "Power Word: Fortitude", spellId: 21562 },
  SKYFURY: { name: "Skyfury", spellId: 462854 },
};

function plannerVacancyRecommendations(vacancy: KeystonePlannerVacancy): KeystonePlannerVacancyRecommendation[] {
  if (vacancy.recommendations?.length) return vacancy.recommendations;
  return (vacancy.candidateClasses ?? []).map((candidate, index) => {
    const capabilities = candidate.contributions.flatMap(contribution => {
      const definition = FALLBACK_CAPABILITY_SPELLS[contribution.capabilityId.toUpperCase()];
      return definition ? [{ capabilityId: contribution.capabilityId, ...definition, availability: contribution.availability }] : [];
    });
    return {
      id: `legacy:${candidate.wowClass}:${index}`,
      wowClass: candidate.wowClass,
      ...(index === 0 && vacancy.recommendedSpecId ? { specId: vacancy.recommendedSpecId, specName: vacancy.recommendedSpecName } : {}),
      offensiveGainPct: index === 0 ? vacancy.offensiveGainPct ?? 0 : 0,
      buffsDebuffs: capabilities.filter(capability => !["BLOODLUST", "BATTLE_REZ"].includes(capability.capabilityId.toUpperCase())),
      utilities: capabilities.filter(capability => ["BLOODLUST", "BATTLE_REZ"].includes(capability.capabilityId.toUpperCase())),
    };
  });
}

function recommendationLabel(recommendation: KeystonePlannerVacancyRecommendation): string {
  return recommendation.specName ? `${recommendation.specName} ${recommendation.wowClass}` : recommendation.wowClass;
}

function recommendationIcon(recommendation: KeystonePlannerVacancyRecommendation, advanced: boolean): string | null {
  return advanced && recommendation.specId ? wowSpecializationIconUrl(recommendation.specId) : wowClassIconUrl(recommendation.wowClass);
}

function externalRecommendationTitle(copy: (typeof PLANNER_COPY)[keyof typeof PLANNER_COPY], vacancy: KeystonePlannerVacancy): string {
  return vacancy.recommendationMode === "advanced" ? copy.recommendedSpecs : copy.recommendedClasses;
}

function capabilityHint(copy: (typeof PLANNER_COPY)[keyof typeof PLANNER_COPY], capabilityId: string): string | null {
  const key = capabilityId.toUpperCase() as keyof typeof copy.capabilityHints;
  return copy.capabilityHints[key] ?? null;
}

function PlannerCapabilityChip({ capability, compact = false }: { capability: KeystonePlannerVacancyCapability; compact?: boolean }) {
  const copy = usePlannerCopy();
  const name = localizedCapabilityName(copy, capability.capabilityId, capability.name);
  const hint = capabilityHint(copy, capability.capabilityId);
  const label = `${name}${hint ? ` · ${hint}` : ""}${capability.availability === "conditional" ? ` · ${copy.availability.conditional}` : ""}`;
  return <WowheadTooltip className="planner-capability-link" id={capability.spellId} label={label} type="spell">
    <span className="planner-capability-chip" data-compact={compact} data-state={capability.availability}><WowheadSpellIcon className="planner-capability-chip__icon" spellId={capability.spellId} />{compact ? null : <span>{name}{hint ? <small>{hint}</small> : null}</span>}</span>
  </WowheadTooltip>;
}

function PlannerGain({ gain }: { gain: number }) {
  const copy = usePlannerCopy();
  const label = `${copy.estimatedGain}: +${(gain * 100).toFixed(2)}%`;
  return <span aria-label={label} className="planner-external-gain" role="status" title={copy.estimatedGain}>
    <ArrowUpRight aria-hidden="true" /><b>+{(gain * 100).toFixed(2)}%</b>
  </span>;
}

function PlannerExternalBreakdown({ onClose, onSelect, selectedId, vacancy }: {
  onClose: () => void; onSelect?: (recommendation: KeystonePlannerVacancyRecommendation) => void;
  selectedId?: string; vacancy: KeystonePlannerVacancy;
}) {
  const copy = usePlannerCopy();
  const recommendations = plannerVacancyRecommendations(vacancy);
  const advanced = vacancy.recommendationMode === "advanced";
  const title = externalRecommendationTitle(copy, vacancy);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const modal = <div className="planner-external-popover" data-portal-layer="modal" onClick={event => event.stopPropagation()} onMouseDown={event => {
    event.stopPropagation();
    if (event.currentTarget === event.target) onClose();
  }}>
    <section aria-label={`${title} · ${copy.role[vacancy.role]}`} aria-modal="true" role="dialog">
      <header><div><strong>{title}</strong><small>{copy.externalSlot} · {copy.role[vacancy.role]}</small></div><button aria-label={copy.closeClasses} onClick={onClose} type="button"><X aria-hidden="true" /></button></header>
      <div className="planner-external-popover__classes">{recommendations.map(recommendation => {
        const classIcon = wowClassIconUrl(recommendation.wowClass);
        const specIcon = recommendation.specId ? wowSpecializationIconUrl(recommendation.specId) : null;
        const content = <>
          <span className="planner-external-popover__identity">
            <span className="planner-external-popover__icons">{classIcon ? <img alt="" src={classIcon} /> : <CircleHelp aria-hidden="true" />}{advanced ? specIcon ? <img alt="" src={specIcon} /> : <CircleHelp aria-hidden="true" /> : null}</span>
            <strong>{recommendationLabel(recommendation)}</strong>
          </span>
          <span className="planner-external-popover__capabilities" aria-label={`${copy.buffsDebuffs} · ${copy.utilities}`}>
            {[...recommendation.buffsDebuffs, ...recommendation.utilities].slice(0, 7).map(capability => <PlannerCapabilityChip capability={capability} compact key={`${recommendation.id}:${capability.spellId}`} />)}
            {recommendation.buffsDebuffs.length + recommendation.utilities.length === 0 ? <small>{copy.noExtraUtility}</small> : null}
          </span>
          <PlannerGain gain={recommendation.offensiveGainPct} />
        </>;
        return <article data-selected={recommendation.id === selectedId} key={recommendation.id} style={{ "--planner-class-color": classColor(recommendation.wowClass) } as React.CSSProperties}>
          {onSelect
            ? <button aria-label={`${copy.selectRecommendation}: ${recommendationLabel(recommendation)}`} className="planner-external-popover__choice" onClick={() => { onSelect(recommendation); onClose(); }} type="button">{content}</button>
            : <div className="planner-external-popover__choice">{content}</div>}
        </article>;
      })}</div>
    </section>
  </div>;
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

function PlannerExternalPreview({ partySlot, vacancy }: { partySlot: PlannerPartySlot; vacancy: KeystonePlannerVacancy }) {
  const copy = usePlannerCopy();
  const [open, setOpen] = useState(false);
  const recommendations = plannerVacancyRecommendations(vacancy);
  const visible = recommendations.slice(0, 4);
  const advanced = vacancy.recommendationMode === "advanced";
  const labels = visible.map(recommendationLabel).join(", ");
  return <div aria-label={`${copy.externalSlot}: ${copy.role[vacancy.role]}${labels ? `. ${externalRecommendationTitle(copy, vacancy)}: ${labels}` : ""}`} className="planner-external-preview" data-mode={advanced ? "advanced" : "quick"} data-party-slot={partySlot} data-role={vacancy.role} role="group">
    <span className="planner-role-watermark"><WowRoleIcon role={vacancy.role} /></span>
    <span aria-hidden="true" className="planner-external-preview__title">{copy.externalCardTitle}</span>
    <span aria-hidden="true" className="planner-external-preview__avatar"><CircleHelp /></span>
    {visible.map((recommendation, index) => {
      const icon = recommendationIcon(recommendation, advanced);
      const label = recommendationLabel(recommendation);
      return <span aria-label={label} className="planner-external-preview__class" data-corner={index + 1} data-icon-kind={advanced ? "spec" : "class"} key={recommendation.id} role="img" style={{ "--planner-class-color": classColor(recommendation.wowClass) } as React.CSSProperties} title={label}>
        {icon ? <img alt="" src={icon} /> : <CircleHelp aria-hidden="true" />}
      </span>;
    })}
    {recommendations.length > 4 ? <button aria-label={`${copy.viewClasses}: ${recommendations.length}`} className="planner-external-preview__more" onClick={event => { event.stopPropagation(); setOpen(true); }} type="button">+</button> : null}
    {open ? <PlannerExternalBreakdown onClose={() => setOpen(false)} vacancy={vacancy} /> : null}
  </div>;
}

function PlannerObjectiveIcon({ assignment, objective }: { assignment: KeystonePlannerAssignment; objective: KeystonePlannerObjective }) {
  const copy = usePlannerCopy();
  return <WowheadTooltip className="planner-objective-icon" id={objective.itemId} label={objective.itemName ?? `${copy.item} #${objective.itemId}`} options={{ spec: assignment.lootSpecId }} type="item"><span data-tier={objective.tier}>
    {objective.iconUrl ? <img alt="" src={objective.iconUrl} /> : <Gem aria-hidden="true" />}
    <UpgradeTrackIcon track={objective.upgradeTrack} className="upgrade-track-icon--badge" />
  </span></WowheadTooltip>;
}

function PlannerLootBreakdown({ assignment, onClose }: { assignment: KeystonePlannerAssignment; onClose: () => void }) {
  const copy = usePlannerCopy();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const groups = ([3, 2, 1, 5, 4, "other"] as const).map(tier => ({
    tier, label: copy.tiers[tier], objectives: assignment.objectives.filter(objective => tier === "other" ? ![1, 2, 3, 4, 5].includes(objective.tier) : objective.tier === tier),
  })).filter(group => group.objectives.length > 0);
  return <div className="planner-loot-popover" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section aria-label={`${copy.lootBreakdown} · ${assignment.characterName}`} aria-modal="true" role="dialog">
      <header><div><strong>{copy.lootBreakdown}</strong><small>{assignment.characterName} · {assignment.username}</small></div><button aria-label={copy.closeLoot} onClick={onClose} type="button"><X aria-hidden="true" /></button></header>
      <div className="planner-loot-popover__groups">{groups.map(group => <section data-tier={group.tier} key={group.tier}><strong>{group.label} · {group.objectives.length}</strong><div>{group.objectives.map(objective => <PlannerObjectiveIcon assignment={assignment} key={objective.variantKey} objective={objective} />)}</div></section>)}</div>
    </section>
  </div>;
}

function PlannerAssignmentCard({ assignment, owner, partySlot }: { assignment: KeystonePlannerAssignment; owner: boolean; partySlot: PlannerPartySlot }) {
  const copy = usePlannerCopy();
  const [lootOpen, setLootOpen] = useState(false);
  const hasOverflow = assignment.objectives.length >= 6;
  const visibleObjectives = hasOverflow ? assignment.objectives.slice(0, 5) : assignment.objectives;
  return <article className="planner-player-card" data-party-slot={partySlot} data-role={assignment.role} style={{ "--planner-class-color": classColor(assignment.wowClass) } as React.CSSProperties}>
    <span className="planner-role-watermark"><WowRoleIcon role={assignment.role} /></span>
    {owner ? <span aria-label={copy.owner} className="planner-owner-crown" role="img" title={copy.ownerTitle}><Crown aria-hidden="true" /></span> : null}
    <header>
      <span className="planner-player-card__specs"><PlannerSpecIcon specId={assignment.specId} /><PlannerSpecIcon loot specId={assignment.lootSpecId} /></span>
      <span className="planner-player-card__identity"><strong style={{ color: classColor(assignment.wowClass) }}>{assignment.characterName}</strong><small>{assignment.username}</small></span>
    </header>
    <div className="planner-objective-icons">{assignment.objectives.length > 0
      ? <>{visibleObjectives.map(objective => <PlannerObjectiveIcon assignment={assignment} key={objective.variantKey} objective={objective} />)}{hasOverflow ? <button aria-label={`${copy.moreLoot} · ${assignment.characterName} · ${assignment.objectives.length}`} className="planner-objective-more" onClick={() => setLootOpen(true)} title={copy.moreLoot} type="button">+</button> : null}</>
      : <small>{copy.noLoot}</small>}</div>
    {lootOpen ? <PlannerLootBreakdown assignment={assignment} onClose={() => setLootOpen(false)} /> : null}
  </article>;
}

function PlannerUtility({ className = "", compact = false, icon, label, profile, source, spellId, state }: {
  className?: string; compact?: boolean; icon: string; label: string; profile?: string; source?: "party" | "external"; spellId?: number; state?: string;
}) {
  const content = <span aria-label={compact ? label : undefined} className={`planner-utility ${className}`.trim()} data-compact={compact} data-profile={profile} data-source={source} data-state={state} role={compact ? "img" : undefined} title={compact ? label : undefined}><img alt="" src={icon} />{compact ? null : <span>{label}</span>}</span>;
  return spellId ? <WowheadTooltip className="planner-utility-link" id={spellId} label={label} type="spell">{content}</WowheadTooltip> : content;
}

function PlannerCapabilityGrid({ capabilities, dynamic = false, limit }: {
  capabilities: readonly KeystonePlannerVacancyCapability[]; dynamic?: boolean; limit: number;
}) {
  const copy = usePlannerCopy();
  const [open, setOpen] = useState(false);
  const [dynamicLimit, setDynamicLimit] = useState(limit);
  const [popupPosition, setPopupPosition] = useState<{ bottom: number; left: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 150);
  }, [cancelClose]);
  useEffect(() => cancelClose, [cancelClose]);
  useEffect(() => {
    if (!dynamic || typeof ResizeObserver === "undefined") {
      setDynamicLimit(limit);
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    const updateLimit = (width: number) => {
      const iconWidth = 42;
      const gap = 7;
      const moreWidth = 22;
      const fullCapacity = Math.max(1, Math.floor((width + gap) / (iconWidth + gap)));
      const next = capabilities.length <= fullCapacity
        ? capabilities.length
        : Math.max(1, Math.floor((width - moreWidth) / (iconWidth + gap)));
      setDynamicLimit(next);
    };
    updateLimit(grid.clientWidth);
    const observer = new ResizeObserver(entries => updateLimit(entries[0]?.contentRect.width ?? grid.clientWidth));
    observer.observe(grid);
    return () => observer.disconnect();
  }, [capabilities.length, dynamic, limit]);
  const updatePopupPosition = useCallback(() => {
    const bounds = moreRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const popupHalfWidth = Math.min(180, Math.max(0, (window.innerWidth - 24) / 2));
    const center = Math.min(window.innerWidth - 12 - popupHalfWidth, Math.max(12 + popupHalfWidth, bounds.left + bounds.width / 2));
    setPopupPosition({ bottom: window.innerHeight - bounds.top + 7, left: center });
  }, []);
  useLayoutEffect(() => {
    if (!open) {
      setPopupPosition(null);
      return;
    }
    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, updatePopupPosition]);
  const visibleLimit = dynamic ? dynamicLimit : limit;
  const overflow = capabilities.slice(visibleLimit);
  const popup = open && popupPosition && overflow.length > 0 ? <div className="planner-capability-grid__popup" data-portal-layer="capabilities" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
  }} onFocusCapture={cancelClose} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} ref={popupRef} role="tooltip" style={popupPosition}>
    {overflow.map((capability, index) => <PlannerCapabilityChip capability={capability} key={`popup:${capability.capabilityId}:${capability.spellId}:${index}`} />)}
  </div> : null;
  return <><div className="planner-capability-grid" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget) && !popupRef.current?.contains(event.relatedTarget as Node)) scheduleClose();
  }} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} ref={gridRef}>
    <div className="planner-capability-grid__icons">
      {capabilities.slice(0, visibleLimit).map((capability, index) => <span className="planner-capability-grid__icon" key={`${capability.capabilityId}:${capability.spellId}:${index}`}>
        <PlannerCapabilityChip capability={capability} compact />
      </span>)}
      {overflow.length > 0 ? <button aria-expanded={open} aria-label={copy.moreUtilities(overflow.length)} className="planner-capability-grid__more" onFocus={() => { cancelClose(); setOpen(true); }} onMouseEnter={() => { cancelClose(); setOpen(true); }} ref={moreRef} type="button">+</button> : null}
    </div>
  </div>{typeof document === "undefined" || !popup ? null : createPortal(popup, document.body)}</>;
}

function uniquePlannerCapabilities(capabilities: readonly KeystonePlannerVacancyCapability[]) {
  const seen = new Set<string>();
  return capabilities.filter(capability => {
    const key = `${capability.capabilityId.toUpperCase()}:${capability.spellId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PlannerExternalCard({ onSelect, partySlot, selectedId, vacancy }: {
  onSelect: (recommendation: KeystonePlannerVacancyRecommendation) => void;
  partySlot: PlannerPartySlot;
  selectedId?: string;
  vacancy: KeystonePlannerVacancy;
}) {
  const copy = usePlannerCopy();
  const recommendations = plannerVacancyRecommendations(vacancy);
  const [open, setOpen] = useState(false);
  const selected = recommendations.find(recommendation => recommendation.id === selectedId) ?? recommendations[0];
  const advanced = vacancy.recommendationMode === "advanced";
  if (!selected) return null;
  const selectedCapabilities = uniquePlannerCapabilities([
    ...selected.buffsDebuffs,
    ...selected.utilities,
    ...(selected.groupDefensives ?? []),
    ...(selected.dungeonUtilities ?? []),
  ]);
  return <article className="planner-external-card" data-mode={advanced ? "advanced" : "quick"} data-party-slot={partySlot} data-role={vacancy.role} style={{ "--planner-class-color": classColor(selected.wowClass) } as React.CSSProperties}>
    <span className="planner-role-watermark"><WowRoleIcon role={vacancy.role} /></span>
    <header>
      <span className="planner-external-card__selectors" role="group" aria-label={`${externalRecommendationTitle(copy, vacancy)} · ${copy.role[vacancy.role]}`}>
        {recommendations.slice(0, 4).map(recommendation => {
          const icon = recommendationIcon(recommendation, advanced);
          const label = recommendationLabel(recommendation);
          return <button aria-label={`${copy.selectRecommendation}: ${label}`} aria-pressed={recommendation.id === selected.id} data-icon-kind={advanced ? "spec" : "class"} key={recommendation.id} onClick={() => onSelect(recommendation)} title={label} type="button" style={{ "--planner-class-color": classColor(recommendation.wowClass) } as React.CSSProperties}>
            {icon ? <img alt="" src={icon} /> : <CircleHelp aria-hidden="true" />}
          </button>;
        })}
        {recommendations.length > 4 ? <button aria-label={`${copy.viewClasses}: ${recommendations.length}`} className="planner-external-card__more" onClick={() => setOpen(true)} type="button">+</button> : null}
      </span>
      <span className="planner-external-card__identity"><strong>{recommendationLabel(selected)}</strong><small>{copy.externalSlot} · {copy.role[vacancy.role]}</small></span>
    </header>
    <div className="planner-external-card__contributions">
      <section aria-label={copy.capabilitySummary} role="group"><span className="planner-external-card__contribution-heading">
        {vacancy.recommendationMode ? <PlannerGain gain={selected.offensiveGainPct} /> : null}
        <strong>{copy.capabilitySummary}</strong>
      </span>{selectedCapabilities.length > 0
        ? <PlannerCapabilityGrid capabilities={selectedCapabilities} limit={5} />
        : <small>{copy.noExtraUtility}</small>}</section>
    </div>
    {open ? <PlannerExternalBreakdown onClose={() => setOpen(false)} onSelect={onSelect} selectedId={selected.id} vacancy={vacancy} /> : null}
  </article>;
}

type PlannerDamageProfile = NonNullable<KeystonePlannerVacancyRecommendation["damageProfile"]>;

function selectedVacancyRecommendation(
  vacancy: KeystonePlannerVacancy,
  index: number,
  selectedIds: Readonly<Record<number, string>>,
) {
  const recommendations = plannerVacancyRecommendations(vacancy);
  return recommendations.find(item => item.id === selectedIds[index]) ?? recommendations[0];
}

function selectedExternalEssentialState(
  recommendations: readonly KeystonePlannerVacancyRecommendation[],
  capabilityId: "BLOODLUST" | "BATTLE_REZ",
): "guaranteed" | "conditional" | "none" {
  const capabilities = recommendations.flatMap(recommendation => recommendation.utilities)
    .filter(capability => capability.capabilityId.toUpperCase() === capabilityId);
  if (capabilities.some(capability => capability.availability === "guaranteed")) return "guaranteed";
  return capabilities.length > 0 ? "conditional" : "none";
}

function displayedEssentialState(
  party: "guaranteed" | "conditional" | "none",
  external: "guaranteed" | "conditional" | "none",
) {
  const rank = { none: 0, conditional: 1, guaranteed: 2 } as const;
  return rank[external] > rank[party]
    ? { source: "external" as const, state: external }
    : { source: "party" as const, state: party };
}

type PlannerPartyEntry =
  | { kind: "assignment"; assignment: KeystonePlannerAssignment; partySlot: PlannerPartySlot }
  | { kind: "vacancy"; partySlot: PlannerPartySlot; vacancy: KeystonePlannerVacancy; vacancyIndex: number };

function plannerPartyEntries(recommendation: KeystonePlannerRecommendation): PlannerPartyEntry[] {
  const entries: PlannerPartyEntry[] = [];
  let dpsSlot = 0;
  for (const role of ["tank", "healer", "dps"] as const) {
    const slotForRole = (): PlannerPartySlot => {
      if (role !== "dps") return role;
      dpsSlot += 1;
      return dpsSlot === 1 ? "dps-1" : dpsSlot === 2 ? "dps-2" : "dps-3";
    };
    for (const assignment of recommendation.assignments.filter(candidate => candidate.role === role)) {
      entries.push({ kind: "assignment", assignment, partySlot: slotForRole() });
    }
    recommendation.vacancies.forEach((vacancy, vacancyIndex) => {
      if (vacancy.role === role) entries.push({ kind: "vacancy", partySlot: slotForRole(), vacancy, vacancyIndex });
    });
  }
  return entries;
}

function plannerDamageProfile(
  recommendation: KeystonePlannerRecommendation,
  selectedIds: Readonly<Record<number, string>>,
): PlannerDamageProfile {
  let magical = recommendation.compositionSummary.magicalDpsCount;
  let physical = recommendation.compositionSummary.physicalDpsCount;
  let mixed = false;
  for (const [index, vacancy] of recommendation.vacancies.entries()) {
    if (vacancy.role !== "dps") continue;
    const profile = selectedVacancyRecommendation(vacancy, index, selectedIds)?.damageProfile ?? "unknown";
    if (profile === "magical") magical += 1;
    else if (profile === "physical") physical += 1;
    else if (profile === "mixed") mixed = true;
  }
  if (mixed || (magical > 0 && magical === physical)) return "mixed";
  if (magical > physical) return "magical";
  if (physical > magical) return "physical";
  return "unknown";
}

function PlannerRecommendationCard({ avatarUrls, centerIncompletePreview, expanded, onToggle, recommendation }: {
  avatarUrls: Map<number, string | null>; centerIncompletePreview: boolean; expanded: boolean; onToggle: () => void; recommendation: KeystonePlannerRecommendation;
}) {
  const copy = usePlannerCopy();
  const [selectedExternalIds, setSelectedExternalIds] = useState<Record<number, string>>({});
  useEffect(() => { setSelectedExternalIds({}); }, [recommendation.fingerprint]);
  const partyEntries = plannerPartyEntries(recommendation);
  const topCount = recommendation.assignments.filter(assignment => assignment.role === "tank" || assignment.role === "healer").length
    + recommendation.vacancies.filter(vacancy => vacancy.role === "tank" || vacancy.role === "healer").length;
  const dpsCount = recommendation.assignments.filter(assignment => assignment.role === "dps").length
    + recommendation.vacancies.filter(vacancy => vacancy.role === "dps").length;
  const centerSingleRowPair = partyEntries.length === 2
    && ((topCount === 2 && dpsCount === 0) || (topCount === 0 && dpsCount === 2));
  const valueWords = copy.value.split(" ");
  const valueLead = valueWords.slice(0, -1).join(" ");
  const valueTail = valueWords[valueWords.length - 1];
  const damageProfile = plannerDamageProfile(recommendation, selectedExternalIds);
  const damageSpellId = damageProfile === "magical" ? 1490 : damageProfile === "physical" ? 113746 : undefined;
  const damageIcon = damageProfile === "mixed"
    ? mixedDamageIcon
    : damageSpellId ? plannerCapabilityIcon(damageSpellId, "damage_debuff") : damageSynergyIcon;
  const selectedExternalRecommendations = recommendation.vacancies.flatMap((vacancy, index) => {
    const selected = selectedVacancyRecommendation(vacancy, index, selectedExternalIds);
    return selected ? [selected] : [];
  });
  const externalBloodlust = selectedExternalEssentialState(selectedExternalRecommendations, "BLOODLUST");
  const externalBattleRez = selectedExternalEssentialState(selectedExternalRecommendations, "BATTLE_REZ");
  const bloodlust = displayedEssentialState(recommendation.compositionSummary.bloodlust, externalBloodlust);
  const battleRez = displayedEssentialState(recommendation.compositionSummary.battleRez, externalBattleRez);
  const compositionCapabilities = uniquePlannerCapabilities([
    ...recommendation.compositionSummary.uniqueCapabilities
    .filter(capability => !["BLOODLUST", "BATTLE_REZ"].includes(capability.capabilityId.toUpperCase()))
    .map(capability => ({
      capabilityId: capability.capabilityId,
      name: localizedCapabilityName(copy, capability.capabilityId, capability.name),
      spellId: capability.iconSpellId,
      availability: capability.availability ?? capability.mode ?? "guaranteed",
    })),
    ...(recommendation.compositionSummary.groupDefensives ?? []),
    ...(recommendation.compositionSummary.dungeonUtilities ?? []),
    ...selectedExternalRecommendations.flatMap(selected => [
      ...selected.buffsDebuffs,
      ...selected.utilities.filter(capability => !["BLOODLUST", "BATTLE_REZ"].includes(capability.capabilityId.toUpperCase())),
      ...(selected.groupDefensives ?? []),
      ...(selected.dungeonUtilities ?? []),
    ]),
  ]);
  return <article className="planner-recommendation" data-expanded={expanded}>
    <div className="planner-recommendation__summary" onClick={onToggle}>
      <span className="planner-rank">#{recommendation.rank}</span>
      <span className="planner-recommendation__metrics">
        <span><b>{recommendation.lootSummary.totalObjectives}</b> {copy.objectiveSummary}</span>
        <span><b>{recommendation.preferenceSummary.preferred}</b> {copy.preferenceSummary}</span>
      </span>
      <span className="planner-recommendation__party" data-centered={centerIncompletePreview && partyEntries.length < 5}>{partyEntries.map(entry => entry.kind === "assignment"
        ? <PlannerAssignmentPreview assignment={entry.assignment} avatarUrl={avatarUrls.get(entry.assignment.characterId) ?? null} key={`member-${entry.assignment.userId}`} owner={entry.assignment.characterId === recommendation.stone.characterId} partySlot={entry.partySlot} />
        : <PlannerExternalPreview key={`external-${entry.vacancy.role}-${entry.vacancyIndex}`} partySlot={entry.partySlot} vacancy={entry.vacancy} />)}</span>
      <span className="planner-score"><small><span>{valueLead}</span><span>{valueTail}</span></small><b>{recommendation.lootSummary.weightedScore}</b></span>
      <button aria-expanded={expanded} aria-label={`${expanded ? copy.collapse : copy.expand} #${recommendation.rank}`} className="planner-recommendation__expand" onClick={event => { event.stopPropagation(); onToggle(); }} type="button"><ChevronDown aria-hidden="true" /></button>
    </div>
    {expanded ? <div className="planner-recommendation__detail">
      <div className="planner-party-trapezoid" data-dps-count={dpsCount} data-single-row-pair={centerSingleRowPair} data-top-count={topCount}>{partyEntries.map(entry => entry.kind === "assignment"
        ? <PlannerAssignmentCard assignment={entry.assignment} key={entry.assignment.userId} owner={entry.assignment.characterId === recommendation.stone.characterId} partySlot={entry.partySlot} />
        : <PlannerExternalCard key={`external-detail-${entry.vacancy.role}-${entry.vacancyIndex}`} onSelect={selected => setSelectedExternalIds(current => ({ ...current, [entry.vacancyIndex]: selected.id }))} partySlot={entry.partySlot} selectedId={selectedExternalIds[entry.vacancyIndex]} vacancy={entry.vacancy} />)}</div>
      <div className="planner-utilities">
        <section aria-label={copy.composition} role="group"><strong>{copy.composition}</strong><div className="planner-summary-icons">
          <PlannerUtility className="planner-summary-damage" compact icon={damageIcon} label={`${copy.damage}: ${copy.profile[damageProfile]}`} profile={damageProfile} spellId={damageSpellId} />
          <span aria-label={`${copy.externalPlayers}: ${recommendation.vacancies.length}`} className="planner-summary-external-count" title={copy.externalPlayers}><span aria-hidden="true" className="planner-summary-external-count__eye" style={{ backgroundImage: `url(${lfgEyeIcon})` }} /><b>{recommendation.vacancies.length}</b></span>
        </div>
        </section>
        <section aria-label={copy.partyEssentials} role="group"><strong>{copy.partyEssentials}</strong><div className="planner-summary-icons">
          <PlannerUtility compact icon={bloodlustIcon} label={`${copy.bloodlust} · ${copy.availability[bloodlust.state]}`} source={bloodlust.source} spellId={2825} state={bloodlust.state} />
          <PlannerUtility compact icon={battleRezIcon} label={`${copy.battleRez} · ${copy.availability[battleRez.state]}`} source={battleRez.source} spellId={20484} state={battleRez.state} />
        </div>
        </section>
        <section aria-label={copy.capabilitySummary} role="group"><strong>{copy.capabilitySummary}</strong>
          <PlannerCapabilityGrid capabilities={compositionCapabilities} dynamic limit={5} />
        </section>
      </div>
    </div> : null}
  </article>;
}

function KeystonePlannerPanel({ dataSource, detail, dungeonId, onConfigure, onOwnerChange, onSessionExpired, selectedUsers, selector, setSelectedUsers, teamId }: {
  dataSource: TeamsDataSource; detail: ClientTeamDetail | null; dungeonId: number; onOwnerChange: (userId: number | null) => void;
  onConfigure: () => void; onSessionExpired: () => void; selectedUsers: Set<number>; selector: KeystoneSelectorResponse | null;
  setSelectedUsers: React.Dispatch<React.SetStateAction<Set<number>>>; teamId: number | null;
}) {
  const copy = usePlannerCopy();
  const [minimumLevel, setMinimumLevel] = useState(1);
  const [selectedStoneId, setSelectedStoneId] = useState<number | null>(null);
  const [response, setResponse] = useState<KeystonePlannerResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [options, setOptions] = useState<KeystonePlannerOptions>(() => ({ ...DEFAULT_KEYSTONE_PLANNER_OPTIONS }));
  const [canScrollConfigDown, setCanScrollConfigDown] = useState(false);
  const configScrollRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const previousOptions = useRef(options);
  const stones = selector?.availability.stones ?? [];
  const visibleStones = stones.filter(stone => stone.level >= minimumLevel);
  const selectedStone = stones.find(stone => stone.characterId === selectedStoneId) ?? null;

  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    generation.current += 1; setResponse(null); setExpanded(null); setPlannerError(null); setLoading(false);
  }, [dungeonId, selectedUsers, teamId]);
  useEffect(() => {
    if (selectedStone && selectedStone.level < minimumLevel) {
      generation.current += 1;
      setSelectedStoneId(null); onOwnerChange(null); setResponse(null); setExpanded(null);
      setLoading(false);
    }
  }, [minimumLevel, onOwnerChange, selectedStone]);

  const selectStone = (stone: KeystoneSelectorStone) => {
    const previousOwnerUserId = selectedStone?.ownerUserId ?? null;
    generation.current += 1;
    setSelectedStoneId(stone.characterId); onOwnerChange(stone.ownerUserId); setResponse(null); setExpanded(null); setPlannerError(null);
    setSelectedUsers(current => {
      const next = new Set(current);
      if (!next.has(stone.ownerUserId) && next.size >= 5) {
        if (previousOwnerUserId !== null) next.delete(previousOwnerUserId);
        else next.delete([...next][next.size - 1]);
      }
      next.add(stone.ownerUserId);
      return next;
    });
  };
  const calculate = useCallback((requestedOptions = options, preserveResults = response !== null) => {
    if (!selectedStone || teamId === null || selectedUsers.size < 2 || selectedUsers.size > 5) {
      setPlannerError(copy.selectError); return;
    }
    const currentGeneration = ++generation.current;
    setLoading(true); setPlannerError(null); setExpanded(null);
    if (!preserveResults) setResponse(null);
    dataSource.getKeystonePlanner(teamId, {
      participantUserIds: [...selectedUsers], targetLevel: selectedStone.level, challengeMapId: dungeonId,
      stoneCharacterId: selectedStone.characterId, options: requestedOptions, locks: [],
    }).then(result => {
      if (currentGeneration !== generation.current) return;
      setResponse(result); setExpanded(null);
    }).catch(caught => {
      if (currentGeneration !== generation.current) return;
      const parsed = errorInfo(caught, copy.requestError);
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired(); else setPlannerError(parsed.message);
    }).finally(() => { if (currentGeneration === generation.current) setLoading(false); });
  }, [copy.requestError, copy.selectError, dataSource, dungeonId, onSessionExpired, options, response, selectedStone, selectedUsers, teamId]);

  useEffect(() => {
    if (previousOptions.current === options) return;
    previousOptions.current = options;
    generation.current += 1;
    setExpanded(null); setPlannerError(null);
    if (!response) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => calculate(options, true), 250);
    return () => window.clearTimeout(timer);
  }, [calculate, options, response]);
  const unconfiguredSelected = detail?.members.some(member => selectedUsers.has(member.userId) && !member.plannerConfigured) ?? false;
  const updateConfigScrollState = useCallback(() => {
    const element = configScrollRef.current;
    setCanScrollConfigDown(Boolean(element && element.scrollTop + element.clientHeight < element.scrollHeight - 1));
  }, []);
  useLayoutEffect(() => {
    const element = configScrollRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(updateConfigScrollState);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateConfigScrollState);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    window.addEventListener("resize", updateConfigScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updateConfigScrollState);
    };
  }, [options.recommendationMode, plannerError, unconfiguredSelected, updateConfigScrollState, visibleStones.length]);
  const scrollConfigToEnd = () => {
    const element = configScrollRef.current;
    if (!element) return;
    if (typeof element.scrollTo === "function") element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    else element.scrollTop = element.scrollHeight;
    setCanScrollConfigDown(false);
  };
  const avatarUrls = new Map(detail?.members.flatMap(member => member.characters.map(character => [character.characterId, character.avatarUrl] as const)) ?? []);
  const emptyResult = response
    ? response.availability.eligibleStoneCount === 0 ? copy.stale
      : response.status === "unconfigured_participants" ? copy.unconfigured
      : response.status === "invalid_input" ? copy.invalid
      : copy.noComposition
    : copy.instruction;

  return <div className="keystone-planner">
    <aside className="keystone-planner__config">
      <div className="planner-config-scroll" onScroll={updateConfigScrollState} ref={configScrollRef}>
      <div className="planner-config-heading"><button className="planner-configure" onClick={onConfigure} type="button"><Settings2 aria-hidden="true" />{copy.configure}</button></div>
      <label className="planner-fill-toggle"><Users aria-hidden="true" /><span>{copy.fillComposition}</span><input aria-label={copy.fillComposition} checked={options.fillComposition} onChange={event => {
        const checked = event.currentTarget.checked;
        setOptions(current => ({ ...current, fillComposition: checked }));
      }} type="checkbox" /></label>
      <div aria-label={copy.recommendationMode} className="planner-mode-selector" role="group">
        {(["quick", "advanced"] as const).map(mode => <button aria-pressed={options.recommendationMode === mode} key={mode} onClick={() => {
          setOptions(current => ({ ...current, recommendationMode: mode }));
        }} type="button">{mode === "quick" ? copy.quick : copy.advanced}</button>)}
      </div>
      <label className="planner-level-filter" htmlFor="planner-minimum-level"><span>{copy.minimum}</span><output>+{minimumLevel}</output></label>
      <input id="planner-minimum-level" max="20" min="1" onChange={event => setMinimumLevel(Number(event.currentTarget.value))} type="range" value={minimumLevel} />
      <p className="planner-filter-help">{copy.filterHelp}</p>
      <div className="planner-stones" role="group" aria-label={copy.stones}>
        {visibleStones.map(stone => {
          const ownerReady = detail?.members.find(member => member.userId === stone.ownerUserId)?.plannerConfigured ?? false;
          const dungeonArt = SEASON_2_DUNGEON_BY_ID.get(dungeonId)?.teleportIconUrl;
          return <button aria-pressed={selectedStoneId === stone.characterId} disabled={!ownerReady} key={stone.characterId} onClick={() => selectStone(stone)} title={!ownerReady ? copy.unconfigured : undefined} type="button">
            {dungeonArt ? <img alt="" aria-hidden="true" src={dungeonArt} /> : <Gem aria-hidden="true" />}<b>+{stone.level}</b><span>{stone.characterName}<small>{stone.ownerUsername}</small></span>
          </button>;
        })}
        {visibleStones.length === 0 ? <small className="planner-no-stones">{copy.noStones}</small> : null}
      </div>
      <div className="planner-priorities"><strong>{copy.options}</strong>
        {([
          ["bloodlust", copy.bloodlust, bloodlustIcon], ["battleRez", copy.battleRez, battleRezIcon],
          ["offensiveSynergy", copy.offensiveSynergy, offensiveSynergyIcon],
          ...(options.recommendationMode === "advanced" ? [
            ["groupDefense", copy.groupDefense, groupDefenseIcon],
            ["dungeonUtility", copy.dungeonUtility, dungeonUtilityIcon],
          ] as const : []),
        ] as const).map(([key, label, icon]) => <label key={key}><img alt="" aria-hidden="true" src={icon} /><span>{label}</span><input aria-label={label} checked={options[key]} onChange={event => {
          const checked = event.currentTarget.checked;
          setOptions(current => ({ ...current, [key]: checked }));
        }} type="checkbox" /></label>)}
      </div>
      <button className="planner-calculate" disabled={loading || !selectedStone || selectedUsers.size < 2 || selectedUsers.size > 5 || unconfiguredSelected} onClick={() => calculate(options, response !== null)} type="button">{loading ? response ? copy.recalculating : copy.calculating : response ? copy.recalculate : copy.calculate}</button>
      {unconfiguredSelected ? <p className="planner-readiness-warning">{copy.unconfigured}</p> : null}
      {plannerError ? <p className="error planner-error" role="alert">{plannerError}</p> : null}
      </div>
      {canScrollConfigDown ? <button aria-label={copy.scrollToEnd} className="planner-config-scroll-cue" onClick={scrollConfigToEnd} type="button"><ChevronDown aria-hidden="true" /></button> : null}
    </aside>
    <section aria-busy={loading} className="keystone-planner__results" data-recalculating={loading && response !== null} aria-label={copy.results} role="region">
      {response?.recommendations.length ? response.recommendations.map(recommendation => <PlannerRecommendationCard avatarUrls={avatarUrls} centerIncompletePreview={!options.fillComposition} expanded={expanded === recommendation.fingerprint} key={recommendation.fingerprint} onToggle={() => setExpanded(current => current === recommendation.fingerprint ? null : recommendation.fingerprint)} recommendation={recommendation} />)
        : <div className="planner-results-empty"><Crown aria-hidden="true" /><strong>{copy.resultTitle}</strong><span>{emptyResult}</span></div>}
      {loading && response ? <span className="planner-recalculating-status" role="status">{copy.recalculating}</span> : null}
    </section>
  </div>;
}

const GROUP_LABELS: Record<SelectorObjectiveGroup["key"], string> = {
  bestInSlot: "BEST IN SLOT", mustHave: "MUST HAVE", niceToHave: "NICE TO HAVE",
  catalyst: "CATALYST", transmog: "TRANSMOG", other: "OTHER",
};

function ObjectiveGroups({ character, specId }: { character: KeystoneSelectorCharacter; specId: number | null }) {
  const { groups } = groupSelectorObjectives(selectorObjectivesForSpec(character.objectives, specId));
  return <div className="teams-objectives">
    {groups.map(group => <section className="teams-objective-group" data-category={group.key} key={group.key}>
      <h4>{GROUP_LABELS[group.key]} · {group.objectives.length}</h4>
      <div className="teams-item-grid">{group.objectives.map(objective => <TeamItemTooltip key={`${objective.itemId}:${objective.sourceType}:${objective.sourceId}:${objective.variantKey}`} objective={objective} />)}</div>
    </section>)}
  </div>;
}

function SelectorCharacterRow({ character, rank }: { character: KeystoneSelectorCharacter; rank: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [specId, setSpecId] = useState<number | null>(null);
  const controls = `teams-character-${character.characterId}`;
  const oneSpec = character.specs.length === 1 ? character.specs[0] : null;
  const specLabel = character.specs.map(spec => specName(spec.specId)).join(" / ");
  return <article className="teams-character-row" data-emphasis="full" data-expanded={expanded} data-owner-id={character.userId} data-testid="selector-character">
    <button aria-controls={controls} aria-expanded={expanded} aria-label={`${expanded ? t("teams.hideItems") : t("teams.showItems")} · ${character.characterName}`} className="teams-character-row__summary" onClick={() => setExpanded(value => !value)} type="button">
      <span className="teams-rank" aria-label={t("teams.rank", { rank })}>#{rank}</span>
      <Portrait avatarUrl={character.avatarUrl} name={character.characterName} wowClass={character.wowClass} />
      <div className="teams-character-row__identity">
        <strong style={{ color: classColor(character.wowClass) }}>{character.characterName}</strong>
        <span className="teams-character-row__details"><span>{specLabel}</span><span>{character.realm}</span><span>{character.username}</span></span>
      </div>
      <strong className="teams-objective-count">{t("teams.objectiveCountShort", { count: character.totalObjectives })}</strong>
      <TierSummary counts={character.tierCounts} />
      <span aria-hidden="true" className="teams-expand"><ChevronDown /></span>
    </button>
    {expanded ? <div className="teams-character-row__content" id={controls}>
      {character.specs.length > 1 ? <div aria-label={t("teams.specFilter")} className="teams-specs" role="group">
        <button aria-pressed={specId === null} onClick={() => setSpecId(null)} type="button">{t("teams.allSpecs")} · {character.totalObjectives}</button>
        {character.specs.map(spec => <button aria-pressed={specId === spec.specId} key={spec.specId} onClick={() => setSpecId(spec.specId)} type="button">{specName(spec.specId)} · {spec.objectiveCount}</button>)}
      </div> : oneSpec ? <span className="teams-single-spec">{specName(oneSpec.specId)}</span> : null}
      <ObjectiveGroups character={character} specId={specId} />
    </div> : null}
  </article>;
}

function TeamPicker({ activeId, onOpen, onSelect, teams }: { activeId: number | null; onOpen: () => void; onSelect: (teamId: number) => void; teams: ClientTeamSummary[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = teams.find(team => team.id === activeId) ?? teams[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return <div className="teams-picker" ref={rootRef}>
    <button aria-expanded={open} aria-haspopup="listbox" className="teams-picker__trigger" onClick={() => { if (!open) onOpen(); setOpen(value => !value); }} ref={triggerRef} type="button">
      <Users aria-hidden="true" className="teams-picker__icon" /><span>{active?.name}</span><ChevronDown aria-hidden="true" />
    </button>
    {open ? <div aria-label={t("teams.yourTeams")} className="teams-picker__popover" role="listbox">
      <strong>{t("teams.yourTeams")}</strong>
      <div className="teams-picker__options">{teams.map(team => <button aria-selected={team.id === activeId} key={team.id} onClick={() => { onSelect(team.id); setOpen(false); }} role="option" type="button">
        <Check aria-hidden="true" /><span>{team.name}</span>
      </button>)}</div>
    </div> : null}
  </div>;
}

function MemberStrip({ detail, mode, onClear, onToggle, ownerUserId, selected }: {
  detail: ClientTeamDetail | null; mode: "objectives" | "planner"; onClear: () => void;
  onToggle: (userId: number) => void; ownerUserId: number | null; selected: Set<number>;
}) {
  const { t } = useI18n();
  const memberCount = detail?.members.length ?? 0;
  const showSelection = mode === "objectives" ? memberCount > 0 : selected.size > 0;
  const showClear = mode === "objectives" ? selected.size < memberCount : selected.size > 0;
  return <div className="teams-member-area">
    <div aria-label={t("teams.memberFilters")} className="teams-member-strip">
      {detail?.members.map(member => {
        const unavailable = mode === "planner" && !member.plannerConfigured;
        const pinned = mode === "planner" && member.userId === ownerUserId;
        return <button aria-label={t(member.characters.length === 1 ? "teams.memberFilterOne" : "teams.memberFilter", { name: member.username, count: member.characters.length })} aria-pressed={selected.has(member.userId)} className="teams-member-filter" data-pinned={pinned} data-unavailable={unavailable} disabled={unavailable} key={member.userId} onClick={() => onToggle(member.userId)} title={unavailable ? "Planner sin configurar" : undefined} type="button">
        <span className="teams-member-filter__avatars">{member.characters.slice(0, 3).map(character => <Portrait avatarUrl={character.avatarUrl} key={character.characterId} name={character.name} wowClass={character.wowClass} />)}</span>
        <span><strong>{member.username}</strong><small>{unavailable ? "Sin configurar" : t(member.characters.length === 1 ? "teams.characterCountOne" : "teams.characterCount", { count: member.characters.length })}</small></span>
        {pinned ? <Crown aria-hidden="true" className="teams-member-filter__owner" /> : null}
        <Check aria-hidden="true" className="teams-member-filter__check" />
      </button>;
      })}
    </div>
    {showSelection ? <div className="teams-active-filters">
      <span>{t(selected.size === 1 ? "teams.selectedMember" : "teams.selectedMembers", { count: selected.size })}</span>
      {showClear ? <button aria-label={t("teams.clearFilters")} className="teams-clear-filters" onClick={onClear} type="button"><X aria-hidden="true" />{t("teams.clearShort")}</button> : null}
    </div> : null}
  </div>;
}

export function TeamsPage({ currentUsername = "", dataSource = liveTeamsDataSource, onOpenWeb, onSessionExpired }: TeamsPageProps) {
  const { language, t } = useI18n();
  const brandMark = useThemeAsset("teams-loading-mark");
  const [initialSession] = useState(() => {
    const snapshot = getTeamsSessionSnapshot();
    const initialTeamId = preferredTeamId(snapshot.teams ?? [], snapshot.selectedTeamId, currentUsername);
    if (initialTeamId !== snapshot.selectedTeamId) setSelectedTeamId(initialTeamId, currentUsername);
    return {
      teams: snapshot.teams,
      teamId: initialTeamId,
      detail: initialTeamId === null ? null : getCachedTeamDetail(initialTeamId),
    };
  });
  const [teams, setTeams] = useState<ClientTeamSummary[] | null>(initialSession.teams);
  const [teamId, setTeamId] = useState<number | null>(initialSession.teamId);
  const [detail, setDetail] = useState<ClientTeamDetail | null>(initialSession.detail);
  const [objectiveSelectedUsers, setObjectiveSelectedUsers] = useState<Set<number>>(
    () => new Set(initialSession.detail?.members.map(member => member.userId) ?? []),
  );
  const [plannerSelectedUsers, setPlannerSelectedUsers] = useState<Set<number>>(() => new Set());
  const [activeFeature, setActiveFeature] = useState<"objectives" | "planner">("objectives");
  const [plannerOwnerUserId, setPlannerOwnerUserId] = useState<number | null>(null);
  const [plannerPreferences, setPlannerPreferences] = useState<ClientPlannerPreferences | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [dungeonId, setDungeonId] = useState<number | null>(null);
  const [selector, setSelector] = useState<KeystoneSelectorResponse | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const selectorGeneration = useRef(0);
  const teamsRef = useRef<ClientTeamSummary[] | null>(initialSession.teams);
  const hasRevealedTeam = useRef(initialSession.detail !== null);

  useEffect(() => { teamsRef.current = teams; }, [teams]);

  const refreshTeams = useCallback((): Promise<ClientTeamSummary[]> => {
    const generation = ++listGeneration.current;
    return loadTeams(dataSource).then(result => {
      if (generation !== listGeneration.current) return result;
      setTeamError(null);
      teamsRef.current = result;
      setTeams(result);
      setTeamId(current => {
        const next = preferredTeamId(result, current, currentUsername);
        setSelectedTeamId(next, currentUsername);
        return next;
      });
      return result;
    }).catch(caught => {
      if (generation === listGeneration.current) {
        const parsed = errorInfo(caught, t("teams.loadError"));
        if (parsed.code === "SESSION_EXPIRED") onSessionExpired();
        else if (teamsRef.current === null) setTeamError(parsed.message);
      }
      throw caught;
    });
  }, [currentUsername, dataSource, onSessionExpired, t]);

  useEffect(() => {
    void refreshTeams().catch(() => undefined);
    const onFocus = () => { void refreshTeams().catch(() => undefined); };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      listGeneration.current += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshTeams]);

  useEffect(() => {
    if (teams && teams.length > 0 && teamId === null) {
      const next = preferredTeamId(teams, null, currentUsername)!;
      setSelectedTeamId(next, currentUsername);
      setTeamId(next);
    }
  }, [currentUsername, teamId, teams]);

  useEffect(() => {
    const generation = ++detailGeneration.current;
    selectorGeneration.current += 1;
    setPlannerSelectedUsers(new Set()); setDungeonId(null); setSelector(null); setSelectorError(null); setActiveFeature("objectives"); setPlannerOwnerUserId(null);
    setPlannerPreferences(null); setPreferencesOpen(false); setPreferencesError(null);
    if (teamId === null) { setDetail(null); setObjectiveSelectedUsers(new Set()); return; }
    const cached = getCachedTeamDetail(teamId);
    setDetail(cached);
    const cachedMemberIds = new Set(cached?.members.map(member => member.userId) ?? []);
    setObjectiveSelectedUsers(cachedMemberIds);
    if (cached) hasRevealedTeam.current = true;
    loadTeamDetail(dataSource, teamId).then(result => {
      if (generation !== detailGeneration.current) return;
      setTeamError(null);
      setDetail(result);
      const resultMemberIds = new Set(result.members.map(member => member.userId));
      setObjectiveSelectedUsers(current => cached
        ? new Set([...resultMemberIds].filter(userId => !cachedMemberIds.has(userId) || current.has(userId)))
        : resultMemberIds);
      hasRevealedTeam.current = true;
    }).catch(caught => {
      if (generation !== detailGeneration.current) return;
      const parsed = errorInfo(caught, t("teams.loadError"));
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired();
      else if (["TEAM_ACCESS_DENIED", "TEAM_NOT_FOUND"].includes(parsed.code)) {
        removeTeamFromSessionCache(teamId);
        setTeams(current => current?.filter(team => team.id !== teamId) ?? current);
        setTeamId(null);
      } else if (!cached) setTeamError(parsed.message);
    });
    return () => { detailGeneration.current += 1; };
  }, [dataSource, onSessionExpired, t, teamId]);

  const selectDungeon = (nextDungeonId: number) => {
    if (teamId === null) return;
    const generation = ++selectorGeneration.current;
    const locale = language === "en" ? "en_US" : "es_ES";
    const cached = getCachedSelector(teamId, nextDungeonId, locale);
    setDungeonId(nextDungeonId); setSelector(cached); setSelectorError(null); setSelectorLoading(cached === null); setPlannerOwnerUserId(null);
    const request = loadSelector(dataSource, teamId, nextDungeonId, locale);
    request.then(result => {
      if (generation === selectorGeneration.current) { setSelector(result); setSelectorError(null); }
    }).catch(caught => {
      if (generation !== selectorGeneration.current) return;
      const parsed = errorInfo(caught, t("teams.selectorError"));
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired();
      else if (!cached) setSelectorError(parsed.message);
    }).finally(() => { if (generation === selectorGeneration.current) setSelectorLoading(false); });
  };

  const closeSelector = () => { selectorGeneration.current += 1; setDungeonId(null); setSelector(null); setSelectorError(null); setSelectorLoading(false); setActiveFeature("objectives"); setPlannerOwnerUserId(null); };
  const readyCharacterIds = new Set(plannerPreferences?.lootPreferences.map(preference => preference.characterId) ?? []);
  const toggleUser = (userId: number) => {
    if (activeFeature === "objectives") {
      setObjectiveSelectedUsers(current => {
        const next = new Set(current);
        if (next.has(userId)) next.delete(userId); else next.add(userId);
        return next;
      });
      return;
    }
    setPlannerSelectedUsers(current => {
    const member = detail?.members.find(item => item.userId === userId);
    const configuredLocally = member?.characters.some(character => readyCharacterIds.has(character.characterId)
      && plannerPreferences?.preferences.some(preference => preference.characterId === character.characterId && preference.playPreference !== "disabled")) ?? false;
    if (member?.plannerConfigured === false && !configuredLocally) return current;
    const next = new Set(current);
    if (next.has(userId)) { if (userId !== plannerOwnerUserId) next.delete(userId); }
    else if (next.size < 5) next.add(userId);
    return next;
    });
  };
  const ownMember = detail?.members.find(member => member.username.toLocaleLowerCase() === currentUsername.toLocaleLowerCase())
    ?? detail?.members.find(member => member.characters.some(character => plannerPreferences?.preferences.some(preference => preference.characterId === character.characterId)))
    ?? null;
  const plannerReady = plannerPreferences
    ? plannerPreferences.preferences.some(preference => preference.playPreference !== "disabled" && readyCharacterIds.has(preference.characterId))
    : ownMember?.plannerConfigured ?? false;
  const plannerDetail = detail && ownMember ? {
    ...detail, members: detail.members.map(member => member.userId === ownMember.userId ? { ...member, plannerConfigured: plannerReady } : member),
  } : detail;
  const setOwnPlannerReadiness = (ready: boolean) => setDetail(current => current ? {
    ...current, members: current.members.map(member => member.userId === ownMember?.userId ? { ...member, plannerConfigured: ready } : member),
  } : current);
  const loadOwnPreferences = useCallback((blockUntilReady: boolean) => {
    setPreferencesError(null); setPreferencesLoading(true);
    return dataSource.getPlannerPreferences().then(result => {
      const lootCharacterIds = new Set(result.lootPreferences.map(preference => preference.characterId));
      const ready = result.preferences.some(preference => preference.playPreference !== "disabled" && lootCharacterIds.has(preference.characterId));
      setPlannerPreferences(result); setOwnPlannerReadiness(ready);
      setPreferencesOpen(blockUntilReady && !ready);
    }).catch(caught => {
      const parsed = errorInfo(caught, language === "es" ? "No se pudo cargar la configuración del Planner." : "Planner configuration could not be loaded.");
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired();
      else { setPreferencesError(parsed.message); setPreferencesOpen(blockUntilReady); }
    }).finally(() => setPreferencesLoading(false));
  }, [dataSource, language, onSessionExpired, ownMember?.userId]);
  const enterPlanner = () => {
    setActiveFeature("planner"); setPlannerOwnerUserId(null);
    setPlannerSelectedUsers(current => new Set([...current]
      .filter(userId => plannerDetail?.members.find(member => member.userId === userId)?.plannerConfigured)
      .slice(0, 5)));
    void loadOwnPreferences(true);
  };
  const openPreferences = () => {
    setPreferencesOpen(true);
    if (plannerPreferences === null) void loadOwnPreferences(true);
  };
  const savePreferences = async (update: ClientPlannerPreferenceUpdate) => {
    setPreferencesSaving(true); setPreferencesError(null);
    try {
      const result = await dataSource.updatePlannerPreferences(update);
      const lootCharacterIds = new Set(result.lootPreferences.map(preference => preference.characterId));
      const ready = result.preferences.some(preference => preference.playPreference !== "disabled" && lootCharacterIds.has(preference.characterId));
      setPlannerPreferences(result); setOwnPlannerReadiness(ready);
      if (ready) setPreferencesOpen(false);
    } catch (caught) {
      const parsed = errorInfo(caught, language === "es" ? "No se pudo guardar la configuración." : "The configuration could not be saved.");
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired(); else setPreferencesError(parsed.message);
    } finally { setPreferencesSaving(false); }
  };
  const stoneCountDetail = detail && activeFeature === "objectives"
    ? { ...detail, members: detail.members.filter(member => objectiveSelectedUsers.has(member.userId)) }
    : detail;
  const counts = stoneCountDetail ? teamStoneCounts(stoneCountDetail) : new Map<number, number>();
  const coldLoading = teams === null
    || Boolean(teams.length > 0 && !hasRevealedTeam.current && (teamId === null || detail?.id !== teamId));
  const detailLoading = !coldLoading && teamId !== null && detail?.id !== teamId;
  const plannerAccessChecking = activeFeature === "planner" && preferencesLoading;
  const selectedUsers = activeFeature === "objectives" ? objectiveSelectedUsers : plannerSelectedUsers;
  const objectiveSelector = selector ? filterSelectorByMembers(selector, objectiveSelectedUsers) : null;
  const summarySelector = activeFeature === "objectives" ? objectiveSelector : selector;
  const summaryCharacters = summarySelector?.summary.charactersWithObjectives ?? 0;
  const summaryObjectives = summarySelector?.summary.totalObjectives ?? 0;
  const globalSummaryKey = summaryCharacters === 1
    ? summaryObjectives === 1 ? "teams.globalSummaryOne" : "teams.globalSummaryCharacterOne"
    : summaryObjectives === 1 ? "teams.globalSummaryObjectiveOne" : "teams.globalSummary";

  if (coldLoading && !teamError) return <section className="teams-page teams-page--loading">
    <div aria-label={t("teams.loading")} className="teams-loading-veil" role="status">
      <img alt="" aria-hidden="true" src={brandMark} />
      <span>{t("teams.loading")}</span>
    </div>
  </section>;
  if (teamError) return <section className="teams-page teams-page--center"><p className="error" role="alert">{teamError}</p></section>;
  if (teams?.length === 0) return <section className="teams-page teams-page--center"><div className="teams-empty"><Users aria-hidden="true" /><h2>{t("teams.emptyTitle")}</h2><p>{t("teams.emptyDetail")}</p><button onClick={onOpenWeb} type="button">{t("shell.openWeb")}</button></div></section>;

  return <section className="teams-page">
    <div className="teams-top-row">
      <TeamPicker activeId={teamId} onOpen={() => { void refreshTeams().catch(() => undefined); }} onSelect={(nextTeamId) => {
        setSelectedTeamId(nextTeamId, currentUsername);
        setTeamId(nextTeamId);
        setDetail(getCachedTeamDetail(nextTeamId));
      }} teams={teams ?? []} />
      <MemberStrip
        detail={activeFeature === "planner" ? plannerDetail : detail}
        mode={activeFeature}
        onClear={() => activeFeature === "objectives"
          ? setObjectiveSelectedUsers(new Set(detail?.members.map(member => member.userId) ?? []))
          : setPlannerSelectedUsers(plannerOwnerUserId === null ? new Set() : new Set([plannerOwnerUserId]))}
        onToggle={toggleUser}
        ownerUserId={plannerOwnerUserId}
        selected={selectedUsers}
      />
    </div>
    <div className="teams-selector">
      {detailLoading ? <div aria-label={t("teams.loadingTeam")} className="teams-detail-loading" role="status">
        <img alt="" aria-hidden="true" src={brandMark} /><span>{t("teams.loadingTeam")}</span>
      </div> : null}
      <nav aria-label={t("teams.dungeons")} className="teams-dungeon-rail">
        {MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => {
          const count = counts.get(dungeon.id) ?? 0; const selected = dungeonId === dungeon.id;
          return <button aria-label={t(count === 1 ? "teams.selectDungeonOne" : "teams.selectDungeon", { name: dungeon.name, count })} aria-pressed={selected} className="teams-dungeon" data-available={count > 0} disabled={!detail} key={dungeon.id} onClick={() => selectDungeon(dungeon.id)} title={dungeon.name} type="button">
            <img alt="" aria-hidden="true" className="teams-dungeon__art" src={dungeon.teleportIconUrl} />
            <span>{dungeon.name}</span><b>{count}</b>
          </button>;
        })}
      </nav>
      <section className="teams-selector-panel" data-selected={dungeonId !== null}>
        {dungeonId === null ? <div className="teams-selector-panel__prompt"><img alt="" aria-hidden="true" src={brandMark} /><div><p>{t("teams.selectPrompt")}</p><small><span>{t("teams.selectHintAvailable")}</span><span>{t("teams.selectHintZero")}</span></small></div></div> : <>
          <header className="teams-selector-panel__top">
            <div className="teams-feature-tabs">
              <button aria-pressed={activeFeature === "objectives"} onClick={() => { setActiveFeature("objectives"); setPlannerOwnerUserId(null); }} type="button">{t("teams.objectives")}</button>
              <button aria-pressed={activeFeature === "planner"} onClick={enterPlanner} type="button">{t("teams.planStone")}</button>
            </div>
            <div className="teams-dungeon-summary">
              {summarySelector ? <StoneOwnerChips detail={detail} stones={summarySelector.availability.stones} /> : null}
              {summarySelector ? <>
                <div className="teams-dungeon-metrics">
                  <span className="teams-summary-total">{t(globalSummaryKey, { characters: summaryCharacters, objectives: summaryObjectives })}</span>
                  <TierSummary counts={summarySelector.summary.tiers} />
                </div>
              </> : null}
            </div>
            <button aria-label={t("teams.closeSelector")} className="teams-selector-panel__close" onClick={closeSelector} type="button"><X aria-hidden="true" /></button>
          </header>
          <div className="teams-selector-panel__content" data-feature={activeFeature}>
            {selectorLoading ? <div aria-label={t("teams.loadingObjectives")} className="teams-selector-loading"><i /><i /><i /></div> : null}
            {selectorError ? <p className="error teams-selector-error" role="alert">{selectorError}</p> : null}
            {selector && !selectorLoading && plannerAccessChecking ? <div aria-label={PLANNER_COPY[language].loadingPreferences} className="teams-selector-loading" role="status"><i /><i /><i /></div> : null}
            {selector && !selectorLoading && activeFeature === "planner" && !plannerAccessChecking && dungeonId !== null ? <KeystonePlannerPanel dataSource={dataSource} detail={plannerDetail} dungeonId={dungeonId} onConfigure={openPreferences} onOwnerChange={setPlannerOwnerUserId} onSessionExpired={onSessionExpired} selectedUsers={plannerSelectedUsers} selector={selector} setSelectedUsers={setPlannerSelectedUsers} teamId={teamId} /> : null}
            {objectiveSelector && !selectorLoading && activeFeature === "objectives" ? objectiveSelector.characters.length === 0
              ? <div className="teams-selector-empty"><Gem aria-hidden="true" /><p>{t("teams.noObjectives")}</p>{objectiveSelector.availability.stoneCount === 0 ? <small>{t("teams.noObjectivesNoStone")}</small> : null}</div>
              : <div className="teams-character-list">{objectiveSelector.characters.map((character, index) => <SelectorCharacterRow character={character} key={character.characterId} rank={index + 1} />)}</div>
              : null}
          </div>
        </>}
      </section>
    </div>
    {preferencesOpen ? <PlannerPreferencesModal characters={ownMember?.characters ?? []} error={preferencesError} initial={plannerPreferences ?? { preferences: [], lootPreferences: [], onboardingCompleted: false }} loading={preferencesLoading} onExit={() => {
      setPreferencesOpen(false); setPreferencesError(null); if (plannerPreferences === null || !plannerReady) setActiveFeature("objectives");
    }} onSave={savePreferences} saving={preferencesSaving} /> : null}
  </section>;
}
