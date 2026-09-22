import { describe, expect, it } from 'vitest';
import type { Square } from 'chess.js';
import {
    EXPERT_ATTEMPTS, createExpert, expertGrid, expertLength, expertStartFen, gradeAttempt, opponentReply, submitAttempt, tryMove,
    type ExpertMove,
} from '../src/lib/expert';
import { bestMove } from '../src/lib/engine';
import { parseLine, START_FEN } from '../src/lib/line';

const RUY = parseLine('1. e4 e5 2. Nf3 Nc6 3. Bb5');
const CASTLE = parseLine('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O');

/** Plays the player's moves (white) with the opponent answering, like the UI does. */
function attempt(plies = RUY, moves: [string, string][]): ExpertMove[] {
    let fen = expertStartFen(plies);
    const played: ExpertMove[] = [];
    let index = 0;
    for (const [from, to] of moves) {
        const move = tryMove(fen, from as Square, to as Square);
        if (!move) throw new Error(`illegal ${from}${to}`);
        played.push(move);
        fen = move.fen;
        index++;
        if (index < plies.length) {
            const reply = opponentReply(plies, index, fen);
            if (reply) {
                fen = reply.fen;
                index++;
            }
        }
    }
    return played;
}

describe('expert mode', () => {
    it('counts only the player moves of the line', () => {
        expect(expertLength(RUY, 'w')).toBe(3);
        expect(expertStartFen(RUY)).toBe(START_FEN);
    });

    it('grades exact moves, right pieces, right squares and misses', () => {
        const moves = attempt(RUY, [['e2', 'e4'], ['b1', 'c3'], ['f1', 'c4']]);
        expect(gradeAttempt(moves, RUY, 'w')).toEqual(['exact', 'piece', 'piece']);
        const other = attempt(RUY, [['d2', 'd4'], ['g1', 'f3'], ['f3', 'g5']]);
        expect(gradeAttempt(other, RUY, 'w')).toEqual(['piece', 'exact', 'miss']);
    });

    it('marks a different piece landing on the target square', () => {
        // 3. Nb5 instead of 3. Bb5: the square is right, the piece is not.
        const moves = attempt(RUY, [['e2', 'e4'], ['b1', 'c3'], ['c3', 'b5']]);
        expect(gradeAttempt(moves, RUY, 'w')[2]).toBe('square');
    });

    it('wins with an all-exact attempt and loses after six misses', () => {
        const perfect = attempt(RUY, [['e2', 'e4'], ['g1', 'f3'], ['f1', 'b5']]);
        const won = submitAttempt(createExpert('w'), perfect, RUY);
        expect(won.status).toBe('won');
        expect(expertGrid(won)).toBe('🟩🟩🟩');

        const wrong = attempt(RUY, [['a2', 'a3'], ['a3', 'a4'], ['h2', 'h3']]);
        let state = createExpert('w');
        for (let i = 0; i < EXPERT_ATTEMPTS; i++) state = submitAttempt(state, wrong, RUY);
        expect(state.status).toBe('lost');
        expect(submitAttempt(state, perfect, RUY)).toBe(state);
    });

    it('accepts castling by dropping the king on its rook', () => {
        const moves = attempt(CASTLE, [['e2', 'e4'], ['g1', 'f3'], ['f1', 'c4'], ['e1', 'h1']]);
        expect(moves[3].san).toBe('O-O');
        expect(gradeAttempt(moves, CASTLE, 'w')).toEqual(['exact', 'exact', 'exact', 'exact']);
    });

    it('keeps the book reply when legal and falls back to the engine otherwise', () => {
        // After 1. d4 (instead of 1. e4) the book reply 1...e5 is still legal.
        const d4 = tryMove(START_FEN, 'd2', 'd4')!;
        expect(opponentReply(RUY, 1, d4.fen)?.san).toBe('e5');
        // Scandinavian: after 2. e5 (instead of 2. exd5) the book 2...Qxd5 is illegal.
        const scandinavian = parseLine('1. e4 d5 2. exd5 Qxd5');
        const e4 = tryMove(START_FEN, 'e2', 'e4')!;
        const afterD5 = tryMove(e4.fen, 'd7', 'd5')!;
        const e5 = tryMove(afterD5.fen, 'e4', 'e5')!;
        const reply = opponentReply(scandinavian, 3, e5.fen);
        expect(reply).not.toBeNull();
        expect(reply!.san).not.toBe('Qxd5');
    });
});

describe('engine', () => {
    it('takes a hanging queen', () => {
        // White queen on d5 can be taken by the knight on f6.
        expect(bestMove('rnbqkb1r/pppp1ppp/5n2/3Qp3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3')?.san).toBe('Nxd5');
    });

    it('finds mate in one', () => {
        // Scholar's mate: Qxf7#.
        expect(bestMove('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4')?.san).toBe('Qxf7#');
    });

    it('returns null when the game is over', () => {
        expect(bestMove('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toBeNull();
    });
});
