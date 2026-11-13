package br.com.reservasimples.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ReservaUpdater")
public class ReservaUpdaterPlugin extends Plugin {
    private static final String API = "https://api.github.com/repos/dutrafg/Reserva-Simples/releases?per_page=30";
    private static final String APK_NAME = "reserva-simples-android.apk";
    private static final long MAX_BYTES = 150L * 1024 * 1024;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile Release available;
    private volatile File downloaded;

    private static class Release {
        String version;
        String url;
        String sha256;
        long size;
        String notes;
    }

    private String installedVersion() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
    }

    private static int compareVersion(String a, String b) {
        String[] aa = a.split("\\.");
        String[] bb = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int x = Integer.parseInt(aa[i]);
            int y = Integer.parseInt(bb[i]);
            if (x != y) return Integer.compare(x, y);
        }
        return 0;
    }

    private static String readUtf8(InputStream stream) throws Exception {
        byte[] bytes = new byte[8192];
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        int read;
        while ((read = stream.read(bytes)) != -1) {
            output.write(bytes, 0, read);
            if (output.size() > 2_000_000) throw new Exception("Resposta muito grande.");
        }
        return output.toString("UTF-8");
    }

    private HttpURLConnection connect(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setRequestProperty("User-Agent", "ReservaSimples-Android-Updater");
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(18000);
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private Release fetchLatest() throws Exception {
        HttpURLConnection c = connect(API);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (c.getResponseCode() == 404) return null;
            if (c.getResponseCode() != 200) throw new Exception("GitHub não respondeu à consulta (" + c.getResponseCode() + ").");
            JSONArray releases;
            try (InputStream in = c.getInputStream()) { releases = new JSONArray(readUtf8(in)); }
            Release best = null;
            for (int j = 0; j < releases.length(); j++) {
                JSONObject result = releases.optJSONObject(j);
                if (result == null || result.optBoolean("draft") || result.optBoolean("prerelease")) continue;
                String tag = result.optString("tag_name", "");
                if (!tag.matches("^android-v?[0-9]+\\.[0-9]+\\.[0-9]+$")) continue;
                JSONArray assets = result.optJSONArray("assets");
                if (assets == null) continue;
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.optJSONObject(i);
                    if (asset == null || !APK_NAME.equals(asset.optString("name"))) continue;
                    String digest = asset.optString("digest", "");
                    if (!digest.matches("^sha256:[a-fA-F0-9]{64}$")) {
                        throw new Exception("Release Android sem SHA-256 verificável.");
                    }
                    Release r = new Release();
                    r.version = tag.replaceFirst("^android-v?", "");
                    r.sha256 = digest.substring(7).toLowerCase(Locale.ROOT);
                    r.url = asset.optString("browser_download_url", "");
                    r.size = asset.optLong("size", -1);
                    r.notes = result.optString("body", "");
                    URL url = new URL(r.url);
                    String path = url.toURI().normalize().getPath();
                    if (!"https".equals(url.getProtocol()) || !"github.com".equalsIgnoreCase(url.getHost())
                        || !path.startsWith("/dutrafg/Reserva-Simples/releases/download/")
                        || !path.endsWith("/" + APK_NAME) || r.size < 1 || r.size > MAX_BYTES) {
                        throw new Exception("Arquivo da atualização não é autorizado.");
                    }
                    if (best == null || compareVersion(r.version, best.version) > 0) best = r;
                }
            }
            return best;
        } finally { c.disconnect(); }
    }

    @PluginMethod
    public void checkUpdate(PluginCall call) {
        executor.execute(() -> {
            try {
                Release latest = fetchLatest();
                JSObject response = new JSObject();
                String current = installedVersion();
                response.put("installedVersion", current);
                if (latest == null || compareVersion(latest.version, current) <= 0) {
                    available = null;
                    response.put("available", false);
                    response.put("latestVersion", latest == null ? current : latest.version);
                    response.put("message", latest == null
                        ? "Ainda não há uma versão Android estável publicada no GitHub."
                        : "O aplicativo está atualizado.");
                } else {
                    available = latest;
                    downloaded = null;
                    response.put("available", true);
                    response.put("latestVersion", latest.version);
                    response.put("notes", latest.notes.length() > 700 ? latest.notes.substring(0, 700) : latest.notes);
                    response.put("bytes", latest.size);
                }
                call.resolve(response);
            } catch (Exception e) {
                call.reject("Falha ao verificar atualização Android: " + e.getMessage());
            }
        });
    }

    private static String hex(byte[] digest) {
        StringBuilder out = new StringBuilder();
        for (byte b : digest) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }

    private void progress(long received, long total) {
        JSObject event = new JSObject();
        event.put("received", received);
        event.put("total", total);
        event.put("percent", total > 0 ? (int) Math.min(100, received * 100 / total) : 0);
        notifyListeners("updateProgress", event);
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        executor.execute(() -> {
            Release r = available;
            if (r == null) { call.reject("Verifique primeiro se existe uma atualização."); return; }
            File dir = new File(getContext().getCacheDir(), "updates");
            dir.mkdirs();
            File pending = new File(dir, "reserva-update.part");
            File completed = new File(dir, APK_NAME);
            HttpURLConnection c = null;
            try {
                c = connect(r.url);
                if (c.getResponseCode() != 200) throw new Exception("Download HTTP " + c.getResponseCode());
                long length = c.getContentLengthLong();
                if (length > MAX_BYTES || (length >= 0 && length != r.size)) throw new Exception("Tamanho do APK incompatível.");
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long total = 0, lastReported = 0;
                byte[] buffer = new byte[65536];
                try (InputStream input = c.getInputStream(); FileOutputStream output = new FileOutputStream(pending)) {
                    int n;
                    while ((n = input.read(buffer)) != -1) {
                        total += n;
                        if (total > MAX_BYTES) throw new Exception("APK excedeu o tamanho permitido.");
                        md.update(buffer, 0, n);
                        output.write(buffer, 0, n);
                        if (total - lastReported >= 200_000 || total == r.size) {
                            progress(total, r.size);
                            lastReported = total;
                        }
                    }
                }
                if (total != r.size || !hex(md.digest()).equals(r.sha256)) {
                    throw new Exception("O APK não corresponde ao SHA-256 publicado pelo GitHub.");
                }
                if (completed.exists() && !completed.delete()) throw new Exception("Não foi possível substituir download anterior.");
                if (!pending.renameTo(completed)) throw new Exception("Não foi possível finalizar o download.");
                downloaded = completed;
                progress(total, r.size);
                JSObject response = new JSObject();
                response.put("downloaded", true);
                response.put("version", r.version);
                response.put("bytes", total);
                call.resolve(response);
            } catch (Exception e) {
                pending.delete();
                downloaded = null;
                call.reject("Download não concluído: " + e.getMessage());
            } finally { if (c != null) c.disconnect(); }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        executor.execute(() -> {
            Release r = available;
            File file = downloaded;
            if (r == null || file == null || !file.isFile()) {
                call.reject("Nenhum APK verificado para instalar.");
                return;
            }
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                try (InputStream in = new FileInputStream(file)) {
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) != -1) md.update(b, 0, n);
                }
                if (!hex(md.digest()).equals(r.sha256)) throw new Exception("A integridade do APK mudou.");
                getActivity().runOnUiThread(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + getContext().getPackageName()));
                            getActivity().startActivity(permission);
                            JSObject response = new JSObject();
                            response.put("permissionRequired", true);
                            call.resolve(response);
                            return;
                        }
                        Uri uri = FileProvider.getUriForFile(getContext(),
                                getContext().getPackageName() + ".updates.provider", file);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(intent);
                        JSObject response = new JSObject();
                        response.put("installerOpened", true);
                        call.resolve(response);
                    } catch (Exception ex) {
                        call.reject("Não foi possível abrir o instalador: " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                call.reject("A instalação foi bloqueada: " + e.getMessage());
            }
        });
    }
}
