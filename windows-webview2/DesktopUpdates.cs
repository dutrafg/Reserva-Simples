using System.Buffers;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ReservaSimples.Desktop;

internal sealed record DesktopRelease(Version Version, string Tag, string SetupUrl, string ChecksumsUrl);
internal readonly record struct DownloadState(long BytesRead, long? TotalBytes);

internal static class DesktopUpdates
{
    internal const string InstallerName = "Reserva-Simples-Desktop-Setup-x64.exe";
    private const string ChecksumsName = "SHA256SUMS.txt";
    private const string ReleasePrefix = "windows-webview2-v";
    private const string ReleasesApi = "https://api.github.com/repos/dutrafg/Reserva-Simples/releases?per_page=30";
    private const long MaxInstallerBytes = 250L * 1024 * 1024;
    private static readonly HttpClient Http = CreateHttpClient();

    private static HttpClient CreateHttpClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("ReservaSimplesDesktop/0.2.0");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        return client;
    }

    internal static Version InstalledVersion =>
        Assembly.GetExecutingAssembly().GetName().Version ?? new Version(0, 2, 0);

    internal static async Task<DesktopRelease?> FindNewerAsync(CancellationToken cancellationToken)
    {
        using var response = await Http.GetAsync(ReleasesApi, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(input, cancellationToken: cancellationToken);
        if (doc.RootElement.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("A resposta de versões do GitHub não é uma lista.");

        DesktopRelease? latest = null;
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("draft", out var draft) || draft.GetBoolean())
                continue;
            if (!item.TryGetProperty("tag_name", out var tagNode))
                continue;
            string tag = tagNode.GetString() ?? "";
            if (!tag.StartsWith(ReleasePrefix, StringComparison.Ordinal))
                continue;
            string versionText = tag[ReleasePrefix.Length..].Split('-')[0];
            if (!Version.TryParse(versionText, out Version? version) || version <= InstalledVersion)
                continue;
            if (!item.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Array)
                continue;

            string? setup = null;
            string? checksums = null;
            foreach (var asset in assets.EnumerateArray())
            {
                if (!asset.TryGetProperty("name", out var nameNode) ||
                    !asset.TryGetProperty("browser_download_url", out var urlNode))
                    continue;
                string name = nameNode.GetString() ?? "";
                string url = urlNode.GetString() ?? "";
                if (!TrustedAssetUrl(url, tag, name)) continue;
                if (name == InstallerName) setup = url;
                if (name == ChecksumsName) checksums = url;
            }
            if (setup is null || checksums is null) continue;
            if (latest is null || version > latest.Version)
                latest = new DesktopRelease(version, tag, setup, checksums);
        }
        return latest;
    }

    private static bool TrustedAssetUrl(string input, string tag, string name)
    {
        if (name != InstallerName && name != ChecksumsName) return false;
        if (!Regex.IsMatch(tag, @"^windows-webview2-v[0-9]+\.[0-9]+\.[0-9]+(-beta)?$",
                RegexOptions.CultureInvariant)) return false;
        string expected = $"https://github.com/dutrafg/Reserva-Simples/releases/download/{tag}/{name}";
        return string.Equals(input, expected, StringComparison.Ordinal);
    }

    internal static async Task<string> DownloadVerifiedAsync(
        DesktopRelease release, IProgress<DownloadState> progress, CancellationToken cancellationToken)
    {
        string expected = await ReadExpectedChecksumAsync(release.ChecksumsUrl, cancellationToken);
        string outputDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ReservaSimples", "Updates");
        Directory.CreateDirectory(outputDir);
        string destination = Path.Combine(outputDir,
            $"Reserva-Simples-Desktop-Setup-x64-v{release.Version}.exe");
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".part";
        try
        {
            using var response = await Http.GetAsync(release.SetupUrl,
                HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();
            long? total = response.Content.Headers.ContentLength;
            if (total.HasValue && (total <= 0 || total > MaxInstallerBytes))
                throw new InvalidDataException("Tamanho inválido do instalador.");

            await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
            await using var output = new FileStream(temporary, FileMode.CreateNew,
                FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous);
            using var digest = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            byte[] buffer = ArrayPool<byte>.Shared.Rent(65536);
            long received = 0;
            try
            {
                int count;
                while ((count = await input.ReadAsync(buffer.AsMemory(0, buffer.Length),
                        cancellationToken)) != 0)
                {
                    received += count;
                    if (received > MaxInstallerBytes)
                        throw new InvalidDataException("O instalador excedeu o limite permitido.");
                    digest.AppendData(buffer, 0, count);
                    await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                    progress.Report(new DownloadState(received, total));
                }
            }
            finally { ArrayPool<byte>.Shared.Return(buffer); }

            await output.FlushAsync(cancellationToken);
            if (total.HasValue && total.Value != received)
                throw new InvalidDataException("O download ficou incompleto.");
            if (received == 0)
                throw new InvalidDataException("O instalador baixado está vazio.");
            string actual = Convert.ToHexString(digest.GetHashAndReset());
            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("SHA-256 incorreto: instalador rejeitado.");
            output.Close();
            File.Move(temporary, destination, true);
            return destination;
        }
        finally
        {
            if (File.Exists(temporary))
                File.Delete(temporary);
        }
    }

    private static async Task<string> ReadExpectedChecksumAsync(string url,
        CancellationToken cancellationToken)
    {
        using var response = await Http.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength is > 8192)
            throw new InvalidDataException("Lista de hashes maior que o permitido.");
        string content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (content.Length > 8192)
            throw new InvalidDataException("Lista de hashes inválida.");
        foreach (string line in content.Split('\n'))
        {
            var match = Regex.Match(line.Trim(),
                @"^(?<hash>[a-fA-F0-9]{64})\s+\*?(?<file>[^\s/\\]+)$",
                RegexOptions.CultureInvariant);
            if (match.Success && match.Groups["file"].Value == InstallerName)
                return match.Groups["hash"].Value;
        }
        throw new InvalidDataException("Não foi encontrado o SHA-256 do instalador oficial.");
    }
}
