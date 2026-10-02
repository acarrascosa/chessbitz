import { describe, expect, it } from 'vitest';
import {
    COUNTDOWN_MS, PUBLIC_FORMAT, PUBLIC_JOIN_MS, TRANSITION_MS,
    backToLobby, createPublicRoom, joinRoom, latestEnd, needsGhost, nextWakeUp, playMove, publicRoom, rankPlayers, rematch,
    renamePlayer, setFormat, setReady, startMatch, tick, withGhost, disconnect,
    type BattleBoard, type BoardResult, type GhostRival, type Outcome, type Room,
} from '../src/lib/battle';
import { ghostRuns } from '../worker/ghost';

// Scholar's mate: after the setup move ...Nf6??, Qxf7# mates.
const MATE: BattleBoard = {
    id: 'mate', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    moves: 'g8f6 h5f7', rating: 1100, themes: ['mateIn1'], limit: 30,
};
const BOARDS = [MATE, { ...MATE, id: 'mate-2' }];
const T0 = 1_000_000;

const unwrap = (outcome: Outcome): Room => {
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.room;
};

const won = (ms: number, points = 120): BoardResult => ({ outcome: 'won', mistakes: 1, hints: 0, hintHalves: 0, ms, points });
const RIVAL: GhostRival = { name: 'IronFork42', boards: BOARDS, results: [won(10_000), { outcome: 'timeout', mistakes: 2, hints: 0, hintHalves: 0, ms: 30_000, points: 0 }] };

const sit = (room: Room, id: string, token: string, at = T0) => unwrap(joinRoom(room, { id, token, name: `Tag ${id}` }, at));

describe('public tables', () => {
    it('only seat the matched players and start once all of them are in', () => {
        let room = createPublicRoom('PUBL', ['ta', 'tb'], BOARDS, T0);
        expect(room).toMatchObject({ mode: 'public', format: PUBLIC_FORMAT, status: 'lobby', joinBy: T0 + PUBLIC_JOIN_MS });
        expect(joinRoom(room, { id: 'x', token: 'stranger', name: 'X' }, T0)).toEqual({ ok: false, error: 'full' });
        room = sit(room, 'a', 'ta');
        expect(tick(room, T0 + 1).status).toBe('lobby');
        room = sit(room, 'b', 'tb', T0 + 2_000);
        const playing = tick(room, T0 + 2_000);
        expect(playing.status).toBe('playing');
        expect(playing.startsAt).toBe(T0 + 2_000 + COUNTDOWN_MS);
    });

    it('start without a no-show when the wait is over, if two are there', () => {
        let room = createPublicRoom('PUBL', ['ta', 'tb', 'tc'], BOARDS, T0);
        room = sit(sit(room, 'a', 'ta'), 'b', 'tb');
        expect(tick(room, T0 + PUBLIC_JOIN_MS - 1).status).toBe('lobby');
        expect(nextWakeUp(room)).toBe(T0 + PUBLIC_JOIN_MS);
        const playing = tick(room, T0 + PUBLIC_JOIN_MS);
        expect(playing.status).toBe('playing');
        expect(playing.players.map(p => p.id)).toEqual(['a', 'b']);
        expect(joinRoom(playing, { id: 'c', token: 'tc', name: 'C' }, T0 + PUBLIC_JOIN_MS)).toEqual({ ok: false, error: 'started' });
    });

    it('ask for a recorded rival when only one person showed up', () => {
        let room = sit(createPublicRoom('PUBL', ['ta', 'tb'], BOARDS, T0), 'a', 'ta');
        expect(needsGhost(room, T0 + PUBLIC_JOIN_MS - 1)).toBe(false);
        expect(needsGhost(room, T0 + PUBLIC_JOIN_MS)).toBe(true);
        expect(tick(room, T0 + PUBLIC_JOIN_MS).status).toBe('lobby');
        room = withGhost(room, RIVAL);
        expect(needsGhost(room, T0 + PUBLIC_JOIN_MS)).toBe(false);
        expect(tick(room, T0 + PUBLIC_JOIN_MS).status).toBe('playing');
    });

    it('refuse what only private tables do: ready, format, start, rename, rematch, lobby', () => {
        const room = sit(sit(createPublicRoom('PUBL', ['ta', 'tb'], BOARDS, T0), 'a', 'ta'), 'b', 'tb');
        expect(setReady(room, 'b', true, T0)).toEqual({ ok: false, error: 'invalid' });
        expect(setFormat(room, 'a', 'long', T0)).toEqual({ ok: false, error: 'invalid' });
        expect(startMatch(room, 'a', BOARDS, T0)).toEqual({ ok: false, error: 'invalid' });
        expect(renamePlayer(room, 'a', 'Álvaro', T0)).toEqual({ ok: false, error: 'invalid' });
        expect(rematch(room, 'a', BOARDS, T0)).toEqual({ ok: false, error: 'invalid' });
        expect(backToLobby(room, 'a', T0)).toEqual({ ok: false, error: 'invalid' });
    });

    it('keep seats and recorded results away from clients', () => {
        const room = sit(createPublicRoom('PUBL', ['ta'], BOARDS, T0, RIVAL), 'a', 'ta');
        const seen = publicRoom(room);
        expect(seen).not.toHaveProperty('seats');
        for (const player of seen.players) {
            expect(player).not.toHaveProperty('ghost');
            expect(player).not.toHaveProperty('token');
        }
        expect(JSON.stringify(seen)).not.toContain('30000');
    });

    it('tell matchmaking when the match ends at the latest', () => {
        const room = tick(sit(createPublicRoom('PUBL', ['ta'], BOARDS, T0, RIVAL), 'a', 'ta'), T0);
        expect(room.status).toBe('playing');
        expect(latestEnd(room)).toBe(room.startsAt + 60_000 + TRANSITION_MS);
    });
});

