import { Check, ChevronDown, GripVertical, Heart, Settings2, TriangleAlert, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { classColor } from "../core/characterDisplay";
import { useI18n } from "../core/i18n";
import type {
  ClientPlannerPreferenceUpdate, ClientPlannerPreferences, ClientTeamCharacter, KeystonePlannerPreferenceState,
} from "../core/types";
import { specializationsForClass, wowLootBagIconUrl, wowSpecializationIconUrl, type ClientWowSpecialization } from "../core/wowSpecs";
import { useThemeAsset } from "../theme/useThemeAsset";
import { WowRoleIcon } from "./WowRoleIcon";

type PlannerPreferencesModalProps = {
  characters: ClientTeamCharacter[];
  error: string | null;
  initial: ClientPlannerPreferences;
  loading: boolean;
  onExit: () => void;
  onSave: (update: ClientPlannerPreferenceUpdate) => Promise<void>;
  saving: boolean;
};

type DraftRow = {
  character: ClientTeamCharacter;
  spec: ClientWowSpecialization;
  playPreference: KeystonePlannerPreferenceState | null;
};

type LootDraft = { characterId: number; primaryLootSpecId: number | null; secondaryLootSpecIds: number[] };
type GuideStep = "loot" | "availability" | "done";

const STATES: readonly KeystonePlannerPreferenceState[] = ["preferred", "available", "emergency", "disabled"];

function CharacterAvatar({ character }: { character: ClientTeamCharacter }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [character.avatarUrl]);
  return <span className="planner-preference-character__avatar">
    {character.avatarUrl && !failed ? <img alt="" onError={() => setFailed(true)} src={character.avatarUrl} /> : character.name.slice(0, 1)}
  </span>;
}

function StateIcon({ state }: { state: KeystonePlannerPreferenceState }) {
  if (state === "preferred") return <Heart aria-hidden="true" fill="currentColor" />;
  if (state === "available") return <Check aria-hidden="true" />;
  if (state === "emergency") return <TriangleAlert aria-hidden="true" />;
  return <X aria-hidden="true" />;
}

function SpecIcon({ spec }: { spec: ClientWowSpecialization }) {
  const icon = wowSpecializationIconUrl(spec.id);
  return icon ? <img alt="" aria-hidden="true" src={icon} /> : <span aria-hidden="true">?</span>;
}

function GuideCallout({ anchorKey, children, target }: {
  anchorKey: number | string | null;
  children: ReactNode;
  target: RefObject<HTMLButtonElement | null>;
}) {
  const callout = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, visible: false });
  useLayoutEffect(() => {
    const update = () => {
      const anchor = target.current;
      const panel = callout.current;
      if (!anchor || !panel) {
        setPosition(current => current.visible ? { ...current, visible: false } : current);
        return;
      }
      const targetBounds = anchor.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      const margin = 12;
      const gap = 12;
      const left = Math.min(
        window.innerWidth - panelBounds.width - margin,
        Math.max(margin, targetBounds.left + targetBounds.width / 2 - panelBounds.width / 2),
      );
      const below = targetBounds.bottom + gap;
      const top = below + panelBounds.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, targetBounds.top - panelBounds.height - gap);
      setPosition(current => current.left === left && current.top === top && current.visible
        ? current : { left, top, visible: true });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorKey, target]);
  return createPortal(<aside
    className="planner-config-guide"
    ref={callout}
    role="status"
    style={{ left: position.left, top: position.top, visibility: position.visible ? "visible" : "hidden" }}
  >{children}</aside>, document.body);
}

