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

import java.util.Locale;

public class MemoWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "scheduler_memo_widget";
    static final String KEY_DATA = "data";

    /** 与日历小部件的 requestCode(0) 区分，避免 PendingIntent 复用覆盖 extras */
    private static final int REQUEST_CODE_OPEN = 1002;

    private static final int[] ROW_IDS = {
        R.id.w_memo_row_0, R.id.w_memo_row_1, R.id.w_memo_row_2, R.id.w_memo_row_3, R.id.w_memo_row_4
    };

    private static final int[] CHECK_IDS = {
        R.id.w_memo_check_0, R.id.w_memo_check_1, R.id.w_memo_check_2, R.id.w_memo_check_3, R.id.w_memo_check_4
    };

    private static final int[] TEXT_IDS = {
        R.id.w_memo_text_0, R.id.w_memo_text_1, R.id.w_memo_text_2, R.id.w_memo_text_3, R.id.w_memo_text_4
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, MemoWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static JSONArray readMemos(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_DATA, "[]");
            if (raw == null || raw.isEmpty()) return new JSONArray();
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_memo);
        JSONArray memos = readMemos(context);

        for (int i = 0; i < ROW_IDS.length; i++) {
            if (i >= memos.length()) {
                views.setViewVisibility(ROW_IDS[i], android.view.View.GONE);
                continue;
            }
            JSONObject memo = memos.optJSONObject(i);
            if (memo == null) {
                views.setViewVisibility(ROW_IDS[i], android.view.View.GONE);
                continue;
            }
            boolean done = memo.optBoolean("done", false);
            String text = memo.optString("text", "");

            views.setViewVisibility(ROW_IDS[i], android.view.View.VISIBLE);
            views.setTextViewText(CHECK_IDS[i], done ? "🟢" : "🔴");
            views.setTextColor(CHECK_IDS[i], done ? 0xFF222831 : 0xFF8A90A2);
            views.setTextViewText(TEXT_IDS[i], text);
            views.setTextColor(TEXT_IDS[i], done ? 0xFF8A90A2 : 0xFF222831);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(MainActivity.EXTRA_OPEN_MEMO, true);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                REQUEST_CODE_OPEN,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(widgetId, views);
    }
}
