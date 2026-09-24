import type { Square } from 'chess.js';
import type { Ply } from './line';
import { challengeReducer, createChallenge, hintsUsed, isPlayerTurn, type ChallengeState } from './challenge';
import { puzzleDifficulty, puzzlePlies, puzzleSide, type Difficulty, type Puzzle } from './puzzle';

/*
 * Tactic battles: 2–4 players share a table (a room), the host picks a format and
 * everyone races through the same Lichess puzzles. Each board has its own clock and
 * the usual 5 mistakes. Everything here is pure so the Durable Object that hosts a
 * room (worker/battle.ts) and the tests share one source of truth.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 16;
/** "3, 2, 1" before the first board. */
export const COUNTDOWN_MS = 3_000;
/** Pause between boards to see the result; the next board's clock starts after it. */
export const TRANSITION_MS = 1_500;
/** A player who drops out of the lobby keeps their seat this long (page reloads). */
export const LOBBY_GRACE_MS = 20_000;

/* ------------------------------------------------------------------ Formats */

export type BattleFormat = 'short' | 'normal' | 'long';
export const FORMATS_ORDER: BattleFormat[] = ['short', 'normal', 'long'];

export interface FormatSpec {
    /** Hard cap for the sum of the boards' clocks: the match can never last longer. */
    budget: number;
    minBoards: number;
    maxBoards: number;
    /** Difficulty of each slot, cycled; boards are then sorted from easy to hard. */
    tiers: Difficulty[];
}

export const FORMATS: Record<BattleFormat, FormatSpec> = {
    // ~2 min: a few easy shots.
    short: { budget: 120, minBoards: 3, maxBoards: 4, tiers: ['easy'] },
    // ≤4 min: easy and hard mixed.
    normal: { budget: 240, minBoards: 4, maxBoards: 6, tiers: ['easy', 'medium', 'hard', 'medium'] },
    // ~10 min: longer, harder calculation.
    long: { budget: 600, minBoards: 7, maxBoards: 10, tiers: ['hard', 'medium', 'hard'] },
};

/** No board gets less time than this, whatever its rating. */
const MIN_LIMIT = 25;

/** Moves the player has to find: the first move is the opponent's setup. */
export function playerMoveCount(puzzle: Puzzle): number {
    return Math.ceil((puzzle.moves.split(' ').length - 1) / 2);
}

/**
 * Seconds allowed for a puzzle: the relation between difficulty and solving time.
 * A base for reading the position, plus time per move to find and per 100 rating
 * points, rounded to 5 s. A 1000-rated mate in one gets 25 s; a 1500-rated
 * two-mover 50 s; a 1900-rated three-mover 75 s.
 */
export function timeLimit(puzzle: Puzzle): number {
    const seconds = 15 + 8 * playerMoveCount(puzzle) + 4 * Math.max(0, puzzle.rating - 1000) / 100;
    return Math.max(MIN_LIMIT, Math.round(seconds / 5) * 5);
}

export interface BattleBoard extends Puzzle {
    /** Seconds on this board's clock. */
    limit: number;
}

