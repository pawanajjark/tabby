import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['tabby-icon.svg', 'tabby-icon-192.png', 'tabby-icon-512.png'],
      manifest: {
        name: 'Tabby · Shared home workspace',
        short_name: 'Tabby',
        description: 'Shared groceries, pantry planning, cooking, and household expenses.',
        theme_color: '#0b1426',
        background_color: '#fbfcfe',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/tabby-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/tabby-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/tabby-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
