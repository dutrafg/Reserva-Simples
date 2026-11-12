using System.Globalization;
using System.IO;
using System.Windows;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow : Window
{
    private static readonly CultureInfo Br = CultureInfo.GetCultureInfo("pt-BR");
    private readonly string databasePath = Environment.GetCommandLineArgs().Contains("--phase1-smoke")
        ? Path.Combine(Path.GetTempPath(), "ReservaSimples-QA-" + Guid.NewGuid().ToString("N"), "reserva.db")
        : Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ReservaSimples", "reserva.db");

    public MainWindow()
    {
        InitializeComponent();
        if (Environment.GetCommandLineArgs().Contains("--phase1-smoke")) Loaded += RunPhaseOneSmoke;
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

    private long? editingId;

    private void ResetEditor()
    {
        editingId = null;
        SaveEntryButton.Content = "Salvar lançamento";
        EntryNote.Clear();
        EntryAmount.Clear();
        EntryDate.SelectedDate = DateTime.Today;
        EntryKind.SelectedIndex = 0;
    }

    private void CancelEdit(object sender, RoutedEventArgs e) => ResetEditor();

    private void EditEntry(object sender, RoutedEventArgs e)
    {
        if (Entries.SelectedItem is not EntryRow row)
        {
            StatusText.Text = "Selecione um lançamento para editar.";
            return;
        }
        editingId = row.Id;
        EntryDate.SelectedDate = DateTime.ParseExact(row.Date, "dd/MM/yyyy", Br);
        EntryKind.SelectedIndex = row.Kind == "Receita" ? 1 : 0;
        EntryNote.Text = row.Note;
        EntryAmount.Text = (row.Cents / 100m).ToString("F2", Br);
        SaveEntryButton.Content = "Salvar alterações";
        ShowEntries(sender, e);
        EntryNote.Focus();
    }

    private void DeleteEntry(object sender, RoutedEventArgs e)
    {
        if (Entries.SelectedItem is not EntryRow row)
        {
            StatusText.Text = "Selecione um lançamento para excluir.";
            return;
        }
        if (MessageBox.Show(this, $"Excluir o lançamento de {row.Date} no valor de {row.Amount}?",
            "Confirmar exclusão", MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) != MessageBoxResult.Yes) return;
        try
        {
            var removed = RemoveEntry(row.Id);
            if (editingId == row.Id) ResetEditor();
            Refresh();
            StatusText.Text = removed == 1 ? "Lançamento excluído." : "O lançamento já foi removido.";
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao excluir ou atualizar a lista: {ex.Message}"; }
    }

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
            cmd.CommandText = editingId.HasValue
                ? "UPDATE entries SET day=$day,kind=$kind,note=$note,cents=$cents WHERE id=$id"
                : "INSERT INTO entries(day,kind,note,cents) VALUES($day,$kind,$note,$cents)";
            if (editingId is long id) cmd.Parameters.AddWithValue("$id", id);
            cmd.Parameters.AddWithValue("$day", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            cmd.Parameters.AddWithValue("$kind", EntryKind.SelectedIndex == 1 ? "income" : "expense");
            cmd.Parameters.AddWithValue("$note", EntryNote.Text.Trim());
            cmd.Parameters.AddWithValue("$cents", (long)(amount * 100));
            if (cmd.ExecuteNonQuery() != 1) throw new InvalidOperationException("O lançamento não está mais disponível.");
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Falha ao salvar: {ex.Message}";
            return;
        }

        selectedMonth = new DateTime(date.Year, date.Month, 1);
        ResetEditor();
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
            CopyDatabase(temporary, target);
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
        cmd.CommandText = "SELECT day, kind, note, cents, id FROM entries WHERE day LIKE $month ORDER BY day DESC, id DESC";
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
                isIncome ? "Receita" : "Despesa", reader.GetString(2), Money(cents), reader.GetInt64(4), cents));
        }
        Entries.ItemsSource = rows;
        Income.Text = Money(income);
        Expenses.Text = Money(expenses);
        Balance.Text = Money(income - expenses);
    }

    private int RemoveEntry(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM entries WHERE id=$id";
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery();
    }

    private void CopyDatabase(string temporary, string target)
    {
        using (var source = Open())
        using (var copy = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = temporary, Pooling = false }.ToString()))
        {
            copy.Open();
            source.BackupDatabase(copy);
        }
        File.Move(temporary, target);
    }

    private void RunPhaseOneSmoke(object sender, RoutedEventArgs e)
    {
        try
        {
            var args = new RoutedEventArgs();
            EntryKind.SelectedIndex = 1;
            EntryNote.Text = "Receita QA";
            EntryAmount.Text = "100,00";
            SaveEntry(this, args);
            EntryNote.Text = "Despesa QA";
            EntryAmount.Text = "25,50";
            SaveEntry(this, args);
            if (Balance.Text != Money(7450)) throw new InvalidOperationException("Saldo inicial incorreto.");

            Entries.SelectedItem = ((IEnumerable<EntryRow>)Entries.ItemsSource).Single(x => x.Kind == "Despesa");
            EditEntry(this, args);
            EntryAmount.Text = "30,00";
            SaveEntry(this, args);
            if (Balance.Text != Money(7000)) throw new InvalidOperationException("Saldo após edição incorreto.");
            var expense = ((IEnumerable<EntryRow>)Entries.ItemsSource).Single(x => x.Kind == "Despesa");

            var copyPath = Path.Combine(Path.GetDirectoryName(databasePath)!, "backup.db");
            CopyDatabase(copyPath + ".tmp", copyPath);
            if (RemoveEntry(expense.Id) != 1) throw new InvalidOperationException("Exclusão falhou.");
            Refresh();
            if (Balance.Text != Money(10000)) throw new InvalidOperationException("Saldo após exclusão incorreto.");
            using var copy = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = copyPath, Mode = SqliteOpenMode.ReadOnly }.ToString());
            copy.Open();
            using var cmd = copy.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM entries WHERE kind='expense' AND cents=3000";
            if (Convert.ToInt64(cmd.ExecuteScalar()) != 1) throw new InvalidOperationException("Backup não preservou o lançamento.");
            VerifyPwaImport();
            VerifyLocalRestore();
            Application.Current.Shutdown(0);
        }
        catch (Exception ex)
        {
            File.WriteAllText(Path.Combine(Path.GetTempPath(), "ReservaSimples-smoke-error.txt"), ex.ToString());
            Application.Current.Shutdown(1);
        }
    }

    public sealed record EntryRow(string Date, string Kind, string Note, string Amount, long Id, long Cents);
}