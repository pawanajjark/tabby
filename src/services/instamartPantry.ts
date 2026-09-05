import type { InstamartMatch } from './agentInstamart';

export interface PurchasedPantryItem {
  name: string;
  quantity: number;
  unit: string;
}

export function purchasedPantryItems(matches: InstamartMatch[]): PurchasedPantryItem[] {
  const combined = new Map<string, PurchasedPantryItem>();
  for (const match of matches) {
    const item = purchasedPackAmount(match);
    const key = `${item.name.toLowerCase()}\u0000${item.unit}`;
    const existing = combined.get(key);
    if (existing) existing.quantity += item.quantity;
    else combined.set(key, item);
  }
  return [...combined.values()];
}

function purchasedPackAmount(match: InstamartMatch): PurchasedPantryItem {
  const name = match.productName.trim() || match.ingredient.name.trim();
  const packs = Math.max(1, Math.trunc(match.quantity));
  const size = match.pack.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pieces?|pcs?|items?)/);
  if (!size) return { name, quantity: packs, unit: 'packs' };

  const amount = Number(size[1]) * packs;
  const unit = size[2];
  if (unit === 'kg') return { name, quantity: Math.max(1, Math.round(amount * 1_000)), unit: 'g' };
  if (unit === 'l') return { name, quantity: Math.max(1, Math.round(amount * 1_000)), unit: 'ml' };
  if (/^(?:pieces?|pcs?|items?)$/.test(unit)) return { name, quantity: Math.max(1, Math.round(amount)), unit: 'items' };
  return { name, quantity: Math.max(1, Math.round(amount)), unit };
}
