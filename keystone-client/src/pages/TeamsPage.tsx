import { Check, ChevronDown, Crown, Gem, Settings2, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import battleRezIcon from "../assets/planner/battle-rez.jpg";
import bloodlustIcon from "../assets/planner/bloodlust.jpg";
import classBuffsIcon from "../assets/planner/class-buffs.jpg";
import damageSynergyIcon from "../assets/planner/damage-synergy.jpg";
import { PlannerPreferencesModal } from "../components/PlannerPreferencesModal";
import { TeamItemTooltip } from "../components/TeamItemTooltip";
import { WowRoleIcon } from "../components/WowRoleIcon";
import { WowheadTooltip } from "../components/WowheadTooltip";
import { classColor } from "../core/characterDisplay";
import { useI18n } from "../core/i18n";
import { MIDNIGHT_SEASON_2_DUNGEONS, SEASON_2_DUNGEON_BY_ID } from "../core/season2";
import {
  groupSelectorObjectives, liveTeamsDataSource, selectorObjectivesForSpec, teamStoneCounts,
  type SelectorObjectiveGroup, type TeamsDataSource,
} from "../core/teams";
import {
  getCachedSelector, getCachedTeamDetail, getTeamsSessionSnapshot, loadSelector, loadTeamDetail,
  loadTeams, removeTeamFromSessionCache, setSelectedTeamId,
} from "../core/teamsSessionCache";
import { specName, wowSpecializationIconUrl } from "../core/wowSpecs";
import { DEFAULT_KEYSTONE_PLANNER_OPTIONS } from "../core/keystonePlanner";
import { useThemeAsset } from "../theme/useThemeAsset";
import type {
  ClientTeamDetail, ClientTeamSummary, CoreError, KeystoneSelectorCharacter, KeystoneSelectorResponse,
  KeystoneSelectorStone, KeystoneSelectorTierCounts, KeystonePlannerAssignment, KeystonePlannerObjective, KeystonePlannerRecommendation,
  ClientPlannerPreference, ClientPlannerPreferenceInput, KeystonePlannerResponse,
} from "../core/types";

type TeamsPageProps = { currentUsername?: string; dataSource?: TeamsDataSource; onOpenWeb: () => void; onSessionExpired: () => void };

function errorInfo(error: unknown, fallback: string): CoreError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error
    ? { code: String((error as CoreError).code), message: String((error as CoreError).message) }
    : { code: "API_UNAVAILABLE", message: fallback };
}

function Portrait({ avatarUrl, name, wowClass }: { avatarUrl: string | null; name: string; wowClass: string | null }) {
  const [failed, setFailed] = useState(false);
  return <span className="teams-portrait" style={{ backgroundColor: classColor(wowClass) }}>
    <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
    {avatarUrl && !failed ? <img alt="" onError={() => setFailed(true)} src={avatarUrl} /> : null}
  </span>;
}

function TierSummary({ counts }: { counts: KeystoneSelectorTierCounts }) {
  return <span className="teams-tier-line">
    <span><b>{counts.bestInSlot}</b> BiS</span><span><b>{counts.mustHave}</b> Must</span>
    <span><b>{counts.niceToHave}</b> Nice</span><span><b>{counts.catalyst}</b> Cat</span>
  </span>;
}

