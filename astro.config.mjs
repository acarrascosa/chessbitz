// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { archivePath, battlePath, guidePath, homePath, legalPath } from './src/i18n/ui.ts';

const SITE = 'https://chessbitz.com';

// Every page and its translation. The slugs are translated (/archivo/ ↔ /en/archive/),
// so the sitemap's own i18n option can't pair them: the alternates are set here.
const TRANSLATIONS = [homePath, archivePath, battlePath, guidePath, legalPath].map(path => ({
  es: new URL(path('es'), SITE).href,
  en: new URL(path('en'), SITE).href,
}));

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  integrations: [
    react(),
    sitemap({
      filter: page => !page.includes('/data/') && !page.includes('/404') && !page.includes('/discord/'),
      serialize(item) {
        const page = TRANSLATIONS.find(({ es, en }) => item.url === es || item.url === en);
        if (page) {
          item.links = [
            { lang: 'es', url: page.es },
            { lang: 'en', url: page.en },
            { lang: 'x-default', url: page.es },
          ];
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // In `astro dev`, the API (and battle WebSockets) come from `wrangler dev` on :8787.
    server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  },
});
