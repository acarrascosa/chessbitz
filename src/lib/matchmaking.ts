/*
 * Public matchmaking: people looking for a battle wait in one queue (web and
 * Discord alike) until there is someone to play with, or get a recorded rival.
 * With little traffic people arrive one by one, so how long to wait depends on
 * what's going on: nobody playing publicly → a short wait in case someone
 * arrives at the same time; a public match about to end → wait for its players
 * to come back (even if they were playing a recorded rival); a match that ends
 * later → the normal wait, with the option to wait for it. Pure, so the Durable
 * Object (worker/matchmaker.ts) and the tests share it.
 */

/** Nobody is playing publicly: wait this long in case someone arrives at the same time. */
export const ALONE_WAIT_MS = 15_000;
/** A public match is on but ends later than SOON_MS: the usual wait (the player can choose to wait for it). */
export const LONG_WAIT_MS = 30_000;
/** A public match that ends within this of starting to search is worth waiting for. */
export const SOON_MS = 60_000;
/** After a public match ends, time for its players to press "find another". */
export const AFTER_END_MS = 10_000;
/** Once two people are searching, wait this long for a third or a fourth. */
export const GATHER_MS = 4_000;
/** Nobody waits longer than this, even after choosing to wait for a match. */
export const MAX_WAIT_MS = 5 * 60_000;
/** Seats at a public table. */
export const MAX_TABLE = 4;

export interface Searcher {
    /** Battle token (web) or `discord:<id>`: what the table seats them by. */
    token: string;
    /** When they started searching. */
    since: number;
    /** Points they usually score, to pick a recorded rival of their level. */
    level: number;
    /** Chose to wait for a match that ends later. */
    extended?: boolean;
}

export interface LiveMatch {
    code: string;
    /** When it ends at the latest (every clock run out). */
    endsBy: number;
    /** People (not recorded rivals) playing it. */
    humans: number;
    /** When it actually ended, if it has. */
    finishedAt?: number;
}

/** When the match that frees people soonest ends (or ended, within AFTER_END_MS); null if none is on. */
export function nextEnd(matches: LiveMatch[], now: number): number | null {
    const ends = matches
        .filter(m => m.humans > 0)
        .map(m => m.finishedAt ?? m.endsBy)
        .filter(end => end + AFTER_END_MS > now);
    return ends.length ? Math.min(...ends) : null;
}

/**
 * When a searcher gets a recorded rival if nobody has turned up. During the battle
 * hour (`busy`) someone is more likely to come, so being alone means the usual wait.
 */
export function waitUntil(searcher: Searcher, matches: LiveMatch[], now: number, busy = false): number {
    const end = nextEnd(matches, now);
    const cap = searcher.since + MAX_WAIT_MS;
    if (end === null) return searcher.since + (busy ? LONG_WAIT_MS : ALONE_WAIT_MS);
    if (searcher.extended) return Math.min(cap, end + AFTER_END_MS);
    // Judged from when they started searching, so the countdown never jumps.
    if (end <= searcher.since + SOON_MS) return Math.min(cap, Math.max(searcher.since + ALONE_WAIT_MS, end + AFTER_END_MS));
    return searcher.since + LONG_WAIT_MS;
}

/** The end of the match the searcher's wait is for, when it is (to say "a match ends in 0:40"). */
export function waitingFor(searcher: Searcher, matches: LiveMatch[], now: number, busy = false): number | null {
    const end = nextEnd(matches, now);
    return end !== null && waitUntil(searcher, matches, now, busy) === Math.min(searcher.since + MAX_WAIT_MS, end + AFTER_END_MS) ? end : null;
}

/** A match ending after the searcher's wait, that they could choose to wait for. */
export function canWaitFor(searcher: Searcher, matches: LiveMatch[], now: number, busy = false): number | null {
    const end = nextEnd(matches, now);
    if (end === null || searcher.extended) return null;
    return end + AFTER_END_MS > waitUntil(searcher, matches, now, busy) && end + AFTER_END_MS <= searcher.since + MAX_WAIT_MS ? end : null;
}

/** The searchers to seat together now (oldest first), or none yet. */
export function readyGroup<T extends Searcher>(searchers: T[], gatherAt: number | null, now: number): T[] {
    if (searchers.length < 2 || gatherAt === null || now < gatherAt) return [];
    return [...searchers].sort((a, b) => a.since - b.since).slice(0, MAX_TABLE);
}

/** People playing public matches right now. */
export const playingNow = (matches: LiveMatch[]) => matches.filter(m => m.finishedAt === undefined).reduce((sum, m) => sum + m.humans, 0);

/** Matches worth remembering: still on, or ended recently enough that their players may come back. */
export const liveMatches = (matches: LiveMatch[], now: number) => matches.filter(m => (m.finishedAt ?? m.endsBy) + AFTER_END_MS > now);

/** Points a newcomer is matched around: a typical normal match. */
export const DEFAULT_LEVEL = 180;

/** Matchmaking protocol. */
export type MatchClientMessage = { t: 'ghost' } | { t: 'wait' };

export type MatchServerMessage =
    | { t: 'status'; searching: number; playing: number; waitUntil: number; waitingFor: number | null; canWaitFor: number | null; now: number }
    | { t: 'matched'; code: string; now: number }
    | { t: 'error'; error: 'invalid' | 'busy'; now: number };

/** What the battle page shows about public matches (GET /api/match/status). */
export interface MatchSummary {
    searching: number;
    playing: number;
    /** When the last public match started; null if none yet. */
    lastAt: number | null;
    /** Public matches started today (UTC). */
    today: number;
}

export function parseMatchMessage(raw: unknown): MatchClientMessage | null {
    if (typeof raw !== 'string' || raw.length > 64) return null;
    try {
        const data = JSON.parse(raw) as { t?: unknown };
        return data.t === 'ghost' || data.t === 'wait' ? { t: data.t } : null;
    } catch {
        return null;
    }
}
