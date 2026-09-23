import { DurableObject } from 'cloudflare:workers';
import puzzles from '../src/data/puzzles.json';
import {
    backToLobby, createRoom, disconnect, joinRoom, kickPlayer, leaveRoom, nextWakeUp, parseClientMessage, pickBoards,
    playMove, publicRoom, renamePlayer, seededRandom, setFormat, setReady, startMatch, tick,
    type BattleError, type ClientMessage, type Outcome, type Room, type ServerMessage,
} from '../src/lib/battle';
import type { Puzzle } from '../src/lib/puzzle';
import { DISCORD_PLAYER_HEADER, announceResults, type DiscordPlayer } from './discord';
import type { Env } from './env';

const POOL: Puzzle[] = Object.values(puzzles as Record<string, Puzzle[]>).flat();
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
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
        const url = new URL(request.url);
        // Inside Discord the Worker has already checked who the player is and which
        // Activity instance (= table) they're in; anyone in the instance may open it.
        const discord = this.discordPlayer(request);
        const code = discord?.table.instanceId ?? url.pathname.split('/')[3] ?? '';
        const token = discord ? `discord:${discord.discordId}` : url.searchParams.get('token') ?? '';
        const name = discord?.name ?? url.searchParams.get('name') ?? '';
        const create = Boolean(discord) || url.searchParams.get('create') === '1';

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
        if (!room || !room.players.length) {
            // Nobody left at the table: it only exists again if someone creates it.
            if (!create) return reject('notFound');
            room = createRoom(code, now);
        } else if (create && !member && !discord) {
            // Someone else already sits at a table with this code: the client picks another.
            return reject('taken');
        }

        if (discord && !room.discord) room = { ...room, discord: discord.table };
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
        await this.commit(joined.room);
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
        const message = parseClientMessage(raw);
        const id = (ws.deserializeAttachment() as Attachment | null)?.id;
        if (!message || !id || !this.room) return;
        const now = Date.now();
        const room = tick(this.room, now);
        const outcome = this.apply(room, id, message, now);
        if (outcome.ok) {
            if (message.t === 'kick') this.dismiss(message.id, 'kicked');
            if (message.t === 'leave') this.dismiss(id, 'left');
            await this.commit(outcome.room);
        } else if (message.t === 'move') {
            // A move for a board that already timed out: just resync that player.
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
        if (!this.ctx.getWebSockets().length && now - this.room.updatedAt >= ROOM_TTL_MS) {
            this.room = null;
            await this.ctx.storage.deleteAll();
            return;
        }
        await this.commit(tick(this.room, now));
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
            case 'start': {
                const seed = crypto.getRandomValues(new Uint32Array(1))[0];
                return startMatch(room, id, pickBoards(POOL, room.format, seededRandom(seed)), now);
            }
            case 'move':
                return playMove(room, id, message.board, message.from, message.to, now);
            case 'lobby':
                return backToLobby(room, id, now);
            case 'leave':
                return { ok: true, room: leaveRoom(room, id, now) };
        }
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
        if (finished && room.discord) {
            await announceResults(this.env, room, now).catch(error => console.error('Posting battle results failed', error));
        }
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
