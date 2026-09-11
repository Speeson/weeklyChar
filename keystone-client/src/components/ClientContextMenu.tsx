import { useEffect, useRef } from "react";
import { ThemedIcon } from "./ThemedIcon";

const WIDTH = 220;
const HEIGHT = 176;
const INSET = 8;
const icons = ["refresh", "edit-avatar", "save", "download"] as const;

export function ClientContextMenu({ labels, onActions, onDismiss, x, y }: {
  labels: readonly [string, string, string, string];
  onActions: readonly [() => void, () => void, () => void, () => void];
  onDismiss: () => void;
  x: number;
  y: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const left = Math.max(INSET, Math.min(x, window.innerWidth - WIDTH - INSET));
  const top = Math.max(INSET, Math.min(y, window.innerHeight - HEIGHT - INSET));
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onDismiss(); };
    const pointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onDismiss(); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [onDismiss]);
  return <div aria-label="KeystoneClient" className="ks-context-menu" ref={ref} role="menu" style={{ left, top }}>
    {labels.map((label, index) => <button key={label} onClick={() => { onActions[index](); onDismiss(); }} role="menuitem" type="button"><ThemedIcon name={icons[index]} size={18}/><span>{label}</span></button>)}
  </div>;
}
