package com.pbrili;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 解锁/亮屏时刷新小部件，保证「今明班次」强调的班次与当前时间一致
    private final BroadcastReceiver widgetRefreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            ShiftWidgetProvider.updateAll(context);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarWidgetPlugin.class);
        registerPlugin(GalleryPlugin.class);
        registerPlugin(ShiftAlarmPlugin.class);
        super.onCreate(savedInstanceState);

        // 让 WebView 内容延伸到状态栏下方，状态栏透明后与 APP 背景颜色一致
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        applyHighRefreshRate();

        // 清理旧版本遗留的同名通知渠道，避免系统设置里出现重复的「上班提醒」
        ShiftAlarmReceiver.cleanupLegacyChannels(this);

        registerReceiver(widgetRefreshReceiver, new IntentFilter(Intent.ACTION_USER_PRESENT));
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(widgetRefreshReceiver);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyHighRefreshRate();
        ShiftWidgetProvider.updateAll(this);
    }

    // 全局适配高刷新率：取当前分辨率下的最高档刷新率作为首选，最终由系统按「屏幕刷新率」设置决定
    private void applyHighRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        try {
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? getDisplay()
                    : getWindowManager().getDefaultDisplay();
            if (display == null) {
                return;
            }
            Display.Mode current = display.getMode();
            if (current == null) {
                return;
            }
            float maxRefreshRate = current.getRefreshRate();
            for (Display.Mode mode : display.getSupportedModes()) {
                if (mode.getPhysicalWidth() == current.getPhysicalWidth()
                        && mode.getPhysicalHeight() == current.getPhysicalHeight()
                        && mode.getRefreshRate() > maxRefreshRate) {
                    maxRefreshRate = mode.getRefreshRate();
                }
            }
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.preferredRefreshRate = maxRefreshRate;
            getWindow().setAttributes(params);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null
                && getBridge().getWebView() != null
                && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }
        super.onBackPressed();
    }
}
