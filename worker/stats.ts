import { getDayNumber } from '../src/lib/daily';
import { MAX_MISTAKES } from '../src/lib/challenge';

/** Mistakes bucket used for lost challenges (all mistakes spent). */
export const LOST = MAX_MISTAKES;
/** Upper bounds that keep a single bogus result from skewing the averages. */
export const MAX_HINTS = 60;
export const MAX_SECONDS = 1800;

export interface ResultSubmission {
    day: number;
    /** 0..MAX_MISTAKES-1 for a completed line, MAX_MISTAKES when lost. */
    mistakes: number;
    /** Absent when sent by clients older than the hints/time stats. */
    detail?: { hints: number; seconds: number };
}

export interface DailyStats {
    day: number;
    players: number;
    /** Completed lines by number of mistakes (index 0..MAX_MISTAKES-1). */
    distribution: number[];
    lost: number;
    /** Averages over the players who reported them; null when nobody did. */
    averageHints: number | null;
    averageSeconds: number | null;
}

export interface ResultRow {
    mistakes: number;
    plays: number;
    hints?: number;
    seconds?: number;
    detailed?: number;
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
    const { day, mistakes, hints, seconds } = body as Record<string, unknown>;
    if (!isInt(day) || !isInt(mistakes)) return null;
    if (mistakes < 0 || mistakes > LOST || !isPlayableDay(day, now)) return null;
    if (hints === undefined && seconds === undefined) return { day, mistakes };
    if (!isInt(hints) || !isInt(seconds) || hints < 0 || hints > MAX_HINTS || seconds < 0) return null;
    return { day, mistakes, detail: { hints, seconds: Math.min(seconds, MAX_SECONDS) } };
}

export function parseDay(value: string | undefined): number | null {
    if (!value || !/^\d{1,5}$/.test(value)) return null;
    return Number(value);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toDailyStats(day: number, rows: ResultRow[]): DailyStats {
    const distribution = Array.from({ length: MAX_MISTAKES }, () => 0);
    let lost = 0;
    let hints = 0;
    let seconds = 0;
    let detailed = 0;
    for (const row of rows) {
        if (row.mistakes === LOST) lost += row.plays;
        else if (row.mistakes >= 0 && row.mistakes < LOST) distribution[row.mistakes] += row.plays;
        hints += row.hints ?? 0;
        seconds += row.seconds ?? 0;
        detailed += row.detailed ?? 0;
    }
    const players = lost + distribution.reduce((sum, n) => sum + n, 0);
    return {
        day,
        players,
        distribution,
        lost,
        averageHints: detailed ? round1(hints / detailed) : null,
        averageSeconds: detailed ? Math.round(seconds / detailed) : null,
    };
}
