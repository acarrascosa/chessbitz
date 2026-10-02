import type { Env } from './env';
import { pushText, PUSH_TOPICS, type PushTopic } from '../src/lib/push';

/*
 * Web Push without a library: messages are encrypted for each browser (RFC 8291,
 * aes128gcm) and signed with the site's VAPID key (RFC 8292), using WebCrypto.
 * Subscriptions (D1, migration 0007) hold only what the browser's push service
 * needs, the topics the person chose and their language.
 */

const encoder = new TextEncoder();

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    const base64 = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const concat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

/** A P-256 key as JWK from its raw public point (0x04 ‖ x ‖ y) and, for a private key, d. */
function jwk(publicRaw: Uint8Array, d?: string): JsonWebKey {
    return { kty: 'EC', crv: 'P-256', x: toBase64Url(publicRaw.slice(1, 33)), y: toBase64Url(publicRaw.slice(33, 65)), ...(d ? { d } : {}), ext: true };
}

export interface ServerKeys {
    publicRaw: Uint8Array;
    privateKey: CryptoKey;
}

/** A fresh key pair for one message (the "application server" ECDH key of RFC 8291). */
async function ephemeralKeys(): Promise<ServerKeys> {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    return { publicRaw: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer), privateKey: pair.privateKey };
}

/** Imports a known ECDH key pair (for the RFC's test vector). */
export async function importServerKeys(publicB64: string, privateD: string): Promise<ServerKeys> {
    const publicRaw = fromBase64Url(publicB64);
    const privateKey = await crypto.subtle.importKey('jwk', jwk(publicRaw, privateD), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    return { publicRaw, privateKey };
}

/**
 * The encrypted body of a push message (RFC 8291 §3–4): one aes128gcm record for
 * the browser's key `p256dh` and secret `auth`. Salt and keys are random unless
 * given (tests).
 */
export async function encryptPayload(plaintext: Uint8Array, p256dh: string, auth: string, fixed?: { salt: Uint8Array; keys: ServerKeys }): Promise<Uint8Array> {
    const uaPublic = fromBase64Url(p256dh);
    const authSecret = fromBase64Url(auth);
    const keys = fixed?.keys ?? await ephemeralKeys();
    const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));

    const uaKey = await crypto.subtle.importKey('jwk', jwk(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    // `public` is the standard (and workerd's) name; the Workers typings call it `$public`.
    const derive = { name: 'ECDH', public: uaKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(derive, keys.privateKey, 256));

    // HKDF (one block each): combine the ECDH secret with the auth secret, then derive key and nonce.
    const prkKey = await hmac(authSecret, ecdhSecret);
    const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, keys.publicRaw);
    const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, concat(encoder.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
    const nonce = (await hmac(prk, concat(encoder.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    // A single record: the plaintext and the last-record delimiter 0x02.
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));
    const header = concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([keys.publicRaw.length]), keys.publicRaw);
    return concat(header, ciphertext);
}

/** The VAPID Authorization header for a push service (RFC 8292): a JWT signed with the site's key. */
export async function vapidAuthorization(endpoint: string, publicKey: string, privateD: string, subject: string, now: number): Promise<string> {
    const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = toBase64Url(encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
    const key = await crypto.subtle.importKey('jwk', jwk(fromBase64Url(publicKey), privateD), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`)));
    return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${publicKey}`;
}

/* ------------------------------------------------------------------ Subscriptions */

/**
 * What is stored of a battle token: its SHA-256. The token reclaims a seat at a
 * table, so it never sits in the database; its hash is enough to recognise the
 * person searching and not notify them about themselves.
 */
export async function tokenHash(token: string): Promise<string> {
    return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))).slice(0, 32);
}

/** Browsers' push services; anything else is refused (the Worker would be posting to it). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const KEY = /^[A-Za-z0-9_-]{16,128}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export interface Subscription {
    endpoint: string;
    p256dh: string;
    auth: string;
    lang: 'es' | 'en';
    topics: PushTopic[];
    /** Battle token, so someone searching isn't told about themselves. */
    token: string | null;
}

