import assert from 'node:assert/strict';
import test from 'node:test';
import { MockInstamartClient } from '../src/mockClient.js';
import { productSearchQuery, RecipeCheckoutAgent } from '../src/recipeAgent.js';
import { MemoryShoppingStateStore } from '../src/shoppingState.js';

test('prepares a recipe cart and requires confirmation before developer checkout', async () => {
  const client = new MockInstamartClient();
  const state = new MemoryShoppingStateStore();
  const agent = new RecipeCheckoutAgent(client, state);
  const prepared = await agent.prepare([
    { name: 'tomatoes', quantity: 750, unit: 'g' },
    { name: 'rice', quantity: 1, unit: 'kg' },
  ]);

  assert.equal(prepared.matches.length, 2);
  assert.equal(prepared.matches[0].quantity, 2);
  assert.equal(prepared.paymentMethod, 'COD');
  assert.equal((prepared.cart as any).couponApplied, 'DEV10');
  assert.equal((prepared.cart as any).pricing.couponDiscount, 10);
  await assert.rejects(() => agent.checkout(prepared.sessionId, false), /Explicit user confirmation/);

  const restartedAgent = new RecipeCheckoutAgent(client, state);
  const result = await restartedAgent.checkout(prepared.sessionId, true) as any;
  assert.equal(result.success, true);
  assert.match(result.data.orderId, /^DEV-/);
});

test('reports recipe ingredients that the developer catalogue cannot match', async () => {
  const agent = new RecipeCheckoutAgent(new MockInstamartClient());
  const prepared = await agent.prepare([
    { name: 'onion', quantity: 1, unit: 'kg' },
    { name: 'dragon fruit powder', quantity: 20, unit: 'g' },
  ]);
  assert.equal(prepared.matches.length, 1);
  assert.equal(prepared.unavailable[0].name, 'dragon fruit powder');
});

test('reuses a conversation session and retains context across recipe queries', async () => {
  const store = new MemoryShoppingStateStore();
  const agent = new RecipeCheckoutAgent(new MockInstamartClient(), store);
  const first = await agent.prepare([{ name: 'rice', quantity: 1, unit: 'kg' }], 'conversation:tabby-test');
  const second = await agent.prepare([{ name: 'tomatoes', quantity: 500, unit: 'g' }], 'conversation:tabby-test');
  const state = await store.load('conversation:tabby-test');

  assert.equal(first.sessionId, 'conversation:tabby-test');
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(state?.requestedItems[0].name, 'tomatoes');
  assert.equal(state?.toolContext.length, 2);
});

test('creates an Instamart address from the selected Tabby home when none is saved', async () => {
  class NoAddressClient extends MockInstamartClient {
    override async callTool(name: string, args: Record<string, any>): Promise<unknown> {
      if (name === 'get_addresses') return { success: true, data: { addresses: [] } };
      return super.callTool(name, args);
    }
  }

  const agent = new RecipeCheckoutAgent(new NoAddressClient(), new MemoryShoppingStateStore());
  const prepared = await agent.prepare(
    [{ name: 'rice', quantity: 1, unit: 'kg' }],
    'conversation:no-address',
    { addressLine: 'Flat 402, Palm Grove Residency', label: 'Home' },
  );

  assert.equal(prepared.addressId, 'dev-created-address');
  assert.equal(prepared.deliveryAddress, 'Flat 402, Palm Grove Residency');
});

test('reduces compound recipe labels to concrete Instamart searches', async () => {
  assert.equal(productSearchQuery('paneer or tofu'), 'paneer');
  assert.equal(productSearchQuery('spices (garam masala, coriander)'), 'coriander powder');
  assert.equal(productSearchQuery('olive oil / cooking oil'), 'olive oil');

  const searches: string[] = [];
  class SearchRecordingClient extends MockInstamartClient {
    override async callTool(name: string, args: Record<string, any>): Promise<unknown> {
      if (name === 'search_products') searches.push(String(args.query));
      return super.callTool(name, args);
    }
  }
  const agent = new RecipeCheckoutAgent(new SearchRecordingClient(), new MemoryShoppingStateStore());
  const prepared = await agent.prepare([
    { name: 'paneer or tofu', quantity: 200, unit: 'g' },
    { name: 'spices (garam masala, coriander)', quantity: 1, unit: 'tsp' },
  ]);

  assert.deepEqual(searches, ['paneer', 'coriander powder']);
  assert.deepEqual(prepared.matches.map(match => match.productName), ['Fresh Malai Paneer', 'Coriander Powder']);
});

test('tracks the latest checked-out order and stores the refreshed delivery context', async () => {
  const store = new MemoryShoppingStateStore();
  const agent = new RecipeCheckoutAgent(new MockInstamartClient(), store);
  const prepared = await agent.prepare([{ name: 'rice', quantity: 1, unit: 'kg' }], 'conversation:tracking');
  const checkout = await agent.checkout(prepared.sessionId, true) as any;
  const tracking = await agent.trackLatest(prepared.sessionId);
  const state = await store.load(prepared.sessionId);

  assert.equal(tracking.orderId, checkout.data.orderId);
  assert.equal(tracking.status, 'OUT_FOR_DELIVERY');
  assert.equal(tracking.etaMinutes, 10);
  assert.equal(state?.toolContext.at(-1)?.name, 'get_delivery_status');
  assert.equal(state?.phase, 'ordered');
});
