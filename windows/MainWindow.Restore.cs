using System.Globalization;
using System.IO;
using System.Windows;
using Microsoft.Data.Sqlite;
using Microsoft.Win32;

namespace ReservaSimples;

public partial class MainWindow
{
    private void RestoreDatabase(object sender, RoutedEventArgs e)
    {
        var picker = new OpenFileDialog { Filter = "Backup SQLite (*.db)|*.db", InitialDirectory = BackupDirectory };
        if (picker.ShowDialog(this) != true) return;
        if (MessageBox.Show(this, "Restaurar este backup? Uma cópia do banco atual será guardada antes da troca.",
            "Restaurar banco local", MessageBoxButton.YesNo, MessageBoxImage.Warning,
            MessageBoxResult.No) != MessageBoxResult.Yes) return;
        try
        {
            var snapshot = RestoreLocalBackup(picker.FileName);
            ResetEditor();
            Refresh();
            StatusText.Text = $"Backup restaurado. Cópia anterior: {snapshot}";
        }
        catch (Exception ex) { StatusText.Text = $"Falha ao restaurar ou atualizar a lista: {ex.Message}"; }
    }

    private string RestoreLocalBackup(string path)
    {
        if (string.Equals(Path.GetFullPath(path), Path.GetFullPath(databasePath), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Escolha um arquivo de backup separado do banco atual.");
        using var source = OpenBackupConnection(path);
        source.Open();
        using var cmd = source.CreateCommand();
        cmd.CommandText = "PRAGMA quick_check";
        if (!Equals(cmd.ExecuteScalar(), "ok")) throw new InvalidDataException("Banco de backup corrompido.");
        cmd.CommandText = "SELECT type FROM sqlite_schema WHERE name='entries'";
        if (!Equals(cmd.ExecuteScalar(), "table")) throw new InvalidDataException("Arquivo incompatível com Reserva Simples.");
        cmd.CommandText = "SELECT id,day,kind,note,cents FROM entries";
        using (var rows = cmd.ExecuteReader())
        {
            while (rows.Read())
            {
                if (rows.GetValue(0) is not long || rows.GetValue(1) is not string day ||
                    !DateOnly.TryParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ||
                    rows.GetValue(2) is not ("income" or "expense") || rows.GetValue(3) is not string ||
                    rows.GetValue(4) is not long cents || cents is <= 0 or > 10000000000L)
                    throw new InvalidDataException("O backup contém lançamentos inválidos.");
            }
        }

        var snapshot = CreateRecoverySnapshot("antes-de-restaurar");
        var staged = databasePath + "." + Guid.NewGuid().ToString("N") + ".restore";
        try
        {
            ExportEncryptedDatabase(source, staged, databaseKey!);
            File.Move(staged, databasePath, overwrite: true);
        }
        finally { if (File.Exists(staged)) File.Delete(staged); }
        return snapshot;
    }

    private string BackupDirectory => Path.Combine(Path.GetDirectoryName(databasePath)!, "backups");

    private string CreateRecoverySnapshot(string reason)
    {
        Directory.CreateDirectory(BackupDirectory);
        var snapshot = Path.Combine(BackupDirectory, $"{reason}-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.db");
        var temporary = snapshot + ".tmp";
        try
        {
            CopyDatabase(temporary, snapshot);
            return snapshot;
        }
        catch
        {
            try { File.Delete(temporary); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            throw;
        }
    }

    private void VerifyLocalRestore()
    {
        var previous = Path.Combine(Path.GetDirectoryName(databasePath)!, "backup.db");
        var bad = Path.Combine(Path.GetDirectoryName(databasePath)!, "invalid.db");
        File.WriteAllText(bad, "arquivo incompatível");
        try { RestoreLocalBackup(bad); throw new InvalidOperationException("Backup inválido foi aceito."); }
        catch (SqliteException) { }
        var snapshot = RestoreLocalBackup(previous);
        Refresh();
        if (Balance.Text != Money(7000)) throw new InvalidOperationException("Saldo restaurado incorreto.");
        using var saved = OpenBackupConnection(snapshot);
        saved.Open();
        using var cmd = saved.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM entries WHERE note='Importado'";
        if (Convert.ToInt64(cmd.ExecuteScalar()) != 2) throw new InvalidOperationException("A cópia anterior não preservou os dados.");
    }
}
