import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleInstamartApi, type InstamartApiAction } from './server/instamartApi.ts';

function instamartDevApiPlugin(): Plugin {
  return {
    name: 'tabby-instamart-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const action = matchInstamartAction(req.url);
        if (!action) return next();
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Method not allowed.' }));
          return;
        }

        try {
          const body = await readRequestBody(req);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(', '));
          }
          const request = new Request(`http://${req.headers.host || '127.0.0.1'}${req.url || ''}`, {
            method: 'POST',
            headers,
            body,
          });
          const response = await handleInstamartApi(request, action);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

function matchInstamartAction(url?: string): InstamartApiAction | null {
  const pathname = new URL(url || '/', 'http://127.0.0.1').pathname;
  if (pathname === '/api/recipe-cart') return 'recipe-cart';
  if (pathname === '/api/checkout') return 'checkout';
  if (pathname === '/api/order-status') return 'order-status';
  return null;
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
}

export default defineConfig({
  plugins: [
    instamartDevApiPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'tabby-icon.svg',
        'tabby-192.png',
        'tabby-512.png',
        'tabby-maskable-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Tabby — Shared home workspace',
        short_name: 'Tabby',
        description: 'A shared household workspace for pantry planning, cooking, and fair expense splitting.',
        theme_color: '#fffaf0',
        background_color: '#fffaf0',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['lifestyle', 'productivity'],
        icons: [
          {
            src: '/tabby-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/tabby-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/tabby-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
