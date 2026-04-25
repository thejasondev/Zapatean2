// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),

  site: 'https://zapatean2.vercel.app',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    AstroPWA({
      // We use our own custom SW at public/sw.js — disable the generated one
      selfDestroying: false,
      registerType: 'autoUpdate',
      injectRegister: false, // We register manually in BaseLayout.astro
      manifest: {
        name: 'Zapatean2 — Rutas Cuba',
        short_name: 'Zapatean',
        description: 'PWA de navegación y rutas para Cuba. Calcula tiempos de viaje en Auto, Moto, Bici y a Pie.',
        theme_color: '#0f172a',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['navigation', 'travel'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Disable workbox entirely — our custom SW (public/sw.js) handles everything
      workbox: {
        // Minimalist config to keep the integration happy
        globPatterns: [],
        runtimeCaching: [],
      },
    }),
  ],
});
