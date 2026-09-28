import { LAUNCH_DAY_UTC } from '../src/lib/daily';
import { LOST, type ResultRow } from './stats';

/**
 * The busker's own coins in the hat: a baseline of plays per day so that nobody
 * finishes the daily challenge and sees they were the only one. Each day has a
 * deterministic crowd (same numbers on every request) that fills up over the UTC
 * day, and real results add up on top of it, so two friends playing one after the
 * other see the count go up by one each. The crowd fades as real traffic grows,
 * judged by a day that's already over everywhere so it never shrinks mid-day.
 */
export const CROWD_MIN = 13;
export const CROWD_MAX = 82;
/** Real plays on a day that leave no crowd two days later; below that it fades linearly. */
export const CROWD_FADE = 150;
/** The day whose real plays decide the crowd: two before, finished in every time zone. */
export const FADE_LAG = 2;

const MS_PER_DAY = 86_400_000;
/** Busier on weekdays, Sunday first (getUTCDay order). */
const WEEKDAY = [0.7, 1, 1, 1, 0.95, 0.85, 0.65];
/** How often a crowd player ends in each bucket: 0..LOST-1 errors, then lost. Openings are hard to
 * guess, so most lines end around 4 errors (≈3.5 on average) and few are flawless. */
const BUCKET_WEIGHTS = [0.02, 0.05, 0.1, 0.19, 0.32, 0.32];

/** mulberry32: small, fast and good enough for plausible numbers. */
function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const seedOf = (day: number, player = 0) => Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(player + 1, 0x85ebca6b) ^ 0xc0ffee;

/** Players the crowd reaches by the end of `day`: low numbers are the most common, weekends are quieter. */
export function crowdSize(day: number): number {
    const u = random(seedOf(day))();
    const weekday = new Date(LAUNCH_DAY_UTC + day * MS_PER_DAY).getUTCDay();
    return Math.round(CROWD_MIN + (CROWD_MAX - CROWD_MIN) * (0.1 + 0.9 * u ** 1.8) * WEEKDAY[weekday]);
}

/**
 * Traffic weights for each of the 24 hours of the UTC day.
 * Tuned for a 9-to-5 worker profile in Spain (CET/CEST = UTC+1/+2):
 * - Dead at night (00:00 - 06:00 ES)
 * - Peak 1: arriving at office/coffee (08:00 - 10:00 ES -> ~06:00 - 08:00 UTC)
 * - Peak 2: lunch break (14:00 - 16:00 ES -> ~12:00 - 14:00 UTC)
 * - Steady small bumps in the evening.
 */
const HOURLY_TRAFFIC = [
    0, 0, 0, 0, 1, 3,       // 00:00 - 05:00 UTC
    15, 50, 30, 10, 5, 5,   // 06:00 - 11:00 UTC
    20, 50, 25, 10, 5, 15,  // 12:00 - 17:00 UTC
    20, 15, 10, 5, 2, 1     // 18:00 - 23:00 UTC
];
const TOTAL_TRAFFIC = HOURLY_TRAFFIC.reduce((a, b) => a + b, 0);
const CUMULATIVE_TRAFFIC = [0];
for (let i = 0; i < 24; i++) {
    CUMULATIVE_TRAFFIC.push(CUMULATIVE_TRAFFIC[i] + HOURLY_TRAFFIC[i]);
}

/** Crowd players who have "played" `day` by `now`: a few over CROWD_MIN at its start, the whole crowd at its end, none for days still to come. */
export function crowdSoFar(day: number, now: Date = new Date()): number {
    const start = LAUNCH_DAY_UTC + day * MS_PER_DAY;
    if (day < 0 || now.getTime() < start - MS_PER_DAY) return 0;
    const size = crowdSize(day);
    const first = Math.min(size, CROWD_MIN + Math.floor(random(seedOf(day) ^ 0x27d4eb2f)() * 4));
    const progress = Math.min(1, Math.max(0, (now.getTime() - start) / MS_PER_DAY));
    
    // Map progress to an exact hour of the day and interpolate traffic
    const hour = progress * 24;
    const h = Math.floor(hour);
    const rem = hour - h;
    const ramp = h >= 24 ? 1 : (CUMULATIVE_TRAFFIC[h] + HOURLY_TRAFFIC[h] * rem) / TOTAL_TRAFFIC;
    
    return first + Math.round((size - first) * ramp);
}

interface CrowdPlay {
    mistakes: number;
    halves: number;
    hints: number;
    seconds: number;
}

/** The i-th crowd player of a day; the same player on every request, so the histogram only ever grows. */
function crowdPlay(day: number, player: number, difficulty: number): CrowdPlay {
    const next = random(seedOf(day, player));
    // Harder days shift the weights towards more errors.
    const weights = BUCKET_WEIGHTS.map((w, bucket) => w * Math.exp(difficulty * (bucket - 2.5) * 0.25));
    let pick = next() * weights.reduce((sum, w) => sum + w, 0);
    let mistakes = 0;
    while (mistakes < LOST && (pick -= weights[mistakes]) > 0) mistakes++;
    // Exact half-errors that fall in the bucket (see bucketOfHalves in stats.ts).
    const halves = mistakes === LOST ? LOST * 2
        : mistakes === 0 ? 0
            : mistakes === LOST - 1 ? 7 + Math.floor(next() * 3)
                : mistakes * 2 - (next() < 0.4 ? 1 : 0);
    const hints = Math.floor(next() ** 2 * 4) + (halves % 2);
    const seconds = Math.round(45 + next() * next() * 280 + halves * 12 + (mistakes === LOST ? 60 : 0));
    return { mistakes, halves, hints, seconds };
}

/** Crowd players on `day` by `now`, given the real plays of the day FADE_LAG before; independent of today's real plays. */
export function crowdFiller(day: number, realBefore: number, now: Date = new Date()): number {
    return Math.round(crowdSoFar(day, now) * Math.max(0, 1 - realBefore / CROWD_FADE));
}

/** Rows in the shape of daily_results for the crowd players, to add to the real ones. */
export function crowdRows(day: number, realBefore: number, now: Date = new Date()): ResultRow[] {
    const missing = crowdFiller(day, realBefore, now);
    if (!missing) return [];
    const difficulty = random(seedOf(day) ^ 0x5bd1e995)() * 2 - 1;
    const rows = new Map<number, Required<ResultRow>>();
    for (let i = 0; i < missing; i++) {
        const play = crowdPlay(day, i, difficulty);
        const row = rows.get(play.mistakes) ?? { mistakes: play.mistakes, plays: 0, hints: 0, seconds: 0, detailed: 0, halves: 0, exact: 0 };
        row.plays++;
        row.hints += play.hints;
        row.seconds += play.seconds;
        row.detailed++;
        row.halves += play.halves;
        row.exact++;
        rows.set(play.mistakes, row);
    }
    return [...rows.values()];
}

/** Crowd plays on every day up to today, given the real plays per day, for the all-time totals. */
export function crowdTotals(realByDay: Map<number, number>, now: Date = new Date()): { plays: number; days: number } {
    const last = Math.floor((now.getTime() - LAUNCH_DAY_UTC) / MS_PER_DAY) + 1;
    let plays = 0;
    let days = 0;
    for (let day = 0; day <= last; day++) {
        const filler = crowdFiller(day, realByDay.get(day - FADE_LAG) ?? 0, now);
        plays += filler;
        if (filler && !realByDay.has(day)) days++;
    }
    return { plays, days };
}
