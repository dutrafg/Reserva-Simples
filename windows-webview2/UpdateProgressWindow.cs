using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Color = System.Windows.Media.Color;
using Button = System.Windows.Controls.Button;
using ProgressBar = System.Windows.Controls.ProgressBar;
using Application = System.Windows.Application;
using Window = System.Windows.Window;

namespace ReservaSimples.Desktop;

internal sealed class UpdateProgressWindow : Window
{
    private readonly TextBlock status;
    private readonly ProgressBar progress;
    private readonly Button cancel;
    private bool finished;

    internal event EventHandler? CancelRequested;

    internal UpdateProgressWindow()
    {
        Title = "Atualização — Reserva Simples";
        Width = 460;
        Height = 190;
        MinWidth = 430;
        MinHeight = 185;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        Background = new SolidColorBrush(Color.FromRgb(243, 246, 251));
        var stack = new StackPanel { Margin = new Thickness(24) };
        stack.Children.Add(new TextBlock
        {
            Text = "Baixando atualização verificada",
            FontWeight = FontWeights.SemiBold,
            FontSize = 16,
            Margin = new Thickness(0, 0, 0, 14)
        });
        status = new TextBlock { Text = "Preparando download…", Margin = new Thickness(0, 0, 0, 8) };
        stack.Children.Add(status);
        progress = new ProgressBar { IsIndeterminate = true, Minimum = 0, Maximum = 100, Height = 14 };
        stack.Children.Add(progress);
        cancel = new Button
        {
            Content = "Cancelar download",
            Width = 145,
            Height = 32,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 14, 0, 0)
        };
        cancel.Click += (_, _) => RequestCancellation();
        stack.Children.Add(cancel);
        Content = stack;
        Closing += (_, args) =>
        {
            if (finished) return;
            args.Cancel = true;
            RequestCancellation();
        };
    }

    private void RequestCancellation()
    {
        if (!cancel.IsEnabled) return;
        cancel.IsEnabled = false;
        status.Text = "Cancelando download…";
        CancelRequested?.Invoke(this, EventArgs.Empty);
    }

    internal void Report(DownloadState state)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => Report(state));
            return;
        }
        if (finished) return;
        double mb = state.BytesRead / (1024d * 1024d);
        if (state.TotalBytes is > 0)
        {
            progress.IsIndeterminate = false;
            progress.Value = state.BytesRead * 100d / state.TotalBytes.Value;
            status.Text = $"{mb:F1} de {state.TotalBytes.Value / (1024d * 1024d):F1} MB ({progress.Value:F0}%)";
        }
        else
        {
            status.Text = $"{mb:F1} MB recebidos";
        }
    }

    internal void Finish()
    {
        finished = true;
        Close();
    }
}