export function PlannerPreferencesModal({ characters, error, initial, loading, onExit, onSave, saving }: PlannerPreferencesModalProps) {
  const { language } = useI18n();
  const appIcon = useThemeAsset("brand-mark");
  const es = language === "es";
  const initialByKey = useMemo(() => new Map(initial.preferences.map(item => [`${item.characterId}:${item.specId}`, item])), [initial.preferences]);
  const allRows = useMemo<DraftRow[]>(() => characters.flatMap(character => specializationsForClass(character.wowClass).map(spec => ({
    character,
    spec,
    playPreference: initialByKey.get(`${character.characterId}:${spec.id}`)?.playPreference ?? null,
  }))), [characters, initialByKey]);
  const initialLoot = useMemo<LootDraft[]>(() => characters.map(character => {
    const stored = initial.lootPreferences.find(item => item.characterId === character.characterId);
    return {
      characterId: character.characterId,
      primaryLootSpecId: stored?.primaryLootSpecId ?? null,
      secondaryLootSpecIds: stored ? [...stored.secondaryLootSpecIds] : [],
    };
  }), [characters, initial.lootPreferences]);
  const [draft, setDraft] = useState(allRows);
  const [lootDraft, setLootDraft] = useState(initialLoot);
  const [activeCharacterIds, setActiveCharacterIds] = useState(() => new Set(allRows
    .filter(row => row.playPreference !== null && row.playPreference !== "disabled")
    .map(row => row.character.characterId)));
  const [draggingCharacterId, setDraggingCharacterId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<"active" | "inactive" | null>(null);
  const [availabilityKey, setAvailabilityKey] = useState<string | null>(null);
  const [lootCharacterId, setLootCharacterId] = useState<number | null>(null);
  const [lootError, setLootError] = useState<string | null>(null);
  const [guideStep, setGuideStep] = useState<GuideStep>(initial.onboardingCompleted ? "done" : "loot");
  const lootGuideTarget = useRef<HTMLButtonElement>(null);
  const availabilityGuideTarget = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(allRows);
    setLootDraft(initialLoot);
    setActiveCharacterIds(new Set(allRows
      .filter(row => row.playPreference !== null && row.playPreference !== "disabled")
      .map(row => row.character.characterId)));
    setDraggingCharacterId(null);
    setDropTarget(null);
    setAvailabilityKey(null);
    setLootCharacterId(null);
    setLootError(null);
    setGuideStep(initial.onboardingCompleted ? "done" : "loot");
  }, [allRows, initial.onboardingCompleted, initialLoot]);

  const activeCharacters = characters.filter(character => activeCharacterIds.has(character.characterId));
  const inactiveCharacters = characters.filter(character => !activeCharacterIds.has(character.characterId));
  const enabled = activeCharacters.length > 0 && activeCharacters.every(character => (
    draft.some(row => row.character.characterId === character.characterId && row.playPreference !== null && row.playPreference !== "disabled")
    && lootDraft.some(loot => loot.characterId === character.characterId && loot.primaryLootSpecId !== null)
  ));
  const stateLabel: Record<KeystonePlannerPreferenceState, string> = es
    ? { preferred: "Preferida", available: "Disponible", emergency: "Emergencia", disabled: "Desactivada" }
    : { preferred: "Preferred", available: "Available", emergency: "Emergency", disabled: "Disabled" };
  const stateDescription: Record<KeystonePlannerPreferenceState, string> = es
    ? { preferred: "Quiero jugarla siempre que sea posible", available: "Puedo jugarla con normalidad", emergency: "Solo si hace falta cubrir el rol", disabled: "No quiero jugarla" }
    : { preferred: "Use whenever possible", available: "I can play it normally", emergency: "Only when its role is needed", disabled: "Do not use this spec" };

  const moveCharacter = (characterId: number, active: boolean) => {
    setActiveCharacterIds(current => {
      const next = new Set(current);
      if (active) next.add(characterId); else next.delete(characterId);
      return next;
    });
    if (!active) {
      setDraft(current => current.map(row => row.character.characterId === characterId ? { ...row, playPreference: "disabled" } : row));
      setAvailabilityKey(current => current?.startsWith(`${characterId}:`) ? null : current);
    }
  };
  const dropCharacter = (event: DragEvent<HTMLElement>, active: boolean) => {
    event.preventDefault();
    const characterId = Number(event.dataTransfer.getData("text/plain")) || draggingCharacterId;
    if (characterId !== null && characters.some(character => character.characterId === characterId)) moveCharacter(characterId, active);
    setDraggingCharacterId(null);
    setDropTarget(null);
  };
  const openAvailability = (key: string) => {
    setAvailabilityKey(key);
    if (guideStep === "availability") setGuideStep("done");
  };
  const openLoot = (characterId: number) => {
    setLootCharacterId(characterId);
    setLootError(null);
    if (guideStep === "loot") setGuideStep("availability");
  };
  const setLootPriority = (characterId: number, specId: number, priority: "primary" | "secondary" | "none") => {
    const selected = lootDraft.find(loot => loot.characterId === characterId);
    if (priority === "primary" && selected?.primaryLootSpecId !== null
      && selected?.primaryLootSpecId !== specId) {
      setLootError(es
        ? "Ya hay una especialización primaria. Desmárcala antes de elegir otra."
        : "A primary specialization is already selected. Clear it before choosing another.");
      return;
    }
    setLootDraft(current => current.map(loot => {
      if (loot.characterId !== characterId) return loot;
      if (priority === "primary") return loot.primaryLootSpecId === specId
        ? { ...loot, primaryLootSpecId: null }
        : { ...loot, primaryLootSpecId: specId, secondaryLootSpecIds: loot.secondaryLootSpecIds.filter(id => id !== specId) };
      if (priority === "none") return {
        ...loot,
        primaryLootSpecId: loot.primaryLootSpecId === specId ? null : loot.primaryLootSpecId,
        secondaryLootSpecIds: loot.secondaryLootSpecIds.filter(id => id !== specId),
      };
      if (loot.primaryLootSpecId === specId) return loot;
      const secondary = loot.secondaryLootSpecIds.includes(specId);
      return {
        ...loot,
        secondaryLootSpecIds: secondary
          ? loot.secondaryLootSpecIds.filter(id => id !== specId)
          : [...loot.secondaryLootSpecIds, specId].sort((left, right) => left - right),
      };
    }));
  };

  const guideCharacterId = characters[0]?.characterId ?? null;
  const guideAvailabilityKey = activeCharacters[0]
    ? `${activeCharacters[0].characterId}:${specializationsForClass(activeCharacters[0].wowClass)[0]?.id ?? 0}`
    : null;
  const openAvailabilityRow = availabilityKey === null ? null : draft.find(row => `${row.character.characterId}:${row.spec.id}` === availabilityKey) ?? null;
  const openLootCharacter = characters.find(character => character.characterId === lootCharacterId) ?? null;
  const openLootDraft = lootDraft.find(loot => loot.characterId === lootCharacterId) ?? null;

  const renderCharacter = (character: ClientTeamCharacter, active: boolean) => {
    const rows = draft.filter(row => row.character.characterId === character.characterId);
    const ready = rows.some(row => row.playPreference !== null && row.playPreference !== "disabled");
    const loot = lootDraft.find(item => item.characterId === character.characterId);
    const primarySpec = rows.find(row => row.spec.id === loot?.primaryLootSpecId)?.spec ?? null;
    const lootIcon = primarySpec ? wowSpecializationIconUrl(primarySpec.id) : null;
    return <section
      className={`planner-preference-character${active ? "" : " is-inactive"}${draggingCharacterId === character.characterId ? " is-dragging" : ""}`}
      data-ready={ready && loot?.primaryLootSpecId !== null}
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
        <div><strong>{character.name}</strong><small>{active ? `${character.wowClass} · ${character.realm}` : (es ? "Inactivo · todo desactivado" : "Inactive · everything disabled")}</small>
          {active && (!ready || loot?.primaryLootSpecId === null) ? <em>{es ? "Configura juego y botín" : "Configure play and loot"}</em> : null}</div>
        <button
          aria-label={`${es ? "Configurar botín de" : "Configure loot for"} ${character.name}`}
          className="planner-preference-character__loot"
          data-guide-target={guideStep === "loot" && character.characterId === guideCharacterId}
          disabled={loading || saving}
          onClick={event => { event.stopPropagation(); openLoot(character.characterId); }}
          onDragStart={event => event.preventDefault()}
          ref={guideStep === "loot" && character.characterId === guideCharacterId ? lootGuideTarget : undefined}
          title={primarySpec ? `${es ? "Botín primario" : "Primary loot"}: ${primarySpec.name}` : (es ? "Configurar botín" : "Configure loot")}
          type="button"
        ><img alt="" aria-hidden="true" data-placeholder={lootIcon === null} src={lootIcon ?? wowLootBagIconUrl()} /></button>
      </div>
      <div className="planner-preference-character__specs" data-spec-count={rows.length}>{rows.map(row => {
        const key = `${character.characterId}:${row.spec.id}`;
        const selected = row.playPreference;
        return <article className="planner-preference-spec" data-state={selected ?? "unset"} key={row.spec.id}>
          <button
            aria-expanded={availabilityKey === key}
            aria-label={`${row.spec.name} · ${selected ? stateLabel[selected] : (es ? "Selecciona tu preferencia" : "Select your preference")}`}
            className="planner-preference-spec__toggle"
            data-guide-target={guideStep === "availability" && key === guideAvailabilityKey}
            disabled={!active}
            onClick={() => openAvailability(key)}
            ref={guideStep === "availability" && key === guideAvailabilityKey ? availabilityGuideTarget : undefined}
            type="button"
          >
            <span className="planner-role-frame"><WowRoleIcon role={row.spec.role} /></span>
            <span><strong>{row.spec.name}</strong><small>{selected ? stateLabel[selected] : (es ? "Selecciona tu preferencia" : "Select your preference")}</small></span>
            {selected ? <span className="planner-preference-spec__state" data-state={selected}><StateIcon state={selected} /></span> : null}
            <ChevronDown aria-hidden="true" />
          </button>
        </article>;
      })}</div>
    </section>;
  };

  const submit = () => onSave({
    preferences: draft.map(row => ({
      characterId: row.character.characterId,
      specId: row.spec.id,
      playPreference: row.playPreference ?? "disabled",
    })),
    lootPreferences: lootDraft.flatMap(loot => loot.primaryLootSpecId === null ? [] : [{
      characterId: loot.characterId,
      primaryLootSpecId: loot.primaryLootSpecId,
      secondaryLootSpecIds: [...loot.secondaryLootSpecIds],
    }]),
    onboardingCompleted: initial.onboardingCompleted || guideStep === "done",
  });

  return <div aria-labelledby="planner-preferences-title" aria-modal="true" className="planner-preferences-modal" role="dialog">
    <div className="planner-preferences-modal__panel">
      <header>
        <span className="planner-preferences-modal__emblem"><img alt="KeystoneSync" src={appIcon} /></span>
        <div><small>Keystone Planner</small><h2 id="planner-preferences-title">{es ? "Configura tus personajes" : "Configure your characters"}</h2>
          <p>{es ? "Separa qué quieres jugar del botín que te interesa. El Planner hará el resto." : "Configure what you want to play separately from the loot you want. The Planner does the rest."}</p></div>
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
        <span><Settings2 aria-hidden="true" />{es ? "Cada personaje activo necesita una spec jugable y una spec primaria de botín." : "Every active character needs one playable spec and one primary loot spec."}</span>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button disabled={!enabled || saving || loading} onClick={() => void submit()} type="button">{loading ? (es ? "Cargando…" : "Loading…") : saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar y planificar" : "Save and plan")}</button>
      </footer>
    </div>

    {openAvailabilityRow ? <div className="planner-preference-popover-backdrop" onClick={() => setAvailabilityKey(null)}>
      <section aria-label={`${openAvailabilityRow.character.name} · ${openAvailabilityRow.spec.name}`} className="planner-availability-popover" onClick={event => event.stopPropagation()}>
        <header><span className="planner-spec-icon"><SpecIcon spec={openAvailabilityRow.spec} /></span><div><small>{openAvailabilityRow.character.name}</small><strong>{openAvailabilityRow.spec.name}</strong></div><button aria-label={es ? "Cerrar" : "Close"} onClick={() => setAvailabilityKey(null)} type="button"><X /></button></header>
        <div role="listbox">{STATES.map(state => <button aria-selected={openAvailabilityRow.playPreference === state} data-state={state} key={state} onClick={() => {
          setDraft(current => current.map(row => row.character.characterId === openAvailabilityRow.character.characterId && row.spec.id === openAvailabilityRow.spec.id ? { ...row, playPreference: state } : row));
          setAvailabilityKey(null);
        }} role="option" type="button"><span><StateIcon state={state} /></span><span><strong>{stateLabel[state]}</strong><small>{stateDescription[state]}</small></span>{openAvailabilityRow.playPreference === state ? <Check aria-hidden="true" /> : null}</button>)}</div>
      </section>
    </div> : null}

    {openLootCharacter && openLootDraft ? <div className="planner-preference-popover-backdrop" onClick={() => { setLootCharacterId(null); setLootError(null); }}>
      <section aria-label={`${es ? "Botín" : "Loot"} · ${openLootCharacter.name}`} className="planner-loot-config-popover" onClick={event => event.stopPropagation()}>
        <header><div><small>{es ? "Preferencias de botín" : "Loot preferences"}</small><strong>{openLootCharacter.name}</strong></div><button aria-label={es ? "Cerrar" : "Close"} onClick={() => { setLootCharacterId(null); setLootError(null); }} type="button"><X /></button></header>
        <div className="planner-loot-matrix" role="table">
          <div className="planner-loot-matrix__header" role="row"><span role="columnheader">{es ? "Especialización" : "Specialization"}</span><span role="columnheader">{es ? "Primaria" : "Primary"}</span><span role="columnheader">{es ? "Secundaria" : "Secondary"}</span><span role="columnheader">{es ? "Sin interés" : "No interest"}</span></div>
          {specializationsForClass(openLootCharacter.wowClass).map(spec => {
            const priority = openLootDraft.primaryLootSpecId === spec.id ? "primary" : openLootDraft.secondaryLootSpecIds.includes(spec.id) ? "secondary" : "none";
            return <div className="planner-loot-matrix__row" key={spec.id} role="row"><span role="cell"><span className="planner-spec-icon"><SpecIcon spec={spec} /></span><strong>{spec.name}</strong></span>{(["primary", "secondary", "none"] as const).map(option => <span key={option} role="cell"><button aria-label={`${spec.name} · ${option}`} aria-pressed={priority === option} onClick={() => setLootPriority(openLootCharacter.characterId, spec.id, option)} type="button"><i /></button></span>)}</div>;
          })}
        </div>
        <p>{es ? "Para cambiar la primaria, desmarca primero la actual. Cada spec sólo puede pertenecer a una columna." : "To change the primary, clear the current one first. Each spec can belong to only one column."}</p>
        <button className="planner-loot-config-popover__done" disabled={openLootDraft.primaryLootSpecId === null} onClick={() => setLootCharacterId(null)} type="button">{es ? "Listo" : "Done"}</button>
      </section>
    </div> : null}
    {lootError ? <div className="planner-loot-error-backdrop">
      <section aria-labelledby="planner-loot-error-title" aria-modal="true" className="planner-loot-error" role="alertdialog">
        <TriangleAlert aria-hidden="true" />
        <div><strong id="planner-loot-error-title">{es ? "Sólo puede haber una especialización primaria" : "Only one primary specialization is allowed"}</strong><p>{lootError}</p></div>
        <button onClick={() => setLootError(null)} type="button">{es ? "Entendido" : "Got it"}</button>
      </section>
    </div> : null}
    {guideStep === "loot" && guideCharacterId !== null ? <GuideCallout anchorKey={guideCharacterId} target={lootGuideTarget}>
      <strong>{es ? "1. Configura el botín" : "1. Configure loot"}</strong>
      <p>{es ? "Configura la especialización primaria de botín y las secundarias de cada personaje." : "Configure every character's primary and secondary loot specializations."}</p>
    </GuideCallout> : null}
    {guideStep === "availability" && guideAvailabilityKey !== null && lootCharacterId === null ? <GuideCallout anchorKey={guideAvailabilityKey} target={availabilityGuideTarget}>
      <strong>{es ? "2. Indica qué quieres jugar" : "2. Choose what you want to play"}</strong>
      <p>{es ? "Configura la preferencia de cada especialización: preferida, disponible, emergencia o desactivada." : "Set each played spec to preferred, available, emergency or disabled."}</p>
    </GuideCallout> : null}
  </div>;
}
