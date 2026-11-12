[Setup]
AppId=ReservaSimples.Windows
AppName=Reserva Simples
AppVersion=0.1.2
DefaultDirName={localappdata}\Programs\Reserva Simples
DefaultGroupName=Reserva Simples
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
OutputDir=..\..\artifacts\installer
OutputBaseFilename=Reserva-Simples-Setup-x64
Compression=lzma2
SolidCompression=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\..\artifacts\win-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Reserva Simples"; Filename: "{app}\ReservaSimples.exe"

[Run]
Filename: "{app}\ReservaSimples.exe"; Description: "Abrir Reserva Simples"; Flags: nowait postinstall skipifsilent
