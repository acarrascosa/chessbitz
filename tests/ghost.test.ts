import { describe, expect, it } from 'vitest';
import { ghostRuns } from '../worker/ghost';
import type { BattlePlayer, BoardResult, Room } from '../src/lib/battle';

const won = (points: number): BoardResult => ({ outcome: 'won', mistakes: 0, hints: 0, hintHalves: 0, ms: 9_000, points });
const lost: BoardResult = { outcome: 'lost', mistakes: 5, hints: 0, hintHalves: 0, ms: 20_000, points: 0 };

function player(id: string, name: string, results: BoardResult[], left = false): BattlePlayer {
    return { id, token: id, name, ready: true, online: true, left, board: results.length, boardStartedAt: 0, results } as unknown as BattlePlayer;
}

function room(status: Room['status'], players: BattlePlayer[]): Room {
    return { code: 'ABCD', status, hostId: 'a', format: 'normal', players, boards: [{ id: 'p1' }, { id: 'p2' }], startsAt: 0, round: 1, updatedAt: 0 } as unknown as Room;
}

describe('ghostRuns', () => {
    it('records each player who finished, under an invented name', () => {
        const runs = ghostRuns(room('finished', [player('a', 'Álvaro', [won(140), lost]), player('b', 'Bea', [won(120), won(100)])]), 1_000, () => 0.3);
        expect(runs).toHaveLength(2);
        expect(runs[0]).toMatchObject({ format: 'normal', boardIds: '["p1","p2"]', totalPoints: 140, boardsSolved: 1, boardCount: 2, recordedAt: 1_000, source: 'real' });
        expect(runs[1]).toMatchObject({ totalPoints: 220, boardsSolved: 2 });
        for (const run of runs) {
            expect(run.displayName).not.toMatch(/Álvaro|Bea/);
            expect(run.displayName.length).toBeLessThanOrEqual(16);
        }
        expect(JSON.parse(runs[0].results)).toEqual([won(140), lost]);
    });

    it('skips players who never made a move', () => {
        const idle: BoardResult = { outcome: 'timeout', mistakes: 0, hints: 0, hintHalves: 0, ms: 30_000, points: 0 };
        const tried: BoardResult = { ...idle, mistakes: 2 };
        expect(ghostRuns(room('finished', [player('a', 'Ana', [idle, idle]), player('b', 'Bea', [idle, tried])]), 0)).toHaveLength(1);
    });

    it('skips players who left and matches that are not over', () => {
        expect(ghostRuns(room('finished', [player('a', 'Ana', [won(140)], true), player('b', 'Bea', [won(1), won(1)])]), 0)).toHaveLength(1);
        expect(ghostRuns(room('playing', [player('a', 'Ana', [won(140), won(1)])]), 0)).toEqual([]);
    });
});
