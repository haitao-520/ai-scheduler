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

public class CalendarWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "scheduler_widget";
    static final String KEY_DATA = "data";
    static final String KEY_STATUS = "status";

    private static final int[] WORK = {0xFFECF5FF, 0xFF409EFF};
    private static final int[] REST = {0xFFF4F4F5, 0xFF909399};
    private static final int[] MORNING = {0xFFFDF6EC, 0xFFE6A23C};
    private static final int[] NOON = {0xFFE6F7F2, 0xFF1ABC9C};
    private static final int[] EVENING = {0xFFF0EAFE, 0xFF8E44AD};
    private static final int[] NIGHT = {0xFFE4E8F5, 0xFF2C3E50};

    private static final int[] CELL_IDS = {
        R.id.w_cell_0, R.id.w_cell_1, R.id.w_cell_2, R.id.w_cell_3, R.id.w_cell_4,
        R.id.w_cell_5, R.id.w_cell_6, R.id.w_cell_7, R.id.w_cell_8, R.id.w_cell_9,
        R.id.w_cell_10, R.id.w_cell_11, R.id.w_cell_12, R.id.w_cell_13, R.id.w_cell_14,
        R.id.w_cell_15, R.id.w_cell_16, R.id.w_cell_17, R.id.w_cell_18, R.id.w_cell_19,
        R.id.w_cell_20, R.id.w_cell_21, R.id.w_cell_22, R.id.w_cell_23, R.id.w_cell_24,
        R.id.w_cell_25, R.id.w_cell_26, R.id.w_cell_27, R.id.w_cell_28, R.id.w_cell_29,
        R.id.w_cell_30, R.id.w_cell_31, R.id.w_cell_32, R.id.w_cell_33, R.id.w_cell_34,
        R.id.w_cell_35, R.id.w_cell_36, R.id.w_cell_37, R.id.w_cell_38, R.id.w_cell_39,
        R.id.w_cell_40, R.id.w_cell_41
    };

    private static final int[] BADGE_IDS = {
        R.id.w_badge_0, R.id.w_badge_1, R.id.w_badge_2, R.id.w_badge_3, R.id.w_badge_4,
        R.id.w_badge_5, R.id.w_badge_6, R.id.w_badge_7, R.id.w_badge_8, R.id.w_badge_9,
        R.id.w_badge_10, R.id.w_badge_11, R.id.w_badge_12, R.id.w_badge_13, R.id.w_badge_14,
        R.id.w_badge_15, R.id.w_badge_16, R.id.w_badge_17, R.id.w_badge_18, R.id.w_badge_19,
        R.id.w_badge_20, R.id.w_badge_21, R.id.w_badge_22, R.id.w_badge_23, R.id.w_badge_24,
        R.id.w_badge_25, R.id.w_badge_26, R.id.w_badge_27, R.id.w_badge_28, R.id.w_badge_29,
        R.id.w_badge_30, R.id.w_badge_31, R.id.w_badge_32, R.id.w_badge_33, R.id.w_badge_34,
        R.id.w_badge_35, R.id.w_badge_36, R.id.w_badge_37, R.id.w_badge_38, R.id.w_badge_39,
        R.id.w_badge_40, R.id.w_badge_41
    };

    private static final int[] ROW_IDS = {
        R.id.w_row_0, R.id.w_row_1, R.id.w_row_2, R.id.w_row_3, R.id.w_row_4, R.id.w_row_5
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                writeStatus(context, "UNCAUGHT " + throwable.getClass().getName() + ": " + throwable.getMessage());
            } catch (Throwable ignored) {
                // 忽略
            }
        });
        writeStatus(context, "onUpdate count=" + appWidgetIds.length);
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
        writeStatus(context, "onUpdate done");
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, CalendarWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) {
            updateWidget(context, manager, id);
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

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        writeStatus(context, "start");
        renderMinimal(context, manager, widgetId, "step1 布局已推送 " + now());
        writeStatus(context, "step1 minimal pushed");
        try {
            renderWidget(context, manager, widgetId);
            writeStatus(context, "ok");
        } catch (Throwable error) {
            writeStatus(context, "ERR " + error.getClass().getSimpleName() + ": " + error.getMessage());
            renderMinimal(context, manager, widgetId,
                    "ERR " + error.getClass().getSimpleName() + "\n" + error.getMessage());
        }
    }

    private static String now() {
        return new java.text.SimpleDateFormat("HH:mm:ss", Locale.US).format(new java.util.Date());
    }

    private static void writeStatus(Context context, String status) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String previous = prefs.getString(KEY_STATUS, "");
            String merged = status + (previous.isEmpty() ? "" : " <- " + previous);
            if (merged.length() > 400) merged = merged.substring(0, 400);
            prefs.edit().putString(KEY_STATUS, merged).commit();
        } catch (Exception ignored) {
            // 状态写入失败无影响
        }
    }

    private static void renderMinimal(Context context, AppWidgetManager manager, int widgetId, String text) {
        try {
            writeStatus(context, "min before");
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_min);
            views.setTextViewText(R.id.widget_min_text, text);
            writeStatus(context, "min calling updateAppWidget");
            manager.updateAppWidget(widgetId, views);
            writeStatus(context, "min after");
        } catch (Throwable error) {
            writeStatus(context, "min ERR " + error.getClass().getName() + ": " + error.getMessage());
        }
    }

    private static void renderWidget(Context context, AppWidgetManager manager, int widgetId) {
        JSONObject shifts = readShifts(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_calendar);

        Calendar today = Calendar.getInstance();
        int year = today.get(Calendar.YEAR);
        int month = today.get(Calendar.MONTH);

        views.setTextViewText(R.id.widget_month, String.format(Locale.CHINA, "%d年%d月", year, month + 1));

        Calendar first = Calendar.getInstance();
        first.clear();
        first.set(year, month, 1);
        int firstDow = first.get(Calendar.DAY_OF_WEEK);
        Calendar cursor = (Calendar) first.clone();
        cursor.add(Calendar.DAY_OF_MONTH, -(firstDow - 1));

        for (int row = 0; row < ROW_IDS.length; row++) {
            boolean hasMonth = false;
            Calendar probe = (Calendar) cursor.clone();
            probe.add(Calendar.DAY_OF_MONTH, row * 7);
            for (int col = 0; col < 7; col++) {
                if (probe.get(Calendar.MONTH) == month) {
                    hasMonth = true;
                    break;
                }
                probe.add(Calendar.DAY_OF_MONTH, 1);
            }
            views.setViewVisibility(
                    ROW_IDS[row],
                    hasMonth ? android.view.View.VISIBLE : android.view.View.GONE);
        }

        String todayKey = key(today);
        for (int index = 0; index < CELL_IDS.length; index++) {
            int cellId = CELL_IDS[index];
            int badgeId = BADGE_IDS[index];
            int day = cursor.get(Calendar.DAY_OF_MONTH);
            boolean inMonth = cursor.get(Calendar.MONTH) == month;
            String dateKey = key(cursor);
            int[] style = dayStyle(shifts, dateKey);

            views.setTextViewText(cellId, String.valueOf(day));
            if (!inMonth) {
                views.setTextColor(cellId, 0xFF9AA0B4);
                views.setTextViewText(badgeId, " ");
            } else {
                views.setTextColor(cellId, dateKey.equals(todayKey) ? 0xFF3730A3 : 0xFF222831);
                if (style == null) {
                    views.setTextViewText(badgeId, " ");
                } else {
                    String badge = badgeText(shifts, dateKey);
                    views.setTextViewText(badgeId, badge);
                    views.setTextColor(badgeId, badge.equals("班") ? 0xFFB71C1C : 0xFF555555);
                }
            }

            cursor.add(Calendar.DAY_OF_MONTH, 1);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        writeStatus(context, "grid built, calling update");
        manager.updateAppWidget(widgetId, views);
    }

    private static String key(Calendar cal) {
        return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH));
    }

    private static int[] dayStyle(JSONObject shifts, String dateKey) {
        JSONArray list = shifts.optJSONArray(dateKey);
        if (list == null || list.length() == 0) return null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject shift = list.optJSONObject(i);
            if (shift == null) continue;
            String start = shift.optString("start", "");
            String end = shift.optString("end", "");
            if (!start.isEmpty() && !end.isEmpty()) return periodColor(start, end);
        }
        return REST;
    }

    private static String badgeText(JSONObject shifts, String dateKey) {
        JSONArray list = shifts.optJSONArray(dateKey);
        if (list == null || list.length() == 0) return "班";
        for (int i = 0; i < list.length(); i++) {
            JSONObject shift = list.optJSONObject(i);
            if (shift == null) continue;
            String start = shift.optString("start", "");
            String end = shift.optString("end", "");
            if (!start.isEmpty() && !end.isEmpty()) return "班";
        }
        return "休";
    }

    private static int[] periodColor(String start, String end) {
        int from = minutes(start);
        int to = minutes(end);
        if (from < 0) return WORK;
        if (to < 0) to = from;

        int[][] ranges = {
            {8 * 60, 12 * 60 + 40, 0},
            {12 * 60 + 40, 17 * 60 + 20, 1},
            {17 * 60 + 20, 22 * 60, 2},
            {22 * 60, 8 * 60, 3},
        };
        int[][] segments = segments(from, to);

        int best = 3;
        int bestOverlap = -1;
        for (int[] range : ranges) {
            int[][] rangeSegments = segments(range[0], range[1]);
            int total = 0;
            for (int[] seg : segments) {
                for (int[] rangeSeg : rangeSegments) {
                    total += Math.max(0, Math.min(seg[1], rangeSeg[1]) - Math.max(seg[0], rangeSeg[0]));
                }
            }
            if (total > bestOverlap) {
                bestOverlap = total;
                best = range[2];
            }
        }

        switch (best) {
            case 0: return MORNING;
            case 1: return NOON;
            case 2: return EVENING;
            default: return NIGHT;
        }
    }

    private static int[][] segments(int start, int end) {
        if (start < end) return new int[][]{{start, end}};
        if (start > end) return new int[][]{{start, 24 * 60}, {0, end}};
        return new int[][]{{0, 24 * 60}};
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
