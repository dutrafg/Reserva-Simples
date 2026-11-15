# Reserva Simples Desktop — WebView2 (Windows x64)

**Versão desktop:** 0.2.6 Beta. **PWA incorporado:** 0.39.40 RC1. O calendário colore o quadrado inteiro de cada dia conforme a intensidade das despesas. A versão também incorpora a correção de navegação em telas intermediárias e a ampliação da Central de Integridade.

Implementação experimental que executa os **arquivos originais** `index.html`, `app.js`, `engines.js` e demais recursos da branch de origem. O projeto não reimplementa em C# os módulos do PWA.

## Arquitetura

- WPF no .NET 10 com o Microsoft Edge WebView2.
- Recursos locais incluídos no instalador e hospedados via `SetVirtualHostNameToFolderMapping`, origem `https://reserva.desktop.invalid/`; nenhuma dependência do site remoto para abrir o aplicativo.
- Perfil do WebView2 em `%LocalAppData%\ReservaSimples\WebView2`. `localStorage` e `IndexedDB` persistem independentemente do Chrome.
- Ícone de bandeja: fechar a janela **oculta**, não encerra. Menu permite abrir, encerrar, consultar novas versões, selecionar inicialização com Windows.
- Alertas Web Notification habilitados somente para a origem interna.
- Botões de atualização do PWA encaminhados ao atualizador Windows, que valida SHA-256 e assinatura Authenticode, solicita confirmação, baixa o instalador com progresso e só executa pacotes assinados por um editor confiável. O instalador é interativo, nunca executado silenciosamente; necessita que a beta seja publicada em release do GitHub.
- PWA original em `main` permanece intacto; a versão WPF/SQLite anterior em `windows-native` também.

## Compatibilidade de dados

O armazenamento existente no navegador e o banco SQLite da beta WPF **não são transferidos automaticamente**. Importar usando o backup/exportação fornecido pelo PWA após validar o formato no dispositivo de origem. Nunca substituir diretórios de dados sem backup. O perfil WebView2 fica intacto na desinstalação.

## Compilação

No Windows 11 x64, com .NET SDK 10, runtime WebView2 e Inno Setup 6:

```powershell
dotnet publish windows-webview2/ReservaSimplesDesktop.csproj -c Release -r win-x64 --self-contained true -o artifacts/desktop-win-x64
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" windows-webview2/installer/ReservaSimplesDesktop.iss
```

O GitHub Actions gera o instalador e executa smoke tests de abertura, interface, persistência entre reinícios e preservação do perfil após reinstalação. Cada novo commit na branch `windows-webview2` publica automaticamente uma beta no GitHub Releases **somente após** passar pelos testes Windows. Os arquivos `Reserva-Simples-Desktop-Setup-x64.exe` e `SHA256SUMS.txt` ficam disponíveis para o atualizador, que compara a versão do executável. Também é possível usar o workflow manualmente com `publish_beta=true`, mas não publique duas vezes a mesma tag sem incrementar a versão. Não considerar o aplicativo validado em produção apenas por esses testes: ainda são necessários testes manuais de PDFs, CDI, importação, notificações e upgrade no Windows real.

## Notas de segurança

A origem local é restrita, navegação externa abre no navegador e pedidos de permissão não associados a notificações são bloqueados. O armazenamento WebView2 não é automaticamente criptografado pelo aplicativo, portanto use proteção do Windows/BitLocker e backups adequados. O atualizador usa somente links de assets da conta/repositório oficiais, limita o tamanho do download e compara o SHA-256 do EXE com `SHA256SUMS.txt`. O hash detecta corrupção ou alteração em trânsito, enquanto a assinatura Authenticode valida a identidade do editor para o Windows. Releases de instalação são publicados apenas depois da validação da assinatura do executável e do instalador. A instalação requer confirmação explícita. O botão Cancelar remove o download parcial.

## Correções Windows 0.2.2

- O painel **Ajustes → Atualizações** passa a indicar a versão do executável Windows, não a detecção do PWA no navegador. Verificar agora/Atualizar agora consultam o atualizador do Windows.
- O instalador é publicado como **pré-release** `windows-webview2-v0.2.2-beta` após a bateria de testes. Antes disso, apenas artefatos de Actions não são suficientes para o atualizador.
- O ícone original está embutido no `.exe` via `ApplicationIcon` e aparece na janela, no menu Iniciar e nos atalhos após reinstalar. O Windows pode manter o ícone antigo de um atalho fixado em cache; nesse caso, desafixe e fixe o aplicativo novamente.
- O Service Worker do PWA não é registrado no Windows. Registros antigos do perfil WebView2 são removidos na inicialização para impedir que um cache antigo substitua os arquivos empacotados.
- Não se apaga o perfil `%LocalAppData%\\ReservaSimples\\WebView2` durante atualização ou desinstalação.

### Limites de validação

Os testes de CI abrangem instalação, reinício, persistência, reinstalação e presença do ícone. A consulta e o download do release são testados no workflow, mas os diálogos do atualizador e as notificações precisam ser confirmados em Windows 11 real.


## Assinatura de código para publicação

O instalador beta precisa de um certificado Authenticode emitido por uma autoridade confiável para executar em computadores com Smart App Control. No GitHub, configure em **Settings → Secrets and variables → Actions**:

- `WINDOWS_SIGNING_CERTIFICATE_BASE64`: conteúdo do arquivo PFX codificado em Base64.
- `WINDOWS_SIGNING_CERTIFICATE_PASSWORD`: senha do PFX.

O workflow assina o executável do aplicativo antes de empacotá-lo, assina o instalador e valida os dois. Sem os segredos, o CI ainda gera o artefato para verificação, mas não publica um release instalável. Não envie o PFX nem a senha em commits, issues ou mensagens.
