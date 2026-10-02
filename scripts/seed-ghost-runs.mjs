/**
 * Simulated recorded rivals for public matchmaking, until real battles have filled
 * ghost_runs. Prints SQL that replaces the previous seed (real runs are kept):
 *
 *   node scripts/seed-ghost-runs.mjs > /tmp/seed.sql
 *   npx wrangler d1 execute chessbitz --remote --file /tmp/seed.sql
 *
 * Boards, clocks, points and the simulation itself come from the game's own code
 * (src/lib/battle.ts, src/lib/ghost-sim.ts), so a seeded run is one a player could
 * have played.
 */
import fs from 'node:fs';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { FORMATS_ORDER, pickBoards, seededRandom } = await jiti.import('../src/lib/battle.ts');
const { simulateRun } = await jiti.import('../src/lib/ghost-sim.ts');
const { gamerTag } = await jiti.import('../src/lib/names.ts');

const RUNS = { short: 50, normal: 200, long: 50 };

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
        const results = simulateRun(boards, random);
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
