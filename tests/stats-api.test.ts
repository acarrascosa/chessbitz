import { describe, expect, it } from 'vitest';
import { LOST, isPlayableDay, parseDay, parseSubmission, toDailyStats } from '../worker/stats';
import { getDayNumber } from '../src/lib/daily';
import { flawlessShare } from '../src/lib/stats-api';

const now = new Date(2026, 8, 21, 12);
const today = getDayNumber(now);

describe('parseSubmission', () => {
    it('accepts a valid result for today', () => {
        expect(parseSubmission({ day: today, mistakes: 2 }, now)).toEqual({ day: today, mistakes: 2 });
        expect(parseSubmission({ day: today, mistakes: LOST }, now)).toEqual({ day: today, mistakes: LOST });
    });

    it('tolerates the time-zone difference of one day', () => {
        expect(isPlayableDay(today - 1, now)).toBe(true);
        expect(isPlayableDay(today + 1, now)).toBe(true);
        expect(isPlayableDay(today - 2, now)).toBe(false);
        expect(isPlayableDay(today + 2, now)).toBe(false);
    });

    it.each([
        null,
        'nope',
        {},
        { day: today },
        { day: today, mistakes: -1 },
        { day: today, mistakes: LOST + 1 },
        { day: today, mistakes: 1.5 },
        { day: String(today), mistakes: 1 },
        { day: today + 10, mistakes: 0 },
    ])('rejects %j', body => {
        expect(parseSubmission(body, now)).toBeNull();
    });
});

describe('parseDay', () => {
    it('only accepts small non-negative integers', () => {
        expect(parseDay('240')).toBe(240);
        expect(parseDay(undefined)).toBeNull();
        expect(parseDay('-1')).toBeNull();
        expect(parseDay('1e3')).toBeNull();
        expect(parseDay('123456')).toBeNull();
    });
});

describe('toDailyStats', () => {
    it('aggregates rows into a distribution plus losses', () => {
        const stats = toDailyStats(240, [
            { mistakes: 0, plays: 7 },
            { mistakes: 2, plays: 3 },
            { mistakes: LOST, plays: 2 },
        ]);
        expect(stats).toEqual({ day: 240, players: 12, distribution: [7, 0, 3, 0, 0], lost: 2 });
        expect(flawlessShare(stats)).toBe(58);
    });
});