const PLANNER_COPY = {
  es: {
    noObjectives: "Sin objetivos", owner: "Dueño de la piedra", ownerTitle: "Dueño de la piedra · líder",
    noLoot: "Sin objetivos de botín", item: "Objeto", value: "Puntuación", buffs: "Buffos y sinergias",
    objectives: "objetivos", players: "jugadores", preferred: "Preferidos", available: "disponibles",
    damage: "Daño", vacancies: "huecos", bloodlust: "Ansia de sangre", battleRez: "Resurrección en combate",
    composition: "Composición", utilities: "Utilidades", objectiveSummary: "Objetivos", preferenceSummary: "Preferidos",
    lootBreakdown: "Desglose de objetivos", moreLoot: "Ver todos los objetivos", closeLoot: "Cerrar desglose",
    minimum: "Nivel mínimo",
    filterHelp: "La barra solo filtra las piedras disponibles.", stones: "Piedras disponibles",
    noStones: "No hay piedras visibles con este filtro.", options: "Prioridades del grupo", configure: "Configurar mis personajes",
    loadingPreferences: "Cargando configuración del Planner…",
    classBuffs: "Buffos de clase", damageSynergy: "Sinergia de daño", calculate: "Calcular Top 5",
    calculating: "Calculando…", results: "Top 5 de configuraciones", resultTitle: "Top 5 para la piedra seleccionada",
    selectError: "Selecciona una piedra exacta y entre 2 y 5 participantes.", requestError: "No se pudo calcular el Top 5.",
    stale: "La piedra exacta ya no está disponible. Actualiza el equipo y vuelve a seleccionarla.",
    unconfigured: "Hay participantes sin preferencias configuradas para el Planner.",
    invalid: "Revisa los miembros disponibles.", noComposition: "No existe una composición válida para esta selección.",
    instruction: "Elige una piedra, marca de 2 a 5 participantes y calcula.",
    availability: { guaranteed: "garantizada", conditional: "condicional", none: "ausente" },
    profile: { physical: "físico", magical: "mágico", mixed: "mixto", unknown: "desconocido" },
    capabilities: { CHAOS_BRAND: "Marca del caos", MYSTIC_TOUCH: "Toque místico", MARK_OF_THE_WILD: "Marca de lo salvaje", ARCANE_INTELLECT: "Intelecto Arcano", BATTLE_SHOUT: "Grito de batalla", POWER_WORD_FORTITUDE: "Palabra de poder: entereza", SKYFURY: "Furia del cielo" },
    tiers: { 3: "BiS", 2: "Must", 1: "Nice", 5: "Catalyst", 4: "Transfiguración", other: "Otros" },
  },
  en: {
    noObjectives: "No objectives", owner: "Keystone owner", ownerTitle: "Keystone owner · leader",
    noLoot: "No loot objectives", item: "Item", value: "Score", buffs: "Buffs and synergies",
    objectives: "objectives", players: "players", preferred: "Preferred", available: "available",
    damage: "Damage", vacancies: "vacancies", bloodlust: "Bloodlust", battleRez: "Battle Resurrection",
    composition: "Composition", utilities: "Utilities", objectiveSummary: "Objectives", preferenceSummary: "Preferred",
    lootBreakdown: "Objective breakdown", moreLoot: "View all objectives", closeLoot: "Close breakdown",
    minimum: "Minimum level",
    filterHelp: "The slider only filters available keystones.", stones: "Available keystones",
    noStones: "No keystones are visible with this filter.", options: "Group priorities", configure: "Configure my characters",
    loadingPreferences: "Loading Planner configuration…",
    classBuffs: "Class buffs", damageSynergy: "Damage synergy", calculate: "Calculate Top 5",
    calculating: "Calculating…", results: "Top 5 configurations", resultTitle: "Top 5 for the selected keystone",
    selectError: "Select one exact keystone and between 2 and 5 participants.", requestError: "The Top 5 could not be calculated.",
    stale: "The exact keystone is no longer available. Refresh the Team and select it again.",
    unconfigured: "Some participants have no Planner preferences configured.",
    invalid: "Review the available members.", noComposition: "No valid composition exists for this selection.",
    instruction: "Choose a keystone, select 2 to 5 participants, and calculate.",
    availability: { guaranteed: "guaranteed", conditional: "conditional", none: "missing" },
    profile: { physical: "physical", magical: "magical", mixed: "mixed", unknown: "unknown" },
    capabilities: { CHAOS_BRAND: "Chaos Brand", MYSTIC_TOUCH: "Mystic Touch", MARK_OF_THE_WILD: "Mark of the Wild", ARCANE_INTELLECT: "Arcane Intellect", BATTLE_SHOUT: "Battle Shout", POWER_WORD_FORTITUDE: "Power Word: Fortitude", SKYFURY: "Skyfury" },
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

function PlannerAssignmentPreview({ assignment, avatarUrl, owner }: { assignment: KeystonePlannerAssignment; avatarUrl: string | null; owner: boolean }) {
  const copy = usePlannerCopy();
  return <span className="planner-assignment-preview" style={{ "--planner-class-color": classColor(assignment.wowClass) } as React.CSSProperties}>
    <span className="planner-role-frame"><WowRoleIcon role={assignment.role} /></span>
    {owner ? <span aria-label={copy.owner} className="planner-owner-crown" role="img" title={copy.ownerTitle}><Crown aria-hidden="true" /></span> : null}
    <Portrait avatarUrl={avatarUrl} name={assignment.characterName} wowClass={assignment.wowClass} />
    <strong>{assignment.characterName}</strong>
  </span>;
}

function PlannerObjectiveIcon({ assignment, objective }: { assignment: KeystonePlannerAssignment; objective: KeystonePlannerObjective }) {
  const copy = usePlannerCopy();
  return <WowheadTooltip className="planner-objective-icon" id={objective.itemId} label={objective.itemName ?? `${copy.item} #${objective.itemId}`} options={{ spec: assignment.lootSpecId }} type="item"><span data-tier={objective.tier}>
    {objective.iconUrl ? <img alt="" src={objective.iconUrl} /> : <Gem aria-hidden="true" />}
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

function PlannerAssignmentCard({ assignment, owner }: { assignment: KeystonePlannerAssignment; owner: boolean }) {
  const copy = usePlannerCopy();
  const specializationIcon = wowSpecializationIconUrl(assignment.specId);
  const [lootOpen, setLootOpen] = useState(false);
  const hasOverflow = assignment.objectives.length >= 6;
  const visibleObjectives = hasOverflow ? assignment.objectives.slice(0, 5) : assignment.objectives;
  return <article className="planner-player-card" data-role={assignment.role} style={{ "--planner-class-color": classColor(assignment.wowClass) } as React.CSSProperties}>
    <header>
      <span className="planner-player-role"><WowRoleIcon role={assignment.role} /></span>
      <span className="planner-wow-icon" title={specName(assignment.specId)}>{specializationIcon ? <img alt="" src={specializationIcon} /> : "?"}</span>
      <span className="planner-player-card__identity"><strong style={{ color: classColor(assignment.wowClass) }}>{assignment.characterName}</strong><small>{assignment.username}</small></span>
      {owner ? <span aria-label={copy.owner} className="planner-owner-crown" role="img" title={copy.ownerTitle}><Crown aria-hidden="true" /></span> : null}
    </header>
    <div className="planner-objective-icons">{assignment.objectives.length > 0
      ? <>{visibleObjectives.map(objective => <PlannerObjectiveIcon assignment={assignment} key={objective.variantKey} objective={objective} />)}{hasOverflow ? <button aria-label={`${copy.moreLoot} · ${assignment.characterName} · ${assignment.objectives.length}`} className="planner-objective-more" onClick={() => setLootOpen(true)} title={copy.moreLoot} type="button">+</button> : null}</>
      : <small>{copy.noLoot}</small>}</div>
    {lootOpen ? <PlannerLootBreakdown assignment={assignment} onClose={() => setLootOpen(false)} /> : null}
  </article>;
}

function PlannerUtility({ icon, label, spellId, state }: { icon: string; label: string; spellId?: number; state?: string }) {
  const content = <span className="planner-utility" data-state={state}><img alt="" src={icon} /><span>{label}</span></span>;
  return spellId ? <WowheadTooltip className="planner-utility-link" id={spellId} label={label} type="spell">{content}</WowheadTooltip> : content;
}

function PlannerRecommendationCard({ avatarUrls, expanded, onToggle, recommendation }: {
  avatarUrls: Map<number, string | null>; expanded: boolean; onToggle: () => void; recommendation: KeystonePlannerRecommendation;
}) {
  const copy = usePlannerCopy();
  const ordered = [
    ...recommendation.assignments.filter(item => item.role === "tank"),
    ...recommendation.assignments.filter(item => item.role === "healer"),
    ...recommendation.assignments.filter(item => item.role === "dps"),
  ];
  return <article className="planner-recommendation" data-expanded={expanded}>
    <button aria-expanded={expanded} className="planner-recommendation__summary" onClick={onToggle} type="button">
      <span className="planner-rank">#{recommendation.rank}</span>
      <span className="planner-recommendation__metrics">
        <span><b>{recommendation.lootSummary.totalObjectives}</b> {copy.objectiveSummary}</span>
        <span><b>{recommendation.preferenceSummary.preferred}</b> {copy.preferenceSummary}</span>
      </span>
      <span className="planner-recommendation__party">{ordered.map(assignment => <PlannerAssignmentPreview assignment={assignment} avatarUrl={avatarUrls.get(assignment.characterId) ?? null} key={assignment.userId} owner={assignment.characterId === recommendation.stone.characterId} />)}</span>
      <span className="planner-score"><b>{recommendation.lootSummary.weightedScore}</b><small>{copy.value}</small></span>
      <ChevronDown aria-hidden="true" />
    </button>
    {expanded ? <div className="planner-recommendation__detail">
      <div className="planner-party-trapezoid">{ordered.map(assignment => <PlannerAssignmentCard assignment={assignment} key={assignment.userId} owner={assignment.characterId === recommendation.stone.characterId} />)}</div>
      <div className="planner-utilities">
        <section><strong>{copy.composition}</strong>
          <PlannerUtility icon={damageSynergyIcon} label={`${copy.damage}: ${copy.profile[recommendation.compositionSummary.damageProfile]}`} />
          {recommendation.vacancies.length > 0 ? <PlannerUtility icon={classBuffsIcon} label={`${recommendation.vacancies.length} ${copy.vacancies}`} /> : null}
        </section>
        <section><strong>{copy.utilities}</strong>
          <PlannerUtility icon={bloodlustIcon} label={`${copy.bloodlust} · ${copy.availability[recommendation.compositionSummary.bloodlust]}`} spellId={2825} state={recommendation.compositionSummary.bloodlust} />
          <PlannerUtility icon={battleRezIcon} label={`${copy.battleRez} · ${copy.availability[recommendation.compositionSummary.battleRez]}`} spellId={20484} state={recommendation.compositionSummary.battleRez} />
        </section>
        <section><strong>{copy.buffs}</strong>
          {recommendation.compositionSummary.uniqueCapabilities.filter(capability => !["BLOODLUST", "BATTLE_REZ"].includes(capability.capabilityId.toUpperCase())).map(capability =>
            <PlannerUtility icon={plannerCapabilityIcon(capability.iconSpellId, capability.type)} key={capability.capabilityId} label={localizedCapabilityName(copy, capability.capabilityId, capability.name)} spellId={capability.iconSpellId} state={capability.availability} />)}
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
  const [options, setOptions] = useState(() => ({ ...DEFAULT_KEYSTONE_PLANNER_OPTIONS }));
  const generation = useRef(0);
  const stones = selector?.availability.stones ?? [];
  const visibleStones = stones.filter(stone => stone.level >= minimumLevel);
  const selectedStone = stones.find(stone => stone.characterId === selectedStoneId) ?? null;

  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    generation.current += 1; setResponse(null); setExpanded(null); setPlannerError(null); setLoading(false);
  }, [options, selectedUsers]);
  useEffect(() => {
    if (selectedStone && selectedStone.level < minimumLevel) {
      setSelectedStoneId(null); onOwnerChange(null); setResponse(null); setExpanded(null);
    }
  }, [minimumLevel, onOwnerChange, selectedStone]);

  const selectStone = (stone: KeystoneSelectorStone) => {
    const previousOwnerUserId = selectedStone?.ownerUserId ?? null;
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
  const calculate = () => {
    if (!selectedStone || teamId === null || selectedUsers.size < 2 || selectedUsers.size > 5) {
      setPlannerError(copy.selectError); return;
    }
    const currentGeneration = ++generation.current;
    setLoading(true); setPlannerError(null); setResponse(null); setExpanded(null);
    dataSource.getKeystonePlanner(teamId, {
      participantUserIds: [...selectedUsers], targetLevel: selectedStone.level, challengeMapId: dungeonId,
      stoneCharacterId: selectedStone.characterId, options, locks: [],
    }).then(result => {
      if (currentGeneration !== generation.current) return;
      setResponse(result); setExpanded(null);
    }).catch(caught => {
      if (currentGeneration !== generation.current) return;
      const parsed = errorInfo(caught, copy.requestError);
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired(); else setPlannerError(parsed.message);
    }).finally(() => { if (currentGeneration === generation.current) setLoading(false); });
  };
  const unconfiguredSelected = detail?.members.some(member => selectedUsers.has(member.userId) && !member.plannerConfigured) ?? false;
  const avatarUrls = new Map(detail?.members.flatMap(member => member.characters.map(character => [character.characterId, character.avatarUrl] as const)) ?? []);
  const emptyResult = response
    ? response.availability.eligibleStoneCount === 0 ? copy.stale
      : response.status === "unconfigured_participants" ? copy.unconfigured
      : response.status === "invalid_input" ? copy.invalid
      : copy.noComposition
    : copy.instruction;

  return <div className="keystone-planner">
    <aside className="keystone-planner__config">
      <div className="planner-config-heading"><button className="planner-configure" onClick={onConfigure} type="button"><Settings2 aria-hidden="true" />{copy.configure}</button></div>
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
          ["classBuffs", copy.classBuffs, classBuffsIcon], ["damageSynergy", copy.damageSynergy, damageSynergyIcon],
        ] as const).map(([key, label, icon]) => <label key={key}><img alt="" aria-hidden="true" src={icon} /><span>{label}</span><input checked={options[key]} onChange={event => setOptions(current => ({ ...current, [key]: event.currentTarget.checked }))} type="checkbox" /></label>)}
      </div>
      <button className="planner-calculate" disabled={loading || !selectedStone || selectedUsers.size < 2 || selectedUsers.size > 5 || unconfiguredSelected} onClick={calculate} type="button">{loading ? copy.calculating : copy.calculate}</button>
      {unconfiguredSelected ? <p className="planner-readiness-warning">{copy.unconfigured}</p> : null}
      {plannerError ? <p className="error planner-error" role="alert">{plannerError}</p> : null}
    </aside>
    <section className="keystone-planner__results" aria-label={copy.results}>
      {response?.recommendations.length ? response.recommendations.map(recommendation => <PlannerRecommendationCard avatarUrls={avatarUrls} expanded={expanded === recommendation.fingerprint} key={recommendation.fingerprint} onToggle={() => setExpanded(current => current === recommendation.fingerprint ? null : recommendation.fingerprint)} recommendation={recommendation} />)
        : <div className="planner-results-empty"><Crown aria-hidden="true" /><strong>{copy.resultTitle}</strong><span>{emptyResult}</span></div>}
    </section>
  </div>;
}

