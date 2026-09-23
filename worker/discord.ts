import type { Env } from './env';
import type { DiscordTable, Room } from '../src/lib/battle';
import {
    PLAY_BUTTON_ID, FORGET_AFTER_DAYS, channelBattle, discordText, dueReminders, reminderMessage, resultsMessage, utcDay,
    type ChannelBattle, type DiscordLang, type DiscordMessage,
} from '../src/lib/discord';

/*
 * Chessbitz as a Discord Activity. The Activity is the battle page served inside
 * Discord's iframe (every request goes through https://<client_id>.discordsays.com,
 * which proxies to this Worker). This module:
 *  - exchanges the OAuth2 code from the Embedded App SDK and hands out a signed session,
 *  - binds each Activity instance to one battle table (Durable Object) after checking
 *    with Discord that the player is really in that instance,
 *  - posts the podium in the channel, and a reminder there the next day (cron),
 *  - answers interactions: the "Play"/"Rematch" buttons launch the Activity.
 */

const API = 'https://discord.com/api/v10';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const INSTANCE_ID = /^[\w-]{1,100}$/;
/** Header the Worker sets for the Durable Object; client headers never reach it. */
export const DISCORD_PLAYER_HEADER = 'X-Battle-Discord';

export interface DiscordPlayer {
    discordId: string;
    name: string;
    table: DiscordTable;
}

const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers } });

/** Fake Discord for local testing: only with DISCORD_MOCK=1 (.dev.vars) and on localhost. */
function isMock(env: Env, url?: URL): boolean {
    if (env.DISCORD_MOCK !== '1') return false;
    return !url || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

const configured = (env: Env) => Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_BOT_TOKEN);

/* ------------------------------------------------------------------ Crypto */

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return btoa(String.fromCharCode(...view)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(hex.match(/../g) ?? [], byte => parseInt(byte, 16));
}

const hmacKey = (secret: string) =>
    crypto.subtle.importKey('raw', encoder.encode(`chessbitz-session:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export interface Session {
    uid: string;
    name: string;
    /** Expiry, ms since the epoch. */
    exp: number;
}

/** `payload.signature`, both base64url: proves who the player is without a database. */
export async function signSession(session: Session, secret: string): Promise<string> {
    const payload = base64url(encoder.encode(JSON.stringify(session)));
    const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
    return `${payload}.${base64url(signature)}`;
}

export async function readSession(token: string, secret: string, now: number): Promise<Session | null> {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    try {
        const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64url(signature), encoder.encode(payload));
        if (!valid) return null;
        const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Session;
        return typeof session.uid === 'string' && typeof session.name === 'string' && session.exp > now ? session : null;
    } catch {
        return null;
    }
}

/** Discord signs every interaction with Ed25519 over timestamp + raw body. */
export async function verifyInteraction(publicKeyHex: string, signatureHex: string, timestamp: string, body: string): Promise<boolean> {
    try {
        const key = await crypto.subtle.importKey('raw', fromHex(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
        return await crypto.subtle.verify('Ed25519', key, fromHex(signatureHex), encoder.encode(timestamp + body));
    } catch {
        return false;
    }
}

/* ------------------------------------------------------------------ Discord API */

interface DiscordUser {
    id: string;
    username: string;
    global_name?: string | null;
    /** The language chosen in Discord's settings ("es-ES", "es-419", "en-US"…), with the identify scope. */
    locale?: string;
}

interface ActivityInstance {
    location: { channel_id: string; guild_id?: string | null };
    users: string[];
}

const bot = (env: Env) => ({ Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` });

