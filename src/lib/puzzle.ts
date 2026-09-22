import type { Color } from 'chess.js';
import { parseUciLine, type Ply } from './line';

/** A tactic from the Lichess open puzzle database (CC0), see scripts/puzzles.mjs. */
export interface Puzzle {
    id: string;
    /** Position before the opponent's setup move. */
    fen: string;
    /** UCI moves: the setup move, then the solution alternating sides. */
    moves: string;
    rating: number;
    themes: string[];
}

/** The setup move is the opponent's first ply; the player finds the rest of their plies. */
export function puzzlePlies(puzzle: Puzzle): Ply[] {
    return parseUciLine(puzzle.fen, puzzle.moves.split(' '));
}

export const puzzleSide = (plies: Ply[]): Color => plies[1]?.color ?? 'w';

export type PuzzleGoal = 'mateIn1' | 'mateIn2' | 'mateIn3' | 'mateIn4' | 'mateIn5' | 'crushing' | 'advantage' | 'equality';

const GOALS: PuzzleGoal[] = ['mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'crushing', 'advantage', 'equality'];

/** What the player is asked to achieve, from the puzzle's Lichess themes. */
export function puzzleGoal(puzzle: Puzzle): PuzzleGoal {
    return GOALS.find(goal => puzzle.themes.includes(goal)) ?? 'advantage';
}

/** Tactical motifs worth naming once the puzzle is solved (goals and phase tags excluded). */
export function puzzleMotifs(puzzle: Puzzle): string[] {
    return puzzle.themes.filter(theme => !GOALS.includes(theme as PuzzleGoal) && theme !== 'opening' && theme !== 'mate');
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export function puzzleDifficulty(puzzle: Puzzle): Difficulty {
    return puzzle.rating < 1300 ? 'easy' : puzzle.rating < 1600 ? 'medium' : 'hard';
}

/** Openings get harder the more moves the player has to find. */
export function lineDifficulty(playerMoves: number): Difficulty {
    return playerMoves <= 2 ? 'easy' : playerMoves <= 4 ? 'medium' : 'hard';
}

export const lichessPuzzleUrl = (id: string) => `https://lichess.org/training/${id}`;
