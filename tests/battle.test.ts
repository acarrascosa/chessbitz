import { describe, expect, it } from 'vitest';
import puzzles from '../src/data/puzzles.json';
import {
    COUNTDOWN_MS, FORMATS, FORMATS_ORDER, LOBBY_GRACE_MS, MAX_PLAYERS, TRANSITION_MS,
    backToLobby, boardDeadline, boardPoints, canStart, cleanName, createRoom, disconnect, isRoomCode, joinRoom,
    kickPlayer, leaveRoom, nextWakeUp, outcomeEmoji, takeHint, parseClientMessage, pickBoards, playMove, publicRoom, randomCode, rankPlayers,
    seededRandom, setFormat, setReady, startMatch, tick, timeLimit, totalLimit,
    type BattleBoard, type Outcome, type Room,
} from '../src/lib/battle';
import { puzzlePlies, type Puzzle } from '../src/lib/puzzle';

const pool = Object.values(puzzles as Record<string, Puzzle[]>).flat();

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

/** A lobby with players a (host) and b, both ready. */
function lobby(): Room {
    let room = createRoom('ABCD', T0);
    room = unwrap(joinRoom(room, { id: 'a', token: 'ta', name: 'Ana' }, T0));
    room = unwrap(joinRoom(room, { id: 'b', token: 'tb', name: 'Bea' }, T0));
    return unwrap(setReady(room, 'b', true, T0));
}

const started = () => unwrap(startMatch(lobby(), 'a', BOARDS, T0));
const START = T0 + COUNTDOWN_MS;

describe('time and board selection', () => {
    it('gives harder and longer puzzles more time', () => {
        const [easy, hard] = [pool.find(p => p.rating < 1100 && p.moves.split(' ').length === 2)!, pool.find(p => p.rating > 1800 && p.moves.split(' ').length === 6)!];
        expect(timeLimit(easy)).toBeLessThan(timeLimit(hard));
        for (const puzzle of pool) {
            expect(timeLimit(puzzle) % 5).toBe(0);
            expect(timeLimit(puzzle)).toBeGreaterThanOrEqual(25);
        }
    });

    it('never exceeds the format budget and respects the board counts', () => {
        for (const format of FORMATS_ORDER) {
            const spec = FORMATS[format];
            for (let seed = 1; seed <= 300; seed++) {
                const boards = pickBoards(pool, format, seededRandom(seed));
                expect(totalLimit(boards)).toBeLessThanOrEqual(spec.budget);
                expect(boards.length).toBeGreaterThanOrEqual(spec.minBoards);
                expect(boards.length).toBeLessThanOrEqual(spec.maxBoards);
                expect(new Set(boards.map(b => b.id)).size).toBe(boards.length);
                expect(boards.map(b => b.rating)).toEqual([...boards.map(b => b.rating)].sort((x, y) => x - y));
            }
        }
    });

    it('makes longer formats harder on average', () => {
        const average = (format: 'short' | 'normal' | 'long') => {
            const boards = Array.from({ length: 100 }, (_, i) => pickBoards(pool, format, seededRandom(i))).flat();
            return boards.reduce((sum, b) => sum + b.rating, 0) / boards.length;
        };
        expect(average('short')).toBeLessThan(average('normal'));
        expect(average('normal')).toBeLessThan(average('long'));
    });

    it('is reproducible from a seed', () => {
        expect(pickBoards(pool, 'normal', seededRandom(42))).toEqual(pickBoards(pool, 'normal', seededRandom(42)));
    });
});

describe('scoring', () => {
    it('rewards speed and punishes mistakes', () => {
        expect(boardPoints('won', 0, 0, 30)).toBe(150);
        expect(boardPoints('won', 0, 30_000, 30)).toBe(100);
        expect(boardPoints('won', 2, 15_000, 30)).toBe(95);
        expect(boardPoints('won', 4, 30_000, 30)).toBe(40);
        expect(boardPoints('lost', 5, 1_000, 30)).toBe(0);
        expect(boardPoints('timeout', 0, 30_000, 30)).toBe(0);
    });
});

