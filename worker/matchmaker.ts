import { DurableObject } from 'cloudflare:workers';
import { randomCode } from '../src/lib/battle';
import {
    DEFAULT_LEVEL, GATHER_MS, AFTER_END_MS, canWaitFor, liveMatches, parseMatchMessage, playingNow, readyGroup, waitUntil, waitingFor,
    type LiveMatch, type MatchServerMessage, type MatchSummary, type Searcher,
} from '../src/lib/matchmaking';
import { battleHour } from '../src/lib/battle-hour';
import type { Env } from './env';
import { SEARCHER_HEADER } from './queue';
import { notifyTopic } from './push';
import { MATCH_NOTIFY_EVERY_MS, MATCH_NOTIFY_PERSON_MS } from '../src/lib/push';

const MS_PER_DAY = 86_400_000;

interface Stats {
    /** UTC day number of `today`. */
    day: number;
    today: number;
    lastAt: number | null;
}

/**
 * Public matchmaking (rules in src/lib/matchmaking.ts). Searchers hold a
 * hibernatable WebSocket each, with who they are in its attachment; the alarm
 * wakes the queue up when someone's wait is over or a group is ready. Matched
 * players get a table code and connect to that BattleRoom as usual.
 */
export class Matchmaker extends DurableObject<Env> {
    private matches: LiveMatch[] = [];
    private gatherAt: number | null = null;
    private stats: Stats = { day: 0, today: 0, lastAt: null };

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
        ctx.blockConcurrencyWhile(async () => {
            this.matches = (await ctx.storage.get<LiveMatch[]>('matches')) ?? [];
            this.gatherAt = (await ctx.storage.get<number | null>('gatherAt')) ?? null;
            this.stats = (await ctx.storage.get<Stats>('stats')) ?? this.stats;
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/status') return Response.json(this.summary(Date.now()), { headers: { 'Cache-Control': 'no-store' } });
        if (url.pathname === '/finished' && request.method === 'POST') {
            const body = await request.json<{ code?: unknown; at?: unknown }>().catch(() => null);
            const match = this.matches.find(m => m.code === body?.code);
            if (match) match.finishedAt = typeof body?.at === 'number' ? body.at : Date.now();
            await this.update();
            return new Response(null, { status: 204 });
        }
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });

        let searcher: { token?: unknown; level?: unknown } | null = null;
        try {
            searcher = JSON.parse(request.headers.get(SEARCHER_HEADER) ?? '');
        } catch {
            // Handled below.
        }
        if (typeof searcher?.token !== 'string' || !searcher.token) return new Response('Who is searching?', { status: 400 });
        const level = typeof searcher.level === 'number' && Number.isFinite(searcher.level) ? Math.min(1000, Math.max(0, searcher.level)) : DEFAULT_LEVEL;

