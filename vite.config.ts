import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
