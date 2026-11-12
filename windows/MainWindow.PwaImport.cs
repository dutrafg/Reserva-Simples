using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Data.Sqlite;
using Microsoft.Win32;

namespace ReservaSimples;

public partial class MainWindow
{
    private async void ImportPwa(object sender, RoutedEventArgs e)
    {
        var button = (Button)sender;
        var picker = new OpenFileDialog { Filter = "Backup JSON (*.json)|*.json" };
        if (picker.ShowDialog(this) != true) return;
        button.IsEnabled = false;
        try
        {
            await using var stream = File.OpenRead(picker.FileName);
            if (stream.Length > 32 * 1024 * 1024) throw new InvalidDataException("Arquivo acima de 32 MB.");
            using var outer = await JsonDocument.ParseAsync(stream);
            var root = outer.RootElement;
            JsonDocument? decrypted = null;
            try
            {
                if (root.TryGetProperty("format", out var format) && format.GetString() == "reserva-vault-1")
                {
                    var password = AskBackupPassword();
                    if (password is null) return;
                    var envelope = root;
                    decrypted = await Task.Run(() => DecryptPwa(envelope, password));
                    root = decrypted.RootElement;
                }
                var entries = ReadPwaEntries(root);
                var portfolio = ReadPwaPortfolio(root);
                if (entries.Count == 0 && portfolio.Count == 0) { StatusText.Text = "O backup está vazio."; return; }
                var answer = MessageBox.Show(this,
                    $"Importar {entries.Count} lançamentos e {portfolio.Count} itens de metas e carteira? O banco Windows é cifrado e vinculado a este usuário do Windows.",
                    "Importar lançamentos", MessageBoxButton.YesNo, MessageBoxImage.Question, MessageBoxResult.No);
                if (answer != MessageBoxResult.Yes) return;
                var snapshot = CreateRecoverySnapshot("antes-de-importar");
                var count = WritePwaEntries(entries, portfolio);
                if (entries.Count > 0)
                {
                var latest = DateTime.ParseExact(entries.Max(x => x.Day)!, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                selectedMonth = new DateTime(latest.Year, latest.Month, 1);
                }
                Refresh();
                StatusText.Text = $"Importados ou atualizados: {count}. Cópia anterior: {snapshot}";
            }
            finally { decrypted?.Dispose(); }
        }
        catch (CryptographicException) { StatusText.Text = "Senha incorreta ou backup cifrado inválido."; }
        catch (Exception ex) { StatusText.Text = $"Falha na importação: {ex.Message}"; }
        finally { button.IsEnabled = true; }
    }

    private string? AskBackupPassword()
    {
        var password = new PasswordBox { Margin = new Thickness(0, 8, 0, 12) };
        var dialog = new Window { Owner = this, Title = "Senha do backup", Width = 370,
            SizeToContent = SizeToContent.Height, WindowStartupLocation = WindowStartupLocation.CenterOwner,
            ResizeMode = ResizeMode.NoResize };
        var panel = new StackPanel { Margin = new Thickness(16) };
        panel.Children.Add(new TextBlock { Text = "Informe a senha usada ao criar o backup." });
        panel.Children.Add(password);
        var actions = new WrapPanel();
        var open = new Button { Content = "Abrir backup", IsDefault = true, Padding = new Thickness(10, 5, 10, 5) };
        open.Click += (_, _) => dialog.DialogResult = true;
        actions.Children.Add(open);
        actions.Children.Add(new Button { Content = "Cancelar", IsCancel = true, Margin = new Thickness(8, 0, 0, 0) });
        panel.Children.Add(actions);
        dialog.Content = panel;
        dialog.Loaded += (_, _) => password.Focus();
        return dialog.ShowDialog() == true ? password.Password : null;
    }

    private static JsonDocument DecryptPwa(JsonElement envelope, string password)
    {
        var salt = envelope.GetProperty("salt").GetBytesFromBase64();
        var nonce = envelope.GetProperty("iv").GetBytesFromBase64();
        var payload = envelope.GetProperty("data").GetBytesFromBase64();
        if (salt.Length != 16 || nonce.Length != 12 || payload.Length <= 16) throw new CryptographicException();
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 600000, HashAlgorithmName.SHA256, 32);
        var plain = new byte[payload.Length - 16];
        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, payload.AsSpan(0, plain.Length), payload.AsSpan(plain.Length), plain);
            using var source = new MemoryStream(plain, writable: false);
            return JsonDocument.Parse(source);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            CryptographicOperations.ZeroMemory(plain);
        }
    }

    private sealed record ImportedEntry(string Id, string Day, string Kind, string Note, long Cents, string Category);

    private static List<ImportedEntry> ReadPwaEntries(JsonElement root)
    {
        if (!root.TryGetProperty("records", out var records) || records.ValueKind != JsonValueKind.Array ||
            records.GetArrayLength() > 50000) throw new InvalidDataException("Estrutura de backup incompatível.");
        var result = new List<ImportedEntry>();
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in records.EnumerateArray())
        {
            var id = row.GetProperty("id").GetString();
            var day = row.GetProperty("date").GetString();
            var kind = row.GetProperty("kind").GetString();
            var cents = row.GetProperty("amount").GetInt64();
            if (string.IsNullOrWhiteSpace(id) || id.Length > 120 || !ids.Add(id) ||
                !DateOnly.TryParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ||
                kind is not ("income" or "expense") || cents is <= 0 or > 10000000000L)
                throw new InvalidDataException("O backup contém um lançamento inválido.");
            var note = row.TryGetProperty("note", out var n) ? n.GetString() : null;
            var category = row.TryGetProperty("category", out var c) ? c.GetString() : null;
            result.Add(new(id, day!, kind, string.IsNullOrWhiteSpace(note) ? category ?? "" : note, cents, string.IsNullOrWhiteSpace(category) || category.Length > 80 ? "Outros" : category));
        }
        return result;
    }

    private int WritePwaEntries(List<ImportedEntry> entries, List<ImportedPortfolio>? portfolio = null)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "CREATE TABLE IF NOT EXISTS pwa_imports (source_id TEXT PRIMARY KEY NOT NULL)";
        cmd.ExecuteNonQuery();
        var count = 0;
        foreach (var entry in entries)
        {
            cmd.Parameters.Clear();
            cmd.CommandText = "INSERT INTO pwa_imports(source_id) VALUES ($id) ON CONFLICT(source_id) DO NOTHING";
            cmd.Parameters.AddWithValue("$id", entry.Id);
            if (cmd.ExecuteNonQuery() == 0) continue;
            cmd.Parameters.Clear();
            cmd.CommandText = "INSERT INTO entries(day,kind,note,cents,category) VALUES($day,$kind,$note,$cents,$category)";
            cmd.Parameters.AddWithValue("$day", entry.Day);
            cmd.Parameters.AddWithValue("$kind", entry.Kind);
            cmd.Parameters.AddWithValue("$note", entry.Note);
            cmd.Parameters.AddWithValue("$cents", entry.Cents);
            cmd.Parameters.AddWithValue("$category", entry.Category);
            count += cmd.ExecuteNonQuery();
        }
        count += WritePwaPortfolio(db, tx, portfolio ?? []);
        tx.Commit();
        return count;
    }
    private void VerifyPwaImport()
    {
        const string password = "senha ficticia de homologacao";
        const string fixture = """
            {"records":[{"id":"qa-pwa-1","date":"2026-11-03","kind":"income","amount":12345,"note":"Importado"}]}
            """;
        using var original = JsonDocument.Parse(fixture);
        var rows = ReadPwaEntries(original.RootElement);
        var snapshot = CreateRecoverySnapshot("antes-de-importar");
        if (WritePwaEntries(rows) != 1 || WritePwaEntries(rows) != 0)
            throw new InvalidOperationException("Importação simples duplicou ou perdeu lançamentos.");

        var plaintext = System.Text.Encoding.UTF8.GetBytes(fixture.Replace("qa-pwa-1", "qa-pwa-2"));
        var salt = RandomNumberGenerator.GetBytes(16);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 600000, HashAlgorithmName.SHA256, 32);
        var cipher = new byte[plaintext.Length + 16];
        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Encrypt(nonce, plaintext, cipher.AsSpan(0, plaintext.Length), cipher.AsSpan(plaintext.Length));
        }
        finally { CryptographicOperations.ZeroMemory(key); }

        using var envelope = JsonDocument.Parse(JsonSerializer.Serialize(new { format = "reserva-vault-1", salt, iv = nonce, data = cipher }));
        try
        {
            using var wrong = DecryptPwa(envelope.RootElement, "senha incorreta");
            throw new InvalidOperationException("Senha incorreta foi aceita.");
        }
        catch (CryptographicException) { }

        using var decoded = DecryptPwa(envelope.RootElement, password);
        var decryptedRows = ReadPwaEntries(decoded.RootElement);
        if (WritePwaEntries(decryptedRows) != 1 || WritePwaEntries(decryptedRows) != 0)
            throw new InvalidOperationException("Importação cifrada não preservou os lançamentos.");
        using var preserved = OpenBackupConnection(snapshot);
        preserved.Open();
        using var prior = preserved.CreateCommand();
        prior.CommandText = "SELECT COUNT(*) FROM entries WHERE note='Importado'";
        if (Convert.ToInt64(prior.ExecuteScalar()) != 0) throw new InvalidOperationException("A cópia anterior foi alterada.");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM entries WHERE note='Importado' AND cents=12345 AND day='2026-11-03'";
        if (Convert.ToInt64(cmd.ExecuteScalar()) != 2)
            throw new InvalidOperationException("A base não contém os dois lançamentos importados.");
    }

}
