package com.atsumilabs.skyfield.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;

import com.atsumilabs.skyfield.R;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;

/**
 * Native banner widget. Renders from the JSON snapshot the RN app writes to
 * getFilesDir()/skyfield_widget.json (see widgetData.ts). Uses RemoteViews with
 * match_parent, so Android reflows it on every resize/rotation — no bitmap, no
 * stale-dimension clipping (the failure mode of the JS-rendered widget).
 */
public class SkyfieldLarge extends AppWidgetProvider {
    private static final String ACTION_REFRESH = "com.atsumilabs.skyfield.WIDGET_REFRESH";
    private static final String SNAPSHOT_FILE = "skyfield_widget.json";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateWidget(context, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle opts) {
        updateWidget(context, mgr, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(context, SkyfieldLarge.class));
            for (int id : ids) updateWidget(context, mgr, id);
        }
    }

    private void updateWidget(Context context, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_skyfield_large);
        JSONObject d = readSnapshot(context);

        if (d != null) {
            v.setTextViewText(R.id.widget_temp, d.optString("temp", "--°"));
            v.setTextViewText(R.id.widget_icon, emoji(d.optString("code", ""), d.optBoolean("isDay", true)));
            v.setTextViewText(R.id.widget_place, d.optString("place", "Skyfield"));

            String alert = optClean(d, "alertEvent");
            String nowcast = optClean(d, "nowcast");
            String sub = !alert.isEmpty() ? "⚠ " + alert
                : (!nowcast.isEmpty() ? nowcast : d.optString("condition", ""));
            v.setTextViewText(R.id.widget_sub, sub);

            v.setTextViewText(R.id.widget_hilo,
                "H " + d.optString("hi", "--°") + "   L " + d.optString("lo", "--°"));
            v.setTextViewText(R.id.widget_windhum,
                d.optString("wind", "") + "  ·  " + d.optString("humidity", ""));
            v.setTextViewText(R.id.widget_updated, d.optString("updated", ""));
        } else {
            v.setTextViewText(R.id.widget_place, "Skyfield — open the app");
            v.setTextViewText(R.id.widget_temp, "--°");
            v.setTextViewText(R.id.widget_sub, "Tap ⟳ to load");
        }

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            v.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(context, 0, open, flags));
        }

        Intent refresh = new Intent(context, SkyfieldLarge.class).setAction(ACTION_REFRESH);
        v.setOnClickPendingIntent(R.id.widget_refresh,
            PendingIntent.getBroadcast(context, 1, refresh, flags));

        mgr.updateAppWidget(id, v);
    }

    private static String optClean(JSONObject d, String key) {
        String s = d.optString(key, "");
        return (s == null || s.equals("null")) ? "" : s;
    }

    private JSONObject readSnapshot(Context context) {
        try {
            File f = new File(context.getFilesDir(), SNAPSHOT_FILE);
            if (!f.exists()) return null;
            FileInputStream fis = new FileInputStream(f);
            byte[] bytes = new byte[(int) f.length()];
            int read = fis.read(bytes);
            fis.close();
            if (read <= 0) return null;
            return new JSONObject(new String(bytes, "UTF-8"));
        } catch (Exception e) {
            return null;
        }
    }

    private String emoji(String code, boolean day) {
        switch (code) {
            case "clear":
            case "sunny":
            case "hot":
                return day ? "☀️" : "🌙"; // sun / moon
            case "partly":
                return day ? "⛅" : "☁️"; // sun-cloud / cloud
            case "cloudy":
            case "overcast":
                return "☁️"; // cloud
            case "fog":
                return "🌫️"; // fog
            case "drizzle":
            case "rain":
            case "showers":
                return "🌧️"; // rain
            case "tstorm":
                return "⛈️"; // thunder
            case "snow":
            case "sleet":
            case "cold":
                return "🌨️"; // snow
            case "wind":
                return "💨"; // wind
            default:
                return "🌡️"; // thermometer
        }
    }
}
