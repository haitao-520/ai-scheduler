package com.pbrili;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CalendarWidget")
public class CalendarWidgetPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        final Context context = getContext();
        final String data = call.getString("data", "{}");
        SharedPreferences prefs = context.getSharedPreferences(CalendarWidgetProvider.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(CalendarWidgetProvider.KEY_DATA, data).apply();
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                CalendarWidgetProvider.updateAll(context);
                ShiftWidgetProvider.updateAll(context);
            });
        } else {
            CalendarWidgetProvider.updateAll(context);
            ShiftWidgetProvider.updateAll(context);
        }
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(CalendarWidgetProvider.PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("status", prefs.getString(CalendarWidgetProvider.KEY_STATUS, ""));
        call.resolve(result);
    }
}
