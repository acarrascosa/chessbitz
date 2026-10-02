import type { Env } from './env';
import type { BattleFormat, BoardResult, Room } from '../src/lib/battle';
import { gamerTag } from '../src/lib/names';

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
        .filter(player => !player.left && player.results.length === room.boards.length && !isIdleRun(player.results))
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
