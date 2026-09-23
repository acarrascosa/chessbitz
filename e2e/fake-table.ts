import type { WebSocketRoute } from '@playwright/test';
import {
    backToLobby, createRoom, joinRoom, leaveRoom, parseClientMessage, playMove, publicRoom, setFormat, setReady, startMatch, tick,
    type BattleBoard, type Outcome, type Room, type ServerMessage,
} from '../src/lib/battle';

/*
 * Plays the Durable Object's part in end-to-end tests: the static preview has no
 * Worker, so tables run the real room logic from src/lib/battle.ts in the test.
 */

// Scholar's mate: after the setup move ...Nf6??, Qxf7# mates.
export const MATE: BattleBoard = {
    id: 'mate', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    moves: 'g8f6 h5f7', rating: 1100, themes: ['mateIn1'], limit: 60,
};

/** Who a socket belongs to; by default the site's ?token=&name=&create= parameters. */
type Identify = (url: URL) => { token: string; name: string; create: boolean; discordId?: string };

const fromParams: Identify = url => ({
    token: url.searchParams.get('token')!,
    name: url.searchParams.get('name') ?? '',
    create: url.searchParams.get('create') === '1',
});

export class FakeTable {
    room: Room | null = null;
    private sockets = new Map<WebSocketRoute, string>();

    constructor(private identify: Identify = fromParams) {}

    connect(ws: WebSocketRoute) {
        const url = new URL(ws.url());
        const { token, name, create, discordId } = this.identify(url);
        const now = Date.now();
        if (!this.room) {
            if (!create) {
                ws.send(JSON.stringify({ t: 'error', error: 'notFound', now } satisfies ServerMessage));
                ws.close({ code: 4000 });
                return;
            }
            this.room = createRoom(url.pathname.split('/')[3], now);
        }
        const joined = joinRoom(this.room, { id: `p${this.sockets.size + 1}`, token, name, discordId }, now);
        if (!joined.ok) return;
        this.sockets.set(ws, joined.room.players.find(p => p.token === token)!.id);
        ws.onMessage(raw => this.receive(ws, String(raw)));
        this.commit(joined.room);
    }

    private receive(ws: WebSocketRoute, raw: string) {
        const message = parseClientMessage(raw);
        const id = this.sockets.get(ws);
        if (!message || !id || !this.room) return;
        const now = Date.now();
        const room = tick(this.room, now);
        const apply = (): Outcome => {
            switch (message.t) {
                case 'ready': return setReady(room, id, message.ready, now);
                case 'format': return setFormat(room, id, message.format, now);
                case 'start': return startMatch(room, id, [MATE, { ...MATE, id: 'mate-2' }], now);
                case 'move': return playMove(room, id, message.board, message.from, message.to, now);
                case 'lobby': return backToLobby(room, id, now);
                case 'leave': return { ok: true, room: leaveRoom(room, id, now) };
                default: return { ok: false, error: 'invalid' };
            }
        };
        const outcome = apply();
        if (outcome.ok) this.commit(outcome.room);
    }

    private commit(room: Room) {
        this.room = room;
        for (const [ws, you] of this.sockets) {
            ws.send(JSON.stringify({ t: 'room', room: publicRoom(room), you, now: Date.now() } satisfies ServerMessage));
        }
    }
}
