import { DurableObject } from 'cloudflare:workers';
import battlePuzzles from '../src/data/battle-puzzles.json';
import {
    PUBLIC_FORMAT, backToLobby, createPublicRoom, createRoom, disconnect, humans, isPublic, joinRoom, kickPlayer, latestEnd, leaveRoom,
    needsGhost, nextWakeUp, parseClientMessage, pickBoards, playMove, publicRoom, rematch, renamePlayer, seededRandom, setFormat,
    setReady, startMatch, takeHint, tick, withGhost,
    type BattleBoard, type BattleError, type BattleFormat, type ClientMessage, type GhostRival, type Outcome, type Room, type ServerMessage,
} from '../src/lib/battle';
import { simulateRun } from '../src/lib/ghost-sim';
import { DEFAULT_LEVEL, MAX_TABLE } from '../src/lib/matchmaking';
import { gamerTag } from '../src/lib/names';
import type { Puzzle } from '../src/lib/puzzle';
import { DISCORD_PLAYER_HEADER, announceResults, type DiscordPlayer } from './discord';
import type { Env } from './env';
import { pickGhost, recordGhostRuns } from './ghost';
import { matchmaker } from './queue';

/** 6,000 Lichess puzzles, 2,000 per tier (scripts/battle-puzzles.mjs); only the Worker loads them. */
const POOL: Puzzle[] = battlePuzzles as Puzzle[];
const POOL_BY_ID = new Map(POOL.map(p => [p.id, p]));
/** An idle table is forgotten after this long (nobody connected, nothing happening). */
const ROOM_TTL_MS = 60 * 60 * 1000;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

interface Attachment {
    id: string;
}

/**
 * One battle table. Players connect over WebSockets (hibernatable, so an idle
 * table costs nothing); the room lives in Durable Object storage and every
 * change is broadcast to everyone. The alarm times out boards whose clock ran
 * out even if nobody sends anything, and deletes abandoned tables.
 */