const GROUP_LABELS: Record<SelectorObjectiveGroup["key"], string> = {
  bestInSlot: "BEST IN SLOT", mustHave: "MUST HAVE", niceToHave: "NICE TO HAVE",
  catalyst: "CATALYST", transmog: "TRANSMOG", other: "OTHER",
};

function ObjectiveGroups({ character, specId }: { character: KeystoneSelectorCharacter; specId: number | null }) {
  const { t } = useI18n();
  const { groups, completed } = groupSelectorObjectives(selectorObjectivesForSpec(character.objectives, specId));
  return <div className="teams-objectives">
    {groups.map(group => <section className="teams-objective-group" data-category={group.key} key={group.key}>
      <h4>{GROUP_LABELS[group.key]} · {group.objectives.length}</h4>
      <div className="teams-item-grid">{group.objectives.map(objective => <TeamItemTooltip key={`${objective.itemId}:${objective.sourceType}:${objective.sourceId}:${objective.variantKey}`} objective={objective} />)}</div>
    </section>)}
    {completed.length > 0 ? <details className="teams-completed">
      <summary>{t("teams.completedVoidcore")} · {completed.length}</summary>
      <div className="teams-item-grid">{completed.map(objective => <TeamItemTooltip key={`${objective.itemId}:${objective.sourceType}:${objective.sourceId}:${objective.variantKey}`} objective={objective} />)}</div>
    </details> : null}
  </div>;
}

