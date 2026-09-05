import { randomUUID } from 'node:crypto';
import { createShoppingStateStore, emptyShoppingState, type ShoppingStateStore } from './shoppingState.js';
import { payload } from './toolResult.js';
import type { CartPreparation, ProductMatch, RecipeItem, ToolClient } from './types.js';

export class RecipeCheckoutAgent {
  constructor(private readonly client: ToolClient, private readonly stateStore: ShoppingStateStore = createShoppingStateStore()) {}

  async prepare(recipeItems: RecipeItem[], requestedSessionId?: string, fallbackAddress?: { addressLine: string; label?: string }): Promise<CartPreparation> {
    const items = recipeItems.filter(item => item.name.trim() && item.quantity > 0);
    if (!items.length) throw new Error('The recipe has no missing ingredients to shop for.');
    const sessionId = requestedSessionId?.trim() || randomUUID();
    if (sessionId.length > 128) throw new Error('The shopping session ID is too long.');
    const previousState = await this.stateStore.load(sessionId);

    const addressData = payload(await this.client.callTool('get_addresses', {}));
    const addresses = asArray(addressData?.addresses ?? addressData);
    let address = addresses.find((candidate: any) => candidate.id === previousState?.addressId)
      ?? addresses.find((candidate: any) => /home/i.test(candidate.addressTag || candidate.addressCategory || candidate.label || ''))
      ?? addresses[0];
    if (!address?.id && fallbackAddress?.addressLine.trim()) {
      const created = payload(await this.client.callTool('create_address', {
        addressLine: fallbackAddress.addressLine.trim(),
        label: fallbackAddress.label?.trim() || 'Tabby home',
      }));
      const createdId = created?.id ?? created?.addressId;
      if (createdId) address = { id: String(createdId), addressLine: fallbackAddress.addressLine.trim(), label: fallbackAddress.label || 'Tabby home' };
    }
    if (!address?.id) throw new Error('No saved Instamart delivery address is available. Add one in Swiggy first.');

    const matches: ProductMatch[] = [];
    const unavailable: RecipeItem[] = [];
    for (const ingredient of items) {
      const query = productSearchQuery(ingredient.name);
      const result = payload(await this.client.callTool('search_products', { addressId: address.id, query }));
      const previousSelection = previousState?.selectedItems.find(item => normalizedQuery(item.query) === normalizedQuery(ingredient.name));
      const match = selectBestProduct(result, ingredient, previousSelection?.spinId);
      if (match) matches.push(match);
      else unavailable.push(ingredient);
    }
    if (!matches.length) throw new Error('Instamart could not match any of the missing recipe ingredients.');

    await this.client.callTool('update_cart', {
      items: matches.map(match => ({ spinId: match.spinId, quantity: match.quantity })),
    });
    let cart = payload(await this.client.callTool('get_cart', { addressId: address.id }));

    try {
      const couponData = payload(await this.client.callTool('list_coupons', {}));
      const coupon = findApplicableCoupon(couponData);
      if (coupon) {
        await this.client.callTool('apply_coupon', { couponCode: coupon });
        cart = payload(await this.client.callTool('get_cart', { addressId: address.id }));
      }
    } catch {
      // Coupon discovery is an optional optimization; a valid cart should still be returned.
    }

    const paymentData = payload(await this.client.callTool('get_payment_options', {}));
    const previousPayment = (previousState?.payment as any)?.availablePaymentMethods?.[0];
    const paymentMethod = choosePaymentMethod(paymentData, cart, previousPayment ? String(previousPayment) : undefined);
    const prepared: CartPreparation = {
      sessionId,
      addressId: address.id,
      deliveryAddress: address.addressLine || address.displayAddress || address.label || 'Saved address',
      matches,
      unavailable,
      cart,
      paymentMethod,
      expiresAt: Date.now() + 10 * 60_000,
    };
    const state = previousState ?? emptyShoppingState(sessionId);
    state.phase = 'awaiting_confirmation';
    state.addressId = prepared.addressId;
    state.requestedItems = items.map(item => ({ name: item.name, quantity: item.quantity, unit: item.unit }));
    state.selectedItems = matches.map(match => ({
      query: match.ingredient.name,
      productName: match.productName,
      spinId: match.spinId,
      pack: match.pack,
      quantity: match.quantity,
      price: match.price,
    }));
    state.cart = cart;
    state.payment = { availablePaymentMethods: [paymentMethod] };
    state.pendingConfirmation = true;
    state.toolContext = [
      ...state.toolContext,
      { name: 'recipe_preparation', arguments: { items }, result: prepared },
    ].slice(-40);
    await this.stateStore.save(state);
    return prepared;
  }

