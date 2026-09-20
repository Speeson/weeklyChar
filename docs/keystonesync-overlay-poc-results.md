# KeystoneClient Overlay POC Results

## Environment

- OS: Microsoft Windows 11 Pro 10.0.26200 (build 26200)
- KeystoneClient commit: `082a57041b32002dd6fa1c643b95c3c836bfb98e`
- WoW mode: Windowed (Fullscreen) / borderless
- Monitor configuration: One primary 3440×1440 display (3440×1392 work area)
- Tauri: 2.11.5
- WebView2: 153.0.4234.48

## Strategy Tested

- Tauri set_focusable(false): PASS
- WS_EX_NOACTIVATE: Not tested; the Tauri-only strategy passed
- WM_MOUSEACTIVATE / MA_NOACTIVATE: Not tested; the Tauri-only strategy passed

## Results

| Test | Result |
|---|---|
| Overlay shows without activating | PASS |
| Hover | PASS |
| Click | PASS |
| Wheel | PASS |
| Scroll | PASS |
| Tabs | PASS |
| Toggles | PASS |
| Modals | PASS |
| Existing held W remains active | PASS |
| New W after overlay click reaches WoW | PASS |
| A/D/Space after overlay click reach WoW | PASS |
| Hide/show repeated | PASS |
| Normal client restored correctly | PASS |

## Final Decision

POC: PASS

## Blocking Issues

- None for the overlay POC.
- Unrelated validation baseline: five browser-only Void snapshots still contain older visual/version output and fail against the current 0.14.1 UI. The overlay branch does not modify frontend or snapshot files. A transient remote Hunter necklace image failure passed on targeted rerun.

## Selected Implementation

Tauri non-focusable only.
