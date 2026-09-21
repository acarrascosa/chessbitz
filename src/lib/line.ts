import { Chess, DEFAULT_POSITION, type Color, type Square } from 'chess.js';

export interface Ply {
    /** 0-based ply index within the line. */
    index: number;
    san: string;
    from: Square;
    to: Square;
    color: Color;
    /** Position after this ply is played. */
    fen: string;
}

export interface MovePair {
    number: number;
    white?: Ply;
    black?: Ply;
}

export const START_FEN = DEFAULT_POSITION;

/** Parses a PGN move sequence into plies. Throws on illegal or malformed input. */
export function parseLine(pgn: string): Ply[] {
    const game = new Chess();
    game.loadPgn(pgn);
    return game.history({ verbose: true }).map((move, index) => ({
        index,
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color,
        fen: move.after,
    }));
}

/** FEN shown when `plyIndex` is the last ply played (-1 = starting position). */
export function fenAt(plies: Ply[], plyIndex: number): string {
    return plyIndex < 0 ? START_FEN : (plies[plyIndex]?.fen ?? START_FEN);
}

/** Groups plies into numbered rows ("1. e4 e5") for move lists. */
export function pairMoves(plies: Ply[]): MovePair[] {
    const pairs: MovePair[] = [];
    for (const ply of plies) {
        const number = Math.floor(ply.index / 2) + 1;
        if (ply.color === 'w' || pairs.length === 0) pairs.push({ number });
        pairs[pairs.length - 1][ply.color === 'w' ? 'white' : 'black'] = ply;
    }
    return pairs;
}