describe('lobby', () => {
    it('makes the first player host and caps the table at four', () => {
        let room = createRoom('ABCD', T0);
        for (let i = 0; i < MAX_PLAYERS; i++) room = unwrap(joinRoom(room, { id: `p${i}`, token: `t${i}`, name: '' }, T0));
        expect(room.hostId).toBe('p0');
        expect(room.players.map(p => p.name)).toEqual(['#1', '#2', '#3', '#4']);
        expect(joinRoom(room, { id: 'x', token: 'tx', name: 'X' }, T0)).toEqual({ ok: false, error: 'full' });
    });

    it('lets a player reclaim their seat with the same token', () => {
        let room = disconnect(lobby(), 'a', T0 + 1);
        room = unwrap(joinRoom(room, { id: 'new-id', token: 'ta', name: '' }, T0 + 2));
        expect(room.players).toHaveLength(2);
        expect(room.players[0]).toMatchObject({ id: 'a', name: 'Ana', online: true });
    });

    it('frees a lobby seat after the grace period and passes the host role on', () => {
        const room = disconnect(lobby(), 'a', T0);
        expect(nextWakeUp(room)).toBe(T0 + LOBBY_GRACE_MS);
        expect(tick(room, T0 + LOBBY_GRACE_MS - 1).players).toHaveLength(2);
        const later = tick(room, T0 + LOBBY_GRACE_MS);
        expect(later.players.map(p => p.id)).toEqual(['b']);
        expect(later.hostId).toBe('b');
    });

    it('only starts when everyone else is ready and online', () => {
        let room = createRoom('ABCD', T0);
        room = unwrap(joinRoom(room, { id: 'a', token: 'ta', name: 'Ana' }, T0));
        expect(canStart(room)).toBe('tooFew');
        room = unwrap(joinRoom(room, { id: 'b', token: 'tb', name: 'Bea' }, T0));
        expect(canStart(room)).toBe('notReady');
        room = unwrap(setReady(room, 'b', true, T0));
        expect(canStart(room)).toBeNull();
        expect(startMatch(room, 'b', BOARDS, T0)).toEqual({ ok: false, error: 'notHost' });
        expect(canStart(disconnect(room, 'b', T0))).toBe('notReady');
    });

    it('asks everyone to confirm again when the format changes', () => {
        const room = unwrap(setFormat(lobby(), 'a', 'long', T0));
        expect(room.format).toBe('long');
        expect(room.players.every(p => !p.ready)).toBe(true);
        expect(setFormat(room, 'b', 'short', T0)).toEqual({ ok: false, error: 'notHost' });
    });

    it('lets the host kick someone, but not themselves', () => {
        expect(unwrap(kickPlayer(lobby(), 'a', 'b', T0)).players.map(p => p.id)).toEqual(['a']);
        expect(kickPlayer(lobby(), 'b', 'a', T0).ok).toBe(false);
        expect(kickPlayer(lobby(), 'a', 'a', T0).ok).toBe(false);
    });

    it('refuses newcomers once the match has started', () => {
        expect(joinRoom(started(), { id: 'c', token: 'tc', name: 'Cris' }, T0)).toEqual({ ok: false, error: 'started' });
    });
});

