import { Capacitor, registerPlugin } from '@capacitor/core';

export interface WidgetGrocery {
  name: string;
  quantity: number;
  unit: string;
}

interface WidgetBridgePlugin {
  updateGroceries(options: { itemsJson: string; updatedAt: number }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
const snapshotKey = 'tabby_widget_snapshot';

export async function syncGroceriesWidget(items: WidgetGrocery[], updatedAt = Date.now()) {
  const snapshot = {
    items: items.slice(0, 20).map(item => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit.trim() || 'items',
    })),
    updatedAt,
  };

  localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

  try {
    await WidgetBridge.updateGroceries({
      itemsJson: JSON.stringify(snapshot.items),
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    console.warn('Unable to refresh the Android grocery widget:', error);
  }
}
