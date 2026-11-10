package ch.leibitech.familyplanner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Widget «Termine · 7 Tage» (E56). Die App legt die Termine der nächsten 14 Tage ab
 * (FPAndroid.setWidget), das Widget zeigt davon 7 Tage ab heute. Antippen öffnet den Kalender.
 */
public class TermineWidget extends AppWidgetProvider {

    static final String PREFS = "fp_widgets";
    static final String KEY = "termine";
    static final String ACTION_OPEN = "ch.leibitech.familyplanner.KALENDER";
    static final String EXTRA_DAY = "fp_tag";

    static JSONObject data(Context c) {
        try {
            String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        refresh(c);
    }

    /** Alle Widgets neu zeichnen (nach neuen Daten oder zum Tageswechsel). */
    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TermineWidget.class));
        if (ids == null || ids.length == 0) return;
        for (int id : ids) draw(c, m, id);
        m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) draw(c, m, id);
        m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }

    private static void draw(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_termine);

        Intent svc = new Intent(c, TermineWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.widget_list, svc);
        v.setEmptyView(R.id.widget_list, R.id.widget_empty);

        JSONObject d = data(c);
        String stand = "";
        String empty = "myFam. öffnen, damit die Termine erscheinen.";
        if (d != null) {
            long at = d.optLong("at", 0);
            if (at > 0) {
                boolean today = new SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(new Date(at))
                    .equals(new SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(new Date()));
                stand = "Stand " + new SimpleDateFormat(today ? "HH:mm" : "d.M. HH:mm", Locale.GERMAN).format(new Date(at));
            }
            if (!d.optBoolean("connected", false)) empty = "Kalender in myFam. verbinden (Mehr → Kalender).";
        }
        v.setTextViewText(R.id.widget_stand, stand);
        v.setTextViewText(R.id.widget_empty, empty);

        // Kopf und leeres Widget: Kalender öffnen. Einzelne Zeilen: diesen Tag öffnen.
        Intent open = new Intent(c, MainActivity.class).setAction(ACTION_OPEN).putExtra(EXTRA_DAY, "");
        PendingIntent head = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_head, head);
        v.setOnClickPendingIntent(R.id.widget_empty, head);
        int mutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        Intent tpl = new Intent(c, MainActivity.class).setAction(ACTION_OPEN);
        v.setPendingIntentTemplate(R.id.widget_list, PendingIntent.getActivity(c, 1, tpl, PendingIntent.FLAG_UPDATE_CURRENT | mutable));

        m.updateAppWidget(id, v);
    }
}
