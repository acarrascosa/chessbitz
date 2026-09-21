import { describe, expect, it } from 'vitest';
import openings from '../src/data/openings.json';
import { getDailyOpening, type Opening } from '../src/lib/openings';
import { parseLine } from '../src/lib/line';

const catalog = openings as Opening[];

describe('openings catalog', () => {
    it('only contains legal lines', () => {
        const illegal = catalog.filter(o => {
            try {
                parseLine(o.pgn);
                return false;
            } catch {
                return true;
            }
        });
        expect(illegal.map(o => o.id)).toEqual([]);
    });

    it('serves the same opening all day long', () => {
        const morning = getDailyOpening(new Date(2026, 5, 1, 0, 5)).opening;
        const night = getDailyOpening(new Date(2026, 5, 1, 23, 55)).opening;
        expect(morning.id).toBe(night.id);
    });
});
