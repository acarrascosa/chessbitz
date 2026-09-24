import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import {
    MAX_MISTAKES, challengeReducer, createChallenge, errorCount, errorHalves, isPlayerTurn, isSolved, judgeAttempt, nextHintHalves, resultBucket, resultGrid,
    type ChallengeAction, type ChallengeState,
} from '../src/lib/challenge';
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

describe('hints cost errors', () => {
    const LONG = parseLine('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+');
    /** All six white moves, each preceded by `hintsPerMove` hints. */
    const withHints = (hintsPerMove: number[]) => play(LONG, 'w', LONG.flatMap((ply, i) => (ply.color === 'w'
        ? [...Array.from({ length: hintsPerMove[i / 2] ?? 0 }, () => hint), move(ply.from, ply.to)]
        : [opponent])));

    it('charges half an error for help on a move and the other half for the arrow', () => {
        let state = play(RUY, 'w');
        expect(nextHintHalves(state)).toBe(1);
        state = play(RUY, 'w', [hint]);
        expect(errorCount(state)).toBe(0.5);
        expect(nextHintHalves(state)).toBe(0);
        state = play(RUY, 'w', [hint, hint]);
        expect(errorCount(state)).toBe(0.5);
        state = play(RUY, 'w', [hint, hint, hint]);
        expect(errorCount(state)).toBe(1);
        expect(state.mistakes).toBe(0);
    });

    it('adds up across moves: one hint on two moves is one error', () => {
        const state = play(RUY, 'w', [hint, move('e2', 'e4'), opponent, hint, move('g1', 'f3'), opponent, move('f1', 'b5')]);
        expect(state.status).toBe('won');
        expect(errorCount(state)).toBe(1);
        expect(resultGrid(state, RUY)).toBe('🟨🟨🟩');
        expect(resultBucket(state)).toBe(1);
        expect(isSolved(state)).toBe(true);
    });

    it('adds hints to wrong moves on the same move', () => {
        const state = play(RUY, 'w', [move('d2', 'd4'), hint, hint, hint]);
        expect(errorHalves(state)).toBe(4);
    });

    it('never ends a line with hints, but one given away entirely is not solved', () => {
        const state = withHints([3, 3, 3, 3, 3, 3]);
        expect(state.status).toBe('won');
        expect(state.mistakes).toBe(0);
        expect(errorCount(state)).toBe(MAX_MISTAKES);
        expect(isSolved(state)).toBe(false);
        expect(resultBucket(state)).toBe(MAX_MISTAKES);
    });

    it('rounds half errors up in the histogram, keeping 4.5 among the solved', () => {
        expect(resultBucket(withHints([1, 0, 0, 0, 0, 0]))).toBe(1);
        const almost = withHints([3, 3, 3, 3, 1, 0]);
        expect(errorCount(almost)).toBe(4.5);
        expect(isSolved(almost)).toBe(true);
        expect(resultBucket(almost)).toBe(MAX_MISTAKES - 1);
    });

    it('reads results saved before hints cost errors as they were', () => {
        const old: ChallengeState = { side: 'w', cursor: 5, results: { 0: 'revealed' }, mistakes: 1, hintLevel: 0, hints: 3, stumbled: false, status: 'won' };
        expect(errorCount(old)).toBe(1);
        expect(resultBucket(old)).toBe(1);
    });
});
