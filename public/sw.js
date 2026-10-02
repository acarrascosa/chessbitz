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

// Notifications the person opted into (worker/push.ts sends them; src/lib/push.ts has the texts).
self.addEventListener('push', event => {
    let message = { title: 'Chessbitz', body: '', url: '/', tag: 'chessbitz' };
    try {
        message = { ...message, ...event.data.json() };
    } catch {
        // An empty or unreadable push still shows something.
    }
    event.waitUntil(self.registration.showNotification(message.title, {
        body: message.body,
        tag: message.tag,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: message.url },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const open = windows.find(client => client.url === target) ?? windows.find(client => new URL(client.url).origin === self.location.origin);
        if (open) {
            await open.focus();
            if (open.url !== target && 'navigate' in open) await open.navigate(target);
            return;
        }
        await self.clients.openWindow(target);
    })());
});
