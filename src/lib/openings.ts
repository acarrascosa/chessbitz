import type { Color } from 'chess.js';
import { getDayNumber, getRotationIndex } from './daily';
import type { Lang } from '../i18n/ui';
import type { Puzzle } from './puzzle';

export interface OpeningText {
    name: string;
    /** One-line hook shown under the title. */
    description: string;
    /** Strategic plans and typical ideas (2–3 sentences). */
    idea: string;
    /** One explanation per ply of `pgn`. */
    moves: string[];
}

/** Authoring format of `src/data/openings/*.json`. */
export interface OpeningEntry {
    slug: string;
    eco: string;
    /** Side whose choice defines the opening; the player plays it in the challenge. */
    side: Color;
    pgn: string;
    es: OpeningText;
    en: OpeningText;
}

export interface Opening extends OpeningEntry {
    /** Source file name, e.g. `sicilian`. */
    family: string;
    /** Lichess tactics from games in this opening, easiest first. */
    puzzles?: Puzzle[];
}

/** One row of `/data/index.json`, the light catalog used by the archive. */
export interface IndexEntry {
    slug: string;
    eco: string;
    side: Color;
    family: string;
    /** Moves the player has to find. */
    moves: number;
    es: string;
    en: string;
}

export interface DailySlot {
    day: number;
    /** Position in the schedule, also the static data file to fetch. */
    index: number;
}

export function getDailySlot(count: number, date: Date = new Date()): DailySlot {
    const day = getDayNumber(date);
    return { day, index: getRotationIndex(day, count) };
}

export const dailyDataUrl = (index: number) => `/data/daily/${index}.json`;
export const INDEX_URL = '/data/index.json';

export async function fetchOpening(index: number): Promise<Opening> {
    const response = await fetch(dailyDataUrl(index));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<Opening>;
}

export function textFor(opening: Opening, lang: Lang): OpeningText {
    return opening[lang];
}
