import { describe, expect, it } from 'vitest';
import { openings, scheduledOpenings } from '../src/lib/catalog';
import { getDailySlot } from '../src/lib/openings';
import { parseLine } from '../src/lib/line';

describe('openings catalog', () => {
    it('schedules every opening exactly once', () => {
        const scheduled = scheduledOpenings.map(o => o.slug);
        expect(new Set(scheduled).size).toBe(scheduled.length);
        expect([...scheduled].sort()).toEqual(openings.map(o => o.slug).sort());
    });

    it('covers at least a full year without repeats', () => {
        expect(scheduledOpenings.length).toBeGreaterThanOrEqual(365);
    });

    it('has unique slugs and lines', () => {
        expect(new Set(openings.map(o => o.slug)).size).toBe(openings.length);
        expect(new Set(openings.map(o => o.pgn)).size).toBe(openings.length);
    });

    it.each(openings.map(o => [o.slug, o] as const))('%s is legal, complete and playable', (_, opening) => {
        const plies = parseLine(opening.pgn);
        expect(plies.some(p => p.color === opening.side)).toBe(true);
        for (const lang of ['es', 'en'] as const) {
            const text = opening[lang];
            expect(text.name.trim()).not.toBe('');
            expect(text.description.trim()).not.toBe('');
            expect(text.idea.trim()).not.toBe('');
            expect(text.moves).toHaveLength(plies.length);
        }
    });
});

describe('getDailySlot', () => {
    it('serves the same slot all day long', () => {
        const morning = getDailySlot(366, new Date(2026, 5, 1, 0, 5));
        const night = getDailySlot(366, new Date(2026, 5, 1, 23, 55));
        expect(morning).toEqual(night);
    });
});
