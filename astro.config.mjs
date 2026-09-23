// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://chessbitz.com',
  trailingSlash: 'ignore',
  integrations: [
    react(),
    sitemap({
      filter: page => !page.includes('/data/') && !page.includes('/404') && !page.includes('/discord/'),
      i18n: { defaultLocale: 'es', locales: { es: 'es-ES', en: 'en-US' } },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // In `astro dev`, the API (and battle WebSockets) come from `wrangler dev` on :8787.
    server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  },
});
