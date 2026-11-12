using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow
{
    private static string Text(JsonObject item, string field, string fallback = "") =>
        item[field] is JsonValue value && value.TryGetValue<string>(out var text) ? text : fallback;
    private static long Cents(JsonObject item, string field) =>
        item[field] is JsonValue value && value.TryGetValue<long>(out var number) ? number : 0;
    private static bool Flag(JsonObject item, string field) =>
        item[field] is JsonValue value && value.TryGetValue<bool>(out var flag) && flag;
    private static IEnumerable<JsonObject> Redemptions(JsonObject item) =>
        (item["redemptions"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>();
    private static string Iso(DateTime date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private List<JsonObject> ReadPlanning(string kind)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_schema WHERE type='table' AND name='pwa_portfolio'";
        if (Convert.ToInt64(cmd.ExecuteScalar()) == 0) return [];
        cmd.CommandText = "SELECT payload FROM pwa_portfolio WHERE kind=$kind ORDER BY rowid";
        cmd.Parameters.AddWithValue("$kind", kind);
        using var rows = cmd.ExecuteReader();
        var result = new List<JsonObject>();
        while (rows.Read())
            if (JsonNode.Parse(rows.GetString(0)) is JsonObject item) result.Add(item);
        return result;
    }

    private void SavePlanning(string kind, JsonObject item) =>
        WritePwaEntries([], [new ImportedPortfolio(kind, Text(item, "id"), item.ToJsonString())]);

    private long PortfolioCash(string month)
    {
        bool InMonth(string date) => date.StartsWith(month + "-", StringComparison.Ordinal);
        long cash = 0;
        foreach (var item in ReadPlanning("investments"))
        {
            if (!Flag(item, "existing") && InMonth(Text(item, "date"))) cash -= Cents(item, "cost");
            cash += Redemptions(item).Where(r => InMonth(Text(r, "date"))).Sum(r => Cents(r, "amount"));
            cash -= ((item["nativeDeposits"] as JsonArray)?.OfType<JsonObject>() ?? Enumerable.Empty<JsonObject>())
                .Where(r => InMonth(Text(r, "date"))).Sum(r => Cents(r, "amount"));
        }
        foreach (var movement in ReadPlanning("allocations").Where(x => InMonth(Text(x, "date"))))
        {
            var amount = Cents(movement, "amount");
            cash += amount < 0 && movement["netReceived"] is not null ? Cents(movement, "netReceived") : -amount;
        }
        return cash;
    }

    private static long GoalBalance(string id, IEnumerable<JsonObject> movements, IEnumerable<JsonObject> positions) =>
        movements.Where(x => Text(x, "jarId") == id).Sum(x => Cents(x, "amount")) +
        positions.Where(x => Text(x, "goalId") == id).Sum(x => Cents(x, "balance"));

    private Window PlanningWindow(string title, object content) => new()
    {
        Owner = this, Title = title, Width = 760, Height = 520, MinWidth = 430, MinHeight = 280,
        WindowStartupLocation = WindowStartupLocation.CenterOwner, Content = content
    };

    private static Button PlanningButton(string label, Action action)
    {
        var button = new Button { Content = label, Padding = new Thickness(10, 6, 10, 6), Margin = new Thickness(0, 0, 8, 8) };
        button.Click += (_, _) => action();
        return button;
    }

    private void ShowGoals(object sender, RoutedEventArgs e) => ShowPlanningList(goalsMode: true);
    private void ShowPortfolio(object sender, RoutedEventArgs e) => ShowPlanningList(goalsMode: false);

    private void ShowPlanningList(bool goalsMode)
    {
        var panel = new DockPanel { Margin = new Thickness(18) };
        var actions = new WrapPanel();
        DockPanel.SetDock(actions, Dock.Top);
        panel.Children.Add(actions);
        var list = new ListBox { DisplayMemberPath = "Label" };
        panel.Children.Add(list);
        var dialog = PlanningWindow(goalsMode ? "Metas" : "Investimentos", panel);
        var kind = goalsMode ? "jars" : "investments";
        void RefreshList()
        {
            var items = ReadPlanning(kind);
            var positions = goalsMode ? ReadPlanning("investments") : items;
            var movements = goalsMode ? ReadPlanning("allocations") : new List<JsonObject>();
            var goalNames = goalsMode ? new Dictionary<string, string>() : ReadPlanning("jars").ToDictionary(x => Text(x,"id"), x => Text(x,"name"));
            list.ItemsSource = items.Select(item =>
            {
                var name = Text(item, "name", goalsMode ? "Meta importada" : "Aplicação importada");
                var label = goalsMode
                    ? $"{name} · {Money(GoalBalance(Text(item, "id"), movements, positions))} de {Money(Cents(item, "target"))} · {Text(item, "dueDate", "Sem prazo")}"
                    : $"{name} · {Text(item, "institution")} · {Money(Cents(item, "balance"))} líquidos" +
                      (goalNames.TryGetValue(Text(item, "goalId"), out var goal) ? $" · Meta: {goal}" : "");
                return new PlanningRow(item, label);
            }).ToList();
        }
        void Guard(Action action)
        {
            try { action(); RefreshList(); Refresh(); }
            catch (Exception ex) { MessageBox.Show(dialog, ex.Message, dialog.Title); }
        }
        actions.Children.Add(PlanningButton(goalsMode ? "Nova meta" : "Nova aplicação", () => Guard(() => EditPlanning(dialog, goalsMode, null))));
        actions.Children.Add(PlanningButton("Editar", () => Guard(() =>
        {
            if (list.SelectedItem is PlanningRow row) EditPlanning(dialog, goalsMode, row.Item);
        })));
        actions.Children.Add(PlanningButton("Aportar", () => Guard(() =>
        {
            if (list.SelectedItem is PlanningRow row) MovePlanningMoney(dialog, goalsMode, row.Item, false);
        })));
        actions.Children.Add(PlanningButton("Resgatar", () => Guard(() =>
        {
            if (list.SelectedItem is PlanningRow row) MovePlanningMoney(dialog, goalsMode, row.Item, true);
        })));
        try { RefreshList(); dialog.ShowDialog(); }
        catch (Exception ex) { StatusText.Text = $"Falha ao abrir {dialog.Title}: {ex.Message}"; }
    }

    private sealed record PlanningRow(JsonObject Item, string Label);

    private static TextBox AddField(Panel panel, string label, string initial, int maxLength = 80)
    {
        panel.Children.Add(new TextBlock { Text = label });
        var box = new TextBox { Text = initial, MaxLength = maxLength, Margin = new Thickness(0, 3, 0, 10) };
        panel.Children.Add(box);
        return box;
    }

    private static long ParseCents(string input, bool allowZero = false)
    {
        if (!decimal.TryParse(input, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingWhite | NumberStyles.AllowTrailingWhite, Br, out var amount)
            || amount < 0 || (!allowZero && amount == 0) || amount > 100000000 || decimal.Round(amount, 2) != amount)
            throw new InvalidDataException("Informe um valor válido em reais, com até duas casas decimais.");
        return (long)(amount * 100);
    }

    private static string EditMoney(long cents) => (cents / 100m).ToString("F2", Br);

    private Window EditorWindow(Window owner, string title, Panel fields, Action save)
    {
        var dialog = PlanningWindow(title, new ScrollViewer { Content = fields, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
        dialog.Owner = owner;
        dialog.Width = 480;
        var button = PlanningButton("Salvar", () =>
        {
            try { save(); dialog.DialogResult = true; }
            catch (Exception ex) { MessageBox.Show(dialog, ex.Message, title); }
        });
        button.IsDefault = true;
        var actions = new WrapPanel();
        actions.Children.Add(button);
        actions.Children.Add(new Button { Content = "Cancelar", IsCancel = true, Padding = new Thickness(10, 6, 10, 6) });
        fields.Children.Add(actions);
        return dialog;
    }

    private void EditPlanning(Window owner, bool goal, JsonObject? current)
    {
        var fields = new StackPanel { Margin = new Thickness(18) };
        var item = current?.DeepClone().AsObject() ?? new JsonObject { ["id"] = Guid.NewGuid().ToString("N") };
        var name = AddField(fields, "Nome", Text(item, "name"));
        TextBox? amount = null, institution = null, product = null, balance = null;
        DatePicker? date = null;
        CheckBox? existing = null;
        ComboBox? link = null;
        if (goal)
        {
            amount = AddField(fields, "Objetivo (R$)", EditMoney(Cents(item, "target")));
            fields.Children.Add(new TextBlock { Text = "Prazo" });
            date = new DatePicker { SelectedDate = ParseDay(Text(item, "dueDate")) ?? DateTime.Today.AddMonths(12) };
            fields.Children.Add(date);
        }
        else
        {
            institution = AddField(fields, "Instituição", Text(item, "institution"));
            product = AddField(fields, "Tipo de aplicação", Text(item, "product"));
            if (current is null)
            {
                amount = AddField(fields, "Valor aplicado (R$)", "");
                fields.Children.Add(new TextBlock { Text = "Data da aplicação" });
                date = new DatePicker { SelectedDate = DateTime.Today };
                fields.Children.Add(date);
                existing = new CheckBox { Content = "Aplicação já existente (sem débito no saldo)", Margin = new Thickness(0, 8, 0, 8) };
                fields.Children.Add(existing);
            }
            balance = AddField(fields, "Saldo líquido atual (R$)", current is null ? "" : EditMoney(Cents(item, "balance")));
            fields.Children.Add(new TextBlock { Text = "Vincular a uma meta (opcional)" });
            var choices = new List<GoalChoice> { new("", "Sem vínculo") };
            choices.AddRange(ReadPlanning("jars").Where(x => !Flag(x, "archived") || Text(x, "id") == Text(item, "goalId"))
                .Select(x => new GoalChoice(Text(x, "id"), Text(x, "name", "Meta importada"))));
            link = new ComboBox { ItemsSource = choices, DisplayMemberPath = "Name", SelectedValuePath = "Id",
                SelectedValue = Text(item, "goalId"), Margin = new Thickness(0, 4, 0, 12) };
            fields.Children.Add(link);
        }
        EditorWindow(owner, goal ? "Editar meta" : "Editar aplicação", fields, () =>
        {
            if (string.IsNullOrWhiteSpace(name.Text)) throw new InvalidDataException("Informe o nome.");
            item["name"] = name.Text.Trim();
            if (goal)
            {
                item["target"] = ParseCents(amount!.Text);
                item["dueDate"] = Iso(date!.SelectedDate ?? throw new InvalidDataException("Selecione um prazo."));
            }
            else
            {
                if (string.IsNullOrWhiteSpace(institution!.Text) || string.IsNullOrWhiteSpace(product!.Text))
                    throw new InvalidDataException("Informe a instituição e o tipo de aplicação.");
                item["institution"] = institution.Text.Trim();
                item["product"] = product!.Text.Trim();
                if (current is null)
                {
                    var day = date!.SelectedDate ?? throw new InvalidDataException("Selecione a data da aplicação.");
                    if (day > DateTime.Today) throw new InvalidDataException("A data não pode estar no futuro.");
                    item["date"] = Iso(day);
                    item["cost"] = ParseCents(amount!.Text);
                    item["existing"] = existing!.IsChecked == true;
                }
                item["balance"] = ParseCents(balance!.Text, true);
                item["checked"] = Iso(DateTime.Today);
                item["goalId"] = (link!.SelectedValue as string) is { Length: > 0 } goalId ? goalId : null;
            }
            SavePlanning(goal ? "jars" : "investments", item);
        }).ShowDialog();
    }

    private sealed record GoalChoice(string Id, string Name);

    private void MovePlanningMoney(Window owner, bool goal, JsonObject item, bool redeem)
    {
        var fields = new StackPanel { Margin = new Thickness(18) };
        var amount = AddField(fields, redeem ? "Valor líquido recebido (R$)" : "Valor do aporte (R$)", "");
        fields.Children.Add(new TextBlock { Text = "Data" });
        var date = new DatePicker { SelectedDate = DateTime.Today };
        fields.Children.Add(date);
        EditorWindow(owner, redeem ? "Registrar resgate" : "Registrar aporte", fields, () =>
        {
            var cents = ParseCents(amount.Text);
            var day = date.SelectedDate ?? throw new InvalidDataException("Selecione a data.");
            if (day > DateTime.Today) throw new InvalidDataException("A data não pode estar no futuro.");
            RecordPlanningMovement(goal, item, redeem, cents, Iso(day));
        }).ShowDialog();
    }

    private void RecordPlanningMovement(bool goal, JsonObject item, bool redeem, long cents, string day)
    {
        if (goal)
        {
            var id = Text(item, "id");
            var available = ReadPlanning("allocations").Where(x => Text(x, "jarId") == id &&
                string.CompareOrdinal(Text(x, "date"), day) <= 0).Sum(x => Cents(x, "amount"));
            if (redeem && cents > available) throw new InvalidDataException("Resgate maior que o saldo do cofrinho na data.");
            var movement = new JsonObject { ["id"] = Guid.NewGuid().ToString("N"), ["jarId"] = id,
                ["date"] = day, ["amount"] = redeem ? -cents : cents };
            if (redeem) movement["netReceived"] = cents;
            SavePlanning("allocations", movement);
            return;
        }
        if (string.CompareOrdinal(day, Text(item, "checked", Text(item, "date"))) < 0)
            throw new InvalidDataException("Use uma data a partir da última conferência do saldo.");
        var updated = item.DeepClone().AsObject();
        var balance = Cents(updated, "balance");
        if (redeem && cents > balance) throw new InvalidDataException("Resgate maior que o saldo líquido.");
        updated["balance"] = redeem ? balance - cents : balance + cents;
        updated["checked"] = day;
        var movements = updated[redeem ? "redemptions" : "nativeDeposits"] as JsonArray;
        if (movements is null)
        {
            movements = new JsonArray();
            updated[redeem ? "redemptions" : "nativeDeposits"] = movements;
        }
        movements.Add(new JsonObject { ["date"] = day, ["amount"] = cents });
        SavePlanning("investments", updated);
    }

    private static DateTime? ParseDay(string value) =>
        DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;

    private void ShowInsights(object sender, RoutedEventArgs e)
    {
        try
        {
            Refresh();
            var rows = ((IEnumerable<EntryRow>)Entries.ItemsSource).ToList();
            var period = selectedMonth.ToString("MMMM yyyy", Br);
            var document = new FlowDocument { FontFamily = new FontFamily("Segoe UI"), FontSize = 13, PagePadding = new Thickness(36), ColumnWidth = 900 };
            void Line(string text, bool title = false) => document.Blocks.Add(new Paragraph(new Run(text))
                { FontSize = title ? 20 : 13, FontWeight = title ? FontWeights.Bold : FontWeights.Normal, Foreground = title ? Brushes.MidnightBlue : Brushes.Black });
            Line("Reserva Simples · " + period, true);
            Line($"Receitas: {Income.Text}   Despesas: {Expenses.Text}   Disponível: {Balance.Text}");
            Line("Despesas por categoria", true);
            foreach (var group in rows.Where(x => x.Kind == "Despesa").GroupBy(x => x.Category).OrderByDescending(g => g.Sum(x => x.Cents)))
                Line($"{group.Key}: {Money(group.Sum(x => x.Cents))}");
            var portfolio = ReadPlanning("investments");
            var moves = ReadPlanning("allocations");
            Line("Posição atual da carteira", true);
            foreach (var item in portfolio) Line($"{Text(item, "name", "Aplicação")} · {Text(item, "institution")} · {Money(Cents(item, "balance"))}");
            Line("Progresso atual das metas", true);
            foreach (var goal in ReadPlanning("jars").Where(x => !Flag(x, "archived")))
                Line($"{Text(goal, "name", "Meta")} · {Money(GoalBalance(Text(goal, "id"), moves, portfolio))} de {Money(Cents(goal, "target"))}");
            Line("Lançamentos do mês", true);
            foreach (var row in rows) Line($"{row.Date} · {row.Kind} · {row.Category} · {row.Note} · {row.Amount}");
            var panel = new DockPanel { Margin = new Thickness(16) };
            var print = PlanningButton("Imprimir / Salvar em PDF", () =>
            {
                try
                {
                    var dialog = new PrintDialog();
                    if (dialog.ShowDialog() == true)
                    {
                        document.PageWidth = dialog.PrintableAreaWidth;
                        document.PageHeight = dialog.PrintableAreaHeight;
                        dialog.PrintDocument(((IDocumentPaginatorSource)document).DocumentPaginator, $"Reserva Simples - {period}");
                    }
                }
                catch (Exception ex) { StatusText.Text = $"Falha ao imprimir: {ex.Message}"; }
            });
            DockPanel.SetDock(print, Dock.Top);
            panel.Children.Add(print);
            panel.Children.Add(new FlowDocumentScrollViewer { Document = document, IsToolBarVisible = false, VerticalScrollBarVisibility = ScrollBarVisibility.Auto });
            PlanningWindow("Insights e relatório mensal", panel).ShowDialog();
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao montar o relatório: {ex.Message}"; }
    }

    private void VerifyPlanningFlows()
    {
        const string day = "2026-12-12", month = "2026-12";
        var goal = new JsonObject { ["id"] = "qa-goal", ["target"] = 10000 };
        SavePlanning("jars", goal);
        var investment = new JsonObject { ["id"] = "qa-position", ["goalId"] = "qa-goal", ["date"] = day,
            ["checked"] = day, ["balance"] = 6000L, ["cost"] = 6000L, ["existing"] = true };
        SavePlanning("investments", investment);
        RecordPlanningMovement(true, goal, false, 1000, day);
        RecordPlanningMovement(false, investment, false, 800, day);
        investment = ReadPlanning("investments").Single(x => Text(x, "id") == "qa-position");
        RecordPlanningMovement(false, investment, true, 400, day);
        if (GoalBalance("qa-goal", ReadPlanning("allocations"), ReadPlanning("investments")) != 7400 ||
            PortfolioCash(month) != -1400)
            throw new InvalidOperationException("Meta vinculada ou saldo financeiro incorreto.");
    }
}
