import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';

/**
 * A deliberately small engine for sensible replies when the player leaves the
 * book in expert mode: a two-ply alpha-beta search over material plus simple
 * piece-square bonuses. It only has to keep opening positions believable.
 */

const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;

/** Bonus for pieces on central squares, from white's point of view. */
function placement(type: PieceSymbol, square: Square, white: boolean): number {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const relRank = white ? rank : 7 - rank;
    const centre = 3.5 - Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5));
    switch (type) {
        case 'p': return relRank * 4 + (file >= 2 && file <= 5 ? centre * 6 : 0);
        case 'n': return centre * 10 - (relRank === 0 ? 15 : 0);
        case 'b': return centre * 5 - (relRank === 0 ? 10 : 0);
        case 'q': return relRank > 1 && relRank < 4 ? -5 : 0;
        case 'k': return relRank === 0 && (file >= 6 || file <= 2) ? 20 : relRank === 0 ? 0 : -25;
        default: return 0;
    }
}

/** Static score from the side to move's point of view. */
function evaluate(game: Chess): number {
    if (game.isCheckmate()) return -MATE;
    if (game.isDraw()) return 0;
    let score = 0;
    for (const row of game.board()) {
        for (const piece of row) {
            if (!piece) continue;
            const value = VALUE[piece.type] + placement(piece.type, piece.square, piece.color === 'w');
            score += piece.color === 'w' ? value : -value;
        }
    }
    return game.turn() === 'w' ? score : -score;
}

/** Captures and checks first, so alpha-beta prunes more. */
const ordered = (moves: Move[]) =>
    [...moves].sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)) || a.san.localeCompare(b.san));

function search(game: Chess, depth: number, alpha: number, beta: number): number {
    if (depth === 0 || game.isGameOver()) return evaluate(game);
    let best = -Infinity;
    for (const move of ordered(game.moves({ verbose: true }))) {
        game.move(move);
        const score = -search(game, depth - 1, -beta, -alpha);
        game.undo();
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
    }
    return best;
}

/** Best move for the side to move, or null when the game is over. Deterministic. */
export function bestMove(fen: string, depth = 2): Move | null {
    const game = new Chess(fen);
    let best: Move | null = null;
    let bestScore = -Infinity;
    for (const move of ordered(game.moves({ verbose: true }))) {
        game.move(move);
        const score = -search(game, depth - 1, -Infinity, -bestScore);
        game.undo();
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return best;
}
