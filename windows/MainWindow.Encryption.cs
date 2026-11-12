using System.IO;
using System.Security.Cryptography;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow
{
    private string? databaseKey;

    private static SqliteConnection CreateDatabaseConnection(string path, SqliteOpenMode mode, string? key)
    {
        var options = new SqliteConnectionStringBuilder { DataSource = path, Mode = mode, Pooling = false };
        if (key is not null) options.Password = key;
        return new SqliteConnection(options.ToString());
    }

    private static bool IsPlainSqlite(string path)
    {
        using var stream = File.OpenRead(path);
        Span<byte> header = stackalloc byte[16];
        return stream.ReadAtLeast(header, 16, false) == 16 &&
            header.SequenceEqual("SQLite format 3\0"u8);
    }

    private SqliteConnection OpenBackupConnection(string path, SqliteOpenMode mode = SqliteOpenMode.ReadOnly) =>
        CreateDatabaseConnection(path, mode, IsPlainSqlite(path) ? null : databaseKey);

    private void InitializeEncryptedStorage()
    {
        SQLitePCL.Batteries_V2.Init();
        var keyPath = Path.Combine(Path.GetDirectoryName(databasePath)!, "vault.key");
        byte[] key;
        if (File.Exists(keyPath))
            key = ProtectedData.Unprotect(File.ReadAllBytes(keyPath), null, DataProtectionScope.CurrentUser);
        else
        {
            if (File.Exists(databasePath) && !IsPlainSqlite(databasePath))
                throw new InvalidDataException("A chave deste banco cifrado não foi encontrada.");
            key = RandomNumberGenerator.GetBytes(32);
            try
            {
                using var file = new FileStream(keyPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                file.Write(ProtectedData.Protect(key, null, DataProtectionScope.CurrentUser));
                file.Flush(flushToDisk: true);
            }
            catch { CryptographicOperations.ZeroMemory(key); throw; }
        }
        try { databaseKey = Convert.ToHexString(key); }
        finally { CryptographicOperations.ZeroMemory(key); }

        using (var probe = CreateDatabaseConnection(":memory:", SqliteOpenMode.ReadWriteCreate, null))
        {
            probe.Open();
            using var cmd = probe.CreateCommand();
            cmd.CommandText = "PRAGMA cipher_version";
            if (cmd.ExecuteScalar() is not string version || string.IsNullOrWhiteSpace(version))
                throw new InvalidOperationException("SQLCipher indisponível.");
        }
        if (!File.Exists(databasePath) || !IsPlainSqlite(databasePath)) return;
        if (File.Exists(databasePath + "-wal") || File.Exists(databasePath + "-journal"))
            throw new InvalidOperationException("Feche versões antigas do Reserva e encerre gravações pendentes antes da migração.");
        var staged = databasePath + "." + Guid.NewGuid().ToString("N") + ".migration";
        try
        {
            using (var source = CreateDatabaseConnection(databasePath, SqliteOpenMode.ReadWrite, null))
            {
                source.Open();
                ExportEncryptedDatabase(source, staged, databaseKey);
            }
            File.Move(staged, databasePath, overwrite: true);
        }
        finally { if (File.Exists(staged)) File.Delete(staged); }
    }

    private static void ExportEncryptedDatabase(SqliteConnection source, string target, string key)
    {
        using var cmd = source.CreateCommand();
        cmd.CommandText = "ATTACH DATABASE $path AS exported KEY $key";
        cmd.Parameters.AddWithValue("$path", target);
        cmd.Parameters.AddWithValue("$key", key);
        cmd.ExecuteNonQuery();
        try
        {
            cmd.Parameters.Clear();
            cmd.CommandText = "SELECT sqlcipher_export('exported')";
            cmd.ExecuteScalar();
        }
        finally
        {
            cmd.CommandText = "DETACH DATABASE exported";
            cmd.ExecuteNonQuery();
        }
        using var verify = CreateDatabaseConnection(target, SqliteOpenMode.ReadOnly, key);
        verify.Open();
        using var check = verify.CreateCommand();
        check.CommandText = "PRAGMA quick_check";
        if (IsPlainSqlite(target) || !Equals(check.ExecuteScalar(), "ok"))
            throw new InvalidDataException("A cópia cifrada não passou na verificação.");
    }
}
