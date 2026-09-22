// Picks tactical puzzles for every opening from the Lichess open puzzle database (CC0).
//
//   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
//   for f in a b c d e; do curl -O https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv; done
//   node scripts/puzzles.mjs <lichess_db_puzzle.csv.zst> <folder with a.tsv…e.tsv>
//
// Lichess tags every puzzle with the opening of its source game ("Sicilian_Defense",
// "Sicilian_Defense_Najdorf_Variation"). Our catalog uses its own names, so each line is
// matched by *position* against the Lichess opening list, which gives its tags. The most
// specific tag with enough good puzzles wins. Output: src/data/puzzles.json.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

const [csvPath, tsvDir] = process.argv.slice(2);
if (!csvPath || !tsvDir) {
    console.error('Usage: node scripts/puzzles.mjs <lichess_db_puzzle.csv.zst> <chess-openings dir>');
    process.exit(1);
}

const PER_OPENING = 3;
const MIN_RATING = 1000;
const MAX_RATING = 1900;
/** Themes the UI can name; anything else is dropped from the output. */
const THEMES = [
    'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'mate', 'advantage', 'crushing', 'equality',
    'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'hangingPiece', 'trappedPiece',
    'deflection', 'attraction', 'clearance', 'interference', 'intermezzo', 'quietMove', 'defensiveMove',
    'xRayAttack', 'zugzwang', 'backRankMate', 'smotheredMate', 'promotion', 'exposedKing', 'kingsideAttack',
    'queensideAttack', 'capturingDefender', 'opening',
];

/** Position key without move counters, so transpositions match. */
const epd = fen => fen.split(' ').slice(0, 4).join(' ');
const tagify = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’.]/g, '').replace(/[\s:,]+/g, '_').replace(/_+$/, '');

// 1. Lichess opening list: position → [family tag, variation tag].
const lichessTags = new Map();
for (const file of 'abcde') {
    const rows = readFileSync(join(tsvDir, `${file}.tsv`), 'utf8').trim().split('\n').slice(1);
    for (const row of rows) {
        const [, name, pgn] = row.split('\t');
        const game = new Chess();
        game.loadPgn(pgn);
        const [family, rest = ''] = name.split(': ');
        const variation = rest.split(', ')[0];
        const tags = [tagify(family)];
        if (variation) tags.unshift(tagify(`${family} ${variation}`));
        lichessTags.set(epd(game.fen()), tags);
    }
}

// 2. Our catalog: the deepest position of each line that Lichess knows gives its tags.
const catalogDir = 'src/data/openings';
const openings = readdirSync(catalogDir)
    .filter(file => file.endsWith('.json'))
    .flatMap(file => JSON.parse(readFileSync(join(catalogDir, file), 'utf8')));
const wanted = new Map();
for (const opening of openings) {
    const game = new Chess();
    game.loadPgn(opening.pgn);
    const replay = new Chess();
    let tags = [];
    for (const move of game.history()) {
        replay.move(move);
        tags = lichessTags.get(epd(replay.fen())) ?? tags;
    }
    wanted.set(opening.slug, tags);
}
const allTags = new Set([...wanted.values()].flat());

// 3. Stream the puzzle database and keep the best candidates per tag.
const candidates = new Map([...allTags].map(tag => [tag, []]));
const zstd = spawn('zstd', ['-dc', csvPath]);
const lines = createInterface({ input: zstd.stdout });
let header = true;
for await (const line of lines) {
    if (header) {
        header = false;
        continue;
    }
    const [id, fen, moves, rating, deviation, popularity, plays, themes, , openingTags] = line.split(',');
    if (!openingTags) continue;
    const r = Number(rating);
    if (r < MIN_RATING || r > MAX_RATING || Number(deviation) > 90 || Number(popularity) < 85 || Number(plays) < 500) continue;
    const themeList = themes.split(' ');
    if (themeList.includes('veryLong') || themeList.includes('endgame')) continue;
    const score = Number(popularity) + Math.log10(Number(plays)) * 5 + (themeList.includes('opening') ? 15 : 0);
    for (const tag of openingTags.split(' ')) {
        const list = candidates.get(tag);
        if (!list) continue;
        list.push({ id, fen, moves, rating: r, themes: themeList.filter(t => THEMES.includes(t)), score });
        if (list.length > 400) {
            list.sort((a, b) => b.score - a.score);
            list.length = 200;
        }
    }
}
for (const list of candidates.values()) list.sort((a, b) => b.score - a.score);

// 4. Most specific tag first; a puzzle is used by one opening only while others are left.
const used = new Set();
const output = {};
let missing = 0;
for (const opening of openings) {
    const picked = [];
    for (const tag of wanted.get(opening.slug)) {
        for (const puzzle of candidates.get(tag) ?? []) {
            if (picked.length >= PER_OPENING) break;
            if (used.has(puzzle.id)) continue;
            used.add(puzzle.id);
            picked.push(puzzle);
        }
    }
    if (!picked.length) missing++;
    output[opening.slug] = picked
        .sort((a, b) => a.rating - b.rating)
        .map(({ id, fen, moves, rating, themes }) => ({ id, fen, moves, rating, themes }));
}

writeFileSync('src/data/puzzles.json', `${JSON.stringify(output, null, 1)}\n`);
console.log(`Puzzles for ${openings.length - missing}/${openings.length} openings → src/data/puzzles.json`);