/** Small seeded PRNG so a match can be reproduced from its seed. */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle<T>(items: T[], random: () => number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const EASIER: Record<Difficulty, Difficulty[]> = { easy: ['easy'], medium: ['medium', 'easy'], hard: ['hard', 'medium', 'easy'] };

/**
 * Random boards for a format whose clocks add up to at most its budget. Each slot
 * takes a puzzle of its tier that still fits (falling back to easier tiers), so the
 * number of boards follows from the time available.
 */
export function pickBoards(pool: Puzzle[], format: BattleFormat, random: () => number): BattleBoard[] {
    const spec = FORMATS[format];
    const byTier: Record<Difficulty, Puzzle[]> = { easy: [], medium: [], hard: [] };
    for (const puzzle of shuffle(pool, random)) byTier[puzzleDifficulty(puzzle)].push(puzzle);

    const picked: BattleBoard[] = [];
    let remaining = spec.budget;
    while (picked.length < spec.maxBoards) {
        const tier = spec.tiers[picked.length % spec.tiers.length];
        // Leave room for the quickest possible boards still needed to reach the minimum.
        const reserve = Math.max(0, spec.minBoards - picked.length - 1) * MIN_LIMIT;
        let next: BattleBoard | undefined;
        for (const candidateTier of EASIER[tier]) {
            const list = byTier[candidateTier];
            const index = list.findIndex(p => timeLimit(p) <= remaining - reserve);
            if (index === -1) continue;
            const [puzzle] = list.splice(index, 1);
            next = { ...puzzle, limit: timeLimit(puzzle) };
            break;
        }
        if (!next) break;
        picked.push(next);
        remaining -= next.limit;
    }
    return picked.sort((a, b) => a.rating - b.rating);
}

export const totalLimit = (boards: BattleBoard[]) => boards.reduce((sum, b) => sum + b.limit, 0);

/* ------------------------------------------------------------------ Scoring */

export type BoardOutcome = 'won' | 'lost' | 'timeout';

export interface BoardResult {
    outcome: BoardOutcome;
    /** Wrong moves. */
    mistakes: number;
    /** Hints taken, and the half-errors they cost (see HINT_HALVES in challenge.ts). */
    hints?: number;
    hintHalves?: number;
    /** Time spent on the board. */
    ms: number;
    points: number;
}

/** 🟩 clean, 🟨 with mistakes or hints, 🟥 out of mistakes, ⏱️ out of time. */
export function outcomeEmoji(result: BoardResult): string {
    if (result.outcome === 'timeout') return '⏱️';
    if (result.outcome === 'lost') return '🟥';
    return result.mistakes || result.hints ? '🟨' : '🟩';
}

/** Errors on a board in half points, like the daily challenge: 2 per wrong move, hints their halves. */
export function resultHalves(result: BoardResult): number {
    return Math.min(MAX_BOARD_HALVES, result.mistakes * 2 + (result.hintHalves ?? 0));
}

const MAX_BOARD_HALVES = 10;

/** A hint costs a third of a mistake: all three on one move cost the same as a wrong move. */
export const POINTS = { solved: 100, speed: 50, mistake: 15, hint: 5, floor: 25 } as const;

/** Solving is worth 100, up to 50 more for speed, minus 15 per mistake and 5 per hint (never below 25). */
export function boardPoints(outcome: BoardOutcome, mistakes: number, ms: number, limit: number, hints = 0): number {
    if (outcome !== 'won') return 0;
    const speed = Math.round(POINTS.speed * Math.max(0, 1 - ms / (limit * 1000)));
    return Math.max(POINTS.floor, POINTS.solved + speed - POINTS.mistake * mistakes - POINTS.hint * hints);
}

/* ------------------------------------------------------------------ Room */

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface BattlePlayer {
    /** Public id, shown to everyone. */
    id: string;
    /** Secret the player's browser keeps to reclaim the seat; never sent to others. */
    token: string;
    name: string;
    ready: boolean;
    online: boolean;
    /** When they went offline, to free lobby seats after a grace period. */
    offlineSince?: number;
    /** Left the match on purpose: their remaining boards count as lost on time. */
    left?: boolean;
    /** Discord user id, when playing inside the Discord Activity. */
    discordId?: string;
    /** Index of the board being played; equals boards.length when done. */
    board: number;
    boardStartedAt: number;
    /** Progress on the current board. */
    state: ChallengeState | null;
    results: BoardResult[];
}

/** Where a table played inside Discord lives, to post the results there. */
export interface DiscordTable {
    instanceId: string;
    channelId: string;
    guildId: string | null;
    lang: 'es' | 'en';
}

export interface Room {
    code: string;
    /** Set for tables inside the Discord Activity (one per activity instance). */
    discord?: DiscordTable;
    status: RoomStatus;
    hostId: string;
    format: BattleFormat;
    players: BattlePlayer[];
    boards: BattleBoard[];
    /** When the first board starts, after the countdown. */
    startsAt: number;
    finishedAt?: number;
    /** Match number within the room (rematches). */
    round: number;
    updatedAt: number;
}

export type BattleError = 'full' | 'started' | 'notFound' | 'taken' | 'kicked' | 'notHost' | 'notReady' | 'tooFew' | 'invalid';

export type Outcome = { ok: true; room: Room } | { ok: false; error: BattleError };

const ok = (room: Room): Outcome => ({ ok: true, room });
const fail = (error: BattleError): Outcome => ({ ok: false, error });

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
export const isRoomCode = (code: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

export function randomCode(random: () => number = Math.random): string {
    return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');
}

/** Trimmed, single-spaced, without control characters and at most 16 characters. */
export function cleanName(name: unknown): string {
    if (typeof name !== 'string') return '';
    return Array.from(name.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

export function createRoom(code: string, now: number): Room {
    return { code, status: 'lobby', hostId: '', format: 'normal', players: [], boards: [], startsAt: 0, round: 0, updatedAt: now };
}

const update = (room: Room, now: number, changes: Partial<Room>): Room => ({ ...room, ...changes, updatedAt: now });

function withPlayer(room: Room, id: string, change: (player: BattlePlayer) => BattlePlayer): Room {
    return { ...room, players: room.players.map(p => (p.id === id ? change(p) : p)) };
}

export const findByToken = (room: Room, token: string) => room.players.find(p => p.token === token);

/** Takes a seat, or reclaims it with the same token (reconnection). */
export function joinRoom(room: Room, player: { id: string; token: string; name: string; discordId?: string }, now: number): Outcome {
    const existing = findByToken(room, player.token);
    if (existing) {
        const name = cleanName(player.name) || existing.name;
        return ok(update(withPlayer(room, existing.id, p => ({ ...p, name, online: true, offlineSince: undefined })), now, {}));
    }
    if (room.status !== 'lobby') return fail('started');
    if (room.players.length >= MAX_PLAYERS) return fail('full');
    const seat = room.players.length + 1;
    const name = cleanName(player.name) || `#${seat}`;
    const joined: BattlePlayer = {
        id: player.id, token: player.token, name, ready: false, online: true,
        board: 0, boardStartedAt: 0, state: null, results: [],
        ...(player.discordId ? { discordId: player.discordId } : {}),
    };
    return ok(update(room, now, { players: [...room.players, joined], hostId: room.hostId || player.id }));
}

/** The host role passes to the longest-seated player still there. */
function ensureHost(room: Room): Room {
    if (room.players.some(p => p.id === room.hostId && !p.left)) return room;
    const next = room.players.find(p => p.online && !p.left) ?? room.players.find(p => !p.left);
    return { ...room, hostId: next?.id ?? '' };
}

function removePlayer(room: Room, id: string, now: number): Room {
    return update(ensureHost({ ...room, players: room.players.filter(p => p.id !== id) }), now, {});
}

export function disconnect(room: Room, id: string, now: number): Room {
    return update(withPlayer(room, id, p => ({ ...p, online: false, offlineSince: now })), now, {});
}

/** Leaving on purpose: out of the lobby, or out of the race with the remaining boards lost. */
export function leaveRoom(room: Room, id: string, now: number): Room {
    const player = room.players.find(p => p.id === id);
    if (!player) return room;
    if (room.status !== 'playing') return removePlayer(room, id, now);
    let next = withPlayer(room, id, p => ({ ...p, left: true, online: false, offlineSince: now }));
    while (true) {
        const current = next.players.find(p => p.id === id)!;
        if (current.board >= next.boards.length) break;
        next = finishBoard(next, id, 'timeout', Math.max(now, current.boardStartedAt));
    }
    return update(ensureHost(next), now, {});
}

export function setReady(room: Room, id: string, ready: boolean, now: number): Outcome {
    if (room.status !== 'lobby') return fail('started');
    return ok(update(withPlayer(room, id, p => ({ ...p, ready })), now, {}));
}

export function renamePlayer(room: Room, id: string, name: unknown, now: number): Outcome {
    const clean = cleanName(name);
    if (!clean) return fail('invalid');
    return ok(update(withPlayer(room, id, p => ({ ...p, name: clean })), now, {}));
}

export function setFormat(room: Room, id: string, format: unknown, now: number): Outcome {
    if (id !== room.hostId) return fail('notHost');
    if (room.status !== 'lobby') return fail('started');
    if (!FORMATS_ORDER.includes(format as BattleFormat)) return fail('invalid');
    // A new format is a new deal: everyone confirms again.
    const players = room.players.map(p => ({ ...p, ready: false }));
    return ok(update(room, now, { format: format as BattleFormat, players }));
}

export function kickPlayer(room: Room, id: string, target: string, now: number): Outcome {
    if (id !== room.hostId) return fail('notHost');
    if (room.status !== 'lobby' || target === id) return fail('invalid');
    return ok(removePlayer(room, target, now));
}

/** Everyone except the host has to be connected and ready; the host's "start" is their ready. */
export function canStart(room: Room): BattleError | null {
    if (room.status !== 'lobby') return 'started';
    if (room.players.length < MIN_PLAYERS) return 'tooFew';
    if (room.players.some(p => !p.online || (!p.ready && p.id !== room.hostId))) return 'notReady';
    return null;
}

/** Plays the opponent's replies (and the setup move) until it's the player's turn. */
function opponentReplies(state: ChallengeState, plies: Ply[]): ChallengeState {
    const reduce = challengeReducer(plies);
    let next = state;
    while (next.status === 'playing' && !isPlayerTurn(next, plies)) next = reduce(next, { type: 'opponent' });
    return next;
}

function firstState(board: BattleBoard | undefined): ChallengeState | null {
    if (!board) return null;
    const plies = puzzlePlies(board);
    return opponentReplies(createChallenge(plies, puzzleSide(plies)), plies);
}

export function startMatch(room: Room, id: string, boards: BattleBoard[], now: number): Outcome {
    if (id !== room.hostId) return fail('notHost');
    const blocked = canStart(room);
    if (blocked) return fail(blocked);
    if (!boards.length) return fail('invalid');
    const startsAt = now + COUNTDOWN_MS;
    const players = room.players.map(p => ({
        ...p, ready: false, left: false, board: 0, boardStartedAt: startsAt, state: firstState(boards[0]), results: [],
    }));
    return ok(update(room, now, { status: 'playing', boards, startsAt, finishedAt: undefined, players, round: room.round + 1 }));
}

/** When the player's current board runs out of time. */
export function boardDeadline(room: Room, player: BattlePlayer): number | null {
    const board = room.boards[player.board];
    return board ? player.boardStartedAt + board.limit * 1000 : null;
}

function finishBoard(room: Room, id: string, outcome: BoardOutcome, at: number): Room {
    const player = room.players.find(p => p.id === id);
    const board = player && room.boards[player.board];
    if (!player || !board) return room;
    const ms = Math.min(board.limit * 1000, Math.max(0, at - player.boardStartedAt));
    const mistakes = player.state?.mistakes ?? 0;
    const hints = player.state ? hintsUsed(player.state) : 0;
    const hintHalves = player.state?.hintHalves ?? 0;
    const result: BoardResult = { outcome, mistakes, hints, hintHalves, ms, points: boardPoints(outcome, mistakes, ms, board.limit, hints) };
    const nextIndex = player.board + 1;
    const next = withPlayer(room, id, p => ({
        ...p,
        board: nextIndex,
        boardStartedAt: at + TRANSITION_MS,
        state: firstState(room.boards[nextIndex]),
        results: [...p.results, result],
    }));
    return maybeFinish(next, at);
}

const isDone = (room: Room, player: BattlePlayer) => player.board >= room.boards.length;

function maybeFinish(room: Room, now: number): Room {
    if (room.status !== 'playing' || !room.players.every(p => isDone(room, p))) return room;
    return { ...room, status: 'finished', finishedAt: now };
}

/** Plays a move on the player's current board; the opponent's reply is applied at once. */
export function playMove(room: Room, id: string, boardIndex: number, from: Square, to: Square, now: number): Outcome {
    if (room.status !== 'playing') return fail('invalid');
    const ticked = tick(room, now);
    const player = ticked.players.find(p => p.id === id);
    const board = player && ticked.boards[player.board];
    if (!player || !board || !player.state || player.board !== boardIndex || now < player.boardStartedAt) return fail('invalid');

    const plies = puzzlePlies(board);
    const attempted = challengeReducer(plies)(player.state, { type: 'attempt', from, to });
    if (attempted === player.state) return fail('invalid');
    const state = opponentReplies(attempted, plies);

    let next = withPlayer(ticked, id, p => ({ ...p, state }));
    if (state.status !== 'playing') next = finishBoard(next, id, state.status, now);
    return ok(update(next, now, {}));
}

/** A hint on the player's current board: it costs points when the board is scored. */
export function takeHint(room: Room, id: string, boardIndex: number, now: number): Outcome {
    if (room.status !== 'playing') return fail('invalid');
    const ticked = tick(room, now);
    const player = ticked.players.find(p => p.id === id);
    const board = player && ticked.boards[player.board];
    if (!player || !board || !player.state || player.board !== boardIndex || now < player.boardStartedAt) return fail('invalid');
    const state = challengeReducer(puzzlePlies(board))(player.state, { type: 'hint' });
    if (state === player.state) return fail('invalid');
    return ok(update(withPlayer(ticked, id, p => ({ ...p, state })), now, {}));
}

/** Applies what time alone decides: boards that ran out and lobby seats left empty. */
export function tick(room: Room, now: number): Room {
    let next = room;
    if (next.status === 'playing') {
        for (const player of next.players) {
            while (true) {
                const current = next.players.find(p => p.id === player.id)!;
                const deadline = boardDeadline(next, current);
                if (deadline === null || deadline > now) break;
                next = finishBoard(next, player.id, 'timeout', deadline);
            }
        }
    }
    if (next.status === 'lobby') {
        for (const player of next.players) {
            if (!player.online && player.offlineSince !== undefined && now - player.offlineSince >= LOBBY_GRACE_MS) {
                next = removePlayer(next, player.id, now);
            }
        }
    }
    return next === room ? room : update(next, now, {});
}

/** The next moment `tick` has something to do, for the Durable Object's alarm. */
export function nextWakeUp(room: Room): number | null {
    const times: number[] = [];
    if (room.status === 'playing') {
        for (const player of room.players) {
            const deadline = boardDeadline(room, player);
            if (deadline !== null) times.push(deadline);
        }
    }
    if (room.status === 'lobby') {
        for (const player of room.players) {
            if (!player.online && player.offlineSince !== undefined) times.push(player.offlineSince + LOBBY_GRACE_MS);
        }
    }
    return times.length ? Math.min(...times) : null;
}

/** After the podium, the host brings everyone back to the table for a rematch. */
export function backToLobby(room: Room, id: string, now: number): Outcome {
    if (id !== room.hostId) return fail('notHost');
    if (room.status !== 'finished') return fail('invalid');
    // Players who left mid-match lose their seat now.
    const players = room.players
        .filter(p => !p.left)
        .map(p => ({ ...p, ready: false, board: 0, boardStartedAt: 0, state: null, results: [] }));
    return ok(update(ensureHost({ ...room, players }), now, { status: 'lobby', boards: [], startsAt: 0, finishedAt: undefined }));
}

/* ------------------------------------------------------------------ Standings */

export interface Standing {
    id: string;
    name: string;
    points: number;
    solved: number;
    /** Errors, hints included (1.5 = a wrong move and half a hint). */
    errors: number;
    ms: number;
    /** Boards finished, for the live race. */
    played: number;
    left: boolean;
}

export function standing(player: BattlePlayer): Standing {
    const sum = (key: 'points' | 'ms') => player.results.reduce((total, r) => total + r[key], 0);
    return {
        id: player.id,
        name: player.name,
        points: sum('points'),
        solved: player.results.filter(r => r.outcome === 'won').length,
        errors: player.results.reduce((total, r) => total + resultHalves(r), 0) / 2,
        ms: sum('ms'),
        played: player.results.length,
        left: Boolean(player.left),
    };
}

/** Points first, then boards solved, fewer errors and less time; those who left go last. */
export function rankPlayers(players: BattlePlayer[]): Standing[] {
    return players.map(standing).sort((a, b) =>
        Number(a.left) - Number(b.left) || b.points - a.points || b.solved - a.solved || a.errors - b.errors || a.ms - b.ms);
}

/* ------------------------------------------------------------------ Protocol */

/** What a client sees: the room without anyone's token. */
export type PublicPlayer = Omit<BattlePlayer, 'token'>;
export type PublicRoom = Omit<Room, 'players'> & { players: PublicPlayer[] };

export function publicRoom(room: Room): PublicRoom {
    return { ...room, players: room.players.map(({ token: _token, ...player }) => player) };
}

export type ClientMessage =
    | { t: 'ready'; ready: boolean }
    | { t: 'format'; format: BattleFormat }
    | { t: 'rename'; name: string }
    | { t: 'kick'; id: string }
    | { t: 'start' }
    | { t: 'move'; board: number; from: Square; to: Square }
    | { t: 'hint'; board: number }
    | { t: 'lobby' }
    | { t: 'leave' };

export type ServerMessage =
    | { t: 'room'; room: PublicRoom; you: string; now: number }
    | { t: 'error'; error: BattleError; now: number };

const SQUARE = /^[a-h][1-8]$/;

/** Validates an incoming message; anything malformed is dropped. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
    if (typeof raw !== 'string' || raw.length > 256) return null;
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || typeof data !== 'object') return null;
    switch (data.t) {
        case 'ready':
            return typeof data.ready === 'boolean' ? { t: 'ready', ready: data.ready } : null;
        case 'format':
            return FORMATS_ORDER.includes(data.format as BattleFormat) ? { t: 'format', format: data.format as BattleFormat } : null;
        case 'rename':
            return typeof data.name === 'string' ? { t: 'rename', name: data.name } : null;
        case 'kick':
            return typeof data.id === 'string' ? { t: 'kick', id: data.id } : null;
        case 'move':
            return Number.isInteger(data.board) && SQUARE.test(String(data.from)) && SQUARE.test(String(data.to))
                ? { t: 'move', board: data.board as number, from: data.from as Square, to: data.to as Square }
                : null;
        case 'hint':
            return Number.isInteger(data.board) ? { t: 'hint', board: data.board as number } : null;
        case 'start':
        case 'lobby':
        case 'leave':
            return { t: data.t };
        default:
            return null;
    }
}