function SelectorCharacterRow({ character, muted, rank }: { character: KeystoneSelectorCharacter; muted: boolean; rank: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [specId, setSpecId] = useState<number | null>(null);
  const controls = `teams-character-${character.characterId}`;
  const oneSpec = character.specs.length === 1 ? character.specs[0] : null;
  const specLabel = character.specs.map(spec => specName(spec.specId)).join(" / ");
  return <article className="teams-character-row" data-emphasis={muted ? "muted" : "full"} data-expanded={expanded} data-owner-id={character.userId} data-testid="selector-character">
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
    {selected.size > 0 ? <div className="teams-active-filters">
      <span>{t(selected.size === 1 ? "teams.selectedMember" : "teams.selectedMembers", { count: selected.size })}</span>
      <button aria-label={t("teams.clearFilters")} className="teams-clear-filters" onClick={onClear} type="button"><X aria-hidden="true" />{t("teams.clearShort")}</button>
    </div> : null}
  </div>;
}

export function TeamsPage({ currentUsername = "", dataSource = liveTeamsDataSource, onOpenWeb, onSessionExpired }: TeamsPageProps) {
  const { language, t } = useI18n();
  const brandMark = useThemeAsset("teams-loading-mark");
  const [initialSession] = useState(() => {
    const snapshot = getTeamsSessionSnapshot();
    const initialTeamId = snapshot.teams?.some(team => team.id === snapshot.selectedTeamId)
      ? snapshot.selectedTeamId
      : snapshot.teams?.[0]?.id ?? null;
    if (initialTeamId !== snapshot.selectedTeamId) setSelectedTeamId(initialTeamId);
    return {
      teams: snapshot.teams,
      teamId: initialTeamId,
      detail: initialTeamId === null ? null : getCachedTeamDetail(initialTeamId),
    };
  });
  const [teams, setTeams] = useState<ClientTeamSummary[] | null>(initialSession.teams);
  const [teamId, setTeamId] = useState<number | null>(initialSession.teamId);
  const [detail, setDetail] = useState<ClientTeamDetail | null>(initialSession.detail);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(() => new Set());
  const [activeFeature, setActiveFeature] = useState<"objectives" | "planner">("objectives");
  const [plannerOwnerUserId, setPlannerOwnerUserId] = useState<number | null>(null);
  const [plannerPreferences, setPlannerPreferences] = useState<ClientPlannerPreference[] | null>(null);
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
        const next = result.some(team => team.id === current) ? current : result[0]?.id ?? null;
        setSelectedTeamId(next);
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
  }, [dataSource, onSessionExpired, t]);

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
      setSelectedTeamId(teams[0].id);
      setTeamId(teams[0].id);
    }
  }, [teamId, teams]);

  useEffect(() => {
    const generation = ++detailGeneration.current;
    selectorGeneration.current += 1;
    setSelectedUsers(new Set()); setDungeonId(null); setSelector(null); setSelectorError(null); setActiveFeature("objectives"); setPlannerOwnerUserId(null);
    setPlannerPreferences(null); setPreferencesOpen(false); setPreferencesError(null);
    if (teamId === null) { setDetail(null); return; }
    const cached = getCachedTeamDetail(teamId);
    setDetail(cached);
    if (cached) hasRevealedTeam.current = true;
    loadTeamDetail(dataSource, teamId).then(result => {
      if (generation !== detailGeneration.current) return;
      setTeamError(null);
      setDetail(result);
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
  const toggleUser = (userId: number) => setSelectedUsers(current => {
    const member = detail?.members.find(item => item.userId === userId);
    const configuredLocally = member?.characters.some(character => plannerPreferences?.some(preference => preference.characterId === character.characterId && preference.playPreference !== "disabled")) ?? false;
    if (activeFeature === "planner" && member?.plannerConfigured === false && !configuredLocally) return current;
    const next = new Set(current);
    if (next.has(userId)) { if (activeFeature !== "planner" || userId !== plannerOwnerUserId) next.delete(userId); }
    else if (activeFeature !== "planner" || next.size < 5) next.add(userId);
    return next;
  });
  const ownMember = detail?.members.find(member => member.username.toLocaleLowerCase() === currentUsername.toLocaleLowerCase())
    ?? detail?.members.find(member => member.characters.some(character => plannerPreferences?.some(preference => preference.characterId === character.characterId)))
    ?? null;
  const plannerReady = plannerPreferences
    ? plannerPreferences.some(preference => preference.playPreference !== "disabled")
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
      const ready = result.preferences.some(preference => preference.playPreference !== "disabled");
      setPlannerPreferences(result.preferences); setOwnPlannerReadiness(ready);
      setPreferencesOpen(blockUntilReady && !ready);
    }).catch(caught => {
      const parsed = errorInfo(caught, language === "es" ? "No se pudo cargar la configuración del Planner." : "Planner configuration could not be loaded.");
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired();
      else { setPreferencesError(parsed.message); setPreferencesOpen(blockUntilReady); }
    }).finally(() => setPreferencesLoading(false));
  }, [dataSource, language, onSessionExpired, ownMember?.userId]);
  const enterPlanner = () => {
    setActiveFeature("planner"); setPlannerOwnerUserId(null);
    setSelectedUsers(current => new Set([...current]
      .filter(userId => plannerDetail?.members.find(member => member.userId === userId)?.plannerConfigured)
      .slice(0, 5)));
    void loadOwnPreferences(true);
  };
  const openPreferences = () => {
    setPreferencesOpen(true);
    if (plannerPreferences === null) void loadOwnPreferences(true);
  };
  const savePreferences = async (preferences: ClientPlannerPreferenceInput[]) => {
    setPreferencesSaving(true); setPreferencesError(null);
    try {
      const result = await dataSource.updatePlannerPreferences(preferences);
      const ready = result.preferences.some(preference => preference.playPreference !== "disabled");
      setPlannerPreferences(result.preferences); setOwnPlannerReadiness(ready);
      if (ready) setPreferencesOpen(false);
    } catch (caught) {
      const parsed = errorInfo(caught, language === "es" ? "No se pudo guardar la configuración." : "The configuration could not be saved.");
      if (parsed.code === "SESSION_EXPIRED") onSessionExpired(); else setPreferencesError(parsed.message);
    } finally { setPreferencesSaving(false); }
  };
  const counts = detail ? teamStoneCounts(detail) : new Map<number, number>();
  const selectedDungeon = MIDNIGHT_SEASON_2_DUNGEONS.find(dungeon => dungeon.id === dungeonId);
  const coldLoading = teams === null
    || Boolean(teams.length > 0 && !hasRevealedTeam.current && (teamId === null || detail?.id !== teamId));
  const detailLoading = !coldLoading && teamId !== null && detail?.id !== teamId;
  const plannerAccessChecking = activeFeature === "planner" && preferencesLoading;

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
        setSelectedTeamId(nextTeamId);
        setTeamId(nextTeamId);
        setDetail(getCachedTeamDetail(nextTeamId));
      }} teams={teams ?? []} />
      <MemberStrip detail={activeFeature === "planner" ? plannerDetail : detail} mode={activeFeature} onClear={() => setSelectedUsers(plannerOwnerUserId === null ? new Set() : new Set([plannerOwnerUserId]))} onToggle={toggleUser} ownerUserId={plannerOwnerUserId} selected={selectedUsers} />
    </div>
    <div className="teams-selector">
      {detailLoading ? <div aria-label={t("teams.loadingTeam")} className="teams-detail-loading" role="status">
        <img alt="" aria-hidden="true" src={brandMark} /><span>{t("teams.loadingTeam")}</span>
      </div> : null}
      <nav aria-label={t("teams.dungeons")} className="teams-dungeon-rail">
        {MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => {
          const count = counts.get(dungeon.id) ?? 0; const selected = dungeonId === dungeon.id;
          return <button aria-label={t("teams.selectDungeon", { name: dungeon.name, count })} aria-pressed={selected} className="teams-dungeon" data-available={count > 0} disabled={!detail} key={dungeon.id} onClick={() => selectDungeon(dungeon.id)} title={dungeon.name} type="button">
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
              <div className="teams-dungeon-context"><strong>{selectedDungeon?.name}</strong>{selector ? <span className="teams-stone-owners">{selector.availability.stoneCount === 0 ? t("teams.noStones") : t(selector.availability.stoneCount === 1 ? "teams.stoneOwner" : "teams.stoneOwners", { count: selector.availability.stoneCount, owners: selector.availability.stones.map(stone => stone.characterName).join(" + ") })}</span> : null}</div>
              {selector ? <>
                <span className="teams-summary-total">{t("teams.globalSummary", { characters: selector.summary.charactersWithObjectives, objectives: selector.summary.totalObjectives })}</span>
                <TierSummary counts={selector.summary.tiers} />
              </> : null}
            </div>
            <button aria-label={t("teams.closeSelector")} className="teams-selector-panel__close" onClick={closeSelector} type="button"><X aria-hidden="true" /></button>
          </header>
          <div className="teams-selector-panel__content" data-feature={activeFeature}>
            {selectorLoading ? <div aria-label={t("teams.loadingObjectives")} className="teams-selector-loading"><i /><i /><i /></div> : null}
            {selectorError ? <p className="error teams-selector-error" role="alert">{selectorError}</p> : null}
            {selector && !selectorLoading && plannerAccessChecking ? <div aria-label={PLANNER_COPY[language].loadingPreferences} className="teams-selector-loading" role="status"><i /><i /><i /></div> : null}
            {selector && !selectorLoading && activeFeature === "planner" && !plannerAccessChecking && dungeonId !== null ? <KeystonePlannerPanel dataSource={dataSource} detail={plannerDetail} dungeonId={dungeonId} onConfigure={openPreferences} onOwnerChange={setPlannerOwnerUserId} onSessionExpired={onSessionExpired} selectedUsers={selectedUsers} selector={selector} setSelectedUsers={setSelectedUsers} teamId={teamId} /> : null}
            {selector && !selectorLoading && activeFeature === "objectives" ? selector.characters.length === 0
              ? <div className="teams-selector-empty"><Gem aria-hidden="true" /><p>{t("teams.noObjectives")}</p>{selector.availability.stoneCount === 0 ? <small>{t("teams.noObjectivesNoStone")}</small> : null}</div>
              : <div className="teams-character-list">{selector.characters.map((character, index) => <SelectorCharacterRow character={character} key={character.characterId} muted={selectedUsers.size > 0 && !selectedUsers.has(character.userId)} rank={index + 1} />)}</div>
              : null}
          </div>
        </>}
      </section>
    </div>
    {preferencesOpen ? <PlannerPreferencesModal characters={ownMember?.characters ?? []} error={preferencesError} initial={plannerPreferences ?? []} loading={preferencesLoading} onExit={() => {
      setPreferencesOpen(false); setPreferencesError(null); if (plannerPreferences === null || !plannerReady) setActiveFeature("objectives");
    }} onSave={savePreferences} saving={preferencesSaving} /> : null}
  </section>;
}
