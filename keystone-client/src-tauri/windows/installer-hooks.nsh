Var KeystoneLegacyAutostart

!macro NSIS_HOOK_PREINSTALL
  SetRegView 64
  ReadRegStr $KeystoneLegacyAutostart HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "KeystoneClient"
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}_is1" "UninstallString"
  StrCmp $0 "" keystone_legacy_migration_done

  ClearErrors
  ExecWait '$0 /VERYSILENT /SUPPRESSMSGBOXES /NORESTART' $1
  IfErrors keystone_legacy_migration_failed
  StrCmp $1 "0" keystone_legacy_migration_done keystone_legacy_migration_failed

keystone_legacy_migration_failed:
  MessageBox MB_ICONSTOP "KeystoneClient could not remove the legacy installation. The new installation has been cancelled."
  Abort

keystone_legacy_migration_done:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  StrCmp $KeystoneLegacyAutostart "" keystone_autostart_migration_done
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "KeystoneClient" '"$INSTDIR\KeystoneClient.exe" --autostart'

keystone_autostart_migration_done:
!macroend