async function exchangeCode(env: Env, code: string): Promise<string | null> {
    const response = await fetch(`${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID!,
            client_secret: env.DISCORD_CLIENT_SECRET!,
            grant_type: 'authorization_code',
            code,
        }),
    });
    if (!response.ok) {
        // e.g. invalid_grant, or invalid_client when the secret doesn't match the app.
        console.error(`Discord OAuth2 token exchange failed: ${response.status} ${await response.text()}`);
        return null;
    }
    const { access_token } = await response.json<{ access_token?: string }>();
    return access_token ?? null;
}

async function fetchUser(accessToken: string): Promise<DiscordUser | null> {
    const response = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) console.error(`Discord /users/@me failed: ${response.status} ${await response.text()}`);
    return response.ok ? response.json<DiscordUser>() : null;
}

/** Where the Activity instance runs and who is in it, straight from Discord. */
async function fetchInstance(env: Env, instanceId: string, mock: boolean, uid: string): Promise<ActivityInstance | null> {
    if (mock) return { location: { channel_id: '100000000000000001', guild_id: '100000000000000002' }, users: [uid] };
    const response = await fetch(`${API}/applications/${env.DISCORD_CLIENT_ID}/activity-instances/${instanceId}`, { headers: bot(env) });
    if (!response.ok) console.error(`Discord activity instance ${instanceId} lookup failed: ${response.status} ${await response.text()}`);
    return response.ok ? response.json<ActivityInstance>() : null;
}

/** Posts in a channel as the bot. Returns the HTTP status (0 when mocked). */
async function postMessage(env: Env, channelId: string, message: DiscordMessage): Promise<number> {
    if (isMock(env)) {
        console.log(`[discord mock] message to ${channelId}:\n${message.content}`);
        return 0;
    }
    const response = await fetch(`${API}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { ...bot(env), 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    });
    if (!response.ok) console.error(`Discord message to ${channelId} failed: ${response.status} ${await response.text()}`);
    return response.status;
}

/* ------------------------------------------------------------------ Routes */

async function token(request: Request, url: URL, env: Env): Promise<Response> {
    const body = await request.json<{ code?: unknown }>().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code || code.length > 512) return json({ error: 'Invalid code' }, { status: 400 });

    let user: DiscordUser | null;
    let accessToken = 'mock';
    const mocked = isMock(env, url) && code.match(/^mock:(\d{1,20}):(.{1,32})$/);
    if (mocked) {
        user = { id: mocked[1], username: mocked[2] };
    } else {
        accessToken = (await exchangeCode(env, code)) ?? '';
        user = accessToken ? await fetchUser(accessToken) : null;
    }
    // The detail is shown to the player so a failure can be reported; it holds no secrets.
    if (!user) return json({ error: accessToken ? 'Discord refused the user lookup' : 'Discord refused the code' }, { status: 401 });

    const session = await signSession(
        { uid: user.id, name: user.global_name || user.username, exp: Date.now() + SESSION_TTL_MS },
        env.DISCORD_CLIENT_SECRET ?? 'mock',
    );
    // The access token goes back to the SDK (commands.authenticate); the session is ours;
    // the locale picks the interface language (the browser's is the OS's, not Discord's).
    return json({ access_token: accessToken, session, locale: user.locale ?? null });
}

async function connect(request: Request, url: URL, env: Env, instanceId: string): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, { status: 426 });
    if (!INSTANCE_ID.test(instanceId)) return json({ error: 'Invalid instance' }, { status: 404 });
    const session = await readSession(url.searchParams.get('session') ?? '', env.DISCORD_CLIENT_SECRET ?? 'mock', Date.now());
    if (!session) return json({ error: 'Invalid session' }, { status: 401 });

    const mock = isMock(env, url);
    let instance = await fetchInstance(env, instanceId, mock, session.uid);
    // A player who has just launched the Activity can take a moment to be listed.
    if (instance && !instance.users.includes(session.uid)) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        instance = await fetchInstance(env, instanceId, mock, session.uid);
    }
    if (!instance?.users.includes(session.uid)) return json({ error: 'Not in this activity' }, { status: 403 });

    const lang: DiscordLang = url.searchParams.get('lang') === 'es' ? 'es' : 'en';
    const player: DiscordPlayer = {
        discordId: session.uid,
        name: session.name,
        table: { instanceId, channelId: instance.location.channel_id, guildId: instance.location.guild_id ?? null, lang },
    };
    // A fresh request: only the headers set here reach the Durable Object.
    const headers = new Headers({ Upgrade: 'websocket', [DISCORD_PLAYER_HEADER]: JSON.stringify(player) });
    return env.BATTLE.get(env.BATTLE.idFromName(`discord:${instanceId}`)).fetch(new Request(`https://battle/discord/${instanceId}`, { headers }));
}

