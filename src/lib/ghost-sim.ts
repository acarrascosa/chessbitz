import { boardPoints, type BattleBoard, type BoardResult } from './battle';
import { MAX_MISTAKES } from './challenge';
import { puzzleDifficulty, type Difficulty } from './puzzle';

/*
 * A plausible run for a set of boards, for when there are no recorded ones to use:
 * the seed script fills ghost_runs with these, and a public table falls back to one
 * if the database has nothing. Solved boards keep errors under the allowance, lost
 * ones spent it, timeouts used the whole clock, and points are the table's own.
 */

/**
 * How a typical player does on each tier: chance to solve, share of the clock used
 * (± spread) and chance of each extra wrong move on a solved board. Calibrated on
 * the first real battles (Oct 2026: 30% of boards solved, 30% lost, 40% out of time).
 */
const PROFILE: Record<Difficulty, { solve: number; time: number; spread: number; slip: number }> = {
    easy: { solve: 0.55, time: 0.45, spread: 0.2, slip: 0.2 },
    medium: { solve: 0.3, time: 0.6, spread: 0.2, slip: 0.3 },
    hard: { solve: 0.15, time: 0.75, spread: 0.15, slip: 0.35 },
};
/** Of the boards not solved, how many end on mistakes rather than on the clock. */
const LOST_SHARE = 0.45;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function simulateBoard(board: BattleBoard, random: () => number): BoardResult {
    const { solve, time, spread, slip } = PROFILE[puzzleDifficulty(board)];
    const limitMs = board.limit * 1000;
    // Hints: the piece costs half an error; the square after it is free (HINT_HALVES).
    const hintRoll = random();
    const hints = hintRoll < 0.05 ? 2 : hintRoll < 0.2 ? 1 : 0;
    const hintHalves = hints ? 1 : 0;
    const roll = random();

    if (roll < solve) {
        let mistakes = 0;
        // At most MAX_MISTAKES - 1: with the hint's half error, still under the allowance.
        while (mistakes < MAX_MISTAKES - 1 && random() < slip) mistakes++;
        const ms = Math.round(clamp(limitMs * (time + (random() * 2 - 1) * spread), 3_000, limitMs - 500));
        return { outcome: 'won', mistakes, hints, hintHalves, ms, points: boardPoints('won', mistakes, ms, board.limit, hints) };
    }
    if (roll < solve + (1 - solve) * LOST_SHARE) {
        const ms = Math.round(clamp(limitMs * (0.3 + random() * 0.6), 3_000, limitMs - 500));
        return { outcome: 'lost', mistakes: MAX_MISTAKES, hints, hintHalves, ms, points: 0 };
    }
    const mistakes = Math.floor(random() * MAX_MISTAKES);
    return { outcome: 'timeout', mistakes, hints, hintHalves, ms: limitMs, points: 0 };
}

export const simulateRun = (boards: BattleBoard[], random: () => number) => boards.map(board => simulateBoard(board, random));
