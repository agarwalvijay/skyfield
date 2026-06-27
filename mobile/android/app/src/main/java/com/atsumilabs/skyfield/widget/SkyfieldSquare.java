package com.atsumilabs.skyfield.widget;

import android.content.Context;
import android.widget.RemoteViews;

import com.atsumilabs.skyfield.R;

import org.json.JSONObject;

/**
 * 2×2 square widget — stacked card: place + ⟳, icon + temp, condition, humidity
 * + wind, hi/lo, updated time. Render only; everything else is in
 * {@link BaseSkyfieldWidget}.
 */
public class SkyfieldSquare extends BaseSkyfieldWidget {

    @Override
    protected int layoutId() {
        return R.layout.widget_skyfield_square;
    }

    @Override
    protected void bind(Context context, RemoteViews v, JSONObject d) {
        v.setTextViewText(R.id.widget_place, d.optString("place", "Skyfield"));
        v.setTextViewText(R.id.widget_icon, emoji(d.optString("code", ""), d.optBoolean("isDay", true)));
        v.setTextViewText(R.id.widget_temp, d.optString("temp", "--°"));

        String alert = optClean(d, "alertEvent");
        String nowcast = optClean(d, "nowcast");
        String sub = !alert.isEmpty() ? "⚠ " + alert
            : (!nowcast.isEmpty() ? nowcast : d.optString("condition", ""));
        v.setTextViewText(R.id.widget_sub, sub);

        v.setTextViewText(R.id.widget_windhum,
            "💧 " + d.optString("humidity", "--%") + "   " + optClean(d, "wind"));
        v.setTextViewText(R.id.widget_hilo,
            "H " + d.optString("hi", "--°") + "    L " + d.optString("lo", "--°"));
        v.setTextViewText(R.id.widget_updated, d.optString("updated", ""));
    }

    @Override
    protected void bindPlaceholder(Context context, RemoteViews v) {
        // Clear the layout's sample defaults (which exist only for the picker preview).
        v.setTextViewText(R.id.widget_place, "Skyfield");
        v.setTextViewText(R.id.widget_icon, "");
        v.setTextViewText(R.id.widget_temp, "--°");
        v.setTextViewText(R.id.widget_sub, "Tap ⟳ to load");
        v.setTextViewText(R.id.widget_hilo, "");
        v.setTextViewText(R.id.widget_windhum, "");
        v.setTextViewText(R.id.widget_updated, "");
    }
}
