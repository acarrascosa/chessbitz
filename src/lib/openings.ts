import openings from '../data/openings.json';
import { getDayNumber, getRotationIndex } from './daily';
import type { Lang } from '../i18n/ui';

export interface OpeningText {
    name: string;
    description: string;
    /** One explanation per ply of `pgn`. */
    explanations: string[];
}

export interface Opening {
    id: number;
    eco: string;
    name: string;
    pgn: string;
    fen: string;
    content: Record<Lang, OpeningText>;
}

const catalog = openings as Opening[];

export function getDailyOpening(date: Date = new Date()): Opening {
    return catalog[getRotationIndex(getDayNumber(date), catalog.length)];
}
