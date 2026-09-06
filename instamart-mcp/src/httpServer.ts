import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createInstamartClient } from './clientFactory.js';
import { InstamartChatAgent, type ChatMessage } from './chatAgent.js';
import { RecipeCheckoutAgent } from './recipeAgent.js';
import { MemoryShoppingStateStore, type ShoppingAgentState, type ShoppingStateStore } from './shoppingState.js';
import { unwrapToolResult } from './toolResult.js';
import type { RecipeItem } from './types.js';

const client = createInstamartClient();
const defaultStateStore = new MemoryShoppingStateStore();
const tokenStateStores = new Map<string, MemoryShoppingStateStore>();
const port = Number(process.env.INSTAMART_PORT || 8787);

const server = createServer(async (request, response) => {
  cors(response);
  if (request.method === 'OPTIONS') return send(response, 204, null);
  try {
    if (request.method === 'GET' && (request.url === '/' || request.url === '/app.js' || request.url === '/styles.css')) {
      const asset = request.url === '/' ? 'index.html' : request.url.slice(1);
      const contents = await readFile(new URL(`../public/${asset}`, import.meta.url));
      response.statusCode = 200;
      response.setHeader('Content-Type', asset.endsWith('.html') ? 'text/html; charset=utf-8' : asset.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
      return void response.end(contents);
    }
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, mode: process.env.INSTAMART_MODE || 'mock', aiEnabled: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-5.5', stateStore: 'tabby-synchronized', hostedDatabase: process.env.SPACETIMEDB_DB || 'tabby', hostedUri: process.env.SPACETIMEDB_URI || 'https://maincloud.spacetimedb.com', acceptsTabbyIdentity: true });
    }
    if (request.method === 'GET' && request.url === '/api/tools') {
      return send(response, 200, { tools: await client.listTools() });
    }
    if (request.method === 'POST' && request.url === '/api/recipe-cart') {
      const body = await jsonBody(request) as RecipeRequestBody;
      const store = stateStoreFor(request);
      await hydratePriorState(store, body.sessionId, body.priorState);
      const agent = new RecipeCheckoutAgent(client, store);
      const prepared = await agent.prepare(body.items || [], body.sessionId, body.fallbackAddress);
      return send(response, 200, { ...prepared, state: await store.load(prepared.sessionId) });
    }
    if (request.method === 'POST' && request.url === '/api/checkout') {
      const body = await jsonBody(request) as RecipeRequestBody & { confirmed?: boolean };
      if (!body.sessionId) throw new Error('A shopping session ID is required to confirm checkout.');
      const store = stateStoreFor(request);
      await hydratePriorState(store, body.sessionId, body.priorState);
      const agent = new RecipeCheckoutAgent(client, store);
      const order = unwrapToolResult(await agent.checkout(body.sessionId, body.confirmed === true));
      return send(response, 200, { order, state: await store.load(body.sessionId) });
    }
    if (request.method === 'POST' && request.url === '/api/order-status') {
      const body = await jsonBody(request) as RecipeRequestBody;
      if (!body.sessionId) throw new Error('A shopping session ID is required to track an order.');
      const store = stateStoreFor(request);
      await hydratePriorState(store, body.sessionId, body.priorState);
      const agent = new RecipeCheckoutAgent(client, store);
      const tracking = await agent.trackLatest(body.sessionId);
      return send(response, 200, { ...tracking, state: await store.load(body.sessionId) });
    }
    if (request.method === 'POST' && request.url === '/api/chat') {
      const body = await jsonBody(request) as { sessionId?: string; messages?: ChatMessage[] };
      if (!body.sessionId) throw new Error('A chat session ID is required.');
      const store = stateStoreFor(request);
      const chatAgent = new InstamartChatAgent(client, process.env, store);
      return send(response, 200, await chatAgent.reply(body.sessionId, body.messages || []));
    }
    const toolMatch = request.method === 'POST' && request.url?.match(/^\/api\/tools\/([a-z_]+)$/);
    if (toolMatch) {
      const body = await jsonBody(request) as Record<string, unknown>;
      if (toolMatch[1] === 'checkout' && body.confirmedByUser !== true) {
        throw new Error('checkout requires confirmedByUser=true after showing the refreshed cart, payment method, and delivery address.');
      }
      const { confirmedByUser: _, ...arguments_ } = body;
      return send(response, 200, unwrapToolResult(await client.callTool(toolMatch[1], arguments_)));
    }
    return send(response, 404, { error: 'Not found' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return send(response, 400, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Tabby Instamart developer bridge listening on http://127.0.0.1:${port}`);
});

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function cors(response: ServerResponse): void {
  const origin = response.req.headers.origin || '';
  if (/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function stateStoreFor(request: IncomingMessage) {
  const authorization = request.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return defaultStateStore;
  const existing = tokenStateStores.get(token);
  if (existing) return existing;
  const store = new MemoryShoppingStateStore();
  tokenStateStores.set(token, store);
  return store;
}

interface RecipeRequestBody {
  items?: RecipeItem[];
  sessionId?: string;
  priorState?: ShoppingAgentState;
  fallbackAddress?: { addressLine: string; label?: string };
}

async function hydratePriorState(store: ShoppingStateStore, sessionId?: string, state?: ShoppingAgentState): Promise<void> {
  if (!state || !sessionId || state.sessionId !== sessionId) return;
  await store.save(state);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  if (body === null) return void response.end();
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await client.close?.();
    server.close(() => process.exit(0));
  });
}
