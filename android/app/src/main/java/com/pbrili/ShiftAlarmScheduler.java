package com.pbrili;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;

final class ShiftAlarmScheduler {

    static final String PREFS = "scheduler_alarm";
    static final String KEY_DATA = "data";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_LEAD_MINUTES = "leadMinutes";
    static final String ACTION = "com.pbrili.SHIFT_ALARM";
    static final int REQUEST_CODE = 1001;
    static final int DEFAULT_LEAD_MINUTES = 30;

    private ShiftAlarmScheduler() {
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    static void cancel(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }
        Intent intent = new Intent(context, ShiftAlarmReceiver.class);
        intent.setAction(ACTION);
        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    static void reschedule(Context context) {
        cancel(context);

        SharedPreferences prefs = prefs(context);
        if (!prefs.getBoolean(KEY_ENABLED, true)) {
            return;
        }

        String raw = prefs.getString(KEY_DATA, "{}");
        int leadMinutes = prefs.getInt(KEY_LEAD_MINUTES, DEFAULT_LEAD_MINUTES);
        if (leadMinutes < 1) {
            leadMinutes = DEFAULT_LEAD_MINUTES;
        }
        long leadMs = leadMinutes * 60L * 1000L;
        long now = System.currentTimeMillis();
        long best = Long.MAX_VALUE;
        String bestName = null;
        String bestStart = null;

        try {
            JSONObject root = new JSONObject(raw);
            JSONObject shifts = root.optJSONObject("shifts");
            if (shifts != null) {
                SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.CHINA);
                fmt.setLenient(false);
                Iterator<String> keys = shifts.keys();
                while (keys.hasNext()) {
                    String date = keys.next();
                    JSONArray list = shifts.optJSONArray(date);
                    if (list == null) {
                        continue;
                    }
                    for (int i = 0; i < list.length(); i++) {
                        JSONObject shift = list.optJSONObject(i);
                        if (shift == null) {
                            continue;
                        }
                        String start = shift.optString("start", "");
                        if (start.isEmpty()) {
                            continue;
                        }
                        Date parsed;
                        try {
                            parsed = fmt.parse(date + " " + start);
                        } catch (Exception e) {
                            continue;
                        }
                        if (parsed == null) {
                            continue;
                        }
                        long trigger = parsed.getTime() - leadMs;
                        if (trigger > now + 1000 && trigger < best) {
                            best = trigger;
                            bestName = shift.optString("name", "班次");
                            bestStart = start;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        if (best == Long.MAX_VALUE || bestName == null) {
            return;
        }

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }

        Intent intent = new Intent(context, ShiftAlarmReceiver.class);
        intent.setAction(ACTION);
        intent.putExtra("name", bestName);
        intent.putExtra("start", bestStart == null ? "" : bestStart);
        intent.putExtra("lead", leadMinutes);
        PendingIntent pi = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, pendingFlags());

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi);
                }
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, best, pi);
            }
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, best, pi);
            }
        }
    }
}
