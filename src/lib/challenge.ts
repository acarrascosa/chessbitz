import { Chess, type Color, type Square } from 'chess.js';
import { fenAt, type Ply } from './line';

export const MAX_MISTAKES = 5;
/** 1: which piece moves · 2: from which square · 3: the full move (counts as revealed). */
export const MAX_HINT_LEVEL = 3;

/** Outcome of each ply the player had to find. */
export type PlyResult = 'perfect' | 'assisted' | 'revealed';
export type ChallengeStatus = 'playing' | 'won' | 'lost';

export interface ChallengeState {
    side: Color;
    /** Index of the next ply to be played. */
    cursor: number;
    /** Keyed by ply index, only for the player's plies that are settled. */
    results: Record<number, PlyResult>;
    mistakes: number;
    /** Hint level of the current ply. */
    hintLevel: number;
    /** Hints used in the whole challenge (absent in results saved before it existed). */
    hints?: number;
    /** Half-errors charged for hints (absent in results saved before hints cost errors). */
    hintHalves?: number;
    /** A wrong attempt was made on the current ply. */
    stumbled: boolean;
    status: ChallengeStatus;
}

export type ChallengeAction =
    | { type: 'opponent' }
    | { type: 'attempt'; from: Square; to: Square }
    | { type: 'hint' };

/** What happened to an attempt, so the UI can give feedback. */
export type AttemptVerdict = 'correct' | 'wrong' | 'illegal';

export function createChallenge(plies: Ply[], side: Color): ChallengeState {
    return { side, cursor: 0, results: {}, mistakes: 0, hintLevel: 0, hints: 0, hintHalves: 0, stumbled: false, status: plies.length ? 'playing' : 'won' };
}

export function isPlayerTurn(state: ChallengeState, plies: Ply[]): boolean {
    return state.status === 'playing' && plies[state.cursor]?.color === state.side;
}

/** Player plies in line order; the length of the emoji grid. */
export function playerPlies(plies: Ply[], side: Color): Ply[] {
    return plies.filter(p => p.color === side);
}

/**
 * Castling can be entered as king-to-destination (e1→g1) or king-onto-rook
 * (e1→h1, how drag-and-drop UIs often do it). Both are accepted.
 */
function matchesPly(ply: Ply, from: Square, to: Square): boolean {
    if (ply.from !== from) return false;
    if (ply.to === to) return true;
    const rank = from[1];
    const isCastle = ply.san.startsWith('O-O');
    if (!isCastle) return false;
    const rookSquare = (ply.san === 'O-O' ? `h${rank}` : `a${rank}`) as Square;
    return to === rookSquare;
}

export function judgeAttempt(state: ChallengeState, plies: Ply[], from: Square, to: Square): AttemptVerdict {
    const ply = plies[state.cursor];
    if (!ply || !isPlayerTurn(state, plies)) return 'illegal';
    if (matchesPly(ply, from, to)) return 'correct';
    const game = new Chess(fenAt(plies, state.cursor - 1));
    try {
        game.move({ from, to, promotion: 'q' });
    } catch {
        return 'illegal';
    }
    // Puzzles accept any mate on the final move, as Lichess does.
    const isLast = state.cursor === plies.length - 1;
    return isLast && ply.san.endsWith('#') && game.isCheckmate() ? 'correct' : 'wrong';
}

/** Hints used so far; results saved before hints were counted report 0. */
export const hintsUsed = (state: ChallengeState) => state.hints ?? 0;

/**
 * What a hint costs, in half-errors, by the level it unlocks: asking for help on a
 * move (which piece) is half an error, the arrow the other half, so a move given
 * away entirely counts as one error. The square hint in between is free.
 */
export const HINT_HALVES: Record<number, number> = { 1: 1, 2: 0, 3: 1 };

/** Cost of the next hint on the current move, in half-errors (0 once all are used). */
export const nextHintHalves = (state: ChallengeState) => HINT_HALVES[state.hintLevel + 1] ?? 0;

/**
 * Errors in half-points: 2 per wrong move plus the hints' halves, up to the whole
 * allowance. Hints never end a line (only wrong moves do), but a line finished on
 * hints alone can still reach the maximum, which counts as not solved.
 */
