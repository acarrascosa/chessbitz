import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import { MAX_MISTAKES, challengeReducer, createChallenge, isPlayerTurn, judgeAttempt, resultGrid, type ChallengeAction, type ChallengeState } from '../src/lib/challenge';
import { parseLine } from '../src/lib/line';

const RUY = parseLine('1. e4 e5 2. Nf3 Nc6 3. Bb5');
const SICILIAN = parseLine('1. e4 c5 2. Nf3 d6');
const CASTLE = parseLine('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O');

function play(plies = RUY, side: 'w' | 'b' = 'w', actions: ChallengeAction[] = []): ChallengeState {
    return actions.reduce(challengeReducer(plies), createChallenge(plies, side));
}
const move = (from: string, to: string): ChallengeAction => ({ type: 'attempt', from: from as Square, to: to as Square });
const opponent: ChallengeAction = { type: 'opponent' };
const hint: ChallengeAction = { type: 'hint' };

describe('challenge', () => {
    it('wins a flawless line with an all-green grid', () => {
        const state = play(RUY, 'w', [move('e2', 'e4'), opponent, move('g1', 'f3'), opponent, move('f1', 'b5')]);
        expect(state.status).toBe('won');
        expect(state.mistakes).toBe(0);
        expect(resultGrid(state, RUY)).toBe('🟩🟩🟩');
    });

    it('lets the opponent open when the player has black', () => {
        let state = play(SICILIAN, 'b');
        expect(isPlayerTurn(state, SICILIAN)).toBe(false);
        state = play(SICILIAN, 'b', [opponent, move('c7', 'c5'), opponent, move('d7', 'd6')]);
        expect(state.status).toBe('won');
        expect(resultGrid(state, SICILIAN)).toBe('🟩🟩');
    });

    it('ignores illegal attempts without penalty', () => {
        expect(judgeAttempt(play(), RUY, 'e2' as Square, 'e5' as Square)).toBe('illegal');
        expect(play(RUY, 'w', [move('e2', 'e5'), move('e7', 'e5')]).mistakes).toBe(0);
    });

    it('counts a legal but wrong move as a mistake and marks the ply yellow', () => {
        const state = play(RUY, 'w', [move('d2', 'd4'), move('e2', 'e4')]);
        expect(state.mistakes).toBe(1);
        expect(state.results[0]).toBe('assisted');
    });

    it('marks hinted plies yellow and fully revealed ones red', () => {
        const state = play(RUY, 'w', [hint, move('e2', 'e4'), opponent, hint, hint, hint, move('g1', 'f3')]);
        expect(state.results).toEqual({ 0: 'assisted', 2: 'revealed' });
    });

    it('counts every hint used across the line', () => {
        const state = play(RUY, 'w', [hint, hint, move('e2', 'e4'), opponent, hint, move('g1', 'f3'), opponent, hint, hint, hint, hint]);
        expect(state.hints).toBe(6);
        expect(state.hintLevel).toBe(3);
    });

    it('accepts castling as king-to-square or king-onto-rook', () => {
        const before = [move('e2', 'e4'), opponent, move('g1', 'f3'), opponent, move('f1', 'c4'), opponent];
        expect(play(CASTLE, 'w', [...before, move('e1', 'g1')]).status).toBe('won');
        expect(play(CASTLE, 'w', [...before, move('e1', 'h1')]).status).toBe('won');
    });

    it('reveals the rest of the line after the last allowed mistake', () => {
        const wrong = Array.from({ length: MAX_MISTAKES }, () => move('d2', 'd4'));
        const state = play(RUY, 'w', wrong);
        expect(state.status).toBe('lost');
        expect(resultGrid(state, RUY)).toBe('🟥🟥🟥');
        expect(play(RUY, 'w', [...wrong, move('e2', 'e4')])).toEqual(state);
    });
});
