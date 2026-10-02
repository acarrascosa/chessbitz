import { describe, expect, it } from 'vitest';
import { BATTLE_HOUR_MS, battleHour } from '../src/lib/battle-hour';

describe('battle hour', () => {
    it('is at 21:00 in Madrid, summer time and winter time', () => {
        // 2 Oct 2026 (CEST, UTC+2): 19:00 UTC. 2 Dec 2026 (CET, UTC+1): 20:00 UTC.
        expect(battleHour(Date.UTC(2026, 9, 2, 12)).start).toBe(Date.UTC(2026, 9, 2, 19));
        expect(battleHour(Date.UTC(2026, 11, 2, 12)).start).toBe(Date.UTC(2026, 11, 2, 20));
    });

    it('is live during the hour and points to tomorrow once it is over', () => {
        const start = Date.UTC(2026, 9, 2, 19);
        expect(battleHour(start - 1)).toMatchObject({ start, live: false });
        expect(battleHour(start + 30 * 60_000)).toMatchObject({ start, live: true, end: start + BATTLE_HOUR_MS });
        expect(battleHour(start + BATTLE_HOUR_MS)).toMatchObject({ start: Date.UTC(2026, 9, 3, 19), live: false });
    });

    it('crosses the clock change and midnight in Madrid', () => {
        // Clocks go back on 25 Oct 2026: the 24th is CEST, the 25th CET.
        expect(battleHour(Date.UTC(2026, 9, 24, 21)).start).toBe(Date.UTC(2026, 9, 25, 20));
        // 23:30 in Madrid (21:30 UTC) is already after today's hour.
        expect(battleHour(Date.UTC(2026, 9, 2, 21, 30)).start).toBe(Date.UTC(2026, 9, 3, 19));
        // 00:30 in Madrid on the 3rd (22:30 UTC on the 2nd): that evening's.
        expect(battleHour(Date.UTC(2026, 9, 2, 22, 30)).start).toBe(Date.UTC(2026, 9, 3, 19));
    });
});
