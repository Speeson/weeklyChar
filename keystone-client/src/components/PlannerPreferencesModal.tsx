import { ChevronDown, GripVertical, Power, PowerOff, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { classColor } from "../core/characterDisplay";
import { useI18n } from "../core/i18n";
import type {
  ClientPlannerPreference, ClientPlannerPreferenceInput, ClientTeamCharacter, KeystonePlannerPreferenceState,
} from "../core/types";
import { specializationsForClass } from "../core/wowSpecs";
import { useThemeAsset } from "../theme/useThemeAsset";
import { WowRoleIcon } from "./WowRoleIcon";

type PlannerPreferencesModalProps = {
  characters: ClientTeamCharacter[];
  error: string | null;
  initial: ClientPlannerPreference[];
  loading: boolean;
  onExit: () => void;
  onSave: (preferences: ClientPlannerPreferenceInput[]) => Promise<void>;
  saving: boolean;
};

const STATES: readonly KeystonePlannerPreferenceState[] = ["preferred", "available", "emergency", "disabled"];

function CharacterAvatar({ character }: { character: ClientTeamCharacter }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [character.avatarUrl]);
  return <span className="planner-preference-character__avatar">
    {character.avatarUrl && !failed ? <img alt="" onError={() => setFailed(true)} src={character.avatarUrl} /> : character.name.slice(0, 1)}
  </span>;
}

