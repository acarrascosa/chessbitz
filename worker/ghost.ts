import type { Env } from './env';
import { PUBLIC_FORMAT, timeLimit, type BattleFormat, type BoardResult, type GhostRival, type Room } from '../src/lib/battle';
import { gamerTag } from '../src/lib/names';
import type { Puzzle } from '../src/lib/puzzle';

/** Where a run comes from: a finished battle, or scripts/seed-ghost-runs.mjs before there were enough of those. */
export type GhostSource = 'real' | 'seed';

/** A row of ghost_runs (migrations 0005 and 0006). */
export interface GhostRun {
    format: BattleFormat;
    /** Puzzle ids in board order, as JSON. */
    boardIds: string;
    /** Invented gamer tag: the player's own name is never stored. */
    displayName: string;
    /** BoardResult[] as JSON. */
    results: string;
    totalPoints: number;
    boardsSolved: number;
    boardCount: number;
    recordedAt: number;
    source: GhostSource;
}

/** Every board ran out of time without a single move or hint: the player wasn't there, and a rival that never moves is no rival. */
export const isIdleRun = (results: BoardResult[]) => results.every(r => r.outcome === 'timeout' && r.mistakes === 0 && !r.hints);

/**
 * A finished battle as recorded rivals for public matchmaking: one run per player
 * who played it to the end (those who left only have part of a match, idle ones
 * none), anonymous.
 */
export function ghostRuns(room: Room, now: number, random: () => number = Math.random): GhostRun[] {
    if (room.status !== 'finished') return [];
    const boardIds = JSON.stringify(room.boards.map(b => b.id));
    return room.players
        .filter(player => !player.ghost && !player.left && player.results.length === room.boards.length && !isIdleRun(player.results))
        .map(player => ({
            format: room.format,
            boardIds,
            displayName: gamerTag(random),
            results: JSON.stringify(player.results),
            totalPoints: player.results.reduce((sum, r) => sum + r.points, 0),
            boardsSolved: player.results.filter(r => r.outcome === 'won').length,
            boardCount: room.boards.length,
            recordedAt: now,
            source: 'real',
        }));
}

export async function recordGhostRuns(env: Env, room: Room, now: number): Promise<void> {
    const runs = ghostRuns(room, now);
    if (!runs.length) return;
    const insert = env.DB.prepare(
        `INSERT INTO ghost_runs (format, board_ids, display_name, results, total_points, boards_solved, board_count, recorded_at, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    );
    await env.DB.batch(runs.map(r => insert.bind(r.format, r.boardIds, r.displayName, r.results, r.totalPoints, r.boardsSolved, r.boardCount, r.recordedAt, r.source)));
}

/** How many of the runs nearest to the player's level to choose from, so rivals vary. */
const CANDIDATES = 12;
/** Real runs are picked this many times more often than seeded ones. */
const REAL_WEIGHT = 3;

interface GhostRow {
    board_ids: string;
    display_name: string;
    results: string;
    source: GhostSource;
}

/**
 * A recorded rival for a public table, near `level` points: one of the closest runs
 * whose boards are all still in the pool, real ones preferred. Null if there is none.
 */
export async function pickGhost(env: Env, pool: Map<string, Puzzle>, level: number, random: () => number = Math.random): Promise<GhostRival | null> {
    const { results } = await env.DB.prepare(
        `SELECT board_ids, display_name, results, source FROM ghost_runs
         WHERE format = ?1 AND total_points > 0 ORDER BY ABS(total_points - ?2) LIMIT ?3`,
    ).bind(PUBLIC_FORMAT, Math.round(level), CANDIDATES * 3).all<GhostRow>();
    const candidates: { rival: GhostRival; weight: number }[] = [];
    for (const row of results) {
        const ids = JSON.parse(row.board_ids) as string[];
        const recorded = JSON.parse(row.results) as BoardResult[];
        const puzzles = ids.map(id => pool.get(id));
        if (recorded.length !== ids.length || puzzles.some(p => !p) || isIdleRun(recorded)) continue;
        const boards = (puzzles as Puzzle[]).map(p => ({ ...p, limit: timeLimit(p) }));
        candidates.push({ rival: { name: row.display_name, boards, results: recorded }, weight: row.source === 'real' ? REAL_WEIGHT : 1 });
        if (candidates.length === CANDIDATES) break;
    }
    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let pick = random() * total;
    for (const candidate of candidates) {
        if ((pick -= candidate.weight) < 0) return candidate.rival;
    }
    return candidates.at(-1)?.rival ?? null;
}
