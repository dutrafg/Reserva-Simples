using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Media.Imaging;
using System.Text.Json;
using System.Windows;
using Application = System.Windows.Application;
using MessageBox = System.Windows.MessageBox;
using MessageBoxButton = System.Windows.MessageBoxButton;
using MessageBoxImage = System.Windows.MessageBoxImage;
using Window = System.Windows.Window;
using System.ComponentModel;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Forms = System.Windows.Forms;
using Drawing = System.Drawing;

namespace ReservaSimples.Desktop;

public partial class MainWindow : Window
{
    private const string LocalHost = "reserva.desktop.invalid";
    private const string LocalOrigin = "https://" + LocalHost + "/";
    private const string ReleasePrefix = "windows-webview2-v";
    private const string UpdatesApi = "https://api.github.com/repos/dutrafg/Reserva-Simples/releases?per_page=30";
    private const string ReleasesPage = "https://github.com/dutrafg/Reserva-Simples/releases";
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunName = "ReservaSimplesDesktop";
    private readonly Forms.NotifyIcon tray = new();
    private Drawing.Icon? ownedTrayIcon;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(nint handle);
    private readonly bool backgroundMode = Environment.GetCommandLineArgs().Contains("--background");
    private readonly bool smokeWrite = Environment.GetCommandLineArgs().Contains("--smoke-write");
    private readonly bool smokeRead = Environment.GetCommandLineArgs().Contains("--smoke-read");
    private bool exitRequested;
    private bool updateCheckRunning;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await InitializeBrowserAsync();
        Closing += OnClosing;
        if (backgroundMode)
        {
            ShowInTaskbar = false;
            WindowState = WindowState.Minimized;
        }
        SetupTray();
    }

    private static string DataFolder => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ReservaSimples");

    private void SetupTray()
    {
        tray.Icon = Drawing.SystemIcons.Application;
        string iconPath = Path.Combine(AppContext.BaseDirectory, "web", "icon-192.png");
        if (File.Exists(iconPath))
        {
            try
            {
                Icon = new BitmapImage(new Uri(iconPath));
                using var bitmap = new Drawing.Bitmap(iconPath);
                nint handle = bitmap.GetHicon();
                try
                {
                    using var temporaryIcon = Drawing.Icon.FromHandle(handle);
                    ownedTrayIcon = (Drawing.Icon)temporaryIcon.Clone();
                    tray.Icon = ownedTrayIcon;
                }
                finally { DestroyIcon(handle); }
            }
            catch { /* Continue with the built-in icon if the asset is invalid. */ }
        }
        tray.Text = "Reserva Simples";
        tray.Visible = true;
        tray.DoubleClick += (_, _) => ShowWindow();

        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("Abrir Reserva Simples", null, (_, _) => ShowWindow());
        menu.Items.Add("Verificar atualizações", null, async (_, _) => await CheckUpdatesAsync());
        var startup = new Forms.ToolStripMenuItem("Iniciar com o Windows")
        {
            CheckOnClick = true,
            Checked = IsAutoStartEnabled()
        };
        startup.CheckedChanged += (_, _) => SetAutoStart(startup.Checked);
        menu.Items.Add(startup);
        menu.Items.Add("Abrir pasta de dados", null, (_, _) =>
            Process.Start(new ProcessStartInfo(DataFolder) { UseShellExecute = true }));
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("Sair completamente", null, (_, _) => ExitApplication());
        tray.ContextMenuStrip = menu;
    }

    private static bool IsAutoStartEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey);
        return key?.GetValue(RunName) is string command &&
               command.Contains("ReservaSimplesDesktop.exe", StringComparison.OrdinalIgnoreCase);
    }

    private void SetAutoStart(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            if (enabled)
                key.SetValue(RunName, $"\"{Environment.ProcessPath}\" --background");
            else
                key.DeleteValue(RunName, false);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Não foi possível configurar a inicialização: " + ex.Message,
                "Reserva Simples", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private async Task InitializeBrowserAsync()
    {
        try
        {
            string webFolder = Path.Combine(AppContext.BaseDirectory, "web");
            if (!File.Exists(Path.Combine(webFolder, "index.html")) ||
                !File.Exists(Path.Combine(webFolder, "app.js")) ||
                !File.Exists(Path.Combine(webFolder, "engines.js")))
                throw new FileNotFoundException("Arquivos do PWA ausentes no instalador.");

            Directory.CreateDirectory(DataFolder);
            string profile = Path.Combine(DataFolder, "WebView2");
            Directory.CreateDirectory(profile);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
            await Browser.EnsureCoreWebView2Async(environment);

            var core = Browser.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping(
                LocalHost, webFolder, CoreWebView2HostResourceAccessKind.DenyCors);
            // A previous profile can still have a service worker for this origin.
            // Load the installed files on the first navigation after an upgrade.
            await core.CallDevToolsProtocolMethodAsync("Network.setBypassServiceWorker", "{\"bypass\":true}");
            await core.CallDevToolsProtocolMethodAsync("Network.setCacheDisabled", "{\"cacheDisabled\":true}");
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
            core.NavigationStarting += (_, args) =>
            {
                if (args.Uri.StartsWith(LocalOrigin, StringComparison.OrdinalIgnoreCase))
                    return;
                args.Cancel = true;
                OpenExternal(args.Uri);
            };
            core.PermissionRequested += (_, args) =>
            {
                if (args.Uri.StartsWith(LocalOrigin, StringComparison.OrdinalIgnoreCase) &&
                    args.PermissionKind == CoreWebView2PermissionKind.Notifications)
                    args.State = CoreWebView2PermissionState.Allow;
                else
                    args.State = CoreWebView2PermissionState.Deny;
            };
            core.WebMessageReceived += OnWebMessageReceived;

            // The desktop version must be available before app.js evaluates.
            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.__RESERVA_DESKTOP_VERSION__ = '" +
                DesktopUpdates.InstalledVersion.ToString(3) + "';");

            // Reuse the PWA interface but route updates only to the native Windows updater.
            await core.AddScriptToExecuteOnDocumentCreatedAsync("""
                window.__RESERVA_DESKTOP__ = true;
                if ('serviceWorker' in navigator)
                  navigator.serviceWorker.getRegistrations()
                    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
                    .catch(() => {});
                document.addEventListener('click', function(event) {
                  const button = event.target instanceof Element
                    ? event.target.closest('#checkUpdatesBtn, #applyUpdateBtn') : null;
                  if (!button) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  window.chrome.webview.postMessage({type:'check-updates'});
                }, true);
                """);

            if (smokeWrite || smokeRead)
                await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__RESERVA_DESKTOP_SMOKE__ = true;");

            var snapshot = new LocalDatabase(DataFolder).Read();
            await core.AddScriptToExecuteOnDocumentCreatedAsync(
                "if (window === window.top && location.href === '" + LocalOrigin + "index.html') " +
                "window.__RESERVA_DESKTOP_DATABASE__ = " + JsonSerializer.Serialize(snapshot) + ";");
            Browser.Source = new Uri(LocalOrigin + "index.html");
            if (backgroundMode)
                Hide();
        }
        catch (Exception ex)
        {
            if (smokeWrite || smokeRead)
            {
                WriteSmokeFailure(ex.ToString());
                Application.Current.Shutdown(1);
                return;
            }
            MessageBox.Show(this, "Falha ao iniciar a versão Windows: " + ex.Message,
                "Reserva Simples", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!string.Equals(e.Source, LocalOrigin + "index.html", StringComparison.Ordinal))
            return;
        try
        {
            using var json = JsonDocument.Parse(e.WebMessageAsJson);
            if (!json.RootElement.TryGetProperty("type", out var type))
                return;
            if (type.GetString() == "check-updates")
                _ = CheckUpdatesAsync();
            else if (type.GetString() == "backup-folder")
                _ = HandleBackupFolderAsync(json.RootElement.Clone());
            else if (type.GetString() == "notify")
            {
                string title = json.RootElement.TryGetProperty("title", out var t)
                    ? (t.GetString() ?? "Reserva Simples") : "Reserva Simples";
                string body = json.RootElement.TryGetProperty("body", out var b)
                    ? (b.GetString() ?? "") : "";
                tray.ShowBalloonTip(3000, title[..Math.Min(title.Length, 60)],
                    body[..Math.Min(body.Length, 240)], Forms.ToolTipIcon.Info);
            }
        }
        catch (JsonException) { /* Ignore malformed untrusted web messages. */ }
    }

    private readonly Dictionary<string, string> backupFolders = new();

    private async Task HandleBackupFolderAsync(JsonElement message)
    {
        static string? ReadString(JsonElement root, string key) =>
            root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString() : null;

        var id = ReadString(message, "id");
        if (id is null || id.Length > 100) return;
        string? value = null;
        string? error = null;
        try
        {
            var action = ReadString(message, "action");
            if (action is "save-file" or "open-file" or "choose")
                await System.Windows.Threading.Dispatcher.Yield();

            if (action == "database-write")
            {
                var content = ReadString(message, "content") ?? throw new JsonException();
                var expected = ReadString(message, "expected");
                await Task.Run(() => new LocalDatabase(DataFolder).Write(content, expected));
            }
            else if (action == "save-file")
            {
                var content = ReadString(message, "content") ?? throw new JsonException();
                var name = ReadString(message, "name");
                var dialog = new Microsoft.Win32.SaveFileDialog
                {
                    Title = "Salvar backup do Reserva Simples",
                    Filter = "Backup JSON (*.json)|*.json",
                    DefaultExt = ".json",
                    AddExtension = true,
                    OverwritePrompt = true,
                    FileName = name == "reserva-cofre.json" ? name : $"reserva-backup-{DateTime.Today:yyyy-MM-dd}.json"
                };
                if (dialog.ShowDialog(this) != true) error = "AbortError";
                else
                {
                    var directory = Path.GetDirectoryName(dialog.FileName)!;
                    var temporary = Path.Combine(directory, $".reserva-{Guid.NewGuid():N}.tmp");
                    try
                    {
                        await File.WriteAllTextAsync(temporary, content);
                        File.Move(temporary, dialog.FileName, overwrite: true);
                    }
                    finally
                    {
                        if (File.Exists(temporary)) File.Delete(temporary);
                    }
                }
            }
            else if (action == "open-file")
            {
                var dialog = new Microsoft.Win32.OpenFileDialog
                {
                    Title = "Abrir backup do Reserva Simples",
                    Filter = "Backup JSON (*.json)|*.json",
                    CheckFileExists = true
                };
                if (dialog.ShowDialog(this) != true) error = "AbortError";
                else
                {
                    await using var stream = File.OpenRead(dialog.FileName);
                    if (stream.Length > 8_000_000) error = "QuotaExceededError";
                    else
                    {
                        var bytes = new byte[(int)stream.Length];
                        await stream.ReadExactlyAsync(bytes);
                        using var reader = new StreamReader(new MemoryStream(bytes));
                        value = reader.ReadToEnd();
                    }
                }
            }
            else if (action == "choose")
            {
                var dialog = new OpenFolderDialog { Title = "Escolher pasta para backup cifrado" };
                if (dialog.ShowDialog(this) == true)
                {
                    value = Guid.NewGuid().ToString("N");
                    backupFolders.Add(value, dialog.FolderName);
                }
                else error = "AbortError";
            }
            else
            {
                var token = ReadString(message, "token");
                var name = ReadString(message, "name");
                if (token is null || !backupFolders.TryGetValue(token, out var folder) ||
                    name is null || name.Length > 160 ||
                    !System.Text.RegularExpressions.Regex.IsMatch(name,
                        @"\AReserva_Simples_(?:cifrado|(?:cifrado|versao)_[a-zA-Z0-9_-]+)\.json\z"))
                    throw new UnauthorizedAccessException();

                var path = Path.Combine(folder, name);
                if (File.Exists(path) && File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint))
                    throw new UnauthorizedAccessException();
                if (action == "read")
                    value = await File.ReadAllTextAsync(path);
                else if (action == "write")
                {
                    var content = ReadString(message, "content") ?? throw new JsonException();
                    var temp = Path.Combine(folder, $".reserva-{Guid.NewGuid():N}.tmp");
                    try
                    {
                        await File.WriteAllTextAsync(temp, content);
                        File.Move(temp, path, overwrite: true);
                    }
                    finally
                    {
                        if (File.Exists(temp)) File.Delete(temp);
                    }
                }
                else throw new UnauthorizedAccessException();
            }
        }
        catch (FileNotFoundException) { error = "NotFoundError"; }
        catch (Exception) { error = "NotAllowedError"; }

        Browser.CoreWebView2?.PostWebMessageAsJson(
            JsonSerializer.Serialize(new { type = "backup-response", id, value, error }));
    }

    private static void OpenExternal(string? address)
    {
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            return;
        if (uri.Host.Equals(LocalHost, StringComparison.OrdinalIgnoreCase))
            return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch { /* A missing default browser should not crash the financial app. */ }
    }

    private async void Browser_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!(smokeRead || smokeWrite))
            return;
        try
        {
            if (!e.IsSuccess)
                throw new InvalidOperationException("O PWA não carregou: " + e.WebErrorStatus);

            const string domCheck = """
                (() => Boolean(document.querySelector('#page-home') &&
                    document.querySelector('#page-transactions') &&
                    document.querySelector('script[src="./app.js"]') &&
                    window.ReservaEngines))()
                """;
            if (await Browser.CoreWebView2.ExecuteScriptAsync(domCheck) != "true")
                throw new InvalidOperationException("Módulos do PWA ou motores financeiros não carregaram.");

            string calendarResult = await Browser.CoreWebView2.ExecuteScriptAsync("window.__reservaCheckCalendar?.() ?? { error: 'Diagnóstico do calendário indisponível' }");
            using var result = JsonDocument.Parse(calendarResult);
            var properties = result.RootElement;
            if (!properties.TryGetProperty("levels", out var levels) || levels[0].GetString() != "1" ||
                levels[1].GetString() != "5" || properties.GetProperty("dots").GetBoolean() ||
                properties.GetProperty("colors")[0].GetString() == properties.GetProperty("colors")[1].GetString() ||
                properties.GetProperty("colors")[1].GetString() == "rgba(0, 0, 0, 0)")
                throw new InvalidOperationException("Mapa de calor: " + calendarResult);

            const string storageKey = "reserva-desktop-smoke-check";
            string script = smokeWrite
                ? $"(() => {{ localStorage.setItem('{storageKey}', 'ok'); return localStorage.getItem('{storageKey}') === 'ok'; }})()"
                : $"(() => localStorage.getItem('{storageKey}') === 'ok')()";
            if (await Browser.CoreWebView2.ExecuteScriptAsync(script) != "true")
                throw new InvalidOperationException("Persistência local do WebView2 não foi validada.");

            Application.Current.Shutdown(0);
        }
        catch (Exception ex)
        {
            WriteSmokeFailure(ex.ToString());
            Application.Current.Shutdown(1);
        }
    }

    private static void WriteSmokeFailure(string message)
    {
        try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "ReservaSimplesDesktop-smoke-error.txt"), message); }
        catch { }
    }

    private async Task ReportDesktopUpdateAsync(
        string status, string state, string latest, bool available, string notes)
    {
        try
        {
            if (Browser.CoreWebView2 is null) return;
            string data = JsonSerializer.Serialize(new
            {
                status,
                state,
                latest,
                available,
                notes
            });
            await Browser.CoreWebView2.ExecuteScriptAsync(
                "window.dispatchEvent(new CustomEvent('reserva:desktop-update', {detail:" +
                data + "}));");
        }
        catch (Exception)
        {
            // The native updater must remain usable even if the settings page is unavailable.
        }
    }

    private async Task CheckUpdatesAsync()
    {
        if (updateCheckRunning) return;
        updateCheckRunning = true;
        try
        {
            if (!IsVisible) ShowWindow();
            await ReportDesktopUpdateAsync("Consultando versões Windows…", "checking",
                DesktopUpdates.InstalledVersion.ToString(3), false,
                "Consultando os instaladores Windows publicados no GitHub.");
            DesktopRelease? release = await DesktopUpdates.FindNewerAsync(CancellationToken.None);
            if (release is null)
            {
                await ReportDesktopUpdateAsync("Versão Windows atualizada", "success",
                    DesktopUpdates.InstalledVersion.ToString(3), false,
                    "O instalador Windows já é o mais recente entre os releases publicados. " +
                    "As atualizações do site e do executável são distribuídas separadamente.");
                MessageBox.Show(this, "Nenhuma atualização Windows nova foi encontrada nos releases oficiais.",
                    "Reserva Simples — Atualizações", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            await ReportDesktopUpdateAsync("Nova versão Windows disponível", "available",
                release.Version.ToString(3), true,
                "Versão publicada no GitHub. Clique em Atualizar agora para baixar " +
                "e validar o instalador x64 antes da confirmação.");
            if (MessageBox.Show(this,
                    $"Nova versão Windows: {release.Version}.\n\nDeseja baixar o instalador oficial? " +
                    "O arquivo será verificado por SHA-256 antes de ser executado.",
                    "Reserva Simples — Atualização disponível",
                    MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            using var cancellation = new CancellationTokenSource();
            var dialog = new UpdateProgressWindow { Owner = this };
            dialog.CancelRequested += (_, _) => cancellation.Cancel();
            var progress = new Progress<DownloadState>(state => dialog.Report(state));
            string installer;
            dialog.Show();
            try
            {
                installer = await DesktopUpdates.DownloadVerifiedAsync(release, progress, cancellation.Token);
            }
            finally
            {
                dialog.Finish();
            }

            if (MessageBox.Show(this,
                    $"Download verificado: {release.Tag}.\n\nDeseja abrir o instalador agora? " +
                    "O Reserva Simples será encerrado para concluir a atualização. " +
                    "Os seus dados locais ficam preservados.",
                    "Instalar atualização",
                    MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            Process.Start(new ProcessStartInfo(installer)
            {
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(installer)!
            });
            ExitApplication();
        }
        catch (OperationCanceledException)
        {
            await ReportDesktopUpdateAsync("Download cancelado", "waiting",
                DesktopUpdates.InstalledVersion.ToString(3), false,
                "Nenhuma alteração foi instalada. Os dados permanecem no computador.");
            MessageBox.Show(this, "Download cancelado sem instalar alterações.",
                "Reserva Simples", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            await ReportDesktopUpdateAsync("Erro ao consultar ou baixar atualização", "error",
                DesktopUpdates.InstalledVersion.ToString(3), false,
                "Verifique sua conexão e tente novamente. Os dados locais permanecem intactos.");
            MessageBox.Show(this, "Não foi possível atualizar: " + ex.Message +
                "\n\nO aplicativo atual permanece instalado e seus dados não foram alterados.",
                "Reserva Simples — Atualizações",
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally { updateCheckRunning = false; }
    }

    private void ShowWindow()
    {
        ShowInTaskbar = true;
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void OnClosing(object? sender, CancelEventArgs args)
    {
        if (exitRequested)
        {
            tray.Visible = false;
            tray.Dispose();
            ownedTrayIcon?.Dispose();
            return;
        }
        args.Cancel = true;
        Hide();
        tray.ShowBalloonTip(2500, "Reserva Simples",
            "O aplicativo permanece na bandeja do Windows. Use 'Sair completamente' para encerrar.",
            Forms.ToolTipIcon.Info);
    }

    private void ExitApplication()
    {
        exitRequested = true;
        Close();
    }
}
