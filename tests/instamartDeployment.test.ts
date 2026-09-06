import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as prepareCart } from '../api/recipe-cart.ts';
import { POST as checkout } from '../api/checkout.ts';
import { POST as orderStatus } from '../api/order-status.ts';
import { readFileSync } from 'node:fs';

const authorization = { Authorization: `Bearer ${'tabby-test-token-'.repeat(3)}`, 'Content-Type': 'application/json' };
const viteConfigSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

function post(path: string, body: unknown): Request {
  return new Request(`https://tabby.example${path}`, {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify(body),
  });
}

test('the deployed Instamart API survives stateless function invocations', async () => {
  const preparedResponse = await prepareCart(post('/api/recipe-cart', {
    sessionId: 'conversation:vercel-test',
    items: [{ name: 'rice', quantity: 1, unit: 'kg' }],
    fallbackAddress: { addressLine: 'Tabby Home, Bengaluru', label: 'Home' },
  }));
  assert.equal(preparedResponse.status, 200);
  const prepared = await preparedResponse.json() as any;
  assert.equal(prepared.state.phase, 'awaiting_confirmation');

  const checkoutResponse = await checkout(post('/api/checkout', {
    sessionId: prepared.sessionId,
    confirmed: true,
    priorState: prepared.state,
  }));
  assert.equal(checkoutResponse.status, 200);
  const ordered = await checkoutResponse.json() as any;
  assert.equal(ordered.state.phase, 'ordered');
  assert.equal(ordered.order.data.cartTotal, 105);

  const trackingResponse = await orderStatus(post('/api/order-status', {
    sessionId: prepared.sessionId,
    priorState: ordered.state,
  }));
  assert.equal(trackingResponse.status, 200);
  const tracking = await trackingResponse.json() as any;
  assert.equal(tracking.status, 'OUT_FOR_DELIVERY');
  assert.equal(tracking.etaMinutes, 10);
});

test('deployed grocery routes require a connected Tabby session', async () => {
  const response = await prepareCart(new Request('https://tabby.example/api/recipe-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ name: 'rice', quantity: 1, unit: 'kg' }] }),
  }));
  assert.equal(response.status, 401);
});

test('the browser uses same-origin grocery routes in production and local dev routes on the parent app', () => {
  const source = readFileSync(new URL('../src/services/agentInstamart.ts', import.meta.url), 'utf8');
  assert.match(source, /const bridgeUrl = \(configuredBridgeUrl \|\| ''\)\.replace\(/);
  assert.doesNotMatch(source, /127\.0\.0\.1:8787/);
  assert.match(viteConfigSource, /handleInstamartApi/);
  assert.ok(viteConfigSource.includes("'/api/recipe-cart'"));
  assert.ok(viteConfigSource.includes("'/api/checkout'"));
  assert.ok(viteConfigSource.includes("'/api/order-status'"));
  assert.match(source, /fetch\(`\$\{bridgeUrl\}\$\{path\}`/);
});
