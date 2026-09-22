import { Chess, DEFAULT_POSITION, type Color, type Square } from 'chess.js';

export interface Ply {
    /** 0-based ply index within the line. */
    index: number;
    /** Full-move number shown in move lists ("12." or "12..."). */
    number: number;
    san: string;
    from: Square;
    to: Square;
    color: Color;
    /** Position before this ply is played. */
    before: string;
    /** Position after this ply is played. */
    fen: string;
}

export interface MovePair {
    number: number;
    white?: Ply;
    black?: Ply;
}

export const START_FEN = DEFAULT_POSITION;

type VerboseMove = ReturnType<Chess['move']>;

const toPly = (move: VerboseMove, index: number): Ply => ({
    index,
    number: Number(move.before.split(' ')[5]),
    san: move.san,
    from: move.from,
    to: move.to,
    color: move.color,
    before: move.before,
    fen: move.after,
});

/** Parses a PGN move sequence into plies. Throws on illegal or malformed input. */
export function parseLine(pgn: string): Ply[] {
    const game = new Chess();
    game.loadPgn(pgn);
    return game.history({ verbose: true }).map(toPly);
}

/** Plays UCI moves ("e2e4 e7e5 e7e8q") from any position. Throws on illegal input. */
export function parseUciLine(fen: string, uci: string[]): Ply[] {
    const game = new Chess(fen);
    return uci.map((move, index) =>
        toPly(game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }), index));
}

/** FEN shown when `plyIndex` is the last ply played (-1 = starting position). */
export function fenAt(plies: Ply[], plyIndex: number): string {
    if (plyIndex < 0) return plies[0]?.before ?? START_FEN;
    return plies[plyIndex]?.fen ?? START_FEN;
}

/** Human-readable move number and SAN, e.g. "3. Bb5" or "3... a6". */
export function moveLabel(ply: Ply): string {
    return `${ply.number}${ply.color === 'w' ? '.' : '...'} ${ply.san}`;
}

/** Groups plies into numbered rows ("1. e4 e5") for move lists. */
export function pairMoves(plies: Ply[]): MovePair[] {
    const pairs: MovePair[] = [];
    for (const ply of plies) {
        if (ply.color === 'w' || pairs.length === 0) pairs.push({ number: ply.number });
        pairs[pairs.length - 1][ply.color === 'w' ? 'white' : 'black'] = ply;
    }
    return pairs;
}
