package com.pbrili;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.util.Calendar;
import java.util.Locale;

public class ShiftAlarmReceiver extends BroadcastReceiver {

    static final String CHANNEL_ID = "shift_reminder_v3";
    private static final String[] LEGACY_CHANNELS = { "shift_reminder", "shift_reminder_v2" };
    private static final long[] VIBRATION = new long[] { 0, 400, 200, 400 };

    @Override
    public void onReceive(Context context, Intent intent) {
        String name = intent.getStringExtra("name");
        String start = intent.getStringExtra("start");
        int leadMinutes = intent.getIntExtra("lead", ShiftAlarmScheduler.DEFAULT_LEAD_MINUTES);
        if (name == null || name.isEmpty()) {
            name = "班次";
        }
        postNotification(context, name, start, leadMinutes);
        ShiftAlarmScheduler.reschedule(context);
        ShiftWidgetProvider.updateAll(context);
    }

    public static void sendTest(Context context) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.MINUTE, 30);
        String start = String.format(
                Locale.CHINA,
                "%02d:%02d",
                cal.get(Calendar.HOUR_OF_DAY),
                cal.get(Calendar.MINUTE));
        postNotification(context, "早班", start, 30);
    }

    static void cleanupLegacyChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        for (String id : LEGACY_CHANNELS) {
            if (manager.getNotificationChannel(id) != null) {
                manager.deleteNotificationChannel(id);
            }
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        cleanupLegacyChannels(context);
        if (manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "上班提醒", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("班次开始前的通知提醒");
        AudioAttributes attributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        channel.setSound(defaultSound(), attributes);
        channel.enableVibration(true);
        channel.setVibrationPattern(VIBRATION);
        manager.createNotificationChannel(channel);
    }

    private static Uri defaultSound() {
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (sound == null) {
            sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        }
        if (sound == null) {
            sound = Settings.System.DEFAULT_NOTIFICATION_URI;
        }
        return sound;
    }

    static void postNotification(Context context, String name, String start, int leadMinutes) {
        ensureChannel(context);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return;
        }

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(context, 1002, openIntent, flags);

        String text = start == null || start.isEmpty()
                ? name + " 即将开始，别忘了准备上班"
                : name + " 将于 " + start + " 开始，还有 " + leadMinutes + " 分钟";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_shift)
                .setContentTitle("上班提醒")
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setSound(defaultSound())
                .setVibrate(VIBRATION)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(contentIntent);

        NotificationManagerCompat.from(context)
                .notify((int) (System.currentTimeMillis() & 0xFFFFFF), builder.build());
    }
}
