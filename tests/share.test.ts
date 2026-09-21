import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import { challengeReducer, createChallenge, type ChallengeAction } from '../src/lib/challenge';
import { parseLine } from '../src/lib/line';
import { buildShareText } from '../src/lib/share';

const plies = parseLine('1. e4 e5 2. Nf3');
const move = (from: string, to: string): ChallengeAction => ({ type: 'attempt', from: from as Square, to: to as Square });

describe('buildShareText', () => {
    it('summarises a win without revealing the moves', () => {
        const state = [move('d2', 'd4'), move('e2', 'e4'), { type: 'opponent' } as const, move('g1', 'f3')]
            .reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 4, 12, 'Apertura Española')).toBe(
            'Chessbitz #12 · Apertura Española\n🟨🟩 1/5 🔥4\nhttps://chessbitz.com',
        );
    });

    it('marks a lost challenge with X and omits a streak of one', () => {
        const state = Array.from({ length: 5 }, () => move('d2', 'd4')).reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 1, 3, 'Ruy Lopez')).toBe('Chessbitz #3 · Ruy Lopez\n🟥🟥 X/5\nhttps://chessbitz.com');
    });
});
