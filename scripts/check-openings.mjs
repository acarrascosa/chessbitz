// Fast feedback while writing content: node scripts/check-openings.mjs [file...]
import { readFileSync, readdirSync } from 'node:fs';
import { Chess } from 'chess.js';

const DIR = 'src/data/openings';
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => `${DIR}/${f}`);
const seenSlugs = new Map();
const seenLines = new Map();
let total = 0;
let problems = 0;

const report = (where, message) => {
    problems++;
    console.log(`✗ ${where}: ${message}`);
};

for (const file of files) {
    const entries = JSON.parse(readFileSync(file, 'utf8'));
    for (const entry of entries) {
        total++;
        const where = `${file.split('/').pop()} › ${entry.slug}`;
        let sans = [];
        try {
            const game = new Chess();
            game.loadPgn(entry.pgn);
            sans = game.history();
            const canonical = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ');
            if (canonical !== entry.pgn) report(where, `non-canonical pgn, expected "${canonical}"`);
        } catch (e) {
            report(where, `illegal pgn "${entry.pgn}" (${e.message})`);
        }
        if (!/^[a-z0-9-]+$/.test(entry.slug)) report(where, 'bad slug');
        if (!/^[A-E]\d\d$/.test(entry.eco)) report(where, `bad eco ${entry.eco}`);
        if (!['w', 'b'].includes(entry.side)) report(where, 'side must be w or b');
        if (sans.length && !sans.some((_, i) => (i % 2 === 0 ? 'w' : 'b') === entry.side)) report(where, 'side never moves');
        if (seenSlugs.has(entry.slug)) report(where, `duplicate slug (also in ${seenSlugs.get(entry.slug)})`);
        seenSlugs.set(entry.slug, file);
        if (seenLines.has(entry.pgn)) report(where, `duplicate line (also ${seenLines.get(entry.pgn)})`);
        seenLines.set(entry.pgn, entry.slug);
        for (const lang of ['es', 'en']) {
            const text = entry[lang];
            if (!text) { report(where, `missing ${lang}`); continue; }
            for (const key of ['name', 'description', 'idea']) if (!text[key]?.trim()) report(where, `${lang}.${key} empty`);
            if (!Array.isArray(text.moves) || text.moves.length !== sans.length) report(where, `${lang}.moves has ${text.moves?.length} items for ${sans.length} plies`);
            if (text.moves?.some(m => !m.trim())) report(where, `${lang}.moves has empty items`);
        }
    }
}
console.log(`${total} openings checked, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