        // Searching from a second tab replaces the first.
        for (const { ws } of this.searchers()) {
            if ((ws.deserializeAttachment() as Searcher).token === searcher.token) {
                ws.serializeAttachment(null);
                ws.close(4001, 'replaced');
            }
        }
        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ token: searcher.token, since: Date.now(), level } satisfies Searcher);
        await this.update();
        await this.callForRivals(searcher.token);
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
        const message = parseMatchMessage(raw);
        const searcher = ws.deserializeAttachment() as Searcher | null;
        if (!message || !searcher) return;
        if (message.t === 'ghost') {
            await this.seat([ws], true);
        } else {
            ws.serializeAttachment({ ...searcher, extended: true } satisfies Searcher);
        }
        await this.update();
    }

    async webSocketClose(ws: WebSocket): Promise<void> {
        ws.serializeAttachment(null);
        await this.update();
    }

    async webSocketError(ws: WebSocket): Promise<void> {
        ws.serializeAttachment(null);
        await this.update();
    }

    async alarm(): Promise<void> {
        await this.update();
    }

    /**
     * Alone in the queue: tell the people who asked to know when someone is looking
     * for a match (not more than every few minutes overall, nor each person more
     * than every half hour, and never the searcher themselves).
     */
    private async callForRivals(token: string) {
        const now = Date.now();
        if (this.searchers().length !== 1) return;
        const last = (await this.ctx.storage.get<number>('calledAt')) ?? 0;
        if (now - last < MATCH_NOTIFY_EVERY_MS) return;
        await this.ctx.storage.put('calledAt', now);
        this.ctx.waitUntil(notifyTopic(this.env, 'match', { gapMs: MATCH_NOTIFY_PERSON_MS, exceptToken: token, now })
            .catch(error => console.error('Calling for rivals failed', error)));
    }

    private searchers(): { ws: WebSocket; searcher: Searcher }[] {
        return this.ctx.getWebSockets()
            .map(ws => ({ ws, searcher: ws.deserializeAttachment() as Searcher | null }))
            .filter((entry): entry is { ws: WebSocket; searcher: Searcher } => entry.searcher !== null);
    }

    /** Seats whoever can be seated, tells everyone still searching how it looks, and schedules the next check. */
    private async update(now = Date.now()): Promise<void> {
        this.matches = liveMatches(this.matches, now);
        const busy = battleHour(now).live;

        let queue = this.searchers();
        if (queue.length < 2) this.gatherAt = null;
        else this.gatherAt ??= now + GATHER_MS;
        const group = readyGroup(queue.map(entry => ({ ...entry.searcher, ws: entry.ws })), this.gatherAt, now);
        if (group.length) {
            this.gatherAt = null;
            await this.seat(group.map(entry => entry.ws), false);
            queue = this.searchers();
            if (queue.length >= 2) this.gatherAt = now + GATHER_MS;
        }

        // Alone with the wait over: a recorded rival. (While a group gathers, nobody gets one.)
        if (this.gatherAt === null) {
            for (const { ws, searcher } of queue) {
                if (now >= waitUntil(searcher, this.matches, now, busy)) await this.seat([ws], true);
            }
            queue = this.searchers();
        }

        const searching = queue.length;
        const playing = playingNow(this.matches);
        const wakeUps: number[] = this.gatherAt === null ? [] : [this.gatherAt];
        for (const { ws, searcher } of queue) {
            const until = waitUntil(searcher, this.matches, now, busy);
            wakeUps.push(until);
            this.send(ws, {
                t: 'status', searching, playing, waitUntil: until,
                waitingFor: waitingFor(searcher, this.matches, now, busy), canWaitFor: canWaitFor(searcher, this.matches, now, busy), now,
            });
        }
        for (const match of this.matches) wakeUps.push((match.finishedAt ?? match.endsBy) + AFTER_END_MS);

        await this.ctx.storage.put({ matches: this.matches, gatherAt: this.gatherAt, stats: this.stats });
        if (wakeUps.length) await this.ctx.storage.setAlarm(Math.max(now + 100, Math.min(...wakeUps)));
        else await this.ctx.storage.deleteAlarm();
    }

    /** A public table for these searchers (and a recorded rival if `ghost`); they're sent its code and leave the queue. */
    private async seat(sockets: WebSocket[], ghost: boolean): Promise<void> {
        const searchers = sockets.map(ws => ws.deserializeAttachment() as Searcher | null).filter((s): s is Searcher => s !== null);
        if (!searchers.length) return;
        const level = searchers.reduce((sum, s) => sum + s.level, 0) / searchers.length;
        const now = Date.now();
        let code = '';
        let endsBy = 0;
        for (let attempt = 0; attempt < 5 && !code; attempt++) {
            const candidate = randomCode();
            const table = this.env.BATTLE.get(this.env.BATTLE.idFromName(candidate));
            const response = await table.fetch('https://battle/init', {
                method: 'POST',
                body: JSON.stringify({ code: candidate, seats: searchers.map(s => s.token), level, ghost }),
            }).catch(error => {
                console.error('Creating a public table failed', error);
                return null;
            });
            if (response?.ok) {
                code = candidate;
                endsBy = ((await response.json()) as { endsBy: number }).endsBy;
            } else if (response?.status !== 409) {
                break;
            }
        }

        for (const ws of sockets) {
            ws.serializeAttachment(null);
            this.send(ws, code ? { t: 'matched', code, now } : { t: 'error', error: 'busy', now });
            ws.close(1000, code ? 'matched' : 'busy');
        }
        if (!code) return;
        this.matches.push({ code, endsBy, humans: searchers.length });
        const day = Math.floor(now / MS_PER_DAY);
        this.stats = { day, today: (this.stats.day === day ? this.stats.today : 0) + 1, lastAt: now };
    }

    private summary(now: number): MatchSummary {
        const day = Math.floor(now / MS_PER_DAY);
        return {
            searching: this.searchers().length,
            playing: playingNow(liveMatches(this.matches, now)),
            lastAt: this.stats.lastAt,
            today: this.stats.day === day ? this.stats.today : 0,
        };
    }

    private send(ws: WebSocket, message: MatchServerMessage) {
        try {
            ws.send(JSON.stringify(message));
        } catch {
            // Closing; its close handler cleans up.
        }
    }
}
