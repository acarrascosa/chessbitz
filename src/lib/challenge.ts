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
    hintLevel: number;
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
    return { side, cursor: 0, results: {}, mistakes: 0, hintLevel: 0, stumbled: false, status: plies.length ? 'playing' : 'won' };
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
    try {
        new Chess(fenAt(plies, state.cursor - 1)).move({ from, to, promotion: 'q' });
        return 'wrong';
    } catch {
        return 'illegal';
    }
}

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
                const hintLevel = Math.min(MAX_HINT_LEVEL, state.hintLevel + 1);
                return { ...state, hintLevel };
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

export function resultGrid(state: ChallengeState, plies: Ply[]): string {
    return playerPlies(plies, state.side)
        .map(p => (state.results[p.index] ? EMOJI[state.results[p.index]] : '⬜'))
        .join('');
}

/** Bucket reported to global stats: mistakes for a completed line, MAX_MISTAKES when lost. */
export function resultBucket(state: ChallengeState): number {
    return state.status === 'lost' ? MAX_MISTAKES : state.mistakes;
}
