import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import puzzles from '../src/data/puzzles.json';
import { openings } from '../src/lib/catalog';
import { challengeReducer, createChallenge, type ChallengeAction } from '../src/lib/challenge';
import { lineDifficulty, puzzleDifficulty, puzzleGoal, puzzleMotifs, puzzlePlies, puzzleSide, type Puzzle } from '../src/lib/puzzle';

const all = puzzles as Record<string, Puzzle[]>;
const SAMPLE: Puzzle = {
    id: 'test',
    // Scholar's mate: after the setup move ...Nf6??, Qxf7# mates.
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    moves: 'g8f6 h5f7',
    rating: 1100,
    themes: ['mateIn1', 'opening', 'short'],
};

describe('puzzles', () => {
    it('gives every opening a few tactics', () => {
        for (const opening of openings) expect(all[opening.slug]?.length ?? 0).toBeGreaterThan(0);
    });

    it('stores only legal solutions', () => {
        for (const list of Object.values(all)) {
            for (const puzzle of list) {
                const plies = puzzlePlies(puzzle);
                expect(plies.length).toBeGreaterThanOrEqual(2);
                expect(plies[0].before).toBe(new Chess(puzzle.fen).fen());
            }
        }
    });

    it('plays the setup move for the opponent and accepts the solution', () => {
        const plies = puzzlePlies(SAMPLE);
        expect(puzzleSide(plies)).toBe('w');
        const move = (from: string, to: string): ChallengeAction => ({ type: 'attempt', from: from as Square, to: to as Square });
        const state = [{ type: 'opponent' } as const, move('h5', 'f7')].reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(state.status).toBe('won');
        expect(plies[1].number).toBe(4);
    });

    it('accepts an alternative mate on the last move', () => {
        // Back-rank mate: the book plays Re8#, but Rd8# mates just as well.
        const puzzle: Puzzle = { ...SAMPLE, fen: '6k1/p4ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1', moves: 'a7a6 e1e8' };
        const plies = puzzlePlies(puzzle);
        const state = [{ type: 'opponent' } as const, { type: 'attempt', from: 'd1', to: 'd8' } as ChallengeAction]
            .reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(state.status).toBe('won');
    });

    it('names goals, motifs and difficulty', () => {
        expect(puzzleGoal(SAMPLE)).toBe('mateIn1');
        expect(puzzleGoal({ ...SAMPLE, themes: ['fork'] })).toBe('advantage');
        expect(puzzleMotifs({ ...SAMPLE, themes: ['crushing', 'fork', 'opening'] })).toEqual(['fork']);
        expect(puzzleDifficulty(SAMPLE)).toBe('easy');
        expect(puzzleDifficulty({ ...SAMPLE, rating: 1700 })).toBe('hard');
        expect([1, 3, 6].map(lineDifficulty)).toEqual(['easy', 'medium', 'hard']);
    });
});