  async checkout(sessionId: string, confirmed: boolean): Promise<unknown> {
    if (!confirmed) throw new Error('Explicit user confirmation is required before checkout.');
    const state = await this.stateStore.load(sessionId);
    if (!state || state.phase !== 'awaiting_confirmation' || !state.pendingConfirmation) throw new Error('This cart review expired. Prepare the recipe cart again.');

    // Refresh immediately before the non-idempotent checkout call.
    state.cart = payload(await this.client.callTool('get_cart', { addressId: state.addressId }));
    const methods = (state.payment as any)?.availablePaymentMethods;
    const paymentMethod = Array.isArray(methods) && methods[0] ? String(methods[0]) : 'COD';
    const result = await this.client.callTool('checkout', {
      addressId: state.addressId,
      paymentMethod,
    });
    state.phase = 'ordered';
    state.pendingConfirmation = false;
    state.toolContext.push({ name: 'checkout', arguments: { addressId: state.addressId, paymentMethod }, result });
    await this.stateStore.save(state);
    return result;
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function selectBestProduct(data: any, ingredient: RecipeItem, preferredSpinId?: string): ProductMatch | null {
  const products = asArray(data?.products ?? data?.items ?? data?.results);
  const candidates = products.flatMap(product => {
    const variants = asArray(product.variants ?? product.variations);
    return (variants.length ? variants : [product]).map(variant => ({ product, variant }));
  }).filter(({ variant }) => variant?.spinId || variant?.spin_id);
  if (!candidates.length) return null;

  const ingredientTerms = tokens(ingredient.name);
  candidates.sort((a, b) => {
    const aPreferred = String(a.variant.spinId ?? a.variant.spin_id) === preferredSpinId ? 1 : 0;
    const bPreferred = String(b.variant.spinId ?? b.variant.spin_id) === preferredSpinId ? 1 : 0;
    return bPreferred - aPreferred || score(b, ingredientTerms) - score(a, ingredientTerms);
  });
  const { product, variant } = candidates[0];
  const spinId = String(variant.spinId ?? variant.spin_id);
  const productName = String(variant.name ?? product.name ?? product.title ?? ingredient.name);
  const pack = String(variant.pack ?? variant.quantityDescription ?? variant.displayName ?? '1 pack');
  const price = Number(variant.price ?? variant.finalPrice ?? product.price ?? 0);
  return { ingredient, productName, pack, price, spinId, quantity: packCount(ingredient, pack) };
}

function score(candidate: any, ingredientTerms: string[]): number {
  const haystack = tokens(`${candidate.variant?.name || ''} ${candidate.product?.name || ''}`);
  return ingredientTerms.filter(term => haystack.includes(term)).length * 100 - Number(candidate.variant?.price ?? 0) / 1000;
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 1 && !['fresh', 'medium'].includes(term));
}

function normalizedQuery(value: string): string {
  return tokens(value).sort().join(' ');
}

export function productSearchQuery(ingredientName: string): string {
  const clean = ingredientName.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\bspices?\b/.test(clean) && /\bcoriander\b/.test(clean)) return 'coriander powder';
  if (/\bpaneer\b/.test(clean) && /\btofu\b/.test(clean)) return 'paneer';

  const withoutDetails = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const firstOption = withoutDetails.split(/\s+(?:or|and)\s+|\s*[\/&,]\s*/i)[0]?.trim();
  return firstOption || clean;
}

function packCount(ingredient: RecipeItem, pack: string): number {
  const desired = normalizeAmount(ingredient.quantity, ingredient.unit);
  const match = pack.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|piece|pieces|pc|pcs)/);
  if (!match || !desired) return 1;
  const offered = normalizeAmount(Number(match[1]), match[2]);
  if (!offered || offered.kind !== desired.kind) return 1;
  return Math.max(1, Math.ceil(desired.amount / offered.amount));
}

function normalizeAmount(quantity: number, unit: string): { amount: number; kind: string } | null {
  const clean = unit.toLowerCase();
  if (clean === 'kg') return { amount: quantity * 1000, kind: 'weight' };
  if (['g', 'gram', 'grams'].includes(clean)) return { amount: quantity, kind: 'weight' };
  if (['l', 'litre', 'liter'].includes(clean)) return { amount: quantity * 1000, kind: 'volume' };
  if (['ml', 'millilitre', 'milliliter'].includes(clean)) return { amount: quantity, kind: 'volume' };
  if (['item', 'items', 'piece', 'pieces', 'pc', 'pcs'].includes(clean)) return { amount: quantity, kind: 'count' };
  return null;
}

function findApplicableCoupon(data: any): string {
  const direct = asArray(data?.coupons);
  const nested = asArray(data?.coupon_sections ?? data?.sections).flatMap(section => asArray(section.coupons));
  const coupon = [...direct, ...nested].find(candidate => candidate?.applicable === true || candidate?.applicabilityStatus === 'APPLICABLE');
  return String(coupon?.code ?? coupon?.id ?? '');
}

function choosePaymentMethod(paymentData: any, cart: any, preferred?: string): string {
  const methods = asArray(paymentData?.methods ?? paymentData?.paymentMethods ?? paymentData?.availablePaymentMethods);
  const cartMethods = asArray(cart?.availablePaymentMethods ?? cart?.paymentMethods);
  const available = [...methods, ...cartMethods].map(method => typeof method === 'string' ? { id: method, enabled: true } : method);
  const previous = available.find(method => method?.enabled !== false && [method?.groupName, method?.id, method?.displayName].some(value => String(value || '').toLowerCase() === preferred?.toLowerCase()));
  if (previous) return String(previous.groupName || previous.id || preferred);
  const cash = available.find(method => method?.enabled !== false && /^(cash|cod)$/i.test(method?.groupName || method?.id || method?.displayName || ''));
  if (cash) return /cash/i.test(cash.groupName || cash.id || '') ? 'Cash' : 'COD';
  const first = available.find(method => method?.enabled !== false);
  return String(first?.groupName || first?.id || 'COD');
}