export function PlannerPreferencesModal({ characters, error, initial, loading, onExit, onSave, saving }: PlannerPreferencesModalProps) {
  const { language } = useI18n();
  const appIcon = useThemeAsset("brand-mark");
  const es = language === "es";
  const initialByKey = useMemo(() => new Map(initial.map(item => [`${item.characterId}:${item.specId}`, item])), [initial]);
  const allRows = useMemo(() => characters.flatMap(character => specializationsForClass(character.wowClass).map(spec => {
    const stored = initialByKey.get(`${character.characterId}:${spec.id}`);
    return { character, spec, playPreference: stored?.playPreference ?? "disabled" as KeystonePlannerPreferenceState, lootSpecId: stored?.lootSpecId ?? spec.id };
  })), [characters, initialByKey]);
  const [draft, setDraft] = useState(() => allRows);
  const [activeCharacterIds, setActiveCharacterIds] = useState(() => new Set(allRows.filter(row => row.playPreference !== "disabled").map(row => row.character.characterId)));
  const [draggingCharacterId, setDraggingCharacterId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<"active" | "inactive" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    setDraft(allRows);
    setActiveCharacterIds(new Set(allRows.filter(row => row.playPreference !== "disabled").map(row => row.character.characterId)));
    setDraggingCharacterId(null); setDropTarget(null); setExpanded(null);
  }, [allRows]);
  const activeCharacters = characters.filter(character => activeCharacterIds.has(character.characterId));
  const inactiveCharacters = characters.filter(character => !activeCharacterIds.has(character.characterId));
  const enabled = activeCharacters.length > 0 && activeCharacters.every(character => draft.some(row => row.character.characterId === character.characterId && row.playPreference !== "disabled"));
  const stateLabel: Record<KeystonePlannerPreferenceState, string> = es
    ? { preferred: "Preferido", available: "Disponible", emergency: "Emergencia", disabled: "Desactivado" }
    : { preferred: "Preferred", available: "Available", emergency: "Emergency", disabled: "Disabled" };

  const update = (characterId: number, specId: number, patch: Partial<Pick<ClientPlannerPreferenceInput, "playPreference" | "lootSpecId">>) => {
    setDraft(current => current.map(row => row.character.characterId === characterId && row.spec.id === specId ? { ...row, ...patch } : row));
  };
  const moveCharacter = (characterId: number, active: boolean) => {
    setActiveCharacterIds(current => {
      const next = new Set(current);
      if (active) next.add(characterId); else next.delete(characterId);
      return next;
    });
    if (!active) {
      setDraft(current => current.map(row => row.character.characterId === characterId ? { ...row, playPreference: "disabled" as const } : row));
      setExpanded(current => current?.startsWith(`${characterId}:`) ? null : current);
    }
  };
  const dropCharacter = (event: DragEvent<HTMLElement>, active: boolean) => {
    event.preventDefault();
    const characterId = Number(event.dataTransfer.getData("text/plain")) || draggingCharacterId;
    if (characterId !== null && characters.some(character => character.characterId === characterId)) moveCharacter(characterId, active);
    setDraggingCharacterId(null); setDropTarget(null);
  };
  const renderCharacter = (character: ClientTeamCharacter, active: boolean) => {
    const rows = draft.filter(row => row.character.characterId === character.characterId);
    const ready = rows.some(row => row.playPreference !== "disabled");
    return <section
      className={`planner-preference-character${active ? "" : " is-inactive"}${draggingCharacterId === character.characterId ? " is-dragging" : ""}`}
      data-ready={ready}
      draggable={!loading && !saving}
      key={character.characterId}
      onDragEnd={() => { setDraggingCharacterId(null); setDropTarget(null); }}
      onDragStart={event => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(character.characterId));
        setDraggingCharacterId(character.characterId);
      }}
      style={{ "--planner-class-color": classColor(character.wowClass) } as React.CSSProperties}
    >
      <div className="planner-preference-character__identity">
        <GripVertical aria-hidden="true" className="planner-preference-character__drag" />
        <CharacterAvatar character={character} />
        <div><strong>{character.name}</strong><small>{active ? `${character.wowClass} · ${character.realm}` : (es ? "Inactivo · todo desactivado" : "Inactive · everything disabled")}</small>{active && !ready ? <em>{es ? "Configura al menos una spec" : "Configure at least one spec"}</em> : null}</div>
        <button aria-label={active ? (es ? `Desactivar ${character.name}` : `Deactivate ${character.name}`) : (es ? `Activar ${character.name}` : `Activate ${character.name}`)} className="planner-preference-character__move" disabled={loading || saving} onClick={() => moveCharacter(character.characterId, !active)} title={active ? (es ? "Mover a inactivos" : "Move to inactive") : (es ? "Mover a activos" : "Move to active")} type="button">{active ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}</button>
      </div>
      <div className="planner-preference-character__specs" data-spec-count={rows.length}>{rows.map(row => {
        const key = `${character.characterId}:${row.spec.id}`;
        const isExpanded = active && expanded === key;
        return <article className="planner-preference-spec" data-state={row.playPreference} data-expanded={isExpanded} key={row.spec.id}>
          <button aria-expanded={isExpanded} aria-label={`${row.spec.name} · ${stateLabel[row.playPreference]}`} className="planner-preference-spec__toggle" disabled={!active} onClick={() => setExpanded(current => current === key ? null : key)} type="button">
            <span className="planner-role-frame"><WowRoleIcon role={row.spec.role} /></span><span><strong>{row.spec.name}</strong><small>{stateLabel[row.playPreference]}</small></span><ChevronDown aria-hidden="true" />
          </button>
          {isExpanded ? <div className="planner-preference-spec__settings">
            <strong className="planner-preference-spec__settings-title">{character.name} · {row.spec.name}</strong>
            <label><span>{es ? "Disponibilidad" : "Availability"}</span><select aria-label={`${character.name} ${row.spec.name}`} disabled={loading} onChange={event => update(character.characterId, row.spec.id, { playPreference: event.currentTarget.value as KeystonePlannerPreferenceState })} value={row.playPreference}>{STATES.map(state => <option key={state} value={state}>{stateLabel[state]}</option>)}</select></label>
            <label><span>{es ? "Botín" : "Loot"}</span><select aria-label={`${es ? "Botín" : "Loot"} ${character.name} ${row.spec.name}`} disabled={loading} onChange={event => update(character.characterId, row.spec.id, { lootSpecId: Number(event.currentTarget.value) })} value={row.lootSpecId}>{specializationsForClass(character.wowClass).map(spec => <option key={spec.id} value={spec.id}>{spec.name}</option>)}</select></label>
          </div> : null}
        </article>;
      })}</div>
    </section>;
  };
  const submit = () => onSave(draft.map(row => ({
    characterId: row.character.characterId, specId: row.spec.id,
    playPreference: row.playPreference, lootSpecId: row.lootSpecId,
  })));

  return <div aria-labelledby="planner-preferences-title" aria-modal="true" className="planner-preferences-modal" role="dialog">
    <div className="planner-preferences-modal__panel">
      <header>
        <span className="planner-preferences-modal__emblem"><img alt="KeystoneSync" src={appIcon} /></span>
        <div><small>Keystone Planner</small><h2 id="planner-preferences-title">{es ? "Configura tus personajes" : "Configure your characters"}</h2>
          <p>{es ? "Indica qué especializaciones puedes jugar. El Planner hará el resto automáticamente." : "Choose the specializations you can play. The Planner will calculate the rest automatically."}</p></div>
        <button aria-label={es ? "Salir del Planner" : "Exit Planner"} onClick={onExit} type="button"><X aria-hidden="true" /></button>
      </header>
      <div className="planner-preferences-modal__body">
        {characters.length === 0 ? <p className="planner-preferences-modal__empty">{es ? "No tienes personajes sincronizados en este equipo." : "You have no synced characters in this Team."}</p> : <>
          <section className="planner-preference-zone" data-drop-active={dropTarget === "active"} data-zone="active" onDragEnter={() => setDropTarget("active")} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={event => dropCharacter(event, true)}>
            <header><div><strong>{es ? "Personajes activos" : "Active characters"}</strong><small>{es ? "El Planner podrá seleccionarlos" : "The Planner can select them"}</small></div><b>{activeCharacters.length}</b></header>
            <div className="planner-preference-zone__list">{activeCharacters.length ? activeCharacters.map(character => renderCharacter(character, true)) : <p>{es ? "Arrastra aquí los personajes que quieras utilizar." : "Drag here the characters you want to use."}</p>}</div>
          </section>
          <section className="planner-preference-zone planner-preference-zone--inactive" data-drop-active={dropTarget === "inactive"} data-zone="inactive" onDragEnter={() => setDropTarget("inactive")} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={event => dropCharacter(event, false)}>
            <header><div><strong>{es ? "Personajes inactivos" : "Inactive characters"}</strong><small>{es ? "Todas sus especializaciones están desactivadas" : "All their specializations are disabled"}</small></div><b>{inactiveCharacters.length}</b></header>
            <div className="planner-preference-zone__list">{inactiveCharacters.length ? inactiveCharacters.map(character => renderCharacter(character, false)) : <p>{es ? "No hay personajes inactivos." : "There are no inactive characters."}</p>}</div>
          </section>
        </>}
      </div>
      <footer>
        <span><Settings2 aria-hidden="true" />{es ? "Cada personaje activo necesita al menos una especialización configurada." : "Every active character needs at least one configured specialization."}</span>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button disabled={!enabled || saving || loading} onClick={() => void submit()} type="button">{loading ? (es ? "Cargando…" : "Loading…") : saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar y planificar" : "Save and plan")}</button>
      </footer>
    </div>
  </div>;
}
