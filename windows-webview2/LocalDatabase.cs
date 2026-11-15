using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace ReservaSimples.Desktop;

internal sealed class LocalDatabase(string directory)
{
    private SqliteConnection Open()
    {
        var options = new SqliteConnectionStringBuilder
        {
            DataSource = Path.Combine(directory, "records.sqlite"),
            DefaultTimeout = 5
        };
        var connection = new SqliteConnection(options.ToString());
        try
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), payload BLOB NOT NULL)";
            command.ExecuteNonQuery();
            return connection;
        }
        catch
        {
            connection.Dispose();
            throw;
        }
    }

    internal string? Read()
    {
        using var connection = Open();
        return ReadSnapshot(connection, null);
    }

    internal void Write(string content, string? expected)
    {
        if (Encoding.UTF8.GetByteCount(content) > 32_000_000)
            throw new InvalidDataException("A base excede 32 MB.");

        using var connection = Open();
        using var transaction = connection.BeginTransaction(deferred: false);
        if (!string.Equals(ReadSnapshot(connection, transaction), expected, StringComparison.Ordinal))
            throw new InvalidOperationException("A base foi alterada por outra janela.");

        var bytes = Encoding.UTF8.GetBytes(content);
        try
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "INSERT INTO snapshot (id, payload) VALUES (1, $payload) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload";
            command.Parameters.AddWithValue("$payload", ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser));
            command.ExecuteNonQuery();
            transaction.Commit();
        }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }

    private static string? ReadSnapshot(SqliteConnection connection, SqliteTransaction? transaction)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT payload FROM snapshot WHERE id = 1";
        if (command.ExecuteScalar() is not byte[] payload) return null;
        var bytes = ProtectedData.Unprotect(payload, null, DataProtectionScope.CurrentUser);
        try { return Encoding.UTF8.GetString(bytes); }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
}
