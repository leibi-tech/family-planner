package ch.leibitech.familyplanner;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Liefert die Zeilen des Widgets «Termine»: pro Tag eine Überschrift, darunter die Termine. */
public class TermineWidgetService extends RemoteViewsService {

    static final int DAYS = 7;
    static final String[] WD = { "So", "Mo", "Di", "Mi", "Do", "Fr", "Sa" };

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Row {
        boolean day;
        String date;
        String text;
        String sub;
        int[] colors = new int[0];
    }

    static String key(Calendar c) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(c.getTime());
    }

    static List<Row> build(Context ctx) {
        List<Row> out = new ArrayList<>();
        JSONObject d = TermineWidget.data(ctx);
        if (d == null || !d.optBoolean("connected", false)) return out;
        JSONArray rows = d.optJSONArray("rows");
        if (rows == null) rows = new JSONArray();
        // Bis zu welchem Tag hat die App Termine geliefert? (14 Tage ab dem Stand)
        Calendar last = Calendar.getInstance();
        last.setTimeInMillis(d.optLong("at", 0));
        last.add(Calendar.DAY_OF_MONTH, 13);
        String known = key(last);

        Calendar day = Calendar.getInstance();
        for (int i = 0; i < DAYS; i++) {
            String k = key(day);
            Row h = new Row();
            h.day = true;
            h.date = k;
            String date = WD[day.get(Calendar.DAY_OF_WEEK) - 1] + " " + day.get(Calendar.DAY_OF_MONTH) + "." + (day.get(Calendar.MONTH) + 1) + ".";
            h.text = i == 0 ? "Heute · " + date : i == 1 ? "Morgen · " + date : date;
            out.add(h);
            int n = 0;
            for (int j = 0; j < rows.length(); j++) {
                JSONObject r = rows.optJSONObject(j);
                if (r == null || !k.equals(r.optString("d"))) continue;
                Row e = new Row();
                e.date = k;
                e.text = r.optString("n");
                String t = r.optString("t");
                String w = r.optString("w");
                e.sub = w.isEmpty() ? t : t + " · " + w;
                JSONArray c = r.optJSONArray("c");
                if (c != null) {
                    e.colors = new int[Math.min(3, c.length())];
                    for (int x = 0; x < e.colors.length; x++) {
                        try {
                            e.colors[x] = Color.parseColor(c.optString(x));
                        } catch (Exception ex) {
                            e.colors[x] = Color.GRAY;
                        }
                    }
                }
                out.add(e);
                n++;
            }
            h.sub = n > 0 ? "" : k.compareTo(known) > 0 ? "noch unbekannt" : "frei";
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        return out;
    }

    static class Factory implements RemoteViewsFactory {
        private final Context ctx;
        private List<Row> rows = new ArrayList<>();

        Factory(Context ctx) {
            this.ctx = ctx;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            rows = build(ctx);
        }

        @Override
        public void onDestroy() {
            rows.clear();
        }

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= rows.size()) return null;
            Row r = rows.get(position);
            RemoteViews v;
            if (r.day) {
                v = new RemoteViews(ctx.getPackageName(), R.layout.widget_termine_day);
                v.setTextViewText(R.id.day, r.text);
                v.setTextViewText(R.id.free, r.sub == null ? "" : r.sub);
            } else {
                v = new RemoteViews(ctx.getPackageName(), R.layout.widget_termine_item);
                v.setTextViewText(R.id.title, r.text);
                v.setTextViewText(R.id.sub, r.sub);
                int[] ids = { R.id.c1, R.id.c2, R.id.c3 };
                for (int x = 0; x < ids.length; x++) {
                    if (x < r.colors.length) {
                        v.setViewVisibility(ids[x], View.VISIBLE);
                        v.setInt(ids[x], "setBackgroundColor", r.colors[x]);
                    } else {
                        v.setViewVisibility(ids[x], View.GONE);
                    }
                }
            }
            v.setOnClickFillInIntent(R.id.row, new Intent().putExtra(TermineWidget.EXTRA_DAY, r.date));
            return v;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 2;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
