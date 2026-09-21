export interface GlobalStats {
    day: number;
    players: number;
    /** Completed lines by number of mistakes. */
    distribution: number[];
    lost: number;
}

/**
 * Global stats are a progressive enhancement served by the Cloudflare Worker:
 * any failure (offline, static hosting, local dev) simply hides them.
 */
export async function submitResult(day: number, mistakes: number): Promise<boolean> {
    try {
        const response = await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day, mistakes }),
            keepalive: true,
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function fetchGlobalStats(day: number): Promise<GlobalStats | null> {
    try {
        const response = await fetch(`/api/stats/${day}`);
        if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return null;
        const stats = (await response.json()) as GlobalStats;
        return stats.players > 0 ? stats : null;
    } catch {
        return null;
    }
}

export function flawlessShare(stats: GlobalStats): number {
    return stats.players ? Math.round(((stats.distribution[0] ?? 0) / stats.players) * 100) : 0;
}
