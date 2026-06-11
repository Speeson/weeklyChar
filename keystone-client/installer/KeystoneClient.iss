#define AppName "KeystoneClient"
#define AppPublisher "Speeson"
#define AppExeName "KeystoneClient.exe"
#define AppVersion ReadIni(SourcePath + "\version.ini", "Version", "AppVersion", "0.1.0")

[Setup]
AppId={{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\KeystoneSync
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputDir=output
OutputBaseFilename=KeystoneClientSetup
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "startmenuicon"; Description: "Crear acceso directo en el menu Inicio"; GroupDescription: "Accesos directos:"; Flags: checkedonce
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Files]
Source: "..\dist\KeystoneClient.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: startmenuicon
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"; Tasks: startmenuicon
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Ejecutar {#AppName}"; Flags: nowait postinstall skipifsilent
