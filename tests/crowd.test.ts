import { describe, expect, it } from 'vitest';
import { CROWD_FADE, CROWD_MAX, CROWD_MIN, crowdFiller, crowdRows, crowdSize, crowdSoFar, crowdTotals } from '../worker/crowd';
import { LOST, bucketOfHalves, toDailyStats } from '../worker/stats';
import { LAUNCH_DAY_UTC } from '../src/lib/daily';

const DAY = 86_400_000;
const at = (day: number, hours: number) => new Date(LAUNCH_DAY_UTC + day * DAY + hours * 3_600_000);
const days = Array.from({ length: 700 }, (_, i) => i);

describe('crowd', () => {
    it('stays between the bounds, mostly on the low side, busier on weekdays', () => {
        const sizes = days.map(crowdSize);
        expect(Math.min(...sizes)).toBeGreaterThanOrEqual(CROWD_MIN);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(CROWD_MAX);
        const middle = (CROWD_MIN + CROWD_MAX) / 2;
        expect(sizes.filter(n => n < middle).length).toBeGreaterThan(sizes.length * 0.6);
        const average = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
        const weekday = (day: number) => new Date(LAUNCH_DAY_UTC + day * DAY).getUTCDay();
        const weekend = days.filter(d => [0, 6].includes(weekday(d)));
        const week = days.filter(d => ![0, 6].includes(weekday(d)));
        expect(average(week.map(crowdSize))).toBeGreaterThan(average(weekend.map(crowdSize)));
    });

    it('gives the same numbers on every request and only grows during the day', () => {
        expect(crowdRows(10, 0, at(10, 15))).toEqual(crowdRows(10, 0, at(10, 15)));
        let before = 0;
        for (let hour = 0; hour <= 24; hour++) {
            const now = crowdSoFar(10, at(10, hour));
            expect(now).toBeGreaterThanOrEqual(before);
            before = now;
        }
        expect(crowdSoFar(10, at(10, 0))).toBeGreaterThanOrEqual(CROWD_MIN);
        expect(crowdSoFar(10, at(10, 0))).toBeLessThan(CROWD_MIN + 4);
        expect(crowdSoFar(10, at(12, 0))).toBe(crowdSize(10));
    });

    it('has nobody on days that have not started anywhere yet', () => {
        expect(crowdSoFar(11, at(10, 12))).toBeGreaterThanOrEqual(CROWD_MIN); // already tomorrow east of UTC
        expect(crowdSoFar(12, at(10, 12))).toBe(0);
    });

    it('builds valid rows whose histogram only grows', () => {
        const morning = toDailyStats(10, crowdRows(10, 0, at(10, 6)));
        const evening = toDailyStats(10, crowdRows(10, 0, at(10, 22)));
        expect(morning.players).toBe(crowdSoFar(10, at(10, 6)));
        expect(evening.players).toBe(crowdSoFar(10, at(10, 22)));
        morning.distribution.forEach((n, i) => expect(evening.distribution[i]).toBeGreaterThanOrEqual(n));
        expect(evening.lost).toBeGreaterThanOrEqual(morning.lost);
        expect(evening.averageSeconds).toBeGreaterThan(30);
        expect(evening.averageErrors).toBeGreaterThan(0);
        expect(evening.averageErrors).toBeLessThanOrEqual(LOST);
        for (const day of days.slice(0, 60)) {
            for (const row of crowdRows(day, 0, at(day + 2, 0))) {
                // Averaged halves still fall in their bucket.
                expect(bucketOfHalves(Math.round(row.halves! / row.plays))).toBeLessThanOrEqual(row.mistakes);
            }
        }
    });

    it('adds every real player on top: two friends in a row see the count go up by one each', () => {
        const now = at(10, 20);
        const real = (plays: number) => [{ mistakes: 1, plays, hints: 0, seconds: 90, detailed: plays, halves: 2 * plays, exact: plays }];
        const count = (plays: number) => toDailyStats(10, [...real(plays), ...crowdRows(10, 0, now)]).players;
        expect(count(2)).toBe(count(1) + 1);
        expect(count(1)).toBe(crowdSoFar(10, now) + 1);
    });

    it('fades the crowd as real traffic grows, judged two days back', () => {
        const now = at(10, 20);
        expect(crowdFiller(10, 0, now)).toBe(crowdSoFar(10, now));
        expect(crowdFiller(10, CROWD_FADE / 2, now)).toBe(Math.round(crowdSoFar(10, now) / 2));
        expect(crowdFiller(10, CROWD_FADE, now)).toBe(0);
        expect(crowdRows(10, CROWD_FADE * 3, now)).toEqual([]);
    });

    it('adds the crowd to the all-time totals', () => {
        const now = at(3, 12);
        const empty = crowdTotals(new Map(), now);
        expect(empty.days).toBe(5); // days 0..3 plus tomorrow east of UTC
        expect(empty.plays).toBe([0, 1, 2, 3, 4].reduce((sum, d) => sum + crowdSoFar(d, now), 0));
        // Heavy real traffic on day 1 removes the crowd of day 3 (day 1 keeps its own, on top of the real plays).
        const withReal = crowdTotals(new Map([[1, 1000]]), now);
        expect(withReal.days).toBe(3); // 0, 2 and 4; day 1 is counted among the real ones
        expect(withReal.plays).toBe(empty.plays - crowdSoFar(3, now));
    });
});

describe('crowd traffic by the hour in Madrid', () => {
    /** UTC hour in which the most crowd players arrive on `day`. */
    const busiestHour = (day: number) => {
        let best = 0;
        let most = -1;
        for (let hour = 0; hour < 24; hour++) {
            const arrivals = crowdSoFar(day, at(day, hour + 1)) - crowdSoFar(day, at(day, hour));
            if (arrivals > most) [best, most] = [hour, arrivals];
        }
        return best;
    };
    const weekday = (day: number) => new Date(LAUNCH_DAY_UTC + day * DAY).getUTCDay();
    const firstWeekday = (from: number) => {
        let day = from;
        while ([0, 6].includes(weekday(day)) || crowdSize(day) < 40) day++;
        return day;
    };

    it('keeps the morning peak at 9 in Madrid when the clocks change', () => {
        // Day 0 is in September (CEST, UTC+2); day 50 in November (CET, UTC+1).
        expect([7, 13]).toContain(busiestHour(firstWeekday(0)));
        expect([8, 14]).toContain(busiestHour(firstWeekday(50)));
    });

    it('wakes up later at weekends', () => {
        let saturday = 0;
        while (weekday(saturday) !== 6) saturday++;
        const workday = firstWeekday(0);
        const morning = (day: number) => (crowdSoFar(day, at(day, 8)) - crowdSoFar(day, at(day, 0))) / Math.max(1, crowdSize(day) - crowdSoFar(day, at(day, 0)));
        expect(morning(saturday)).toBeLessThan(morning(workday));
    });
});
