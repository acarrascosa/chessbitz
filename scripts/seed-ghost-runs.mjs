import fs from 'fs';
import path from 'path';

// Seeded PRNG
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

const FORMATS = {
    short: { budget: 120, minBoards: 3, maxBoards: 4, tiers: ['easy'] },
    normal: { budget: 240, minBoards: 4, maxBoards: 6, tiers: ['easy', 'medium', 'hard', 'medium'] },
    long: { budget: 600, minBoards: 7, maxBoards: 10, tiers: ['hard', 'medium', 'hard'] },
};

const EASIER = { easy: ['easy'], medium: ['medium', 'easy'], hard: ['hard', 'medium', 'easy'] };

function puzzleDifficulty(puzzle) {
    if (puzzle.rating < 1300) return 'easy';
    if (puzzle.rating < 1600) return 'medium';
    return 'hard';
}

function playerMoveCount(puzzle) {
    return Math.ceil((puzzle.moves.split(' ').length - 1) / 2);
}

function timeLimit(puzzle) {
    const seconds = 15 + 8 * playerMoveCount(puzzle) + 4 * Math.max(0, puzzle.rating - 1000) / 100;
    return Math.max(25, Math.round(seconds / 5) * 5);
}

function shuffle(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function pickBoards(pool, format, random) {
    const spec = FORMATS[format];
    const byTier = { easy: [], medium: [], hard: [] };
    for (const puzzle of shuffle(pool, random)) {
        byTier[puzzleDifficulty(puzzle)].push(puzzle);
    }

    const picked = [];
    let remaining = spec.budget;
    while (picked.length < spec.maxBoards) {
        const tier = spec.tiers[picked.length % spec.tiers.length];
        const reserve = Math.max(0, spec.minBoards - picked.length - 1) * 25;
        let next;
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

const adjectives = [
    'Swift', 'Silent', 'Bold', 'Quick', 'Rogue', 'Dark', 'Blazing', 'Clever', 
    'Phantom', 'Royal', 'Grand', 'Nimble', 'Cunning', 'Iron', 'Steel', 'Shadow', 
    'Golden', 'Crystal', 'Fierce', 'Brave', 'Noble', 'Sharp', 'Mighty', 'Lucky', 
    'Epic', 'Cosmic', 'Turbo', 'Ultra', 'Neo', 'Hyper'
];

const nouns = [
    'Knight', 'Bishop', 'Rook', 'Pawn', 'King', 'Queen', 'Castle', 'Gambit', 
    'Check', 'Mate', 'Blitz', 'Tempo', 'Fork', 'Pin', 'Tactic', 'Fischer', 
    'Morphy', 'Magnus', 'Endgame', 'Zugzwang'
];

function generateName(random) {
    const adj = adjectives[Math.floor(random() * adjectives.length)];
    const noun = nouns[Math.floor(random() * nouns.length)];
    const useNumber = random() > 0.5;
    const number = useNumber ? Math.floor(random() * 99) + 1 : '';
    const useUnderscore = random() > 0.8;
    return `${adj}${useUnderscore ? '_' : ''}${noun}${number}`;
}

function simulateBoardResult(board, random) {
    const diff = puzzleDifficulty(board);
    let solveRate, timePct, timeVar, avgMistakes;
    if (diff === 'easy') {
        solveRate = 0.85; timePct = 0.35; timeVar = 0.15; avgMistakes = 0.4;
    } else if (diff === 'medium') {
        solveRate = 0.65; timePct = 0.55; timeVar = 0.20; avgMistakes = 1.2;
    } else {
        solveRate = 0.40; timePct = 0.70; timeVar = 0.20; avgMistakes = 2.1;
    }

    const solved = random() < solveRate;
    let mistakes = 0;
    let hints = 0;
    let ms = 0;
    
    if (solved) {
        // Poisson-like mistakes based on avgMistakes
        for (let i = 0; i < 5; i++) {
            if (random() < avgMistakes / 5) mistakes++;
        }
        const hintChance = random();
        if (hintChance < 0.05) hints = 2;
        else if (hintChance < 0.20) hints = 1;
        
        const timeFactor = timePct + (random() * 2 - 1) * timeVar;
        ms = Math.min(board.limit * 1000, Math.max(1000, board.limit * 1000 * timeFactor));
    } else {
        mistakes = 5;
        const timeFactor = 0.85 + (random() * 2 - 1) * 0.10;
        ms = Math.min(board.limit * 1000, Math.max(1000, board.limit * 1000 * timeFactor));
    }

    const outcome = solved ? 'won' : (random() < 0.2 ? 'timeout' : 'lost');
    
    let points = 0;
    if (outcome === 'won') {
        const speed_bonus = Math.round(50 * Math.max(0, 1 - ms / (board.limit * 1000)));
        points = Math.max(25, 100 + speed_bonus - 15 * mistakes - 5 * hints);
    }

    return {
        outcome,
        mistakes,
        hints,
        hintHalves: hints,
        ms: Math.round(ms),
        points
    };
}

/** Escape single quotes for SQL string literals. */
function esc(s) {
    return s.replace(/'/g, "''");
}

function run() {
    const puzzlesPath = new URL('../src/data/battle-puzzles.json', import.meta.url);
    const pool = JSON.parse(fs.readFileSync(puzzlesPath, 'utf8'));
    
    const formatsToGenerate = {
        normal: 200,
        short: 50,
        long: 50
    };

    const now = Date.now();
    let globalSeed = 12345;

    console.log('-- Ghost runs seed data');
    console.log(`-- Generated at ${new Date(now).toISOString()}`);
    console.log(`-- ${Object.values(formatsToGenerate).reduce((a, b) => a + b, 0)} total runs\n`);

    for (const [format, count] of Object.entries(formatsToGenerate)) {
        console.log(`-- ${format}: ${count} runs`);
        for (let i = 0; i < count; i++) {
            // Each run gets its own PRNG so board selection is independent.
            const runRandom = seededRandom(globalSeed++);
            const boards = pickBoards(pool, format, runRandom);
            // Name and simulation share a second PRNG to keep them deterministic but separate.
            const simRandom = seededRandom(globalSeed++);
            const displayName = generateName(simRandom);
            const results = boards.map(b => simulateBoardResult(b, simRandom));
            const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
            const boardsSolved = results.filter(r => r.outcome === 'won').length;
            const boardIds = JSON.stringify(boards.map(b => b.id));
            const resultsJson = JSON.stringify(results);

            console.log(`INSERT INTO ghost_runs (format, board_ids, display_name, results, total_points, boards_solved, board_count, recorded_at) VALUES ('${esc(format)}', '${esc(boardIds)}', '${esc(displayName)}', '${esc(resultsJson)}', ${totalPoints}, ${boardsSolved}, ${boards.length}, ${now});`);
        }
    }
}

run();

