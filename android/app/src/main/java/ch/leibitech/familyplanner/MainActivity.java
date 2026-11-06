package ch.leibitech.familyplanner;

import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    // Nur die eigene App darf Dateien speichern/teilen
    static final String HOME = "https://leibi-tech.github.io/family-planner/";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebView web = getBridge().getWebView();

        // Speichern und Teilen für die App (window.FPAndroid). Danach neu laden,
        // damit die erste Seite die Verbindung sicher schon hat.
        web.addJavascriptInterface(new FpAndroid(), "FPAndroid");
        web.loadUrl(HOME);

        // Zurück-Taste: die App entscheidet (Fenster schliessen, Seite zurück).
        // Gibt sie false zurück (Startseite), geht die App in den Hintergrund.
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    web.evaluateJavascript(
                        "(function(){try{return window.fpBack?window.fpBack():false}catch(e){return false}})()",
                        (result) -> {
                            if (!"true".equals(result)) moveTaskToBack(true);
                        }
                    );
                }
            }
        );
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    private static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return n.isEmpty() ? "Dokument" : n;
    }

    /** Läuft auf dem Haupt-Thread, aber nur wenn die eigene App angezeigt wird. */
    private void onApp(Runnable job) {
        runOnUiThread(() -> {
            WebView web = getBridge().getWebView();
            String url = web.getUrl();
            if (url == null || !url.startsWith(HOME)) return;
            try {
                job.run();
            } catch (Exception e) {
                toast("Das hat nicht geklappt: " + e.getMessage());
            }
        });
    }

    private void open(Uri uri, String mime) {
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, mime);
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(view);
        } catch (ActivityNotFoundException e) {
            // keine passende App zum Anzeigen: gespeichert ist die Datei trotzdem
        }
    }

    private File cacheFile(String name, byte[] data) throws Exception {
        File dir = new File(getCacheDir(), "teilen");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Ordner fehlt");
        File f = new File(dir, safeName(name));
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
        return f;
    }

    private Uri providerUri(File f) {
        return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
    }

    class FpAndroid {

        /** Datei im Ordner «Download» speichern und gleich öffnen. */
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            onApp(() -> {
                try {
                    String file = safeName(name);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues v = new ContentValues();
                        v.put(MediaStore.Downloads.DISPLAY_NAME, file);
                        v.put(MediaStore.Downloads.MIME_TYPE, mime);
                        v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                        if (uri == null) throw new Exception("kein Speicherplatz");
                        try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                            if (out == null) throw new Exception("kein Zugriff");
                            out.write(data);
                        }
                        toast("Gespeichert im Ordner «Download»: " + file);
                        open(uri, mime);
                    } else {
                        // Ältere Android-Versionen: Kopie öffnen, dort lässt sie sich speichern
                        File f = cacheFile(file, data);
                        open(providerUri(f), mime);
                    }
                } catch (Exception e) {
                    toast("Speichern hat nicht geklappt: " + e.getMessage());
                }
            });
        }

        /** Android-Teilen-Fenster mit der Datei öffnen. */
        @JavascriptInterface
        public void shareFile(final String name, final String mime, final String base64) {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            onApp(() -> {
                try {
                    Uri uri = providerUri(cacheFile(name, data));
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mime);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent chooser = Intent.createChooser(send, safeName(name));
                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(chooser);
                } catch (Exception e) {
                    toast("Teilen hat nicht geklappt: " + e.getMessage());
                }
            });
        }
    }
}
