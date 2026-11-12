using System.Globalization;
using System.IO;
using System.Windows;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow : Window
{
    private static readonly CultureInfo Br = CultureInfo.GetCultureInfo("pt-BR");
    private readonly string databasePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ReservaSimples", "reserva.db");

    public MainWindow()
    {
        InitializeComponent();
        EntryDate.SelectedDate = DateTime.Today;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
            using var db = Open();
            using var cmd = db.CreateCommand();
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS entries (
                    id INTEGER PRIMARY KEY,
                    day TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
                    note TEXT NOT NULL,
                    cents INTEGER NOT NULL CHECK(cents > 0)
                );
                CREATE INDEX IF NOT EXISTS entries_by_day ON entries(day);
                """;
            cmd.ExecuteNonQuery();
            Refresh();
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Falha ao abrir o banco local: {ex.Message}";
        }
    }

    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        return db;
    }

    private void ShowToday(object sender, RoutedEventArgs e)
    {
        PageTitle.Text = "Hoje";
        EntryEditor.Visibility = Visibility.Collapsed;
    }

    private void ShowEntries(object sender, RoutedEventArgs e)
    {
        PageTitle.Text = "Lançamentos";
        EntryEditor.Visibility = Visibility.Visible;
    }

    private static string Money(long cents) => (cents / 100m).ToString("C2", Br);

    private void SaveEntry(object sender, RoutedEventArgs e)
    {
        if (EntryDate.SelectedDate is not DateTime date ||
            !decimal.TryParse(EntryAmount.Text, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingWhite | NumberStyles.AllowTrailingWhite, Br, out var amount) ||
            amount <= 0 || amount > 100000000 || decimal.Round(amount, 2) != amount ||
            string.IsNullOrWhiteSpace(EntryNote.Text))
        {
            StatusText.Text = "Informe uma data, uma descrição e um valor positivo com até duas casas decimais.";
            return;
        }

        try
        {
            using var db = Open();
            using var cmd = db.CreateCommand();
            cmd.CommandText = "INSERT INTO entries(day,kind,note,cents) VALUES($day,$kind,$note,$cents)";
            cmd.Parameters.AddWithValue("$day", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            cmd.Parameters.AddWithValue("$kind", EntryKind.SelectedIndex == 1 ? "income" : "expense");
            cmd.Parameters.AddWithValue("$note", EntryNote.Text.Trim());
            cmd.Parameters.AddWithValue("$cents", (long)(amount * 100));
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Falha ao salvar: {ex.Message}";
            return;
        }

        EntryNote.Clear();
        EntryAmount.Clear();
        StatusText.Text = "Lançamento salvo.";
        try { Refresh(); }
        catch (Exception ex) { StatusText.Text = $"Lançamento salvo. Falha ao atualizar a lista: {ex.Message}"; }
    }

    private DateTime selectedMonth = new(DateTime.Today.Year, DateTime.Today.Month, 1);

    private void PreviousMonth(object sender, RoutedEventArgs e) => ChangeMonth(-1);
    private void NextMonth(object sender, RoutedEventArgs e) => ChangeMonth(1);
    private void CurrentMonth(object sender, RoutedEventArgs e)
    {
        selectedMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        RefreshSelectedMonth();
    }

    private void ChangeMonth(int offset)
    {
        selectedMonth = selectedMonth.AddMonths(offset);
        RefreshSelectedMonth();
    }

    private void RefreshSelectedMonth()
    {
        try { Refresh(); StatusText.Text = ""; }
        catch (Exception ex) { StatusText.Text = $"Falha ao consultar o mês: {ex.Message}"; }
    }

    private void BackupDatabase(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.SaveFileDialog
        {
            FileName = $"ReservaSimples-backup-{DateTime.Now:yyyyMMdd-HHmmss}.db",
            Filter = "Banco SQLite (*.db)|*.db",
            OverwritePrompt = true
        };
        if (dialog.ShowDialog(this) != true) return;
        var target = Path.GetFullPath(dialog.FileName);
        if (File.Exists(target))
        {
            StatusText.Text = "Escolha um nome novo para preservar o arquivo que já existe.";
            return;
        }
        var temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var source = Open())
            using (var copy = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = temporary, Pooling = false }.ToString()))
            {
                copy.Open();
                source.BackupDatabase(copy);
            }
            File.Move(temporary, target);
            StatusText.Text = "Backup criado. O arquivo ainda não é criptografado.";
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Falha ao criar o backup: {ex.Message}";
            try { File.Delete(temporary); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }

    private void Refresh()
    {
        var month = selectedMonth.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        MonthLabel.Text = $"{selectedMonth.ToString("MMMM yyyy", Br)}";
        var rows = new List<EntryRow>();
        long income = 0, expenses = 0;
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT day, kind, note, cents FROM entries WHERE day LIKE $month ORDER BY day DESC, id DESC";
        cmd.Parameters.AddWithValue("$month", month + "-%");
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var day = reader.GetString(0);
            var isIncome = reader.GetString(1) == "income";
            var cents = reader.GetInt64(3);
            if (day.StartsWith(month, StringComparison.Ordinal))
            {
                if (isIncome) income += cents;
                else expenses += cents;
            }
            rows.Add(new EntryRow(DateTime.ParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture).ToString("dd/MM/yyyy", Br),
                isIncome ? "Receita" : "Despesa", reader.GetString(2), Money(cents)));
        }
        Entries.ItemsSource = rows;
        Income.Text = Money(income);
        Expenses.Text = Money(expenses);
        Balance.Text = Money(income - expenses);
    }

    public sealed record EntryRow(string Date, string Kind, string Note, string Amount);
}