describe('recorded rivals', () => {
    /** One person against RIVAL, started at T0. */
    const race = () => tick(sit(createPublicRoom('PUBL', ['ta'], BOARDS, T0, RIVAL), 'a', 'ta'), T0);
    const start = T0 + COUNTDOWN_MS;

    it('use the rival\'s boards and finish each one when it was finished when recorded', () => {
        let room = race();
        expect(room.boards.map(b => b.id)).toEqual(['mate', 'mate-2']);
        const ghost = () => room.players.find(p => p.ghost)!;
        expect(nextWakeUp(room)).toBe(start + 10_000);
        room = tick(room, start + 9_999);
        expect(ghost().results).toEqual([]);
        room = tick(room, start + 10_000);
        expect(ghost().results).toEqual([{ ...won(10_000), points: boardPoints(10_000) }]);
        expect(ghost().board).toBe(1);
        // The second board was a timeout: it lasts the whole clock.
        const second = start + 10_000 + TRANSITION_MS;
        expect(nextWakeUp(room)).toBe(Math.min(second + 30_000, start + 30_000));
        room = tick(room, second + 30_000);
        expect(ghost().results[1]).toMatchObject({ outcome: 'timeout', mistakes: 2, points: 0, ms: 30_000 });
    });

    it('race in the standings while both are playing', () => {
        let room = race();
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', start + 5_000));
        expect(room.status).toBe('playing');
        expect(rankPlayers(room.players)[0].id).toBe('a');
        room = tick(room, start + 10_000);
        expect(room.players.find(p => p.ghost)!.results).toHaveLength(1);
        expect(room.status).toBe('playing');
    });

    it('don\'t keep anyone waiting: once the person is done, the rest of the recording is scored at once', () => {
        let room = race();
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', start + 2_000));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', start + 2_000 + TRANSITION_MS + 2_000));
        expect(room.status).toBe('finished');
        expect(room.finishedAt).toBe(start + 2_000 + TRANSITION_MS + 2_000);
        const ghost = room.players.find(p => p.ghost)!;
        expect(ghost.results.map(r => r.outcome)).toEqual(['won', 'timeout']);
        expect(ghost.results[0].ms).toBe(10_000);
        expect(ghost.results[1].ms).toBe(30_000);
    });

    it('stay connected and are never recorded again', () => {
        let room = race();
        room = disconnect(room, 'g1', T0);
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', start + 5_000));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', start + 12_000));
        room = tick(room, start + 60_000);
        expect(room.status).toBe('finished');
        const runs = ghostRuns(room, start + 60_000);
        expect(runs).toHaveLength(1);
        expect(runs[0].totalPoints).toBe(room.players.find(p => p.id === 'a')!.results.reduce((sum, r) => sum + r.points, 0));
    });
});

/** Points of a solved MATE board with one mistake, as the table scores it. */
function boardPoints(ms: number) {
    return Math.max(25, 100 + Math.round(50 * Math.max(0, 1 - ms / 30_000)) - 15);
}
