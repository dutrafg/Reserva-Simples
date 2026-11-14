[Setup]
AppId=ReservaSimples.Desktop.WebView2
AppName=Reserva Simples Desktop
AppVersion=0.2.2
DefaultDirName={localappdata}\Programs\Reserva Simples Desktop
DefaultGroupName=Reserva Simples Desktop
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
OutputDir=..\..\artifacts\desktop-installer
OutputBaseFilename=Reserva-Simples-Desktop-Setup-x64
Compression=lzma2
SolidCompression=yes
CloseApplications=yes
UninstallDisplayIcon={app}\ReservaSimplesDesktop.exe

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\..\artifacts\desktop-win-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Reserva Simples Desktop"; Filename: "{app}\ReservaSimplesDesktop.exe"
Name: "{userdesktop}\Reserva Simples Desktop"; Filename: "{app}\ReservaSimplesDesktop.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; Flags: unchecked

[Run]
Filename: "{app}\ReservaSimplesDesktop.exe"; Description: "Abrir Reserva Simples"; Flags: nowait postinstall skipifsilent
