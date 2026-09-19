package com.pbrili;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "ShiftAlarm", permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
})
public class ShiftAlarmPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        String data = call.getString("data", "{}");
        boolean enabled = !Boolean.FALSE.equals(call.getBoolean("enabled", true));
        Integer lead = call.getInt("leadMinutes", ShiftAlarmScheduler.DEFAULT_LEAD_MINUTES);
        int leadMinutes = lead == null ? ShiftAlarmScheduler.DEFAULT_LEAD_MINUTES : lead;
        if (leadMinutes < 1) {
            leadMinutes = ShiftAlarmScheduler.DEFAULT_LEAD_MINUTES;
        }
        ShiftAlarmScheduler.prefs(getContext()).edit()
                .putString(ShiftAlarmScheduler.KEY_DATA, data == null ? "{}" : data)
                .putBoolean(ShiftAlarmScheduler.KEY_ENABLED, enabled)
                .putInt(ShiftAlarmScheduler.KEY_LEAD_MINUTES, leadMinutes)
                .apply();
        ShiftAlarmScheduler.reschedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "testPermissionCallback");
            return;
        }
        ShiftAlarmReceiver.sendTest(getContext());
        call.resolve();
    }

    @PermissionCallback
    private void testPermissionCallback(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            ShiftAlarmReceiver.sendTest(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            resolveGranted(call, true);
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        resolveGranted(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
