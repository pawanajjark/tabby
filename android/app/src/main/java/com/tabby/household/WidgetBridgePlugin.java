package com.tabby.household;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;
import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void updateGroceries(PluginCall call) {
        String itemsJson = call.getString("itemsJson", "[]");
        Long updatedAt = call.getLong("updatedAt", System.currentTimeMillis());

        try {
            new JSONArray(itemsJson);
        } catch (JSONException error) {
            call.reject("Groceries must be a valid JSON array.", error);
            return;
        }

        SharedPreferences preferences = getContext().getSharedPreferences(
            GroceryWidgetProvider.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        );
        preferences.edit()
            .putString(GroceryWidgetProvider.KEY_ITEMS_JSON, itemsJson)
            .putLong(GroceryWidgetProvider.KEY_UPDATED_AT, updatedAt)
            .apply();

        GroceryWidgetProvider.refreshAll(getContext());
        call.resolve();
    }
}
