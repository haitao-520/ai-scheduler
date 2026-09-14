package com.pbrili;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public class ShiftWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "scheduler_widget";
    static final String KEY_DATA = "data";

    private static final int TODAY_FALLBACK = 0xFF1F5FBF;
    private static final int TOMORROW_FALLBACK = 0xFFD35400;
    private static final int EMPTY = 0xFF6B7280;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, ShiftWidgetProvider.class);
        for (int id : manager.getAppWidgetIds(name)) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shifts);
            JSONObject shifts = readShifts(context);

            Calendar today = Calendar.getInstance();
            Calendar tomorrow = (Calendar) today.clone();
            tomorrow.add(Calendar.DAY_OF_MONTH, 1);

            int[] todayColor = {0};
            int[] tomorrowColor = {0};
            String todayText = describe(shifts, today, todayColor);
            String tomorrowText = describe(shifts, tomorrow, tomorrowColor);

            int colorToday = todayColor[0] != 0 ? todayColor[0] : EMPTY;
            int colorTomorrow = tomorrowColor[0] != 0 ? tomorrowColor[0] : EMPTY;
            if (colorToday == colorTomorrow) {
                colorTomorrow = colorTomorrow == TOMORROW_FALLBACK ? TODAY_FALLBACK : TOMORROW_FALLBACK;
            }

            views.setTextViewText(R.id.widget_shifts_today, todayText);
            views.setTextViewText(R.id.widget_shifts_tomorrow, tomorrowText);
            views.setTextColor(R.id.widget_shifts_today, colorToday);
            views.setTextColor(R.id.widget_shifts_tomorrow, colorTomorrow);

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                    context,
                    1,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_shifts_root, pending);

            manager.updateAppWidget(widgetId, views);
        } catch (Throwable ignored) {
            // 小部件渲染失败时静默处理，避免拖垮桌面
        }
    }

    private static JSONObject readShifts(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_DATA, "");
            if (raw == null || raw.isEmpty()) return new JSONObject();
            JSONObject root = new JSONObject(raw);
            JSONObject shifts = root.optJSONObject("shifts");
            return shifts != null ? shifts : new JSONObject();
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static String describe(JSONObject shifts, Calendar cal, int[] color) {
        JSONArray list = shifts.optJSONArray(key(cal));
        if (list == null || list.length() == 0) return label(cal) + " 无排班";

        StringBuilder builder = new StringBuilder(label(cal)).append("  ");
        boolean hasWork = false;
        boolean first = true;
        for (int i = 0; i < list.length(); i++) {
            JSONObject shift = list.optJSONObject(i);
            if (shift == null) continue;
            String start = shift.optString("start", "");
            String end = shift.optString("end", "");
            if (!first) builder.append(" ");
            first = false;
            if (!start.isEmpty() && !end.isEmpty()) {
                builder.append(start).append("-").append(end);
                if (!hasWork) {
                    color[0] = colorFor(start);
                    hasWork = true;
                }
            } else {
                builder.append(shift.optString("name", "休息"));
            }
        }
        if (!hasWork) color[0] = EMPTY;
        return builder.toString();
    }

    private static String label(Calendar cal) {
        Calendar now = Calendar.getInstance();
        Calendar next = (Calendar) now.clone();
        next.add(Calendar.DAY_OF_MONTH, 1);
        return sameDay(cal, now) ? "今天" : sameDay(cal, next) ? "明天" : "当天";
    }

    private static boolean sameDay(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
                && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    private static int colorFor(String start) {
        int from = minutes(start);
        if (from < 0) return EMPTY;
        if (from < 12 * 60) return 0xFFD35400;
        if (from < 16 * 60) return 0xFF1E8449;
        if (from < 21 * 60) return 0xFF6C3483;
        return 0xFF1B2631;
    }

    private static String key(Calendar cal) {
        return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH));
    }

    private static int minutes(String value) {
        try {
            String[] parts = value.split(":");
            if (parts.length != 2) return -1;
            int hour = Integer.parseInt(parts[0].trim());
            int minute = Integer.parseInt(parts[1].trim());
            if (hour > 23 || minute > 59) return -1;
            return hour * 60 + minute;
        } catch (Exception e) {
            return -1;
        }
    }
}
