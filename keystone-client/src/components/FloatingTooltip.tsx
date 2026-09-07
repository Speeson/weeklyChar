import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = { left: number; top: number; placement: "above" | "below" };

function positionFor(target: HTMLElement): TooltipPosition {
  const rect = target.getBoundingClientRect();
  const halfWidth = 120;
  const left = Math.min(Math.max(8 + halfWidth, rect.left + rect.width / 2), window.innerWidth - 8 - halfWidth);
  const placement = rect.top >= 56 ? "above" : "below";
  return { left, top: placement === "above" ? rect.top - 8 : rect.bottom + 8, placement };
}

export function FloatingTooltip({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0, placement: "above" });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => triggerRef.current && setPosition(positionFor(triggerRef.current));
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return <>
    <span
      aria-describedby={open ? tooltipId : undefined}
      aria-label={label}
      className={className}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={triggerRef}
      tabIndex={0}
    >
      {children}
    </span>
    {open ? createPortal(<span
      className="floating-local-tooltip"
      data-placement={position.placement}
      id={tooltipId}
      role="tooltip"
      style={{ left: position.left, top: position.top } as CSSProperties}
    >{label}</span>, document.body) : null}
  </>;
}
