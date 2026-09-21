import { getDayNumber } from '../src/lib/daily';
import { MAX_MISTAKES } from '../src/lib/challenge';

/** Mistakes bucket used for lost challenges (all mistakes spent). */
export const LOST = MAX_MISTAKES;

export interface ResultSubmission {
    day: number;
    /** 0..MAX_MISTAKES-1 for a completed line, MAX_MISTAKES when lost. */
    mistakes: number;
}

export interface DailyStats {
    day: number;
    players: number;
    /** Completed lines by number of mistakes (index 0..MAX_MISTAKES-1). */
    distribution: number[];
    lost: number;
}

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/**
 * Players submit their local calendar day, which can be one day ahead or
 * behind the server's UTC day depending on their time zone.
 */
export function isPlayableDay(day: number, now: Date = new Date()): boolean {
    const today = getDayNumber(now);
    return day >= today - 1 && day <= today + 1;
}

export function parseSubmission(body: unknown, now: Date = new Date()): ResultSubmission | null {
    if (typeof body !== 'object' || body === null) return null;
    const { day, mistakes } = body as Record<string, unknown>;
    if (!isInt(day) || !isInt(mistakes)) return null;
    if (mistakes < 0 || mistakes > LOST || !isPlayableDay(day, now)) return null;
    return { day, mistakes };
}

export function parseDay(value: string | undefined): number | null {
    if (!value || !/^\d{1,5}$/.test(value)) return null;
    return Number(value);
}

export function toDailyStats(day: number, rows: { mistakes: number; plays: number }[]): DailyStats {
    const distribution = Array.from({ length: MAX_MISTAKES }, () => 0);
    let lost = 0;
    for (const { mistakes, plays } of rows) {
        if (mistakes === LOST) lost += plays;
        else if (mistakes >= 0 && mistakes < LOST) distribution[mistakes] += plays;
    }
    const players = lost + distribution.reduce((sum, n) => sum + n, 0);
    return { day, players, distribution, lost };
}