async function interaction(request: Request, env: Env): Promise<Response> {
    const body = await request.text();
    const signature = request.headers.get('X-Signature-Ed25519') ?? '';
    const timestamp = request.headers.get('X-Signature-Timestamp') ?? '';
    if (!env.DISCORD_PUBLIC_KEY || !(await verifyInteraction(env.DISCORD_PUBLIC_KEY, signature, timestamp, body))) {
        return new Response('Invalid request signature', { status: 401 });
    }
    const data = JSON.parse(body) as { type: number; locale?: string; data?: { custom_id?: string } };
    // 1: PING → PONG. Commands and our Play / Rematch buttons → LAUNCH_ACTIVITY (12).
    if (data.type === 1) return json({ type: 1 });
    if (data.type === 2 || (data.type === 3 && data.data?.custom_id === PLAY_BUTTON_ID)) return json({ type: 12 });
    const lang: DiscordLang = data.locale?.startsWith('es') ? 'es' : 'en';
    return json({ type: 4, data: { content: discordText(lang).notInDiscord, flags: 64 } });
}

/** Everything under /api/discord/. */
export async function handleDiscord(request: Request, url: URL, env: Env): Promise<Response> {
    const [, , , route, param] = url.pathname.split('/');
    if (!configured(env) && !isMock(env, url)) return json({ error: 'Discord is not configured' }, { status: 503 });

    if (route === 'config' && request.method === 'GET') {
        return json({ clientId: env.DISCORD_CLIENT_ID ?? 'mock', mock: isMock(env, url) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (route === 'interactions' && request.method === 'POST') return interaction(request, env);

    const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.BATTLE_LIMITER && !(await env.BATTLE_LIMITER.limit({ key })).success) {
        return json({ error: 'Too many requests' }, { status: 429 });
    }
    if (route === 'token' && request.method === 'POST') return token(request, url, env);
    if (route === 'battle' && param && request.method === 'GET') return connect(request, url, env, param);
    return json({ error: 'Not found' }, { status: 404 });
}

/* ------------------------------------------------------------------ Channel posts */

/** When a Discord match ends: the podium in its channel, and the channel remembered for tomorrow. */
export async function announceResults(env: Env, room: Room, now: number): Promise<void> {
    const row = channelBattle(room, now);
    if (!room.discord || !row) return;
    await postMessage(env, room.discord.channelId, resultsMessage(room, room.discord.lang));
    await env.DB.prepare(
        `INSERT INTO discord_battles (channel_id, guild_id, lang, day, winner_id, winner_name, winner_points, players, reminded_day)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL)
         ON CONFLICT (channel_id) DO UPDATE SET
             guild_id = ?2, lang = ?3, day = ?4, winner_id = ?5, winner_name = ?6, winner_points = ?7, players = ?8, reminded_day = NULL`,
    ).bind(row.channel_id, row.guild_id, row.lang, row.day, row.winner_id, row.winner_name, row.winner_points, row.players).run();
}

/** Daily cron: remind the channels that played yesterday, and forget the ones gone quiet. */
export async function sendReminders(env: Env, now: number): Promise<void> {
    if (!configured(env) && !isMock(env)) return;
    const today = utcDay(now);
    await env.DB.prepare('DELETE FROM discord_battles WHERE day < ?1').bind(today - FORGET_AFTER_DAYS).run();
    const { results } = await env.DB.prepare('SELECT * FROM discord_battles WHERE day = ?1').bind(today - 1).all<ChannelBattle>();
    for (const row of dueReminders(results, today)) {
        const status = await postMessage(env, row.channel_id, reminderMessage(row));
        if (status === 403 || status === 404) {
            // The bot lost access to the channel (removed, deleted, DM): stop trying.
            await env.DB.prepare('DELETE FROM discord_battles WHERE channel_id = ?1').bind(row.channel_id).run();
        } else if (status === 0 || (status >= 200 && status < 300)) {
            await env.DB.prepare('UPDATE discord_battles SET reminded_day = ?1 WHERE channel_id = ?2').bind(today, row.channel_id).run();
        }
    }
}
