import { useId, useState, type KeyboardEvent } from "react";
import { useI18n } from "../core/i18n";

const MODIFIER_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
]);

const NAMED_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Backquote",
  "Backslash",
  "Backspace",
  "BracketLeft",
  "BracketRight",
  "CapsLock",
  "Comma",
  "Delete",
  "End",
  "Enter",
  "Equal",
  "Home",
  "Insert",
  "Minus",
  "NumLock",
  "NumpadAdd",
  "NumpadDecimal",
  "NumpadDivide",
  "NumpadEnter",
  "NumpadEqual",
  "NumpadMultiply",
  "NumpadSubtract",
  "PageDown",
  "PageUp",
  "Pause",
  "Period",
  "PrintScreen",
  "Quote",
  "ScrollLock",
  "Semicolon",
  "Slash",
  "Space",
  "Tab",
]);

function supportedMainKey(code: string): boolean {
  return /^Key[A-Z]$/.test(code)
    || /^Digit[0-9]$/.test(code)
    || /^Numpad[0-9]$/.test(code)
    || /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)
    || NAMED_KEYS.has(code);
}

export function shortcutFromKeyboardEvent(event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey">): string | null {
  if (MODIFIER_CODES.has(event.code) || !supportedMainKey(event.code)) {
    return null;
  }

  const modifiers = [
    event.ctrlKey ? "Ctrl" : null,
    event.shiftKey ? "Shift" : null,
    event.altKey ? "Alt" : null,
    event.metaKey ? "Super" : null,
  ].filter((value): value is string => value !== null);
  if (modifiers.length === 0) {
    return null;
  }

  return [...modifiers, event.code].join("+");
}

export function formatShortcut(value: string): string {
  return value
    .split("+")
    .map((part) => {
      if (/^Key[A-Z]$/i.test(part)) return part.slice(3).toUpperCase();
      if (/^Digit[0-9]$/i.test(part)) return part.slice(5);
      return part;
    })
    .join(" + ");
}

type OverlayShortcutRecorderProps = {
  disabled?: boolean;
  onChange: (shortcut: string) => void;
  value: string;
};

export function OverlayShortcutRecorder({ disabled = false, onChange, value }: OverlayShortcutRecorderProps) {
  const { t } = useI18n();
  const helpId = useId();
  const errorId = useId();
  const [recording, setRecording] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      setRecording(false);
      setCaptureError(null);
      return;
    }
    if (MODIFIER_CODES.has(event.code)) {
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event);
    if (!shortcut) {
      setCaptureError(t("settings.overlayShortcutModifierRequired"));
      return;
    }

    onChange(shortcut);
    setRecording(false);
    setCaptureError(null);
  }

  return (
    <div className="settings-shortcut-recorder">
      <button
        aria-describedby={`${helpId}${captureError ? ` ${errorId}` : ""}`}
        aria-label={t("settings.overlayShortcutAria", { shortcut: formatShortcut(value) })}
        aria-pressed={recording}
        disabled={disabled}
        onClick={() => {
          setRecording(true);
          setCaptureError(null);
        }}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {recording ? t("settings.overlayShortcutRecording") : formatShortcut(value)}
      </button>
      <span className="muted settings-shortcut-help" id={helpId}>
        {recording ? t("settings.overlayShortcutCancelHint") : t("settings.overlayShortcutHelp")}
      </span>
      {captureError ? <span className="error settings-shortcut-error" id={errorId} role="alert">{captureError}</span> : null}
    </div>
  );
}