export function errorHalves(state: ChallengeState): number {
    if (state.status === 'lost') return MAX_MISTAKES * 2;
    return Math.min(MAX_MISTAKES * 2, state.mistakes * 2 + (state.hintHalves ?? 0));
}

/** Errors as shown to the player (1.5 for a wrong move plus half a hint). */
export const errorCount = (state: ChallengeState) => errorHalves(state) / 2;

/** Completed with errors to spare: the win for streaks and stats. */
export const isSolved = (state: ChallengeState) => state.status === 'won' && errorHalves(state) < MAX_MISTAKES * 2;

function settle(state: ChallengeState, plies: Ply[], result: PlyResult): ChallengeState {
    const cursor = state.cursor + 1;
    return {
        ...state,
        cursor,
        results: { ...state.results, [state.cursor]: result },
        hintLevel: 0,
        stumbled: false,
        status: cursor >= plies.length ? 'won' : 'playing',
    };
}

/** Out of mistakes: every remaining player ply is marked as revealed. */
function forfeit(state: ChallengeState, plies: Ply[]): ChallengeState {
    const results = { ...state.results };
    for (const ply of plies.slice(state.cursor)) {
        if (ply.color === state.side) results[ply.index] = 'revealed';
    }
    return { ...state, results, cursor: plies.length, hintLevel: 0, status: 'lost' };
}

export function challengeReducer(plies: Ply[]) {
    return (state: ChallengeState, action: ChallengeAction): ChallengeState => {
        if (state.status !== 'playing') return state;

        switch (action.type) {
            case 'opponent': {
                if (isPlayerTurn(state, plies)) return state;
                const cursor = state.cursor + 1;
                return { ...state, cursor, status: cursor >= plies.length ? 'won' : 'playing' };
            }
            case 'hint': {
                if (!isPlayerTurn(state, plies)) return state;
                if (state.hintLevel >= MAX_HINT_LEVEL) return state;
                return {
                    ...state,
                    hintLevel: state.hintLevel + 1,
                    hints: hintsUsed(state) + 1,
                    hintHalves: (state.hintHalves ?? 0) + nextHintHalves(state),
                };
            }
            case 'attempt': {
                const verdict = judgeAttempt(state, plies, action.from, action.to);
                if (verdict === 'illegal') return state;
                if (verdict === 'correct') {
                    const result: PlyResult = state.hintLevel >= MAX_HINT_LEVEL
                        ? 'revealed'
                        : state.stumbled || state.hintLevel > 0 ? 'assisted' : 'perfect';
                    return settle(state, plies, result);
                }
                const mistakes = state.mistakes + 1;
                const next = { ...state, mistakes, stumbled: true };
                return mistakes >= MAX_MISTAKES ? forfeit(next, plies) : next;
            }
        }
    };
}

const EMOJI: Record<PlyResult, string> = { perfect: '🟩', assisted: '🟨', revealed: '🟥' };
/** High-contrast palette for colour-blind players. */
const CONTRAST_EMOJI: Record<PlyResult, string> = { perfect: '🟦', assisted: '🟧', revealed: '⬛' };

/** One square for a whole line or puzzle: 🟩 clean, 🟨 solved with help, 🟥 not solved. */
export function summaryEmoji(state: ChallengeState, contrast = false): string {
    const emoji = contrast ? CONTRAST_EMOJI : EMOJI;
    return emoji[!isSolved(state) ? 'revealed' : errorHalves(state) ? 'assisted' : 'perfect'];
}

export function resultGrid(state: ChallengeState, plies: Ply[], contrast = false): string {
    const emoji = contrast ? CONTRAST_EMOJI : EMOJI;
    return playerPlies(plies, state.side)
        .map(p => (state.results[p.index] ? emoji[state.results[p.index]] : '⬜'))
        .join('');
}

/**
 * Bucket for the stats histograms: whole errors rounded up (0 means truly clean:
 * no wrong move and no hint), 0..MAX_MISTAKES-1 for a solved line, MAX_MISTAKES when
 * lost or finished with the whole allowance spent.
 */
export function resultBucket(state: ChallengeState): number {
    if (!isSolved(state)) return MAX_MISTAKES;
    return Math.min(MAX_MISTAKES - 1, Math.ceil(errorHalves(state) / 2));
}
