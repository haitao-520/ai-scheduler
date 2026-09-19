package com.pbrili;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

public class ShiftWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "scheduler_widget";
    static final String KEY_DATA = "data";
    static final String ACTION_REFRESH = "com.pbrili.WIDGET_REFRESH";
    private static final int REFRESH_REQUEST_CODE = 2001;
    private static final int REPEAT_REQUEST_CODE = 2002;
    private static final long REPEAT_INTERVAL_MS = 15L * 60L * 1000L;

    // 与前端 src/lib/colors.ts 保持一致的配色
    private static final int WORK = 0xFF409EFF;
    private static final int REST = 0xFF909399;
    private static final int MORNING = 0xFFE6A23C;
    private static final int NOON = 0xFF1ABC9C;
    private static final int EVENING = 0xFF8E44AD;
    private static final int NIGHT = 0xFF2C3E50;
    private static final int EMPTY = 0xFF6B7280;
    private static final int[] PALETTE = {WORK, MORNING, NOON, EVENING, NIGHT, REST};

    private static final int DAY_MINUTES = 24 * 60;
    private static final int[][] PERIOD_RANGES = {
            {8 * 60, 12 * 60 + 40},
            {12 * 60 + 40, 17 * 60 + 20},
            {17 * 60 + 20, 22 * 60},
            {22 * 60, 8 * 60},
    };
    private static final String[] PERIOD_NAMES = {"早", "中", "晚", "夜"};

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            updateAll(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
        scheduleNextRefresh(context);
        ensurePeriodicRefresh(context);
    }

    // 15 分钟兜底刷新，避免精确闹钟被系统限制时长时间不刷新
    private static void ensurePeriodicRefresh(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent intent = new Intent(context, ShiftWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, REPEAT_REQUEST_CODE, intent, flags);
        am.setInexactRepeating(
                AlarmManager.RTC,
                System.currentTimeMillis() + REPEAT_INTERVAL_MS,
                REPEAT_INTERVAL_MS,
                pi);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, ShiftWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
        if (ids.length > 0) {
            scheduleNextRefresh(context);
        }
    }

    // 在当天某个班次结束的时刻安排一次刷新，让标签颜色及时切到下一个班
    private static void scheduleNextRefresh(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(context, ShiftWidgetProvider.class);
            intent.setAction(ACTION_REFRESH);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(context, REFRESH_REQUEST_CODE, intent, flags);
            long next = nextBoundary(context);
            if (next <= 0) {
                am.cancel(pi);
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            }
        } catch (Throwable ignored) {
            // 精确闹钟不可用时退化为 15 分钟兜底刷新
        }
    }

    private static long nextBoundary(Context context) {
        JSONArray list = readShifts(context).optJSONArray(key(Calendar.getInstance()));
        if (list == null) return 0;
        Calendar now = Calendar.getInstance();
        long nowMs = now.getTimeInMillis();
        int nowMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        long best = Long.MAX_VALUE;
        for (int i = 0; i < list.length(); i++) {
            JSONObject shift = list.optJSONObject(i);
            if (shift == null) continue;
            int start = minutes(shift.optString("start", ""));
            int end = minutes(shift.optString("end", ""));
            if (start < 0 || end < 0) continue;
            Calendar boundary = (Calendar) now.clone();
            boundary.set(Calendar.HOUR_OF_DAY, end / 60);
            boundary.set(Calendar.MINUTE, end % 60);
            boundary.set(Calendar.SECOND, 0);
            boundary.set(Calendar.MILLISECOND, 0);
            if (end <= start && nowMinutes >= end) {
                boundary.add(Calendar.DAY_OF_MONTH, 1);
            }
            long time = boundary.getTimeInMillis();
            if (time > nowMs && time < best) {
                best = time;
            }
        }
        return best == Long.MAX_VALUE ? 0 : best;
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shifts_v8);
            JSONObject shifts = readShifts(context);

            Calendar today = Calendar.getInstance();
            Calendar tomorrow = (Calendar) today.clone();
            tomorrow.add(Calendar.DAY_OF_MONTH, 1);

            List<Line> todayLines = describeDay(shifts, today);
            List<Line> tomorrowLines = describeDay(shifts, tomorrow);

            int todayActive = activeIndex(todayLines, true);

            bindDay(views, todayLines, R.id.ws8_today_lines);
            bindDay(views, tomorrowLines, R.id.ws8_tomorrow_lines);

            views.setTextColor(R.id.ws8_today_label, labelColor(todayLines, todayActive));
            views.setTextColor(
                    R.id.ws8_tomorrow_label,
                    tomorrowLines.isEmpty() ? EMPTY : tomorrowLines.get(0).color);

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                    context,
                    1,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.ws8_root, pending);

            manager.updateAppWidget(widgetId, views);
        } catch (Throwable ignored) {
            // 小部件渲染失败时静默处理，避免拖垮桌面
        }
    }

    // 一天的所有班次放在同一个 TextView 里（用换行），字号天然完全一致；
    // 每行颜色用 ForegroundColorSpan，并把 TextView 基准色设为第一行颜色，
    // 这样即使 MIUI 只保留最后一个 span，第一行仍能落到正确的基准色。
    // 注意：不要用「一天多个 TextView」的竖向堆叠，MIUI 会把靠下的 TextView 自动缩小。
    private static void bindDay(RemoteViews views, List<Line> lines, int id) {
        if (lines.isEmpty()) {
            views.setTextViewText(id, "无排班");
            views.setTextColor(id, EMPTY);
            return;
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lines.size(); i++) {
            if (i > 0) sb.append('\n');
            sb.append(lines.get(i).text);
        }
        SpannableString span = new SpannableString(sb.toString());
        int cursor = 0;
        for (int i = 0; i < lines.size(); i++) {
            int start = cursor;
            int end = cursor + lines.get(i).text.length();
            span.setSpan(
                    new ForegroundColorSpan(lines.get(i).color),
                    start,
                    end,
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            cursor = end + 1;
        }
        views.setTextViewText(id, span);
        views.setTextColor(id, lines.get(0).color);
    }

    // 当天「当前/下一个」班次的下标：今天取第一个还没结束的班；明天取第一个班；都结束了返回 -1
    private static int activeIndex(List<Line> lines, boolean isToday) {
        if (lines.isEmpty()) {
            return -1;
        }
        if (!isToday) {
            return 0;
        }
        int now = currentMinutes();
        for (int i = 0; i < lines.size(); i++) {
            if (!isEnded(lines.get(i), now)) {
                return i;
            }
        }
        return -1;
    }

    // 标签颜色与当天「当前班次」颜色一致：两个班时先取第一个班，第一个班结束后自动切到下一个班
    private static int labelColor(List<Line> lines, int index) {
        if (lines.isEmpty()) {
            return EMPTY;
        }
        if (index < 0 || index >= lines.size()) {
            return lines.get(lines.size() - 1).color;
        }
        return lines.get(index).color;
    }

    private static boolean isEnded(Line line, int now) {
        if (line.start < 0 || line.end < 0) {
            return false;
        }
        if (line.end > line.start) {
            return now >= line.end;
        }
        // 跨夜班（如 22:00-00:00、22:00-06:00）：在当天内要么还没开始，要么正在进行，
        // 永远不算「已结束」，避免白天时把当晚的夜班误判成结束。
        return false;
    }

    private static int currentMinutes() {
        Calendar now = Calendar.getInstance();
        return now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
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

    private static List<Line> describeDay(JSONObject shifts, Calendar cal) {
        List<Line> lines = new ArrayList<>();
        JSONArray list = shifts.optJSONArray(key(cal));
        if (list == null) {
            return lines;
        }
        for (int i = 0; i < list.length(); i++) {
            JSONObject shift = list.optJSONObject(i);
            if (shift == null) continue;
            String name = shift.optString("name", "班次");
            String start = shift.optString("start", "");
            String end = shift.optString("end", "");
            String text = (!start.isEmpty() && !end.isEmpty()) ? start + "-" + end : name;
            lines.add(new Line(text, colorForShift(name, start, end), minutes(start), minutes(end)));
        }
        return lines;
    }

    private static int colorForShift(String name, String start, String end) {
        if (start != null && !start.isEmpty()) {
            String period = periodForTime(start, end);
            if (period != null) {
                if ("早".equals(period)) return MORNING;
                if ("中".equals(period)) return NOON;
                if ("晚".equals(period)) return EVENING;
                return NIGHT;
            }
        }
        return colorForName(name);
    }

    private static int colorForName(String name) {
        String value = name == null ? "" : name;
        if ("上班".equals(value) || "白班".equals(value)) return WORK;
        if ("休息".equals(value)) return REST;
        if ("早班".equals(value)) return MORNING;
        if ("中班".equals(value)) return NOON;
        if ("晚班".equals(value)) return EVENING;
        if ("夜班".equals(value)) return NIGHT;
        int hash = 0;
        for (int i = 0; i < value.length(); i++) {
            hash = hash * 31 + value.charAt(i);
        }
        int index = (int) (((long) hash & 0xFFFFFFFFL) % PALETTE.length);
        return PALETTE[index];
    }

    private static String periodForTime(String start, String end) {
        int from = minutes(start);
        if (from < 0) return null;
        int to = (end == null || end.isEmpty()) ? -1 : minutes(end);
        int[][] shiftSegments = (to < 0 || to == from) ? new int[0][] : toSegments(from, to);

        if (shiftSegments.length == 0) {
            for (int i = 0; i < PERIOD_RANGES.length; i++) {
                for (int[] segment : toSegments(PERIOD_RANGES[i][0], PERIOD_RANGES[i][1])) {
                    if (overlap(segment, new int[] {from, from + 1}) > 0) {
                        return PERIOD_NAMES[i];
                    }
                }
            }
            return "夜";
        }

        int best = -1;
        String bestName = "夜";
        for (int i = 0; i < PERIOD_RANGES.length; i++) {
            int total = 0;
            int[][] rangeSegments = toSegments(PERIOD_RANGES[i][0], PERIOD_RANGES[i][1]);
            for (int[] segment : shiftSegments) {
                for (int[] rangeSegment : rangeSegments) {
                    total += overlap(segment, rangeSegment);
                }
            }
            if (total > best) {
                best = total;
                bestName = PERIOD_NAMES[i];
            }
        }
        return bestName;
    }

    private static int[][] toSegments(int start, int end) {
        if (start < end) return new int[][] {{start, end}};
        if (start > end) return new int[][] {{start, DAY_MINUTES}, {0, end}};
        return new int[][] {{0, DAY_MINUTES}};
    }

    private static int overlap(int[] a, int[] b) {
        return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
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

    private static final class Line {
        final String text;
        final int color;
        final int start;
        final int end;

        Line(String text, int color, int start, int end) {
            this.text = text;
            this.color = color;
            this.start = start;
            this.end = end;
        }
    }
}
