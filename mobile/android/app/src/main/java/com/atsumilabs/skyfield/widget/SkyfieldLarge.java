package com.atsumilabs.skyfield.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.widget.RemoteViews;

import com.atsumilabs.skyfield.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 4×1 banner widget. Two states, picked from the data:
 *  - normal: one dense row (icon, temp, place/condition, hi-lo, wind/humidity).
 *  - rain: when the next-2h nowcast has precip, line 1 collapses to
 *    place·condition·hi-lo (⟳ far right) and line 2 pairs icon+temp with the
 *    precip chart. Render only; the data path + refresh wiring live in
 *    {@link BaseSkyfieldWidget}.
 */
public class SkyfieldLarge extends BaseSkyfieldWidget {

    @Override
    protected int layoutId() {
        return R.layout.widget_skyfield_large;
    }

    @Override
    protected int layoutIdFor(JSONObject d) {
        return hasRain(d) ? R.layout.widget_skyfield_large_rain : R.layout.widget_skyfield_large;
    }

    /** Rain state ⇔ the snapshot carries a non-empty precip bar series. */
    private static boolean hasRain(JSONObject d) {
        if (d == null) return false;
        JSONArray bars = d.optJSONArray("nowcastBars");
        return bars != null && bars.length() > 0;
    }

    @Override
    protected void bind(Context context, RemoteViews v, JSONObject d) {
        if (hasRain(d)) bindRain(v, d);
        else bindNormal(v, d);
    }

    private void bindNormal(RemoteViews v, JSONObject d) {
        v.setTextViewText(R.id.widget_temp, d.optString("temp", "--°"));
        v.setTextViewText(R.id.widget_icon, emoji(d.optString("code", ""), d.optBoolean("isDay", true)));
        v.setTextViewText(R.id.widget_place, d.optString("place", "Skyfield"));

        String sub = subLine(d);
        v.setTextViewText(R.id.widget_sub, sub);

        v.setTextViewText(R.id.widget_hilo,
            "H " + d.optString("hi", "--°") + "   L " + d.optString("lo", "--°"));
        v.setTextViewText(R.id.widget_windhum,
            d.optString("wind", "") + "  ·  " + d.optString("humidity", ""));
        v.setTextViewText(R.id.widget_updated, d.optString("updated", ""));
    }

    private void bindRain(RemoteViews v, JSONObject d) {
        v.setTextViewText(R.id.widget_temp, d.optString("temp", "--°"));
        v.setTextViewText(R.id.widget_icon, emoji(d.optString("code", ""), d.optBoolean("isDay", true)));
        v.setTextViewText(R.id.widget_place, d.optString("place", "Skyfield"));
        // Leading "·" separates place from condition on line 1.
        v.setTextViewText(R.id.widget_sub, "·  " + subLine(d));
        v.setTextViewText(R.id.widget_hilo,
            "H " + d.optString("hi", "--°") + "  L " + d.optString("lo", "--°"));

        Bitmap chart = drawChart(d.optJSONArray("nowcastBars"), d.optInt("nowcastNowIdx", -1));
        if (chart != null) v.setImageViewBitmap(R.id.widget_chart, chart);
    }

    /** Sub line priority: active alert > nowcast phrase > plain condition. */
    private String subLine(JSONObject d) {
        String alert = optClean(d, "alertEvent");
        String nowcast = optClean(d, "nowcast");
        return !alert.isEmpty() ? "⚠ " + alert
            : (!nowcast.isEmpty() ? nowcast : d.optString("condition", ""));
    }

    @Override
    protected void bindPlaceholder(Context context, RemoteViews v) {
        // Placeholder always uses the normal layout (no bars → layoutIdFor()).
        v.setTextViewText(R.id.widget_place, "Skyfield — open the app");
        v.setTextViewText(R.id.widget_icon, "");
        v.setTextViewText(R.id.widget_temp, "--°");
        v.setTextViewText(R.id.widget_sub, "Tap ⟳ to load");
        v.setTextViewText(R.id.widget_hilo, "");
        v.setTextViewText(R.id.widget_windhum, "");
        v.setTextViewText(R.id.widget_updated, "");
    }

    // ---- Precip chart -------------------------------------------------------

    private static final int CHART_W = 520;
    private static final int CHART_H = 150;
    private static final int BAR_FUTURE = 0xFF5DB8FF; // solid Skyfield blue
    private static final int BAR_PAST = 0x665DB8FF;   // dim (already happened)
    private static final int NOW_MARK = 0xFFF3F6FC;   // bright tick under "now"

    /** Draw the next-2h precip bars to a bitmap (RemoteViews can't host a live
     *  chart). Bars before "now" are dimmed; a tick marks the now column. */
    private static Bitmap drawChart(JSONArray bars, int nowIdx) {
        if (bars == null || bars.length() == 0) return null;
        int n = bars.length();

        Bitmap bmp = Bitmap.createBitmap(CHART_W, CHART_H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        float gap = n > 24 ? 3f : 5f;
        float barW = (CHART_W - gap * (n - 1)) / n;
        float radius = Math.min(barW / 2f, 6f);
        float topPad = 8f;
        float botPad = nowIdx >= 0 ? 12f : 6f; // room for the now tick
        float maxH = CHART_H - topPad - botPad;

        for (int i = 0; i < n; i++) {
            int h = clampHeight(bars.optInt(i, 4));
            float bh = Math.max(4f, (h / 100f) * maxH);
            float left = i * (barW + gap);
            float top = CHART_H - botPad - bh;
            p.setColor((nowIdx < 0 || i >= nowIdx) ? BAR_FUTURE : BAR_PAST);
            c.drawRoundRect(left, top, left + barW, CHART_H - botPad, radius, radius, p);
        }

        // "Now" indicator: a short tick centered under the now column.
        if (nowIdx >= 0 && nowIdx < n) {
            float cx = nowIdx * (barW + gap) + barW / 2f;
            p.setColor(NOW_MARK);
            float r = 3.5f;
            c.drawCircle(cx, CHART_H - botPad + 6f, r, p);
        }
        return bmp;
    }

    private static int clampHeight(int h) {
        if (h < 0) return 0;
        return Math.min(h, 100);
    }
}
