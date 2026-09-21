import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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
  error?: string | null;
  onChange: (shortcut: string) => void;
  onPoll?: () => Promise<string | null>;
  onRecordingStart?: () => Promise<void>;
  onRecordingStop?: () => Promise<void>;
  onRestore: () => void;
  onValidate?: (shortcut: string) => Promise<void>;
  value: string;
};

export function OverlayShortcutRecorder({
  disabled = false,
  error = null,
  onChange,
  onPoll,
  onRecordingStart,
  onRecordingStop,
  onRestore,
  onValidate,
  value,
}: OverlayShortcutRecorderProps) {
  const { t } = useI18n();
  const helpId = useId();
  const [recording, setRecording] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const recordingRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastPolledShortcutRef = useRef<string | null>(null);
  const stopRecordingRef = useRef(onRecordingStop);
  const validatingRef = useRef(false);
  const visibleError = captureError ?? error;

  useEffect(() => {
    stopRecordingRef.current = onRecordingStop;
  }, [onRecordingStop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recordingRef.current) {
        recordingRef.current = false;
        void stopRecordingRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    if (!recording || !onPoll) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const shortcut = await onPoll?.();
        if (cancelled || !recordingRef.current) return;
        if (!shortcut) {
          lastPolledShortcutRef.current = null;
        } else if (shortcut !== lastPolledShortcutRef.current) {
          lastPolledShortcutRef.current = shortcut;
          await validateCandidate(shortcut);
        }
      } catch (caught) {
        if (!cancelled && recordingRef.current) {
          setCaptureError(formatCaptureError(caught));
        }
      }
      if (!cancelled && recordingRef.current) {
        timer = window.setTimeout(poll, 25);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [onPoll, recording]);

  function formatCaptureError(caught: unknown): string {
    void caught;
    return t("settings.overlayShortcutUnavailable");
  }

  async function startRecording() {
    if (recordingRef.current || startingRef.current) return;
    startingRef.current = true;
    const recordingSession = recordingSessionRef.current + 1;
    recordingSessionRef.current = recordingSession;
    setCaptureError(null);
    try {
      await onRecordingStart?.();
      if (!mountedRef.current || recordingSession !== recordingSessionRef.current) {
        await onRecordingStop?.();
        return;
      }
      recordingRef.current = true;
      lastPolledShortcutRef.current = null;
      setRecording(true);
    } catch (caught) {
      if (mountedRef.current && recordingSession === recordingSessionRef.current) {
        recordingRef.current = false;
        setRecording(false);
        setCaptureError(formatCaptureError(caught));
      }
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecording() {
    if (startingRef.current && !recordingRef.current) {
      recordingSessionRef.current += 1;
      return;
    }
    if (!recordingRef.current) return;
    recordingRef.current = false;
    recordingSessionRef.current += 1;
    setRecording(false);
    await onRecordingStop?.();
  }

  async function validateCandidate(shortcut: string) {
    if (validatingRef.current) return;
    const recordingSession = recordingSessionRef.current;
    validatingRef.current = true;
    try {
      await onValidate?.(shortcut);
      if (!recordingRef.current || recordingSession !== recordingSessionRef.current) return;
      await stopRecording();
      onChange(shortcut);
      setCaptureError(null);
    } catch (caught) {
      if (recordingRef.current && recordingSession === recordingSessionRef.current) {
        setCaptureError(formatCaptureError(caught));
      }
    } finally {
      validatingRef.current = false;
    }
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      setCaptureError(null);
      try {
        await stopRecording();
      } catch (caught) {
        setCaptureError(formatCaptureError(caught));
      }
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

    await validateCandidate(shortcut);
  }

  return (
    <div className="settings-shortcut-recorder">
      <button
        aria-describedby={helpId}
        aria-label={t("settings.overlayShortcutAria", { shortcut: formatShortcut(value) })}
        aria-pressed={recording}
        disabled={disabled}
        onBlur={() => void stopRecording().catch((caught) => setCaptureError(formatCaptureError(caught)))}
        onClick={() => void startRecording()}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {recording ? t("settings.overlayShortcutRecording") : formatShortcut(value)}
      </button>
      <button
        disabled={disabled}
        onClick={() => {
          void stopRecording().catch((caught) => setCaptureError(formatCaptureError(caught)));
          onRestore();
          setCaptureError(null);
        }}
        type="button"
      >
        {t("settings.overlayShortcutRestore")}
      </button>
      <span
        className={`settings-shortcut-help${visibleError ? " error" : " muted"}`}
        id={helpId}
        role={visibleError ? "alert" : undefined}
      >
        {visibleError
          ?? (recording ? t("settings.overlayShortcutCancelHint") : t("settings.overlayShortcutHelp"))}
      </span>
    </div>
  );
}
