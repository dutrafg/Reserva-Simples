using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Windows;
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

            // Mark the desktop host and route the PWA update buttons to the native checker.
            await core.AddScriptToExecuteOnDocumentCreatedAsync("""
                window.__RESERVA_DESKTOP__ = true;
                document.addEventListener('click', function(event) {
                  const button = event.target instanceof Element
                    ? event.target.closest('#checkUpdatesBtn, #applyUpdateBtn') : null;
                  if (!button) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  window.chrome.webview.postMessage({type:'check-updates'});
                }, true);
                """);

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
        if (!e.Source.StartsWith(LocalOrigin, StringComparison.OrdinalIgnoreCase))
            return;
        try
        {
            using var json = JsonDocument.Parse(e.WebMessageAsJson);
            if (!json.RootElement.TryGetProperty("type", out var type))
                return;
            if (type.GetString() == "check-updates")
                _ = CheckUpdatesAsync();
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

    private async Task CheckUpdatesAsync()
    {
        if (updateCheckRunning) return;
        updateCheckRunning = true;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            http.DefaultRequestHeaders.UserAgent.ParseAdd("ReservaSimplesDesktop/0.1.0");
            using var response = await http.GetAsync(UpdatesApi);
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            string? latestTag = null;
            string? releaseUrl = null;
            Version current = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(0, 1, 0);
            Version newest = current;
            foreach (var release in doc.RootElement.EnumerateArray())
            {
                string tag = release.GetProperty("tag_name").GetString() ?? "";
                if (!tag.StartsWith(ReleasePrefix, StringComparison.OrdinalIgnoreCase)) continue;
                string token = tag[ReleasePrefix.Length..].Split('-')[0];
                if (Version.TryParse(token, out Version? version) && version > newest)
                {
                    newest = version;
                    latestTag = tag;
                    releaseUrl = release.GetProperty("html_url").GetString();
                }
            }

            if (latestTag is null)
                MessageBox.Show(this, "Nenhuma versão Windows WebView2 mais recente foi encontrada.",
                    "Atualizações", MessageBoxButton.OK, MessageBoxImage.Information);
            else if (MessageBox.Show(this,
                $"Versão disponível: {latestTag}. Deseja abrir a página oficial para baixar o instalador?",
                "Atualização disponível", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
                OpenExternal(releaseUrl);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Falha ao consultar o GitHub: " + ex.Message,
                "Atualizações", MessageBoxButton.OK, MessageBoxImage.Warning);
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
