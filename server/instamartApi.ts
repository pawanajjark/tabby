import { createInstamartClient } from './instamart/clientFactory.js';
import { RecipeCheckoutAgent } from './instamart/recipeAgent.js';
import { MemoryShoppingStateStore, type ShoppingAgentState } from './instamart/shoppingState.js';
import { unwrapToolResult } from './instamart/toolResult.js';
import type { RecipeItem, ToolClient } from './instamart/types.js';

export type InstamartApiAction = 'recipe-cart' | 'checkout' | 'order-status';

interface InstamartRequestBody {
  items?: RecipeItem[];
  sessionId?: string;
  priorState?: ShoppingAgentState;
  fallbackAddress?: { addressLine: string; label?: string };
  confirmed?: boolean;
}

export async function handleInstamartApi(request: Request, action: InstamartApiAction): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S{20,}$/i.test(authorization)) {
    return json({ error: 'A connected Tabby session is required for grocery checkout.' }, 401);
  }

  let client: ToolClient | undefined;
  try {
    const body = await readBody(request);
    client = createInstamartClient();
    const store = new MemoryShoppingStateStore();
    await hydratePriorState(store, body.sessionId, body.priorState);
    const agent = new RecipeCheckoutAgent(client, store);

    if (action === 'recipe-cart') {
      const prepared = await agent.prepare(body.items || [], body.sessionId, body.fallbackAddress);
      return json({ ...prepared, state: await store.load(prepared.sessionId) });
    }

    if (!body.sessionId) throw new Error('A shopping session ID is required.');
    if (action === 'checkout') {
      if (body.confirmed !== true) throw new Error('Explicit user confirmation is required before checkout.');
      await restoreCart(client, body.priorState);
      const order = unwrapToolResult(await agent.checkout(body.sessionId, true));
      return json({ order, state: await store.load(body.sessionId) });
    }

    const tracking = await agent.trackLatest(body.sessionId);
    return json({ ...tracking, state: await store.load(body.sessionId) });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : String(cause) }, 400);
  } finally {
    await client?.close?.();
  }
}

async function readBody(request: Request): Promise<InstamartRequestBody> {
  try {
    return await request.json() as InstamartRequestBody;
  } catch {
    throw new Error('A valid JSON request body is required.');
  }
}

async function hydratePriorState(store: MemoryShoppingStateStore, sessionId?: string, state?: ShoppingAgentState): Promise<void> {
  if (!state || !sessionId || state.sessionId !== sessionId) return;
  await store.save(state);
}

async function restoreCart(client: ToolClient, state?: ShoppingAgentState): Promise<void> {
  if (!state?.selectedItems.length) return;
  await client.callTool('update_cart', {
    items: state.selectedItems.map(item => ({ spinId: item.spinId, quantity: item.quantity })),
  });
  const cart = state.cart as { couponApplied?: unknown } | null;
  const couponCode = typeof cart?.couponApplied === 'string' ? cart.couponApplied.trim() : '';
  if (couponCode) {
    try {
      await client.callTool('apply_coupon', { couponCode });
    } catch {
      // Checkout can continue when a previously shown coupon is no longer applicable.
    }
  }
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}