describe('match', () => {
    it('starts every clock after the countdown', () => {
        const room = started();
        expect(room.status).toBe('playing');
        expect(room.players.every(p => p.boardStartedAt === START && p.board === 0)).toBe(true);
        expect(playMove(room, 'a', 0, 'h5', 'f7', START - 1)).toEqual({ ok: false, error: 'invalid' });
    });

    it('plays the setup move and scores a solved board', () => {
        const room = unwrap(playMove(started(), 'a', 0, 'h5', 'f7', START + 6_000));
        const ana = room.players[0];
        expect(ana.board).toBe(1);
        expect(ana.results[0]).toEqual({ outcome: 'won', mistakes: 0, hints: 0, hintHalves: 0, ms: 6_000, points: 140 });
        expect(ana.boardStartedAt).toBe(START + 6_000 + TRANSITION_MS);
    });

    it('charges 5 points per hint and counts it as half an error', () => {
        let room = started();
        expect(takeHint(room, 'a', 1, START + 1)).toEqual({ ok: false, error: 'invalid' });
        room = unwrap(takeHint(room, 'a', 0, START + 1_000));
        room = unwrap(takeHint(room, 'a', 0, START + 2_000));
        expect(room.players[0].state?.hints).toBe(2);
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', START + 6_000));
        const result = room.players[0].results[0];
        // 100 + 40 for speed − 2 × 5 for the hints.
        expect(result).toMatchObject({ outcome: 'won', mistakes: 0, hints: 2, hintHalves: 1, points: 130 });
        expect(outcomeEmoji(result)).toBe('🟨');
        expect(rankPlayers(room.players)[0]).toMatchObject({ name: 'Ana', errors: 0.5 });
    });

    it('costs as much for all three hints on a move as for a wrong move', () => {
        expect(boardPoints('won', 0, 30_000, 30, 3)).toBe(boardPoints('won', 1, 30_000, 30));
    });

    it('counts mistakes and loses the board after five', () => {
        let room = started();
        room = unwrap(playMove(room, 'a', 0, 'h5', 'h6', START + 1));
        expect(room.players[0].state?.mistakes).toBe(1);
        for (let i = 0; i < 4; i++) room = unwrap(playMove(room, 'a', 0, 'h5', 'h6', START + 2 + i));
        expect(room.players[0].results[0]).toMatchObject({ outcome: 'lost', mistakes: 5, points: 0 });
    });

    it('ignores moves for a board that is not the current one, and illegal moves', () => {
        expect(playMove(started(), 'a', 1, 'h5', 'f7', START + 1).ok).toBe(false);
        expect(playMove(started(), 'a', 0, 'a1', 'a8', START + 1).ok).toBe(false);
    });

    it('times boards out at their deadline, even when the alarm is late', () => {
        const room = started();
        const deadline = boardDeadline(room, room.players[0])!;
        expect(deadline).toBe(START + 30_000);
        expect(nextWakeUp(room)).toBe(deadline);
        // Late enough for both boards to expire.
        const late = tick(room, deadline + TRANSITION_MS + 30_000 + 5_000);
        expect(late.players[0].results.map(r => r.outcome)).toEqual(['timeout', 'timeout']);
        expect(late.status).toBe('finished');
        expect(late.finishedAt).toBe(deadline + TRANSITION_MS + 30_000);
    });

    it('finishes when every player is done and ranks by points, then solved, mistakes and time', () => {
        let room = started();
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', START + 5_000));
        room = unwrap(playMove(room, 'b', 0, 'h5', 'h6', START + 1_000));
        room = unwrap(playMove(room, 'b', 0, 'h5', 'f7', START + 2_000));
        const next = START + 5_000 + TRANSITION_MS;
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', next + 5_000));
        expect(room.status).toBe('playing');
        room = unwrap(playMove(room, 'b', 1, 'h5', 'f7', START + 2_000 + TRANSITION_MS + 1_000));
        expect(room.status).toBe('finished');
        expect(rankPlayers(room.players).map(s => [s.name, s.points, s.solved, s.errors])).toEqual([
            ['Ana', 284, 2, 0],
            ['Bea', 280, 2, 1],
        ]);
    });

    it('solves real multi-move puzzles with the opponent replying automatically', () => {
        const boards = pickBoards(pool, 'normal', seededRandom(7));
        let room = unwrap(startMatch(lobby(), 'a', boards, T0));
        let now = START;
        for (const [index, board] of boards.entries()) {
            const plies = puzzlePlies(board);
            for (const ply of plies.filter((_, i) => i % 2 === 1)) {
                now += 1_000;
                room = unwrap(playMove(room, 'a', index, ply.from, ply.to, now));
            }
            expect(room.players[0].results[index].outcome).toBe('won');
            now = room.players[0].boardStartedAt;
        }
        expect(room.players[0].board).toBe(boards.length);
    });

    it('ranks players who left last, even with fewer mistakes', () => {
        let room = unwrap(playMove(started(), 'a', 0, 'h5', 'h6', START + 1));
        room = leaveRoom(room, 'b', START + 2);
        expect(rankPlayers(room.players).map(s => s.name)).toEqual(['Ana', 'Bea']);
    });

    it('turns leaving mid-match into lost boards so the others can finish', () => {
        let room = leaveRoom(started(), 'b', START + 1_000);
        expect(room.players[1]).toMatchObject({ left: true, board: 2 });
        expect(room.hostId).toBe('a');
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', START + 2_000));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', START + 2_000 + TRANSITION_MS + 1_000));
        expect(room.status).toBe('finished');
    });

    it('brings everyone back to the table for a rematch, without those who left', () => {
        let room = leaveRoom(started(), 'b', START);
        room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', START + 1));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', START + 1 + TRANSITION_MS));
        room = unwrap(backToLobby(room, 'a', START + 10_000));
        expect(room.status).toBe('lobby');
        expect(room.players.map(p => p.id)).toEqual(['a']);
        expect(room.players[0].results).toEqual([]);
        expect(room.round).toBe(1);
    });
});

describe('protocol', () => {
    it('never sends tokens to clients', () => {
        expect(JSON.stringify(publicRoom(lobby()))).not.toContain('"token"');
    });

    it('validates client messages', () => {
        expect(parseClientMessage('{"t":"move","board":0,"from":"e2","to":"e4"}')).toEqual({ t: 'move', board: 0, from: 'e2', to: 'e4' });
        expect(parseClientMessage('{"t":"move","board":0,"from":"z9","to":"e4"}')).toBeNull();
        expect(parseClientMessage('{"t":"format","format":"huge"}')).toBeNull();
        expect(parseClientMessage('{"t":"ready","ready":"yes"}')).toBeNull();
        expect(parseClientMessage('not json')).toBeNull();
        expect(parseClientMessage(`{"t":"rename","name":"${'x'.repeat(300)}"}`)).toBeNull();
        expect(parseClientMessage('{"t":"start"}')).toEqual({ t: 'start' });
        expect(parseClientMessage('{"t":"hint","board":2}')).toEqual({ t: 'hint', board: 2 });
        expect(parseClientMessage('{"t":"hint","board":"x"}')).toBeNull();
    });

    it('cleans names and room codes', () => {
        expect(cleanName('  Magnus\u0000   Carlsen the great  ')).toBe('Magnus Carlsen t');
        expect(cleanName(42)).toBe('');
        expect(isRoomCode(randomCode())).toBe(true);
        expect(isRoomCode('abcd')).toBe(false);
        expect(isRoomCode('AB0D')).toBe(false);
    });
});
