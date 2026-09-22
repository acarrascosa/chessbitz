import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import { challengeReducer, createChallenge, type ChallengeAction } from '../src/lib/challenge';
import { parseLine } from '../src/lib/line';
import { createExpert, submitAttempt, tryMove } from '../src/lib/expert';
import { buildExpertShareText, buildShareText } from '../src/lib/share';

const plies = parseLine('1. e4 e5 2. Nf3');
const move = (from: string, to: string): ChallengeAction => ({ type: 'attempt', from: from as Square, to: to as Square });

describe('buildShareText', () => {
    it('summarises a win without revealing the moves', () => {
        const state = [move('d2', 'd4'), move('e2', 'e4'), { type: 'opponent' } as const, move('g1', 'f3')]
            .reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 12, 'Apertura Española', { streak: 4 })).toBe(
            'Chessbitz #12 · Apertura Española\n🟨🟩 1/5 🔥4\nhttps://chessbitz.com',
        );
    });

    it('marks a lost challenge with X and omits a streak of one', () => {
        const state = Array.from({ length: 5 }, () => move('d2', 'd4')).reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 3, 'Ruy Lopez', { streak: 1 })).toBe('Chessbitz #3 · Ruy Lopez\n🟥🟥 X/5\nhttps://chessbitz.com');
    });

    it('counts hints and tags archive replays', () => {
        const state = [{ type: 'hint' } as const, move('e2', 'e4'), { type: 'opponent' } as const, move('g1', 'f3')]
            .reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 7, 'Italiana', { tag: 'archivo' })).toBe(
            'Chessbitz #7 (archivo) · Italiana\n🟨🟩 0/5 💡1\nhttps://chessbitz.com',
        );
    });

    it('uses the high-contrast palette on request', () => {
        const state = [move('e2', 'e4'), { type: 'opponent' } as const, move('g1', 'f3')].reduce(challengeReducer(plies), createChallenge(plies, 'w'));
        expect(buildShareText(state, plies, 1, 'X', { contrast: true })).toContain('🟦🟦 0/5');
    });
});

describe('buildExpertShareText', () => {
    it('shares one row per attempt', () => {
        const e4 = tryMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2', 'e4')!;
        const d4 = tryMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'd2', 'd4')!;
        const nf3 = tryMove(e4.fen.replace(' b ', ' w '), 'g1', 'f3')!;
        let state = submitAttempt(createExpert('w'), [d4, nf3], plies);
        state = submitAttempt(state, [e4, nf3], plies);
        expect(buildExpertShareText(state, 5, 'Rey', 'experto')).toBe('Chessbitz #5 (experto) · Rey · 2/6\n🟨🟩\n🟩🟩\nhttps://chessbitz.com');
    });
});
