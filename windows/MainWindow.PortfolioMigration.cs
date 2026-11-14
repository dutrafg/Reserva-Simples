using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace ReservaSimples;

public partial class MainWindow
{
    private sealed record ImportedPortfolio(string Kind, string Id, string Payload);

    private static List<ImportedPortfolio> ReadPwaPortfolio(JsonElement root)
    {
        var result = new List<ImportedPortfolio>();
        foreach (var kind in new[] { "institutions", "jars", "allocations", "investments" })
        {
            if (!root.TryGetProperty(kind, out var items)) continue;
            if (items.ValueKind != JsonValueKind.Array || items.GetArrayLength() > 50000)
                throw new InvalidDataException($"Seção de backup inválida: {kind}.");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (var item in items.EnumerateArray())
            {
                var id = item.GetProperty("id").GetString();
                if (string.IsNullOrWhiteSpace(id) || id.Length > 120 || !ids.Add(id))
                    throw new InvalidDataException($"Identificador inválido ou repetido em {kind}.");
                if (kind == "jars" && item.GetProperty("target").GetInt64() <= 0)
                    throw new InvalidDataException("Uma meta contém valor inválido.");
                if (kind == "investments" && (item.GetProperty("cost").GetInt64() < 0 || item.GetProperty("balance").GetInt64() < 0))
                    throw new InvalidDataException("Um investimento contém valor inválido.");
                result.Add(new(kind, id, item.GetRawText()));
            }
        }
        return result;
    }

    private static int WritePwaPortfolio(SqliteConnection db, SqliteTransaction tx, List<ImportedPortfolio> portfolio)
    {
        if (portfolio.Count == 0) return 0;
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS pwa_portfolio (
                kind TEXT NOT NULL, source_id TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(kind, source_id)
            )
            """;
        cmd.ExecuteNonQuery();
        cmd.CommandText = """
            INSERT INTO pwa_portfolio(kind,source_id,payload) VALUES($kind,$id,$payload)
            ON CONFLICT(kind,source_id) DO UPDATE SET payload=excluded.payload
            WHERE payload<>excluded.payload
            """;
        var kind = cmd.Parameters.Add("$kind", SqliteType.Text);
        var id = cmd.Parameters.Add("$id", SqliteType.Text);
        var payload = cmd.Parameters.Add("$payload", SqliteType.Text);
        var count = 0;
        foreach (var item in portfolio)
        {
            kind.Value = item.Kind;
            id.Value = item.Id;
            payload.Value = item.Payload;
            count += cmd.ExecuteNonQuery();
        }
        return count;
    }

    private void VerifyPortfolioMigration()
    {
        using var fixture = JsonDocument.Parse("""
            {"jars":[{"id":"meta","target":100000}],"investments":[{"id":"cdb","cost":90000,"balance":92000,"goalId":"meta","redemptions":[{"date":"2026-11-04","amount":100}]}]}
            """);
        var items = ReadPwaPortfolio(fixture.RootElement);
        if (WritePwaEntries([], items) != 2 || WritePwaEntries([], items) != 0)
            throw new InvalidOperationException("Falha na migração da carteira ou na proteção contra duplicatas.");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT payload FROM pwa_portfolio WHERE kind='investments' AND source_id='cdb'";
        using var result = JsonDocument.Parse((string)cmd.ExecuteScalar()!);
        if (result.RootElement.GetProperty("goalId").GetString() != "meta" ||
            result.RootElement.GetProperty("redemptions").GetArrayLength() != 1)
            throw new InvalidOperationException("Vínculo ou resgate perdido na migração.");
    }
}
