import type { Color } from 'chess.js';
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
    /** Side whose choice defines the opening; the player plays it in the challenge. */
    side?: Color;
    content: Record<Lang, OpeningText>;
}

export interface DailyOpening {
    day: number;
    opening: Opening;
}

const catalog = openings as Opening[];

// Fallback until every opening declares `side`: defenses and black gambits are black's choice.
const BLACK_OPENING = /defen[cs]e|counter|declined|accepted|\b(QGD|QGA|KID|KGD)\b|sicilian|french|caro|pirc|modern|alekhine|scandinavian|benoni|benko|dutch|gr(ue|ü|u)nfeld|nimzo|slav|indian|philidor|petrov|russian game|budapest|latvian|elephant|englund|blumenfeld|borg/i;

export function getPlayerSide(opening: Opening): Color {
    return opening.side ?? (BLACK_OPENING.test(opening.name) ? 'b' : 'w');
}

export function getDailyOpening(date: Date = new Date()): DailyOpening {
    const day = getDayNumber(date);
    return { day, opening: catalog[getRotationIndex(day, catalog.length)] };
}
