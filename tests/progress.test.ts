import { describe, expect, it } from 'vitest';
import type { ChallengeState, ChallengeStatus } from '../src/lib/challenge';
import { computeStats, type History } from '../src/lib/progress';

function day(status: ChallengeStatus, mistakes = 0) {
    const state: ChallengeState = { side: 'w', cursor: 0, results: {}, mistakes, hintLevel: 0, stumbled: false, status };
    return { openingId: 1, state };
}

describe('computeStats', () => {
    it('counts consecutive wins and keeps the streak alive while today is unfinished', () => {
        const history: History = { 1: day('won'), 2: day('won', 2), 3: day('won'), 4: day('playing') };
        const stats = computeStats(history, 4);
        expect(stats).toMatchObject({ played: 3, won: 3, currentStreak: 3, maxStreak: 3 });
        expect(stats.distribution).toEqual([2, 0, 1, 0, 0]);
    });

    it('resets the streak after a loss or a skipped day', () => {
        const history: History = { 1: day('won'), 2: day('won'), 3: day('lost'), 5: day('won'), 7: day('won') };
        expect(computeStats(history, 7)).toMatchObject({ played: 5, won: 4, currentStreak: 1, maxStreak: 2 });
        expect(computeStats(history, 9).currentStreak).toBe(0);
    });
});