export class BattleRoom extends DurableObject<Env> {
    private room: Room | null = null;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
        ctx.blockConcurrencyWhile(async () => {
            this.room = (await ctx.storage.get<Room>('room')) ?? null;
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        // Only the matchmaker's internal request gets here with a POST (worker/matchmaker.ts).
        if (request.method === 'POST' && url.pathname === '/init') return this.init(request);
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
        // Inside Discord the Worker has already checked who the player is and which
        // Activity instance (= table) they're in; anyone in the instance may open it.
        // Discord players at a public table come without an instance.
        const discord = this.discordPlayer(request);
        const code = discord?.table?.instanceId ?? url.pathname.split('/').pop() ?? '';
        const token = discord ? `discord:${discord.discordId}` : url.searchParams.get('token') ?? '';
        const create = discord ? Boolean(discord.table) : url.searchParams.get('create') === '1';

        const { 0: client, 1: server } = new WebSocketPair();
        const reject = (error: BattleError) => {
            server.accept();
            server.send(JSON.stringify({ t: 'error', error, now: Date.now() } satisfies ServerMessage));
            server.close(4000, error);
            return new Response(null, { status: 101, webSocket: client });
        };

        if (!discord && !TOKEN.test(token)) return reject('invalid');
        const now = Date.now();
        let room = this.room ? tick(this.room, now) : null;
        const member = room?.players.find(p => p.token === token);
        if (!room || (!room.players.length && !isPublic(room))) {
            // Nobody left at the table: it only exists again if someone creates it.
            // (A public table starts empty: matchmaking created it for its players.)
            if (!create) return reject('notFound');
            room = createRoom(code, now);
        } else if (create && !member && !discord) {
            // Someone else already sits at a table with this code: the client picks another.
            return reject('taken');
        }

        if (discord?.table && !room.discord) room = { ...room, discord: discord.table };
        // At public tables everyone goes by an invented name (kept when they reconnect).
        const name = isPublic(room) ? (member ? '' : gamerTag()) : discord?.name ?? url.searchParams.get('name') ?? '';
        const joined = joinRoom(room, { id: crypto.randomUUID().slice(0, 8), token, name, discordId: discord?.discordId }, now);
        if (!joined.ok) return reject(joined.error);
        const player = joined.room.players.find(p => p.token === token)!;

        // A second tab takes over the seat.
        for (const socket of this.socketsOf(player.id)) {
            socket.serializeAttachment(null);
            socket.close(4001, 'replaced');
        }
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ id: player.id } satisfies Attachment);
        await this.commit(await this.advance(joined.room, now));
        return new Response(null, { status: 101, webSocket: client });
    }

    /** A public table for the players matchmaking has just put together (and maybe a recorded rival). */
    private async init(request: Request): Promise<Response> {
        const body = await request.json<{ code?: unknown; seats?: unknown; level?: unknown; ghost?: unknown }>().catch(() => null);
        const code = typeof body?.code === 'string' ? body.code : '';
        const seats = Array.isArray(body?.seats) ? body.seats.filter((s): s is string => typeof s === 'string').slice(0, MAX_TABLE) : [];
        if (!code || !seats.length) return new Response('Invalid table', { status: 400 });
        const now = Date.now();
        if (this.room?.players.length && now - this.room.updatedAt < ROOM_TTL_MS) return new Response('Taken', { status: 409 });
        const level = typeof body?.level === 'number' && Number.isFinite(body.level) ? body.level : DEFAULT_LEVEL;
        const boards = this.boardsFor(PUBLIC_FORMAT);
        const rival = body?.ghost === true ? await this.rival(level, boards) : undefined;
        const room = createPublicRoom(code, seats, boards, now, rival, level);
        await this.commit(room);
        return Response.json({ endsBy: latestEnd(room) });
    }

    /** One of the recorded runs near the players' level, or a simulated one if the database has none. */
    private async rival(level: number, boards: BattleBoard[]): Promise<GhostRival> {
        const recorded = await pickGhost(this.env, POOL_BY_ID, level).catch(error => {
            console.error('Picking a recorded rival failed', error);
            return null;
        });
        return recorded ?? { name: gamerTag(), boards, results: simulateRun(boards, Math.random) };
    }

    /** What time decides, plus a recorded rival for a public table where only one person turned up. */
    private async advance(room: Room, now: number): Promise<Room> {
        const next = tick(room, now);
        if (!needsGhost(next, now)) return next;
        return tick(withGhost(next, await this.rival(next.level ?? DEFAULT_LEVEL, next.boards)), now);
    }

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
        const message = parseClientMessage(raw);
        const id = (ws.deserializeAttachment() as Attachment | null)?.id;
        if (!message || !id || !this.room) return;
        const now = Date.now();
        const room = await this.advance(this.room, now);
        const outcome = this.apply(room, id, message, now);
        if (outcome.ok) {
            if (message.t === 'kick') this.dismiss(message.id, 'kicked');
            if (message.t === 'leave') this.dismiss(id, 'left');
            await this.commit(outcome.room);
        } else if (message.t === 'move' || message.t === 'hint') {
            // A move or hint for a board that already timed out: just resync that player.
            if (room !== this.room) await this.commit(room);
            else this.send(ws, room, id, now);
        } else {
            ws.send(JSON.stringify({ t: 'error', error: outcome.error, now } satisfies ServerMessage));
        }
    }

    async webSocketClose(ws: WebSocket): Promise<void> {
        await this.dropped(ws);
    }

    async webSocketError(ws: WebSocket): Promise<void> {
        await this.dropped(ws);
    }

    async alarm(): Promise<void> {
        if (!this.room) return;
        const now = Date.now();
        // A public table nobody turned up to: matchmaking stops counting it and it's gone.
        if (isPublic(this.room) && this.room.status === 'lobby' && now >= (this.room.joinBy ?? 0) && !humans(this.room).length) {
            await this.tellMatchmaking(this.room.code, now);
            this.room = null;
            await this.ctx.storage.deleteAll();
            return;
        }
        if (!this.ctx.getWebSockets().length && now - this.room.updatedAt >= ROOM_TTL_MS) {
            this.room = null;
            await this.ctx.storage.deleteAll();
            return;
        }
        await this.commit(await this.advance(this.room, now));
    }

    private apply(room: Room, id: string, message: ClientMessage, now: number): Outcome {
        switch (message.t) {
            case 'ready':
                return setReady(room, id, message.ready, now);
            case 'format':
                return setFormat(room, id, message.format, now);
            case 'rename':
                return renamePlayer(room, id, message.name, now);
            case 'kick':
                return kickPlayer(room, id, message.id, now);
            case 'start':
                return startMatch(room, id, this.boardsFor(room.format, room.played), now);
            case 'rematch':
                return rematch(room, id, this.boardsFor(room.format, room.played), now);
            case 'move':
                return playMove(room, id, message.board, message.from, message.to, now);
            case 'hint':
                return takeHint(room, id, message.board, now);
            case 'lobby':
                return backToLobby(room, id, now);
            case 'leave':
                return { ok: true, room: leaveRoom(room, id, now) };
        }
    }

    /** Fresh random boards for a format, avoiding the puzzles the table has already played. */
    private boardsFor(format: BattleFormat, played?: string[]) {
        const seed = crypto.getRandomValues(new Uint32Array(1))[0];
        return pickBoards(POOL, format, seededRandom(seed), played);
    }

    /** Stores the room, tells everyone and schedules the next time-based change. */
    private async commit(room: Room): Promise<void> {
        const changed = room !== this.room;
        const finished = this.room?.status === 'playing' && room.status === 'finished';
        this.room = room;
        if (changed) await this.ctx.storage.put('room', room);
        const now = Date.now();
        for (const ws of this.ctx.getWebSockets()) {
            const id = (ws.deserializeAttachment() as Attachment | null)?.id;
            if (id) this.send(ws, room, id, now);
        }
        // Nothing timed pending: check back in an hour whether the table was abandoned.
        await this.ctx.storage.setAlarm(nextWakeUp(room) ?? now + ROOM_TTL_MS);
        // Public matches aren't posted in anyone's channel.
        if (finished && room.discord && !isPublic(room)) {
            await announceResults(this.env, room, now).catch(error => console.error('Posting battle results failed', error));
        }
        if (finished) {
            await recordGhostRuns(this.env, room, now).catch(error => console.error('Recording ghost runs failed', error));
        }
        if (finished && isPublic(room)) await this.tellMatchmaking(room.code, now);
    }

    /** A public match is over (or never happened): its players are free again, matchmaking stops waiting for them. */
    private async tellMatchmaking(code: string, at: number) {
        await matchmaker(this.env)?.fetch('https://match/finished', { method: 'POST', body: JSON.stringify({ code, at }) })
            .catch(error => console.error('Telling matchmaking failed', error));
    }

    private discordPlayer(request: Request): DiscordPlayer | null {
        const header = request.headers.get(DISCORD_PLAYER_HEADER);
        if (!header) return null;
        try {
            return JSON.parse(header) as DiscordPlayer;
        } catch {
            return null;
        }
    }

    private send(ws: WebSocket, room: Room, you: string, now: number) {
        try {
            ws.send(JSON.stringify({ t: 'room', room: publicRoom(room), you, now } satisfies ServerMessage));
        } catch {
            // The socket is closing; its close handler cleans up.
        }
    }

    private socketsOf(id: string): WebSocket[] {
        return this.ctx.getWebSockets().filter(ws => (ws.deserializeAttachment() as Attachment | null)?.id === id);
    }

    /** Closes a player's sockets after they left or were removed, without marking them offline. */
    private dismiss(id: string, reason: 'kicked' | 'left') {
        for (const ws of this.socketsOf(id)) {
            ws.serializeAttachment(null);
            if (reason === 'kicked') ws.send(JSON.stringify({ t: 'error', error: 'kicked', now: Date.now() } satisfies ServerMessage));
            ws.close(4000, reason);
        }
    }

    private async dropped(ws: WebSocket): Promise<void> {
        const id = (ws.deserializeAttachment() as Attachment | null)?.id;
        ws.serializeAttachment(null);
        if (!id || !this.room) return;
        // Still connected from another socket (e.g. the tab that replaced this one).
        if (this.socketsOf(id).some(other => other !== ws)) return;
        await this.commit(disconnect(this.room, id, Date.now()));
    }
}
