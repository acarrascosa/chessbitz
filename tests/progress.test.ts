import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeState, ChallengeStatus } from '../src/lib/challenge';
import {
    computeStats, exportProgress, importProgress, loadArchive, loadHistory, loadTactics, saveArchiveDay, saveDay, saveTactic, type History,
} from '../src/lib/progress';

function day(status: ChallengeStatus, mistakes = 0) {
    const state: ChallengeState = { side: 'w', cursor: 0, results: {}, mistakes, hintLevel: 0, stumbled: false, status };
    return { opening: "italian-game", state };
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

describe('averageHints', () => {
    it('ignores results saved before hints were counted', () => {
        const old = day('won');
        const withHints = { opening: 'x', state: { ...day('won').state, hints: 3 } };
        const none = { opening: 'x', state: { ...day('lost').state, hints: 0 } };
        const stats = computeStats({ 1: old, 2: withHints, 3: none }, 3);
        expect(stats.averageHints).toBe(1.5);
        expect(stats.lost).toBe(1);
        expect(computeStats({ 1: old }, 1).averageHints).toBeNull();
    });
});

describe('export and import', () => {
    const storage = new Map<string, string>();
    beforeEach(() => {
        storage.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('round-trips every kind of progress', () => {
        saveDay(1, day('won'));
        saveArchiveDay(0, { opening: 'x', normal: { state: day('lost').state } });
        saveTactic('abc', day('won').state);
        const code = exportProgress();
        storage.clear();
        expect(importProgress(code)).toEqual({ ok: true, days: 1 });
        expect(loadHistory()[1].state.status).toBe('won');
        expect(loadArchive()[0].normal?.state.status).toBe('lost');
        expect(loadTactics().abc.state.status).toBe('won');
    });

    it('never overwrites a finished local result', () => {
        saveDay(1, day('won', 0));
        const code = JSON.stringify({ app: 'chessbitz', version: 1, history: { 1: day('lost'), 2: day('won', 2) }, archive: {}, tactics: {} });
        importProgress(code);
        expect(loadHistory()[1].state.status).toBe('won');
        expect(loadHistory()[2].state.mistakes).toBe(2);
    });

    it('rejects anything that is not a Chessbitz export', () => {
        expect(importProgress('nope')).toEqual({ ok: false });
        expect(importProgress('{"app":"other","version":1}')).toEqual({ ok: false });
        expect(importProgress(JSON.stringify({ app: 'chessbitz', version: 1, history: { 1: { opening: 'x', state: { status: 'hacked' } } } }))).toEqual({ ok: true, days: 0 });
    });
});
