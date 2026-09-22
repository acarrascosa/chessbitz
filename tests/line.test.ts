import { describe, expect, it } from 'vitest';
import { START_FEN, fenAt, moveLabel, pairMoves, parseLine, parseUciLine } from '../src/lib/line';

const RUY_LOPEZ = '1. e4 e5 2. Nf3 Nc6 3. Bb5';

describe('parseLine', () => {
    it('returns one ply per move with squares and resulting position', () => {
        const plies = parseLine(RUY_LOPEZ);
        expect(plies.map(p => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
        expect(plies[4]).toMatchObject({ index: 4, from: 'f1', to: 'b5', color: 'w' });
        expect(plies[4].fen).toBe('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
    });

    it('throws on illegal moves', () => {
        expect(() => parseLine('1. e4 e5 2. Ke3')).toThrow();
    });
});

describe('fenAt', () => {
    const plies = parseLine(RUY_LOPEZ);

    it('returns the starting position before the first ply', () => {
        expect(fenAt(plies, -1)).toBe(START_FEN);
    });

    it('returns the position after the given ply', () => {
        expect(fenAt(plies, 0)).toBe(plies[0].fen);
    });
});

describe('pairMoves', () => {
    it('groups plies into numbered rows, leaving the last black move empty when missing', () => {
        const pairs = pairMoves(parseLine(RUY_LOPEZ));
        expect(pairs.map(p => [p.number, p.white?.san, p.black?.san])).toEqual([
            [1, 'e4', 'e5'],
            [2, 'Nf3', 'Nc6'],
            [3, 'Bb5', undefined],
        ]);
    });
});

describe('moveLabel', () => {
    it('numbers white and black moves', () => {
        const plies = parseLine('1. e4 e5 2. Nf3');
        expect(plies.map(moveLabel)).toEqual(['1. e4', '1... e5', '2. Nf3']);
    });
});

describe('parseUciLine', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

    it('plays UCI moves from any position with real move numbers', () => {
        const plies = parseUciLine(fen, ['g8f6', 'h5f7']);
        expect(plies.map(p => p.san)).toEqual(['Nf6', 'Qxf7#']);
        expect(plies[0]).toMatchObject({ number: 3, color: 'b', before: fen });
        expect(fenAt(plies, -1)).toBe(fen);
        expect(moveLabel(plies[1])).toBe('4. Qxf7#');
        expect(pairMoves(plies).map(p => p.number)).toEqual([3, 4]);
    });

    it('supports promotions and rejects illegal moves', () => {
        expect(parseUciLine('8/P7/8/8/8/8/8/k6K w - - 0 1', ['a7a8q'])[0].san).toBe('a8=Q+');
        expect(() => parseUciLine(fen, ['e1e3'])).toThrow();
    });
});
