import type { PantryItem } from '../../module_bindings/types.ts';
import type { HouseholdAction } from './actions.ts';
import { escapeHouseholdHtml } from './html.ts';

export type PantryStockState = 'out' | 'low' | 'available' | 'use-soon';

export interface PantryViewItem {
  id: bigint;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  location: string;
  lowStockThreshold: number;
  useSoon: boolean;
  stockState: PantryStockState;
  updatedAtMicros?: bigint;
}

export interface PantryFilters {
  query?: string;
  category?: string;
  location?: string;
  stockState?: PantryStockState | 'all';
}

export interface ParsedPantryCommand {
  name: string;
  quantity: number;
  unit: string;
}

export type PantryImageKey =
  | 'apple'
  | 'banana'
  | 'bread'
  | 'carrot'
  | 'default'
  | 'eggs'
  | 'garlic'
  | 'greens'
  | 'lentils'
  | 'milk'
  | 'oats'
  | 'oil'
  | 'onion'
  | 'potato'
  | 'rice'
  | 'tomato';

export function pantryImageKey(name: string): PantryImageKey {
  const normalized = name.toLocaleLowerCase();
  if (/\beggs?\b/.test(normalized)) return 'eggs';
  if (/\b(?:bread|loaf|loaves)\b/.test(normalized)) return 'bread';
  if (/\b(?:milk|dairy)\b/.test(normalized)) return 'milk';
  if (/\bapples?\b/.test(normalized)) return 'apple';
  if (/\bbananas?\b/.test(normalized)) return 'banana';
  if (/\b(?:rice|basmati)\b/.test(normalized)) return 'rice';
  if (/\b(?:lentils?|dal)\b/.test(normalized)) return 'lentils';
  if (/\b(?:oats?|oatmeal)\b/.test(normalized)) return 'oats';
  if (/\bonions?\b/.test(normalized)) return 'onion';
  if (/\btomatoes?\b/.test(normalized)) return 'tomato';
  if (/\bgarlic\b/.test(normalized)) return 'garlic';
  if (/\b(?:cooking|olive|sunflower|mustard)?\s*oil\b/.test(normalized)) return 'oil';
  if (/\bpotatoes?\b/.test(normalized)) return 'potato';
  if (/\bcarrots?\b/.test(normalized)) return 'carrot';
  if (/\b(?:leafy|greens?|spinach|lettuce|kale|vegetables?|veggies)\b/.test(normalized)) return 'greens';
  return 'default';
}

export function formatPantryQuantity(quantity: number, unit: string): string {
  const cleanUnit = unit.trim() || 'items';
  if (quantity === 1 || /^(?:g|kg|ml|l)$/i.test(cleanUnit) || cleanUnit.endsWith('s')) {
    return `${quantity} ${cleanUnit}`;
  }
  const plural = ({
    box: 'boxes', bunch: 'bunches', loaf: 'loaves', pantry: 'pantries',
  } as Record<string, string>)[cleanUnit.toLocaleLowerCase()] ?? `${cleanUnit}s`;
  return `${quantity} ${plural}`;
}

const PANTRY_UNITS = new Set([
  'bag', 'bags', 'bottle', 'bottles', 'box', 'boxes', 'bunch', 'bunches',
  'can', 'cans', 'carton', 'cartons', 'clove', 'cloves', 'cup', 'cups',
  'dozen', 'dozens', 'g', 'gram', 'grams', 'item', 'items', 'jar', 'jars',
  'kg', 'kilogram', 'kilograms', 'l', 'liter', 'liters', 'litre', 'litres',
  'loaf', 'loaves', 'ml', 'pack', 'packs', 'packet', 'packets',
]);

export function parsePantryCommand(text: string): ParsedPantryCommand | null {
  const pantryAddition = text.match(/\b(?:add|put|store|stock)\s+(.+?)\s+(?:to|in)\s+(?:the\s+)?pantry\b/i);
  const purchase = text.match(/\b(?:bought|added|got|purchased|have|store|stock)\s+(.+?)(?:[.!?]+)?$/i);
  const rawDetails = (pantryAddition?.[1] ?? purchase?.[1] ?? '')
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!rawDetails) return null;

  const quantityMatch = rawDetails.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!quantityMatch) return { name: rawDetails, quantity: 1, unit: 'items' };

  const quantity = Math.max(1, Math.round(Number(quantityMatch[1])));
  const remainder = quantityMatch[2].trim();
  const [firstWord, ...rest] = remainder.split(/\s+/);
  if (PANTRY_UNITS.has(firstWord.toLowerCase()) && rest.length > 0) {
    return { name: rest.join(' '), quantity, unit: firstWord.toLowerCase() };
  }
  return { name: remainder, quantity, unit: 'items' };
}

