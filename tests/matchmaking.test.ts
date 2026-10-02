import { describe, expect, it } from 'vitest';
import {
    AFTER_END_MS, ALONE_WAIT_MS, GATHER_MS, LONG_WAIT_MS, MAX_WAIT_MS,
    canWaitFor, liveMatches, nextEnd, parseMatchMessage, playingNow, readyGroup, waitUntil, waitingFor,
    type LiveMatch, type Searcher,
} from '../src/lib/matchmaking';

const T0 = 1_000_000;
const me: Searcher = { token: 'ta', since: T0, level: 180 };
const match = (endsBy: number, humans = 1, finishedAt?: number): LiveMatch => ({ code: 'ABCD', endsBy, humans, finishedAt });

describe('waiting for a rival', () => {
    it('is short when nobody plays publicly', () => {
        expect(waitUntil(me, [], T0)).toBe(T0 + ALONE_WAIT_MS);
        // Matches with only recorded rivals... still have a person: those count. Empty ones don't.
        expect(waitUntil(me, [match(T0 + 20_000, 0)], T0)).toBe(T0 + ALONE_WAIT_MS);
    });

    it('waits the usual time when alone during the battle hour, when people are more likely to come', () => {
        expect(waitUntil(me, [], T0, true)).toBe(T0 + LONG_WAIT_MS);
    });

    it('waits for a public match about to end, plus time for its players to come back', () => {
        expect(waitUntil(me, [match(T0 + 40_000)], T0)).toBe(T0 + 40_000 + AFTER_END_MS);
        expect(waitingFor(me, [match(T0 + 40_000)], T0)).toBe(T0 + 40_000);
        expect(waitingFor(me, [], T0)).toBeNull();
        expect(waitingFor(me, [match(T0 + 130_000)], T0)).toBeNull();
        // Ending at once still leaves at least the short wait.
        expect(waitUntil(me, [match(T0 + 1_000)], T0)).toBe(T0 + ALONE_WAIT_MS);
    });

    it('keeps the usual wait when the match ends later, and offers to wait for it', () => {
        const later = [match(T0 + 130_000)];
        expect(waitUntil(me, later, T0)).toBe(T0 + LONG_WAIT_MS);
        expect(canWaitFor(me, later, T0)).toBe(T0 + 130_000);
        const waiting = { ...me, extended: true };
        expect(waitUntil(waiting, later, T0)).toBe(T0 + 130_000 + AFTER_END_MS);
        expect(canWaitFor(waiting, later, T0)).toBeNull();
    });

    it('never jumps as time passes, and never goes past the cap', () => {
        const later = [match(T0 + 70_000)];
        const at = (ms: number) => waitUntil(me, later, T0 + ms);
        expect(at(0)).toBe(T0 + LONG_WAIT_MS);
        expect(at(15_000)).toBe(T0 + LONG_WAIT_MS);
        expect(canWaitFor(me, [match(T0 + 10 * 60_000)], T0)).toBeNull();
        expect(waitUntil({ ...me, extended: true }, [match(T0 + 10 * 60_000)], T0)).toBe(T0 + MAX_WAIT_MS);
    });

    it('waits a little after a match that just ended', () => {
        const ended = [match(T0 + 200_000, 2, T0 - 2_000)];
        expect(nextEnd(ended, T0)).toBe(T0 - 2_000);
        expect(waitUntil(me, ended, T0)).toBe(T0 + ALONE_WAIT_MS);
        expect(nextEnd(ended, T0 + AFTER_END_MS)).toBeNull();
        expect(liveMatches(ended, T0 + AFTER_END_MS)).toEqual([]);
        expect(playingNow(ended)).toBe(0);
        expect(playingNow([match(T0 + 1, 3)])).toBe(3);
    });
});

describe('seating people together', () => {
    const searchers: Searcher[] = ['a', 'b', 'c', 'd', 'e'].map((token, i) => ({ token, since: T0 + i, level: 100 }));

    it('gathers for a moment once two are in, then seats up to four, oldest first', () => {
        expect(readyGroup(searchers.slice(0, 1), T0, T0 + GATHER_MS)).toEqual([]);
        expect(readyGroup(searchers.slice(0, 2), T0 + GATHER_MS, T0)).toEqual([]);
        expect(readyGroup(searchers.slice(0, 2), null, T0 + GATHER_MS)).toEqual([]);
        expect(readyGroup([...searchers].reverse(), T0, T0).map(s => s.token)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('reads only the two client messages', () => {
        expect(parseMatchMessage('{"t":"ghost"}')).toEqual({ t: 'ghost' });
        expect(parseMatchMessage('{"t":"wait"}')).toEqual({ t: 'wait' });
        expect(parseMatchMessage('{"t":"start"}')).toBeNull();
        expect(parseMatchMessage('nope')).toBeNull();
    });
});
