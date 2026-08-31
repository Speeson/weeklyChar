import { Check, ChevronDown, Gem, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeamItemTooltip } from "../components/TeamItemTooltip";
import { classColor } from "../core/characterDisplay";
import { useI18n } from "../core/i18n";
import { MIDNIGHT_SEASON_2_DUNGEONS } from "../core/season2";
import {
  groupSelectorObjectives, liveTeamsDataSource, selectorObjectivesForSpec, teamStoneCounts,
  type SelectorObjectiveGroup, type TeamsDataSource,
} from "../core/teams";
import {
  getCachedSelector, getCachedTeamDetail, getTeamsSessionSnapshot, loadSelector, loadTeamDetail,
  loadTeams, removeTeamFromSessionCache, setSelectedTeamId,
} from "../core/teamsSessionCache";
import { specName } from "../core/wowSpecs";
import { useThemeAsset } from "../theme/useThemeAsset";
import type {
  ClientTeamDetail, ClientTeamSummary, CoreError, KeystoneSelectorCharacter, KeystoneSelectorResponse,
  KeystoneSelectorTierCounts,
} from "../core/types";

type TeamsPageProps = { dataSource?: TeamsDataSource; onOpenWeb: () => void; onSessionExpired: () => void };

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

function MemberStrip({ detail, onClear, onToggle, selected }: { detail: ClientTeamDetail | null; onClear: () => void; onToggle: (userId: number) => void; selected: Set<number> }) {
  const { t } = useI18n();
  return <div className="teams-member-area">
    <div aria-label={t("teams.memberFilters")} className="teams-member-strip">
      {detail?.members.map(member => <button aria-label={t(member.characters.length === 1 ? "teams.memberFilterOne" : "teams.memberFilter", { name: member.username, count: member.characters.length })} aria-pressed={selected.has(member.userId)} className="teams-member-filter" key={member.userId} onClick={() => onToggle(member.userId)} type="button">
        <span className="teams-member-filter__avatars">{member.characters.slice(0, 3).map(character => <Portrait avatarUrl={character.avatarUrl} key={character.characterId} name={character.name} wowClass={character.wowClass} />)}</span>
        <span><strong>{member.username}</strong><small>{t(member.characters.length === 1 ? "teams.characterCountOne" : "teams.characterCount", { count: member.characters.length })}</small></span>
        <Check aria-hidden="true" className="teams-member-filter__check" />
      </button>)}
    </div>
    {selected.size > 0 ? <div className="teams-active-filters">
      <span>{t(selected.size === 1 ? "teams.selectedMember" : "teams.selectedMembers", { count: selected.size })}</span>
      <button aria-label={t("teams.clearFilters")} className="teams-clear-filters" onClick={onClear} type="button"><X aria-hidden="true" />{t("teams.clearShort")}</button>
    </div> : null}
  </div>;
}

export function TeamsPage({ dataSource = liveTeamsDataSource, onOpenWeb, onSessionExpired }: TeamsPageProps) {
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
    setSelectedUsers(new Set()); setDungeonId(null); setSelector(null); setSelectorError(null);
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
    setDungeonId(nextDungeonId); setSelector(cached); setSelectorError(null); setSelectorLoading(cached === null);
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

  const closeSelector = () => { selectorGeneration.current += 1; setDungeonId(null); setSelector(null); setSelectorError(null); setSelectorLoading(false); };
  const toggleUser = (userId: number) => setSelectedUsers(current => {
    const next = new Set(current); if (next.has(userId)) next.delete(userId); else next.add(userId); return next;
  });
  const counts = detail ? teamStoneCounts(detail) : new Map<number, number>();
  const selectedDungeon = MIDNIGHT_SEASON_2_DUNGEONS.find(dungeon => dungeon.id === dungeonId);
  const coldLoading = teams === null
    || Boolean(teams.length > 0 && !hasRevealedTeam.current && (teamId === null || detail?.id !== teamId));
  const detailLoading = !coldLoading && teamId !== null && detail?.id !== teamId;

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
      <MemberStrip detail={detail} onClear={() => setSelectedUsers(new Set())} onToggle={toggleUser} selected={selectedUsers} />
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
            <div className="teams-feature-tabs"><span>{t("teams.objectives")}</span><button disabled type="button">{t("teams.planStone")} <small>{t("teams.comingSoon")}</small></button></div>
            <div className="teams-dungeon-summary">
              <div className="teams-dungeon-context"><strong>{selectedDungeon?.name}</strong>{selector ? <span className="teams-stone-owners">{selector.availability.stoneCount === 0 ? t("teams.noStones") : t(selector.availability.stoneCount === 1 ? "teams.stoneOwner" : "teams.stoneOwners", { count: selector.availability.stoneCount, owners: selector.availability.stones.map(stone => stone.characterName).join(" + ") })}</span> : null}</div>
              {selector ? <>
                <span className="teams-summary-total">{t("teams.globalSummary", { characters: selector.summary.charactersWithObjectives, objectives: selector.summary.totalObjectives })}</span>
                <TierSummary counts={selector.summary.tiers} />
              </> : null}
            </div>
            <button aria-label={t("teams.closeSelector")} className="teams-selector-panel__close" onClick={closeSelector} type="button"><X aria-hidden="true" /></button>
          </header>
          <div className="teams-selector-panel__content">
            {selectorLoading ? <div aria-label={t("teams.loadingObjectives")} className="teams-selector-loading"><i /><i /><i /></div> : null}
            {selectorError ? <p className="error teams-selector-error" role="alert">{selectorError}</p> : null}
            {selector && !selectorLoading ? selector.characters.length === 0
              ? <div className="teams-selector-empty"><Gem aria-hidden="true" /><p>{t("teams.noObjectives")}</p>{selector.availability.stoneCount === 0 ? <small>{t("teams.noObjectivesNoStone")}</small> : null}</div>
              : <div className="teams-character-list">{selector.characters.map((character, index) => <SelectorCharacterRow character={character} key={character.characterId} muted={selectedUsers.size > 0 && !selectedUsers.has(character.userId)} rank={index + 1} />)}</div>
              : null}
          </div>
        </>}
      </section>
    </div>
  </section>;
}
