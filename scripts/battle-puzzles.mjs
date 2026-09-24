// Picks the battle's puzzle pool from the Lichess open puzzle database (CC0):
//
//   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
//   node scripts/battle-puzzles.mjs lichess_db_puzzle.csv.zst
//
// Unlike src/data/puzzles.json (three per opening, for the daily tactics), battles
// only need good puzzles of every difficulty: 2,000 per tier, spread evenly over
// 100-point rating bands so each tier covers its whole range. Quality filters as for
// the tactics (popular, widely played, settled rating); a seeded reservoir sample
// keeps it varied and reproducible. Output: src/data/battle-puzzles.json, which only
// the Worker loads (players receive just their match's boards).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

const [csvPath] = process.argv.slice(2);
if (!csvPath) {
    console.error('Usage: node scripts/battle-puzzles.mjs <lichess_db_puzzle.csv.zst>');
    process.exit(1);
}

/** Tiers as in puzzleDifficulty (src/lib/puzzle.ts): easy < 1300 ≤ medium < 1600 ≤ hard. */
const TIERS = [
    { name: 'easy', from: 800, to: 1300 },
    { name: 'medium', from: 1300, to: 1600 },
    { name: 'hard', from: 1600, to: 2200 },
];
const PER_TIER = 2000;
const MAX_PLIES = 7; // setup move + at most three moves to find, so boards fit the clocks
const THEMES = new Set([
    'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'mate', 'advantage', 'crushing', 'equality',
    'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'hangingPiece', 'trappedPiece',
    'deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'quietMove', 'defensiveMove',
    'xRayAttack', 'zugzwang', 'backRankMate', 'smotheredMate', 'promotion', 'exposedKing', 'kingsideAttack',
    'queensideAttack', 'capturingDefender', 'opening', 'middlegame', 'endgame',
]);

function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = seededRandom(2026);

// One reservoir per 100-point band, its size the tier's quota split evenly.
const bands = new Map();
for (const tier of TIERS) {
    const count = (tier.to - tier.from) / 100;
    for (let i = 0; i < count; i++) {
        const size = Math.floor(PER_TIER / count) + (i < PER_TIER % count ? 1 : 0);
        bands.set(tier.from + i * 100, { size, seen: 0, picked: [] });
    }
}

const zstd = spawn('zstd', ['-dc', csvPath]);
const lines = createInterface({ input: zstd.stdout });
let header = true;
let qualified = 0;
for await (const line of lines) {
    if (header) {
        header = false;
        continue;
    }
    const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',');
    const r = Number(rating);
    const band = bands.get(Math.floor(r / 100) * 100);
    if (!band) continue;
    const plies = moves.split(' ').length;
    if (plies < 2 || plies > MAX_PLIES) continue;
    if (Number(deviation) > 80 || Number(popularity) < 85 || Number(plays) < 1000) continue;
    const themeList = themes.split(' ');
    if (themeList.includes('veryLong')) continue;
    qualified++;
    const puzzle = { id, fen, moves, rating: r, themes: themeList.filter(t => THEMES.has(t)) };
    // Reservoir sampling: every qualified puzzle of the band has the same chance.
    band.seen++;
    if (band.picked.length < band.size) band.picked.push(puzzle);
    else {
        const j = Math.floor(random() * band.seen);
        if (j < band.size) band.picked[j] = puzzle;
    }
}

const pool = [...bands.values()].flatMap(b => b.picked).sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
// Every solution must be playable from its position.
for (const puzzle of pool) {
    const game = new Chess(puzzle.fen);
    for (const move of puzzle.moves.split(' ')) game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
}
writeFileSync('src/data/battle-puzzles.json', `[\n${pool.map(p => JSON.stringify(p)).join(',\n')}\n]\n`);
const short = [...bands.entries()].filter(([, b]) => b.picked.length < b.size).map(([from, b]) => `${from}: ${b.picked.length}/${b.size}`);
console.log(`${pool.length} puzzles from ${qualified.toLocaleString()} qualified → src/data/battle-puzzles.json${short.length ? ` (short bands: ${short.join(', ')})` : ''}`);
