import { describe, expect, it } from 'vitest';
import { DAYS_BETWEEN_ASKS, GAMES_BEFORE_ASKING, VIEWS_BEFORE_ASKING, shouldAsk } from '../src/lib/support';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 1);

describe('shouldAsk', () => {
    it('waits for a few finished games or many page views', () => {
        expect(shouldAsk({ views: 1, games: 0 }, now)).toBe(false);
        expect(shouldAsk({ views: 1, games: GAMES_BEFORE_ASKING }, now)).toBe(true);
        expect(shouldAsk({ views: VIEWS_BEFORE_ASKING, games: 0 }, now)).toBe(true);
    });

    it('asks again only after a few weeks', () => {
        const shownAt = now - (DAYS_BETWEEN_ASKS - 1) * DAY;
        expect(shouldAsk({ views: 50, games: 50, shownAt }, now)).toBe(false);
        expect(shouldAsk({ views: 50, games: 50, shownAt: now - (DAYS_BETWEEN_ASKS + 1) * DAY }, now)).toBe(true);
    });

    it('leaves supporters alone for months', () => {
        expect(shouldAsk({ views: 50, games: 50, supportedAt: now - 30 * DAY }, now)).toBe(false);
    });
});
