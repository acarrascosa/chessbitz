/**
 * Simulated recorded rivals for public matchmaking, until real battles have filled
 * ghost_runs. Prints SQL that replaces the previous seed (real runs are kept):
 *
 *   node scripts/seed-ghost-runs.mjs > /tmp/seed.sql
 *   npx wrangler d1 execute chessbitz --remote --file /tmp/seed.sql
 *
 * Boards, clocks and points come from the game's own code (src/lib), so a seeded
 * run is one a player could have played: solved boards keep errors under the
 * allowance, lost ones spent it, timeouts used the whole clock.
 */
import fs from 'node:fs';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { FORMATS_ORDER, boardPoints, pickBoards, seededRandom } = await jiti.import('../src/lib/battle.ts');
const { MAX_MISTAKES } = await jiti.import('../src/lib/challenge.ts');
const { puzzleDifficulty } = await jiti.import('../src/lib/puzzle.ts');
const { gamerTag } = await jiti.import('../src/lib/names.ts');

const RUNS = { short: 50, normal: 200, long: 50 };

/**
 * How a typical player does on each tier: chance to solve, share of the clock used
 * (± spread) and chance of each extra wrong move on a solved board. Calibrated on
 * the first real battles (Oct 2026: 30% of boards solved, 30% lost, 40% out of time).
 */
const PROFILE = {
    easy: { solve: 0.55, time: 0.45, spread: 0.2, slip: 0.2 },
    medium: { solve: 0.3, time: 0.6, spread: 0.2, slip: 0.3 },
    hard: { solve: 0.15, time: 0.75, spread: 0.15, slip: 0.35 },
};
/** Of the boards not solved, how many end on mistakes rather than on the clock. */
const LOST_SHARE = 0.45;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function simulateBoard(board, random) {
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

const sql = value => `'${String(value).replace(/'/g, "''")}'`;

const pool = JSON.parse(fs.readFileSync(new URL('../src/data/battle-puzzles.json', import.meta.url), 'utf8'));
const now = Date.now();
let seed = 12345;

console.log(`-- Seeded ghost runs, generated ${new Date(now).toISOString()}`);
console.log(`DELETE FROM ghost_runs WHERE source = 'seed';`);
for (const format of FORMATS_ORDER) {
    for (let i = 0; i < RUNS[format]; i++) {
        const boards = pickBoards(pool, format, seededRandom(seed++));
        const random = seededRandom(seed++);
        const results = boards.map(board => simulateBoard(board, random));
        const values = [
            sql(format),
            sql(JSON.stringify(boards.map(b => b.id))),
            sql(gamerTag(random)),
            sql(JSON.stringify(results)),
            results.reduce((sum, r) => sum + r.points, 0),
            results.filter(r => r.outcome === 'won').length,
            boards.length,
            now,
            sql('seed'),
        ];
        console.log(`INSERT INTO ghost_runs (format, board_ids, display_name, results, total_points, boards_solved, board_count, recorded_at, source) VALUES (${values.join(', ')});`);
    }
}
