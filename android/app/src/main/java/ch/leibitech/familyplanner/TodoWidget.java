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
 * Widget «ToDos» (E58): meine offenen ToDos und die ohne Zuteilung, überfällige zuerst.
 * Die App legt die Liste ab (FPAndroid.setWidget("todos", …)). Nur zum Ansehen:
 * Antippen einer Zeile öffnet das ToDo, der Kopf die ToDo-Seite.
 */
public class TodoWidget extends AppWidgetProvider {

    static final String KEY = "todos";
    static final String ACTION_OPEN = "ch.leibitech.familyplanner.TODO";
    static final String EXTRA_ID = "fp_todo";

    static JSONObject data(Context c) {
        try {
            String s = c.getSharedPreferences(TermineWidget.PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void save(Context c, String json) {
        c.getSharedPreferences(TermineWidget.PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        refresh(c);
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TodoWidget.class));
        if (ids == null || ids.length == 0) return;
        for (int id : ids) draw(c, m, id);
        m.notifyAppWidgetViewDataChanged(ids, R.id.todo_list);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        // Auch zum Tageswechsel: «heute» / «überfällig» neu berechnen
        for (int id : ids) draw(c, m, id);
        m.notifyAppWidgetViewDataChanged(ids, R.id.todo_list);
    }

    private static void draw(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_todos);

        Intent svc = new Intent(c, TodoWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.todo_list, svc);
        v.setEmptyView(R.id.todo_list, R.id.todo_empty);

        JSONObject d = data(c);
        String stand = "";
        String count = "";
        String empty = "myFam. öffnen, damit die ToDos erscheinen.";
        if (d != null) {
            long at = d.optLong("at", 0);
            if (at > 0) {
                boolean today = new SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(new Date(at))
                    .equals(new SimpleDateFormat("yyyyMMdd", Locale.ROOT).format(new Date()));
                stand = "Stand " + new SimpleDateFormat(today ? "HH:mm" : "d.M. HH:mm", Locale.GERMAN).format(new Date(at));
            }
            int n = (d.optJSONArray("rows") == null ? 0 : d.optJSONArray("rows").length()) + d.optInt("more", 0);
            count = n > 0 ? String.valueOf(n) : "";
            empty = "Nichts zu tun. 🎉";
        }
        v.setTextViewText(R.id.todo_stand, stand);
        v.setTextViewText(R.id.todo_count, count);
        v.setTextViewText(R.id.todo_empty, empty);

        Intent open = new Intent(c, MainActivity.class).setAction(ACTION_OPEN).putExtra(EXTRA_ID, "");
        PendingIntent head = PendingIntent.getActivity(c, 10, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.todo_head, head);
        v.setOnClickPendingIntent(R.id.todo_empty, head);
        int mutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        Intent tpl = new Intent(c, MainActivity.class).setAction(ACTION_OPEN);
        v.setPendingIntentTemplate(R.id.todo_list, PendingIntent.getActivity(c, 11, tpl, PendingIntent.FLAG_UPDATE_CURRENT | mutable));

        m.updateAppWidget(id, v);
    }
}
