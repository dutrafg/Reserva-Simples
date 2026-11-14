using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow
{
    private sealed record RecurringBill(long Id, int Day, string Note, string Category, long Cents)
    {
        public string Label => $"Dia {Day:00} · {Note} · {Category} · {Money(Cents)}";
    }

    private static void EnsureRecurring(SqliteConnection db)
    {
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS recurring_bills (
                id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER UNIQUE,
                day INTEGER NOT NULL, note TEXT NOT NULL, category TEXT NOT NULL, cents INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS recurring_posts (
                bill_id INTEGER NOT NULL, month TEXT NOT NULL, PRIMARY KEY(bill_id,month));
            """;
        cmd.ExecuteNonQuery();
    }

    private void AddRecurring(object sender, RoutedEventArgs e)
    {
        if (Entries.SelectedItem is not EntryRow row || row.Kind != "Despesa")
        {
            StatusText.Text = "Selecione uma despesa para criar a conta recorrente.";
            return;
        }
        try
        {
            using var db = Open();
            EnsureRecurring(db);
            using var tx = db.BeginTransaction();
            using var cmd = db.CreateCommand();
            cmd.Transaction = tx;
            var day = DateTime.ParseExact(row.Date, "dd/MM/yyyy", Br);
            cmd.CommandText = """
                INSERT INTO recurring_bills(source_id,day,note,category,cents) VALUES($id,$day,$note,$category,$cents)
                ON CONFLICT(source_id) DO NOTHING
                """;
            cmd.Parameters.AddWithValue("$id", row.Id);
            cmd.Parameters.AddWithValue("$day", day.Day);
            cmd.Parameters.AddWithValue("$note", row.Note);
            cmd.Parameters.AddWithValue("$category", row.Category);
            cmd.Parameters.AddWithValue("$cents", row.Cents);
            var added = cmd.ExecuteNonQuery() == 1;
            if (added)
            {
                cmd.Parameters.Clear();
                cmd.CommandText = "INSERT INTO recurring_posts VALUES(last_insert_rowid(),$month)";
                cmd.Parameters.AddWithValue("$month", day.ToString("yyyy-MM", CultureInfo.InvariantCulture));
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
            StatusText.Text = added ? "Conta recorrente criada. O mês da despesa original já está registrado." : "Esta despesa já é recorrente.";
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao criar conta recorrente: {ex.Message}"; }
    }

    private void ManageRecurring(object sender, RoutedEventArgs e)
    {
        try
        {
            using var db = Open();
            EnsureRecurring(db);
            var bills = new List<RecurringBill>();
            using (var cmd = db.CreateCommand())
            {
                cmd.CommandText = "SELECT id,day,note,category,cents FROM recurring_bills ORDER BY day,note";
                using var rows = cmd.ExecuteReader();
                while (rows.Read()) bills.Add(new(rows.GetInt64(0), rows.GetInt32(1), rows.GetString(2), rows.GetString(3), rows.GetInt64(4)));
            }
            var month = selectedMonth;
            var dialog = new Window { Owner = this, Title = "Contas recorrentes", Width = 550, Height = 350,
                WindowStartupLocation = WindowStartupLocation.CenterOwner };
            var panel = new DockPanel { Margin = new Thickness(16) };
            var actions = new WrapPanel { Margin = new Thickness(0, 12, 0, 0) };
            DockPanel.SetDock(actions, Dock.Bottom);
            panel.Children.Add(actions);
            var list = new ListBox { ItemsSource = bills, DisplayMemberPath = "Label" };
            panel.Children.Add(list);
            var post = new Button { Content = $"Lançar em {month.ToString("MMMM/yyyy", Br)}", Padding = new Thickness(9, 5, 9, 5) };
            post.Click += (_, _) =>
            {
                if (list.SelectedItem is not RecurringBill bill) return;
                try
                {
                    var added = PostRecurring(db, bill, month);
                    dialog.Close();
                    Refresh();
                    StatusText.Text = added ? "Despesa recorrente lançada." : "Esta conta já foi lançada neste mês.";
                }
                catch (Exception ex) { MessageBox.Show(dialog.IsVisible ? dialog : this, ex.Message, "Contas recorrentes"); }
            };
            actions.Children.Add(post);
            var remove = new Button { Content = "Desativar recorrência", Margin = new Thickness(8, 0, 0, 0) };
            remove.Click += (_, _) =>
            {
                if (list.SelectedItem is not RecurringBill bill ||
                    MessageBox.Show(dialog, "Desativar esta recorrência? Os lançamentos já feitos serão mantidos.", "Contas recorrentes",
                        MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No) != MessageBoxResult.Yes) return;
                try
                {
                    using var cmd = db.CreateCommand();
                    cmd.CommandText = "DELETE FROM recurring_bills WHERE id=$id";
                    cmd.Parameters.AddWithValue("$id", bill.Id);
                    cmd.ExecuteNonQuery();
                    bills.Remove(bill);
                    list.Items.Refresh();
                }
                catch (Exception ex) { MessageBox.Show(dialog, ex.Message, "Contas recorrentes"); }
            };
            actions.Children.Add(remove);
            actions.Children.Add(new Button { Content = "Fechar", IsCancel = true, Margin = new Thickness(8, 0, 0, 0) });
            dialog.Content = panel;
            dialog.ShowDialog();
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao abrir contas recorrentes: {ex.Message}"; }
    }

    private static bool PostRecurring(SqliteConnection db, RecurringBill bill, DateTime month)
    {
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "INSERT INTO recurring_posts VALUES($id,$month) ON CONFLICT DO NOTHING";
        cmd.Parameters.AddWithValue("$id", bill.Id);
        cmd.Parameters.AddWithValue("$month", month.ToString("yyyy-MM", CultureInfo.InvariantCulture));
        if (cmd.ExecuteNonQuery() == 0) return false;
        var day = Math.Min(bill.Day, DateTime.DaysInMonth(month.Year, month.Month));
        cmd.Parameters.Clear();
        cmd.CommandText = "INSERT INTO entries(day,kind,note,category,cents) VALUES($day,'expense',$note,$category,$cents)";
        cmd.Parameters.AddWithValue("$day", new DateTime(month.Year, month.Month, day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("$note", bill.Note);
        cmd.Parameters.AddWithValue("$category", bill.Category);
        cmd.Parameters.AddWithValue("$cents", bill.Cents);
        cmd.ExecuteNonQuery();
        tx.Commit();
        return true;
    }
}
