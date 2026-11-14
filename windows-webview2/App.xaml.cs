using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace ReservaSimples.Desktop;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += OnUnhandledException;
    }

    private static void OnUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        try
        {
            string folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ReservaSimples", "logs");
            Directory.CreateDirectory(folder);
            File.AppendAllText(Path.Combine(folder, "desktop.log"),
                $"[{DateTimeOffset.Now:O}] {e.Exception}\r\n");
        }
        catch { /* Log errors must not hide the original failure. */ }

        MessageBox.Show("O Reserva Simples encontrou um erro. Veja o arquivo desktop.log na pasta local do aplicativo.",
            "Reserva Simples", MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true;
        Current.Shutdown(1);
    }
}
