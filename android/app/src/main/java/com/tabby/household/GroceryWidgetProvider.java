package com.tabby.household;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class GroceryWidgetProvider extends AppWidgetProvider {
    public static final String PREFERENCES_NAME = "tabby_grocery_widget";
    public static final String KEY_ITEMS_JSON = "items_json";
    public static final String KEY_UPDATED_AT = "updated_at";

    private static final int[] ROW_IDS = {
        R.id.grocery_item_1,
        R.id.grocery_item_2,
        R.id.grocery_item_3,
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            manager.updateAppWidget(appWidgetId, buildViews(context));
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, GroceryWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.grocery_widget);
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        JSONArray items;
        try {
            items = new JSONArray(preferences.getString(KEY_ITEMS_JSON, "[]"));
        } catch (Exception ignored) {
            items = new JSONArray();
        }

        int count = items.length();
        views.setTextViewText(R.id.grocery_count, count == 1 ? "1 item" : count + " items");
        views.setViewVisibility(R.id.grocery_empty, count == 0 ? View.VISIBLE : View.GONE);

        for (int index = 0; index < ROW_IDS.length; index++) {
            int rowId = ROW_IDS[index];
            if (index < count) {
                JSONObject item = items.optJSONObject(index);
                views.setTextViewText(rowId, item == null ? "" : formatItem(item));
                views.setViewVisibility(rowId, View.VISIBLE);
            } else {
                views.setViewVisibility(rowId, View.GONE);
            }
        }

        int remaining = Math.max(0, count - ROW_IDS.length);
        long updatedAt = preferences.getLong(KEY_UPDATED_AT, 0L);
        String footer = remaining > 0 ? "+" + remaining + " more" : "";
        if (updatedAt > 0) {
            String time = DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(updatedAt));
            footer = footer.isEmpty() ? "Updated " + time : footer + "  ·  Updated " + time;
        } else if (count == 0) {
            footer = "Open Tabby to sync";
        }
        views.setTextViewText(R.id.grocery_footer, footer);

        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setAction("com.tabby.household.OPEN_GROCERIES");
        openApp.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.grocery_widget_root, pendingIntent);
        return views;
    }

    private static String formatItem(JSONObject item) {
        String name = item.optString("name", "Groceries").trim();
        String unit = item.optString("unit", "items").trim();
        double quantity = item.optDouble("quantity", 0);
        String amount = formatQuantity(quantity);
        return "•  " + name + (amount.isEmpty() ? "" : "  ·  " + amount + " " + unit);
    }

    static String formatQuantity(double quantity) {
        if (!Double.isFinite(quantity) || quantity <= 0) return "";
        if (quantity == Math.rint(quantity)) return String.valueOf((long) quantity);
        return String.format(Locale.getDefault(), "%.1f", quantity);
    }
}
