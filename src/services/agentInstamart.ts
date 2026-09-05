import type { RecipeIngredient } from './agentCooking';

export interface InstamartMatch {
  ingredient: Pick<RecipeIngredient, 'name' | 'quantity' | 'unit'>;
  productName: string;
  pack: string;
  quantity: number;
  spinId: string;
  price: number;
}

export interface InstamartCartPreparation {
  sessionId: string;
  addressId: string;
  deliveryAddress: string;
  matches: InstamartMatch[];
  unavailable: Array<Pick<RecipeIngredient, 'name' | 'quantity' | 'unit'>>;
  cart: Record<string, unknown>;
  paymentMethod: string;
  expiresAt: number;
}

export interface InstamartRecipeOrder {
  prepared: InstamartCartPreparation;
  order: Record<string, unknown>;
  state?: InstamartShoppingState;
}

export interface InstamartOrderTracking {
  sessionId: string;
  orderId: string;
  status: string;
  etaMinutes?: number;
  etaText?: string;
  details: unknown;
  state: InstamartShoppingState;
}

export interface InstamartShoppingState {
  sessionId: string;
  phase: 'idle' | 'selected' | 'cart_ready' | 'awaiting_confirmation' | 'ordered' | 'failed';
  addressId: string;
  requestedItems: Array<{ name: string; quantity: number; unit: string }>;
  selectedItems: Array<{ query: string; productName: string; spinId: string; pack: string; quantity: number; price: number }>;
  cart: unknown;
  payment: unknown;
  toolContext: Array<{ name: string; arguments: Record<string, unknown>; result: unknown }>;
  pendingConfirmation: boolean;
}

export interface InstamartCheckoutContext {
  sessionId: string;
  priorState?: InstamartShoppingState;
  fallbackAddress?: { addressLine: string; label?: string };
}

const bridgeUrl = ((import.meta.env.VITE_INSTAMART_BRIDGE_URL as string | undefined) || 'http://127.0.0.1:8787').replace(/\/$/, '');
let databaseToken = '';

export class AgentInstamart {
  static useDatabaseToken(token: string): void {
    databaseToken = token;
  }

  static async prepareRecipeCart(ingredients: RecipeIngredient[], sessionId?: string): Promise<InstamartCartPreparation> {
    return request<InstamartCartPreparation>('/api/recipe-cart', {
      items: ingredients.filter(item => !item.inPantry).map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      sessionId,
    });
  }

  static async checkout(sessionId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>('/api/checkout', { sessionId, confirmed: true });
  }

  static async checkoutRecipe(ingredients: RecipeIngredient[], context: InstamartCheckoutContext): Promise<InstamartRecipeOrder> {
    return request<InstamartRecipeOrder>('/api/recipe-checkout', {
      items: ingredients.filter(item => !item.inPantry).map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      confirmed: true,
      ...context,
    });
  }

  static async trackLatestOrder(state: InstamartShoppingState): Promise<InstamartOrderTracking> {
    return request<InstamartOrderTracking>('/api/order-status', {
      sessionId: state.sessionId,
      priorState: state,
    });
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${bridgeUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(databaseToken ? { Authorization: `Bearer ${databaseToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Instamart is not ready. Stop any web-only process and run the parent command: npm run dev.');
  }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Instamart request failed (${response.status}).`);
  return data;
}
