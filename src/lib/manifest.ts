import { homePath, ui, type Lang } from '../i18n/ui';

/** Web app manifest per language, so an installed app opens in the right one. */
export function manifest(lang: Lang) {
    const t = ui[lang];
    return {
        name: `Chessbitz — ${t.siteTagline}`,
        short_name: 'Chessbitz',
        description: t.metaDescription,
        lang,
        start_url: homePath(lang),
        scope: '/',
        display: 'standalone',
        background_color: '#f4efe4',
        theme_color: '#1f4435',
        categories: ['games', 'education'],
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}

export const manifestResponse = (lang: Lang) =>
    new Response(JSON.stringify(manifest(lang)), { headers: { 'Content-Type': 'application/manifest+json' } });