export function parseSubscription(body: unknown): Subscription | null {
    if (typeof body !== 'object' || body === null) return null;
    const { subscription, topics, lang, token } = body as Record<string, unknown>;
    const sub = subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    if (typeof sub?.endpoint !== 'string' || sub.endpoint.length > 1024) return null;
    let url: URL;
    try {
        url = new URL(sub.endpoint);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || !PUSH_HOSTS.some(host => host.test(url.hostname))) return null;
    const p256dh = sub.keys?.p256dh;
    const auth = sub.keys?.auth;
    if (typeof p256dh !== 'string' || typeof auth !== 'string' || !KEY.test(p256dh) || !KEY.test(auth)) return null;
    const chosen = Array.isArray(topics) ? PUSH_TOPICS.filter(topic => topics.includes(topic)) : [];
    return {
        endpoint: sub.endpoint,
        p256dh,
        auth,
        lang: lang === 'en' ? 'en' : 'es',
        topics: chosen,
        token: typeof token === 'string' && TOKEN.test(token) ? token : null,
    };
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store', ...init.headers } });

/** /api/push/key, /api/push/subscribe and /api/push/unsubscribe. */
export async function handlePush(request: Request, url: URL, env: Env): Promise<Response> {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return json({ error: 'Notifications are not available' }, { status: 503 });
    const route = url.pathname.split('/')[3];
    if (route === 'key' && request.method === 'GET') return json({ publicKey: env.VAPID_PUBLIC_KEY });
    if (request.method !== 'POST') return json({ error: 'Not found' }, { status: 404 });

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.BATTLE_LIMITER && !(await env.BATTLE_LIMITER.limit({ key: ip })).success) return json({ error: 'Too many requests' }, { status: 429 });
    if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return json({ error: 'Payload too large' }, { status: 413 });
    const body = await request.json().catch(() => null);

    if (route === 'subscribe') {
        const sub = parseSubscription(body);
        if (!sub) return json({ error: 'Invalid subscription' }, { status: 400 });
        if (!sub.topics.length) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(sub.endpoint).run();
            return new Response(null, { status: 204 });
        }
        await env.DB.prepare(
            `INSERT INTO push_subscriptions (endpoint, p256dh, auth, lang, topics, token, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT (endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, lang = ?4, topics = ?5, token = ?6`,
        ).bind(sub.endpoint, sub.p256dh, sub.auth, sub.lang, sub.topics.join(','), sub.token ? await tokenHash(sub.token) : null, Date.now()).run();
        return new Response(null, { status: 204 });
    }
    if (route === 'unsubscribe') {
        const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
        if (typeof endpoint !== 'string') return json({ error: 'Invalid subscription' }, { status: 400 });
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(endpoint).run();
        return new Response(null, { status: 204 });
    }
    return json({ error: 'Not found' }, { status: 404 });
}

/* ------------------------------------------------------------------ Sending */

/** Workers allow 50 outgoing requests per invocation on the free plan: stay under it. */
const MAX_PER_RUN = 40;

interface SubscriptionRow {
    endpoint: string;
    p256dh: string;
    auth: string;
    lang: 'es' | 'en';
}

/**
 * Sends `topic`'s message to the people who chose it and weren't sent anything in
 * the last `gapMs` (never to the browser holding `exceptToken`). Subscriptions the push service says
 * are gone are deleted. Returns how many were delivered.
 */
export async function notifyTopic(env: Env, topic: PushTopic, options: { gapMs: number; exceptToken?: string; now?: number }): Promise<number> {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;
    const now = options.now ?? Date.now();
    // The column name comes from the fixed list of topics, never from a request.
    const last = `last_${topic}_at`;
    const { results } = await env.DB.prepare(
        `SELECT endpoint, p256dh, auth, lang FROM push_subscriptions
         WHERE (',' || topics || ',') LIKE ?1 AND (${last} IS NULL OR ${last} < ?2) AND (token IS NULL OR token != ?3)
         ORDER BY COALESCE(${last}, 0) LIMIT ?4`,
    ).bind(`%,${topic},%`, now - options.gapMs, options.exceptToken ? await tokenHash(options.exceptToken) : '', MAX_PER_RUN).all<SubscriptionRow>();

    let delivered = 0;
    await Promise.all(results.map(async row => {
        const message = pushText(row.lang, topic);
        const body = await encryptPayload(encoder.encode(JSON.stringify(message)), row.p256dh, row.auth);
        const response = await fetch(row.endpoint, {
            method: 'POST',
            headers: {
                Authorization: await vapidAuthorization(row.endpoint, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!, 'https://chessbitz.com', now),
                'Content-Encoding': 'aes128gcm',
                'Content-Type': 'application/octet-stream',
                TTL: String(message.ttl),
                Urgency: 'normal',
            },
            body,
        }).catch(() => null);
        if (response && (response.status === 404 || response.status === 410)) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(row.endpoint).run();
        } else if (response?.ok) {
            delivered++;
            await env.DB.prepare(`UPDATE push_subscriptions SET ${last} = ?1 WHERE endpoint = ?2`).bind(now, row.endpoint).run();
        } else if (response) {
            console.error(`Push to ${new URL(row.endpoint).hostname} failed: ${response.status}`);
        }
    }));
    return delivered;
}
