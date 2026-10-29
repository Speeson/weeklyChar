import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { CHARACTER_CURRENCIES, type CharacterCurrencyKey } from "../core/characterSnapshots";
import { addCurrency, defaultCurrencyLayout, moveCurrency, removeCurrency, type CurrencyLayout } from "../core/currencyLayout";
import type { CharacterCurrency } from "../core/types";
import { blizzardIconUrl, catalogIconUrl } from "../core/wowhead";

const DRAG_TYPE = "application/x-keystonesync-currency";
type Source = { kind: "list"; key: CharacterCurrencyKey } | { kind: "slot"; slot: number };

function currencyLabel(key: CharacterCurrencyKey, language: "es" | "en") {
  const meta = CHARACTER_CURRENCIES.find(value => value.key === key)!;
  return language === "es" ? meta.labelEs : meta.label;
}

function CurrencyEditorIcon({ currencyKey, info, region }: { currencyKey: CharacterCurrencyKey; info?: CharacterCurrency; region: string }) {
  const meta = CHARACTER_CURRENCIES.find(value => value.key === currencyKey)!;
  const url = blizzardIconUrl(info?.iconPath, region, info?.iconFileID)
    ?? (meta.iconFileID > 0 ? blizzardIconUrl(null, region, meta.iconFileID) : catalogIconUrl(meta.iconName));
  return url ? <img alt="" src={url}/> : <span aria-hidden="true">{meta.symbol}</span>;
}

function readSource(event: DragEvent<HTMLElement>): Source | null {
  try {
    const value: unknown = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
    if (!value || typeof value !== "object") return null;
    const source = value as Partial<Source>;
    if (source.kind === "slot" && Number.isInteger(source.slot) && typeof source.slot === "number") {
      return { kind: "slot", slot: source.slot };
    }
    if (source.kind === "list" && CHARACTER_CURRENCIES.some(meta => meta.key === source.key)) {
      return { kind: "list", key: source.key as CharacterCurrencyKey };
    }
  } catch { /* Ignore drag data from outside the editor. */ }
  return null;
}

export function CurrencyLayoutEditor({ layout, onChange, onClose, language, currencies, region }: {
  layout: CurrencyLayout;
  onChange: (next: CurrencyLayout) => void;
  onClose: () => void;
  language: "es" | "en";
  currencies: Record<string, CharacterCurrency> | null | undefined;
  region: string;
}) {
  const [selected, setSelected] = useState<Source | null>(null);
  const [hoveredListKey, setHoveredListKey] = useState<CharacterCurrencyKey | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const firstFreeSlot = layout.indexOf(null);
  const copy = language === "es" ? {
    title: "Organizar monedas", close: "Cerrar", restore: "Restaurar distribución",
    available: "Disponibles", selected: "Seleccionada", slot: "Hueco", empty: "Vacío",
    add: "Añadir", remove: "Quitar", hint: "Arrastra un icono o selecciona un hueco y después su destino.",
  } : {
    title: "Organize currencies", close: "Close", restore: "Restore layout",
    available: "Available", selected: "Selected", slot: "Slot", empty: "Empty",
    add: "Add", remove: "Remove", hint: "Drag an icon or select a slot and then its destination.",
  };

  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { if (selected) setSelected(null); else onClose(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose, selected]);

  const place = (source: Source, target: number) => {
    onChange(source.kind === "slot" ? moveCurrency(layout, source.slot, target) : addCurrency(layout, source.key, target));
    setSelected(null);
  };
  const selectSlot = (slot: number) => {
    if (selected) { place(selected, slot); return; }
    if (layout[slot]) setSelected({ kind: "slot", slot });
  };
  const slotKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSlot(index); }
  };
  const dragStart = (event: DragEvent<HTMLElement>, source: Source) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(source));
    event.dataTransfer.effectAllowed = "move";
    setHoveredListKey(null);
  };
  const dropSlot = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    setDropTarget(null);
    const source = readSource(event);
    if (source) place(source, index);
  };
  const dropList = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropTarget(null);
    const source = readSource(event);
    if (source?.kind === "slot") onChange(removeCurrency(layout, source.slot));
    setSelected(null);
  };

  return <div className="currency-editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label={copy.title} aria-modal="true" className="currency-editor" role="dialog">
      <header><h2>{copy.title}</h2><button onClick={onClose} type="button">{copy.close}</button></header>
      <p>{copy.hint}</p>
      <div className="currency-editor__body">
        <div aria-label={copy.title} className="currency-editor__grid">
          {layout.map((key, index) => <div
            className={`currency-editor__slot${selected?.kind === "slot" && selected.slot === index ? " is-selected" : ""}${dropTarget === index ? " is-drop-target" : ""}${hoveredListKey && firstFreeSlot === index ? " is-click-target" : ""}`}
            data-currency={key ?? undefined} data-currency-slot={index} draggable={Boolean(key)}
            key={index} onDragOver={event => { event.preventDefault(); setDropTarget(index); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
            onDragStart={event => { if (key) dragStart(event, { kind: "slot", slot: index }); }}
            onDragEnd={() => setDropTarget(null)}
            onDrop={event => dropSlot(event, index)}
          >
            <button aria-label={`${copy.slot} ${index + 1}: ${key ? currencyLabel(key, language) : copy.empty}`} autoFocus={index === 0} onClick={() => selectSlot(index)} onKeyDown={event => slotKey(event, index)} type="button">
              {key ? <CurrencyEditorIcon currencyKey={key} info={currencies?.[key]} region={region}/> : <span aria-hidden="true">+</span>}
            </button>
            {key ? <button aria-label={`${copy.remove} ${currencyLabel(key, language)}`} className="currency-editor__remove" onClick={() => { onChange(removeCurrency(layout, index)); setSelected(null); }} type="button">×</button> : null}
          </div>)}
        </div>
        <aside aria-label={copy.available} className="currency-editor__available" onDragOver={event => event.preventDefault()} onDrop={dropList}>
          <h3>{copy.available}</h3>
          <div>{CHARACTER_CURRENCIES.filter(meta => !layout.includes(meta.key)).map(meta => <button
            aria-label={`${copy.add} ${language === "es" ? meta.labelEs : meta.label}`}
            className={hoveredListKey === meta.key ? "is-hovered" : undefined}
            data-currency={meta.key} draggable key={meta.key} onClick={() => { onChange(addCurrency(layout, meta.key)); setHoveredListKey(null); }}
            onDragStart={event => dragStart(event, { kind: "list", key: meta.key })}
            onDragEnd={() => setDropTarget(null)}
            onMouseEnter={() => setHoveredListKey(meta.key)}
            onMouseLeave={() => setHoveredListKey(current => current === meta.key ? null : current)}
            onFocus={() => setHoveredListKey(meta.key)}
            onBlur={() => setHoveredListKey(current => current === meta.key ? null : current)}
            onKeyDown={event => { if (event.key === " ") { event.preventDefault(); setSelected({ kind: "list", key: meta.key }); } }}
            type="button"
          ><CurrencyEditorIcon currencyKey={meta.key} info={currencies?.[meta.key]} region={region}/><span>{language === "es" ? meta.labelEs : meta.label}</span></button>)}</div>
        </aside>
      </div>
      <footer><button onClick={() => { onChange(defaultCurrencyLayout()); setSelected(null); }} type="button">{copy.restore}</button></footer>
    </section>
  </div>;
}