interface PantryItemDetail {
  pantryItemId: bigint;
  category: string;
  location: string;
  lowStockThreshold: number;
  useSoon: boolean;
  updatedAt: { microsSinceUnixEpoch: bigint };
}

function stockState(quantity: number, threshold: number, useSoon: boolean): PantryStockState {
  if (quantity <= 0) return 'out';
  if (useSoon) return 'use-soon';
  if (quantity <= threshold) return 'low';
  return 'available';
}

export function pantryViewItems(items: readonly PantryItem[], details: readonly PantryItemDetail[] = []): PantryViewItem[] {
  const detailsByItem = new Map(details.map(detail => [detail.pantryItemId, detail]));
  return items.map(item => {
    const detail = detailsByItem.get(item.id);
    const threshold = detail?.lowStockThreshold ?? 0;
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: detail?.category ?? '',
      location: detail?.location ?? '',
      lowStockThreshold: threshold,
      useSoon: detail?.useSoon ?? false,
      stockState: stockState(item.quantity, threshold, detail?.useSoon ?? false),
      updatedAtMicros: detail?.updatedAt.microsSinceUnixEpoch,
    };
  });
}

export function filterPantry(items: readonly PantryViewItem[], filters: PantryFilters): PantryViewItem[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? '';
  const category = filters.category?.trim().toLocaleLowerCase() ?? '';
  const location = filters.location?.trim().toLocaleLowerCase() ?? '';
  return items.filter(item => {
    const matchesQuery = !query || `${item.name} ${item.category} ${item.location}`.toLocaleLowerCase().includes(query);
    const matchesCategory = !category || item.category.toLocaleLowerCase() === category;
    const matchesLocation = !location || item.location.toLocaleLowerCase() === location;
    const matchesStock = !filters.stockState || filters.stockState === 'all' || item.stockState === filters.stockState;
    return matchesQuery && matchesCategory && matchesLocation && matchesStock;
  });
}

export function pantryUpdatedLabel(updatedAtMicros: bigint | undefined, nowMicros: bigint): string {
  if (updatedAtMicros === undefined) return 'Update time unavailable';
  const elapsedMinutes = Number((nowMicros - updatedAtMicros) / 60_000_000n);
  if (elapsedMinutes <= 0) return 'Updated just now';
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

export function pantryUpsertAction(item: Omit<PantryViewItem, 'stockState' | 'updatedAtMicros'>): HouseholdAction {
  return {
    reducer: 'upsertPantryItem',
    payload: {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      location: item.location,
      lowStockThreshold: item.lowStockThreshold,
      useSoon: item.useSoon,
    },
  };
}

export function renderPantryRoute(
  items: readonly PantryViewItem[],
  options: { nowMicros: bigint; online: boolean; mobile?: boolean; filters?: PantryFilters },
): string {
  const visible = filterPantry(items, options.filters ?? {});
  const rows = visible.length
    ? visible.map(item => {
      const imageKey = pantryImageKey(item.name);
      return `<article class="pantry-item stock-${item.stockState}" data-pantry-id="${item.id}">
        <span class="pantry-thumb pantry-thumb-${imageKey}" aria-hidden="true">
          <svg viewBox="0 0 64 64" focusable="false"><use href="/pantry-foods.svg#food-${imageKey}"></use></svg>
        </span>
        <div class="pantry-item-name"><h3>${escapeHouseholdHtml(item.name)}</h3></div>
        <p class="pantry-quantity">${escapeHouseholdHtml(formatPantryQuantity(item.quantity, item.unit))}</p>
      </article>`;
    }).join('')
    : '<div class="pantry-empty"><h2>No pantry items match</h2><p>Try clearing a filter or add the first real item.</p></div>';
  return `<section class="pantry-route ${options.mobile ? 'pantry-mobile' : 'pantry-desktop'}" data-household-route="pantry">
    <header class="pantry-route-header"><p class="eyebrow">SHARED PANTRY</p><h1>Pantry</h1><input type="search" data-pantry-search placeholder="Search pantry" value="${escapeHouseholdHtml(options.filters?.query ?? '')}" /></header>
    ${options.online ? '' : '<p class="pantry-offline" role="status">Pantry is unavailable for shared changes while offline.</p>'}
    <div class="pantry-filters" data-pantry-filters>
      <label>Stock<select data-pantry-stock><option value="all">All stock</option><option value="available">Available</option><option value="low">Low</option><option value="out">Out</option><option value="use-soon">Use soon</option></select></label>
    </div>
    <div class="pantry-grid">${rows}</div>
  </section>`;
}

export function pantryShelfSummary(items: readonly PantryViewItem[]) {
  return {
    total: items.length,
    low: items.filter(item => item.stockState === 'low' || item.stockState === 'out').length,
    useSoon: items.filter(item => item.stockState === 'use-soon').length,
    locations: [...new Set(items.map(item => item.location).filter(Boolean))].sort(),
  };
}
