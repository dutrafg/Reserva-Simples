# Reserva Simples Desktop — WebView2 (Windows x64)

Implementação experimental que executa os **arquivos originais** `index.html`, `app.js`, `engines.js` e demais recursos da branch de origem. O projeto não reimplementa em C# os módulos do PWA.

## Arquitetura

- WPF no .NET 10 com o Microsoft Edge WebView2.
- Recursos locais incluídos no instalador e hospedados via `SetVirtualHostNameToFolderMapping`, origem `https://reserva.desktop.invalid/`; nenhuma dependência do site remoto para abrir o aplicativo.
- Perfil do WebView2 em `%LocalAppData%\ReservaSimples\WebView2`. `localStorage` e `IndexedDB` persistem independentemente do Chrome.
- Ícone de bandeja: fechar a janela **oculta**, não encerra. Menu permite abrir, encerrar, consultar novas versões, selecionar inicialização com Windows.
- Alertas Web Notification habilitados somente para a origem interna.
- Botões de atualização do PWA encaminhados ao verificador de releases GitHub com prefixo `windows-webview2-v`. A primeira beta **consulta e abre a página de download**; download/instalação automática ficam pendentes.
- PWA original em `main` permanece intacto; a versão WPF/SQLite anterior em `windows-native` também.

## Compatibilidade de dados

O armazenamento existente no navegador e o banco SQLite da beta WPF **não são transferidos automaticamente**. Importar usando o backup/exportação fornecido pelo PWA após validar o formato no dispositivo de origem. Nunca substituir diretórios de dados sem backup. O perfil WebView2 fica intacto na desinstalação.

## Compilação

No Windows 11 x64, com .NET SDK 10, runtime WebView2 e Inno Setup 6:

```powershell
dotnet publish windows-webview2/ReservaSimplesDesktop.csproj -c Release -r win-x64 --self-contained true -o artifacts/desktop-win-x64
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" windows-webview2/installer/ReservaSimplesDesktop.iss
```

O GitHub Actions gera o instalador e executa smoke tests de abertura, interface e persistência entre reinícios. Não considerar o aplicativo validado em produção apenas por esses testes: ainda são necessários testes manuais de PDFs, CDI, importação, notificações e upgrade no Windows real.

## Notas de segurança

A origem local é restrita, navegação externa abre no navegador e pedidos de permissão não associados a notificações são bloqueados. O armazenamento WebView2 não é automaticamente criptografado pelo aplicativo, portanto use proteção do Windows/BitLocker e backups adequados. O atualizador só consulta a API oficial do GitHub, sem instalar executáveis silenciosamente.
