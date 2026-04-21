import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pawmate - חיית מחמד וירטואלית',
        short_name: 'Pawmate',
        description: 'גדל חיית מחמד וירטואלית',
        theme_color: '#FF6B6B',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
