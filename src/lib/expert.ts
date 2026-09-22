import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { bestMove } from './engine';
import { playerPlies } from './challenge';
import { fenAt, type Ply } from './line';

/**
 * Expert mode, inspired by Chessle: the player plays their whole side of the
 * line blind, then submits it and every move is graded at once. Six attempts.
 */
export const EXPERT_ATTEMPTS = 6;

/**
 * exact: the move of the line · piece: right piece type, wrong move ·
 * square: right destination, wrong piece · miss: neither.
 */
export type Grade = 'exact' | 'piece' | 'square' | 'miss';

export interface ExpertMove {
    san: string;
    from: Square;
    to: Square;
    piece: PieceSymbol;
    color: Color;
    /** Position after the move. */
    fen: string;
}

export interface GradedAttempt {
    moves: ExpertMove[];
    grades: Grade[];
}

export interface ExpertState {
    side: Color;
    attempts: GradedAttempt[];
    status: 'playing' | 'won' | 'lost';
}

export const createExpert = (side: Color): ExpertState => ({ side, attempts: [], status: 'playing' });

/** Number of moves the player enters per attempt. */
export const expertLength = (plies: Ply[], side: Color) => playerPlies(plies, side).length;

const bare = (san: string) => san.replace(/[+#!?]/g, '');

export function gradeMove(move: ExpertMove, target: Ply): Grade {
    if (bare(move.san) === bare(target.san)) return 'exact';
    const targetPiece = new Chess(target.before).get(target.from)?.type;
    if (move.piece === targetPiece) return 'piece';
    if (move.to === target.to) return 'square';
    return 'miss';
}

export function gradeAttempt(moves: ExpertMove[], plies: Ply[], side: Color): Grade[] {
    const targets = playerPlies(plies, side);
    return targets.map((target, i) => (moves[i] ? gradeMove(moves[i], target) : 'miss'));
}

export function submitAttempt(state: ExpertState, moves: ExpertMove[], plies: Ply[]): ExpertState {
    if (state.status !== 'playing') return state;
    const grades = gradeAttempt(moves, plies, state.side);
    const attempts = [...state.attempts, { moves, grades }];
    const status = grades.every(grade => grade === 'exact') ? 'won' : attempts.length >= EXPERT_ATTEMPTS ? 'lost' : 'playing';
    return { ...state, attempts, status };
}

/** Dropping the king onto its own rook means castling on that side. */
function castlingTarget(game: Chess, from: Square, to: Square): Square | null {
    const king = game.get(from);
    const rook = game.get(to);
    if (king?.type !== 'k' || rook?.type !== 'r' || rook.color !== king.color) return null;
    return `${to[0] === 'h' ? 'g' : 'c'}${from[1]}` as Square;
}

/** Plays `from`→`to` on `fen` (queen promotion), or returns null if illegal. */
export function tryMove(fen: string, from: Square, to: Square): ExpertMove | null {
    const game = new Chess(fen);
    const target = castlingTarget(game, from, to) ?? to;
    try {
        const move = game.move({ from, to: target, promotion: 'q' });
        return { san: move.san, from: move.from, to: move.to, piece: move.piece, color: move.color, fen: move.after };
    } catch {
        return null;
    }
}

/**
 * The opponent's reply at ply `index` of the line. While the player follows
 * the book the book reply is played; once they leave it the book reply is
 * still used when legal (the position stays recognisable), otherwise the
 * small engine answers.
 */
export function opponentReply(plies: Ply[], index: number, fen: string): ExpertMove | null {
    const book = plies[index];
    if (book) {
        const reply = tryMove(fen, book.from, book.to);
        if (reply) return reply;
    }
    const engine = bestMove(fen);
    return engine && { san: engine.san, from: engine.from, to: engine.to, piece: engine.piece, color: engine.color, fen: engine.after };
}

/** The line's starting position (before any ply). */
export const expertStartFen = (plies: Ply[]) => fenAt(plies, -1);

const EMOJI: Record<Grade, string> = { exact: '🟩', piece: '🟨', square: '🟫', miss: '⬜' };
const CONTRAST_EMOJI: Record<Grade, string> = { exact: '🟦', piece: '🟧', square: '🟪', miss: '⬜' };

export function expertGrid(state: ExpertState, contrast = false): string {
    const emoji = contrast ? CONTRAST_EMOJI : EMOJI;
    return state.attempts.map(attempt => attempt.grades.map(grade => emoji[grade]).join('')).join('\n');
}
