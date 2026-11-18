using System.Globalization;
using System.Windows;
using System.Windows.Media;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow
{
    private static void EnsureBudgetSettings(SqliteConnection db)
    {
        using var cmd = db.CreateCommand();
        cmd.CommandText = "CREATE TABLE IF NOT EXISTS budget_settings (id INTEGER PRIMARY KEY CHECK(id=1), cents INTEGER NOT NULL CHECK(cents>0))";
        cmd.ExecuteNonQuery();
    }

    private long? ReadGroceryLimit()
    {
        using var db = Open();
        EnsureBudgetSettings(db);
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT cents FROM budget_settings WHERE id=1";
        return cmd.ExecuteScalar() is long cents ? cents : null;
    }

    private void WriteGroceryLimit(long? cents)
    {
        using var db = Open();
        EnsureBudgetSettings(db);
        using var cmd = db.CreateCommand();
        cmd.CommandText = cents.HasValue
            ? "INSERT INTO budget_settings(id,cents) VALUES(1,$cents) ON CONFLICT(id) DO UPDATE SET cents=excluded.cents"
            : "DELETE FROM budget_settings WHERE id=1";
        if (cents.HasValue) cmd.Parameters.AddWithValue("$cents", cents.Value);
        cmd.ExecuteNonQuery();
    }

    private static int GroceryMilestone(long spent, long? limit)
    {
        if (limit is not > 0) return 0;
        var percent = spent * 100m / limit.Value;
        return percent >= 100 ? 100 : percent >= 75 ? 75 : percent >= 50 ? 50 : percent >= 25 ? 25 : 0;
    }

    private void RefreshGroceryBudget(IEnumerable<EntryRow> rows)
    {
        var spent = rows.Where(x => x.Kind == "Despesa" && x.Category.Trim().Equals("Mercado", StringComparison.OrdinalIgnoreCase)).Sum(x => x.Cents);
        var limit = ReadGroceryLimit();
        var milestone = GroceryMilestone(spent, limit);
        GroceryLimit.Text = limit.HasValue ? (limit.Value / 100m).ToString("F2", Br) : "";
        GroceryStatus.Foreground = milestone >= 75 ? Brushes.Firebrick : Brushes.DarkSlateGray;
        GroceryStatus.Text = !limit.HasValue ? $"{Money(spent)} gastos no mês · Sem cota definida"
            : $"{Money(spent)} gastos de {Money(limit.Value)} · " +
                (spent > limit.Value ? $"Cota ultrapassada em {Money(spent - limit.Value)}"
                    : milestone > 0 ? $"Marco de {milestone}% atingido" : "Abaixo de 25% da cota");
    }

    private void SaveGroceryLimit(object sender, RoutedEventArgs e)
    {
        if (!decimal.TryParse(GroceryLimit.Text, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingWhite | NumberStyles.AllowTrailingWhite, Br, out var amount)
            || amount <= 0 || amount > 100000000 || decimal.Round(amount, 2) != amount)
        {
            StatusText.Text = "Informe uma cota positiva com até duas casas decimais.";
            return;
        }
        ChangeGroceryLimit((long)(amount * 100));
    }

    private void ClearGroceryLimit(object sender, RoutedEventArgs e) => ChangeGroceryLimit(null);

    private void ChangeGroceryLimit(long? cents)
    {
        try
        {
            WriteGroceryLimit(cents);
            Refresh();
            StatusText.Text = cents.HasValue ? "Cota mensal salva." : "Cota removida.";
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao atualizar a cota: {ex.Message}"; }
    }

    private void VerifyGroceryBudget()
    {
        if (ReadGroceryLimit() is not null) throw new InvalidOperationException("A cota deve começar sem limite.");
        WriteGroceryLimit(70000);
        if (ReadGroceryLimit() != 70000 || GroceryMilestone(17500, 70000) != 25 ||
            GroceryMilestone(35000, 70000) != 50 || GroceryMilestone(52500, 70000) != 75 ||
            GroceryMilestone(70000, 70000) != 100)
            throw new InvalidOperationException("Limite ou marcos da cota incorretos.");
        WriteGroceryLimit(null);
        if (ReadGroceryLimit() is not null) throw new InvalidOperationException("A cota não foi removida.");
    }
}
