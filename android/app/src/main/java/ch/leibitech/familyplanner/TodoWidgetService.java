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

/** Liefert die Zeilen des Widgets «ToDos» (Reihenfolge kommt fertig aus der App). */
public class TodoWidgetService extends RemoteViewsService {

    static final String[] WD = { "So", "Mo", "Di", "Mi", "Do", "Fr", "Sa" };

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Row {
        String id;
        String title;
        String sub;
        boolean late;
        boolean today;
        int[] colors = new int[0];
    }

    static String key(Calendar c) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(c.getTime());
    }

    /** Fälligkeit wie in der App: heute, morgen, gestern, sonst «Mo 3.11.». */
    static String dueLabel(String due) {
        Calendar c = Calendar.getInstance();
        String today = key(c);
        if (due.equals(today)) return "heute";
        c.add(Calendar.DAY_OF_MONTH, 1);
        if (due.equals(key(c))) return "morgen";
        c.add(Calendar.DAY_OF_MONTH, -2);
        if (due.equals(key(c))) return "gestern";
        try {
            Calendar d = Calendar.getInstance();
            d.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).parse(due));
            return WD[d.get(Calendar.DAY_OF_WEEK) - 1] + " " + d.get(Calendar.DAY_OF_MONTH) + "." + (d.get(Calendar.MONTH) + 1) + ".";
        } catch (Exception e) {
            return due;
        }
    }

    static List<Row> build(Context ctx) {
        List<Row> out = new ArrayList<>();
        JSONObject d = TodoWidget.data(ctx);
        if (d == null) return out;
        JSONArray rows = d.optJSONArray("rows");
        if (rows == null) return out;
        String today = key(Calendar.getInstance());
        for (int j = 0; j < rows.length(); j++) {
            JSONObject r = rows.optJSONObject(j);
            if (r == null) continue;
            Row e = new Row();
            e.id = r.optString("id");
            e.title = (r.optBoolean("g", false) ? "G · " : "") + r.optString("n");
            String due = r.optString("d");
            String w = r.optString("w");
            StringBuilder sub = new StringBuilder();
            if (!due.isEmpty()) {
                e.late = due.compareTo(today) < 0;
                e.today = due.equals(today);
                sub.append(e.late ? "überfällig · " : "").append(dueLabel(due));
            }
            if (!w.isEmpty() && !r.optBoolean("g", false)) sub.append(sub.length() > 0 ? " · " : "").append(w);
            e.sub = sub.toString();
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
        }
        int more = d.optInt("more", 0);
        if (more > 0) {
            Row m = new Row();
            m.id = "";
            m.title = "… und " + more + " weitere";
            m.sub = "";
            out.add(m);
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
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_todos_item);
            v.setTextViewText(R.id.title, r.title);
            v.setTextViewText(R.id.sub, r.sub);
            v.setViewVisibility(R.id.sub, r.sub.isEmpty() ? View.GONE : View.VISIBLE);
            int red = ctx.getResources().getColor(R.color.fp_widget_late, null);
            int head = ctx.getResources().getColor(R.color.fp_widget_head, null);
            int muted = ctx.getResources().getColor(R.color.fp_widget_muted, null);
            v.setTextColor(R.id.sub, r.late ? red : r.today ? head : muted);
            int[] ids = { R.id.c1, R.id.c2, R.id.c3 };
            for (int x = 0; x < ids.length; x++) {
                if (x < r.colors.length) {
                    v.setViewVisibility(ids[x], View.VISIBLE);
                    v.setInt(ids[x], "setBackgroundColor", r.colors[x]);
                } else {
                    v.setViewVisibility(ids[x], x == 0 ? View.INVISIBLE : View.GONE);
                }
            }
            v.setOnClickFillInIntent(R.id.row, new Intent().putExtra(TodoWidget.EXTRA_ID, r.id));
            return v;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
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
