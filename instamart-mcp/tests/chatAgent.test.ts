import assert from 'node:assert/strict';
import test from 'node:test';
import { InstamartChatAgent } from '../src/chatAgent.js';
import { MockInstamartClient } from '../src/mockClient.js';
import { MemoryShoppingStateStore } from '../src/shoppingState.js';

test('routes common search language without an OpenAI key', async () => {
  const agent = new InstamartChatAgent(new MockInstamartClient(), {});
  const reply = await agent.reply('chat-1', [{ role: 'user', content: 'Search for tomatoes' }]);
  assert.equal(reply.aiEnabled, false);
  const search = reply.toolCalls.find(call => call.name === 'search_products');
  assert.ok(search);
  assert.match(JSON.stringify(search.result), /Fresh Tomato/);
});

test('plans pack quantity, persists the selected SKU, and checks out after a separate confirmation', async () => {
  const client = new MockInstamartClient();
  const state = new MemoryShoppingStateStore();
  const firstAgent = new InstamartChatAgent(client, {}, state);
  const review = await firstAgent.reply('chat-3', [{ role: 'user', content: 'search and 10 eggs and checkout' }]);

  const update = review.toolCalls.find(call => call.name === 'update_cart');
  assert.deepEqual(update?.arguments, { items: [{ spinId: 'dev-egg', quantity: 2 }] });
  assert.match(review.message, /reply .yes, place the order./i);

  // A new agent instance simulates a process/request boundary. The shared store
  // retains the SKU and confirmation phase.
  const restartedAgent = new InstamartChatAgent(client, {}, state);
  const order = await restartedAgent.reply('chat-3', [{ role: 'user', content: 'yeah, go ahead and order' }]);
  assert.match(JSON.stringify(order.toolCalls[0].result), /DEV-/);
});

test('rejects invented update_cart arguments instead of silently emptying the cart', async () => {
  const client = new MockInstamartClient();
  await assert.rejects(
    () => client.callTool('update_cart', { product_query: 'Fresh Eggs', quantity: 1 }),
    /items is required/,
  );
  const cart = await client.callTool('get_cart', {}) as any;
  assert.deepEqual(cart.data.items, []);
});

test('direct checkout refreshes a review before accepting confirmation', async () => {
  const client = new MockInstamartClient();
  await client.callTool('update_cart', { items: [{ spinId: 'dev-onion', quantity: 1 }] });
  const agent = new InstamartChatAgent(client, {});
  const command = '/tool checkout {"addressId":"dev-home","paymentMethod":"COD","confirmedByUser":true}';

  const review = await agent.reply('chat-2', [{ role: 'user', content: command }]);
  assert.equal((review.toolCalls[0].result as any).requiresExplicitConfirmation, true);

  const order = await agent.reply('chat-2', [
    { role: 'assistant', content: review.message },
    { role: 'user', content: command },
  ]);
  assert.match(JSON.stringify(order.toolCalls[0].result), /DEV-/);
});
