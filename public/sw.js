// Chessbitz service worker: makes the site installable and keeps the last
// visited pages and today's opening available offline. The API is never cached.
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    const keep = new Set([PAGES, ASSETS, DATA]);
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => !keep.has(key)).map(key => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        if (request.mode === 'navigate') {
            const home = await cache.match(new URL(request.url).pathname.startsWith('/en') ? '/en/' : '/');
            if (home) return home;
        }
        throw new Error('offline');
    }
}

/** Hashed build files never change, so the cached copy is always right. */
async function cacheFirst(request) {
    const cache = await caches.open(ASSETS);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, PAGES));
    } else if (url.pathname.startsWith('/_astro/') || /\.(woff2?|png|svg|glb)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
    } else if (url.pathname.startsWith('/data/')) {
        event.respondWith(networkFirst(request, DATA));
    }
});
