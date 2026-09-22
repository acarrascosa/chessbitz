export interface GlobalStats {
    day: number;
    players: number;
    /** Completed lines by number of mistakes. */
    distribution: number[];
    lost: number;
    /** Averages over the players who reported them; null when nobody did yet. */
    averageHints: number | null;
    averageSeconds: number | null;
}

export interface Summary {
    plays: number;
    days: number;
}

export interface ResultReport {
    day: number;
    mistakes: number;
    hints: number;
    seconds: number;
}

/** Mirrors MAX_SECONDS in worker/stats.ts: longer sessions are counted as 30 minutes. */
const MAX_SECONDS = 1800;

/**
 * Global stats are a progressive enhancement served by the Cloudflare Worker:
 * any failure (offline, static hosting, local dev) simply hides them.
 */
export async function submitResult(report: ResultReport): Promise<boolean> {
    try {
        const response = await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...report, seconds: Math.min(MAX_SECONDS, Math.round(report.seconds)) }),
            keepalive: true,
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function getJson<T>(path: string): Promise<T | null> {
    try {
        const response = await fetch(path);
        if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return null;
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

export async function fetchGlobalStats(day: number): Promise<GlobalStats | null> {
    const stats = await getJson<GlobalStats>(`/api/stats/${day}`);
    return stats && stats.players > 0 ? { ...stats, averageHints: stats.averageHints ?? null, averageSeconds: stats.averageSeconds ?? null } : null;
}

export const fetchSummary = () => getJson<Summary>('/api/summary');

export function flawlessShare(stats: GlobalStats): number {
    return stats.players ? Math.round(((stats.distribution[0] ?? 0) / stats.players) * 100) : 0;
}

/** Average mistakes of today's players (a lost line counts as MAX_MISTAKES). */
export function averageMistakes(stats: GlobalStats): number {
    const total = stats.distribution.reduce((sum, count, mistakes) => sum + count * mistakes, 0) + stats.lost * stats.distribution.length;
    return stats.players ? Math.round((total / stats.players) * 10) / 10 : 0;
}
