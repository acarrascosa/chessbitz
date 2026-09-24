import { MAX_MISTAKES, hintsUsed, isSolved, resultBucket, type ChallengeState } from './challenge';
import type { ExpertState } from './expert';

export interface DayRecord {
    /** Slug of the opening played that day. */
    opening: string;
    state: ChallengeState;
    /** The finished result was already reported to the global stats. */
    submitted?: boolean;
    /** Time spent playing with the page visible. */
    elapsedMs?: number;
}

/** Day number → the player's daily challenge for that day. */
export type History = Record<number, DayRecord>;

/** Past days replayed from the archive; kept apart so they never touch streaks. */
export interface ArchiveRecord {
    opening: string;
    normal?: { state: ChallengeState; elapsedMs?: number };
    expert?: { state: ExpertState; elapsedMs?: number };
}
export type Archive = Record<number, ArchiveRecord>;

/** Lichess puzzle id → the player's attempt. */
export type Tactics = Record<string, { state: ChallengeState }>;

export interface Stats {
    played: number;
    won: number;
    currentStreak: number;
    maxStreak: number;
    /** Wins by number of mistakes (index 0..MAX_MISTAKES-1). */
    distribution: number[];
    /** Lost challenges (all mistakes spent). */
    lost: number;
    /** Average hints per finished challenge, counting only results that recorded hints. */
    averageHints: number | null;
}

/** v2: the calendar restarted at the public launch, so day numbers from v1 no longer match. */
const KEYS = {
    history: 'chessbitz:history:v2',
    archive: 'chessbitz:archive:v2',
    tactics: 'chessbitz:tactics:v2',
} as const;

// Pre-launch progress used the old calendar; drop it once.
try {
    for (const key of ['chessbitz:history:v1', 'chessbitz:archive:v1', 'chessbitz:tactics:v1']) localStorage.removeItem(key);
} catch {
    // No storage (SSR, private mode): nothing to clean.
}

/** Storage can be unavailable (private mode, blocked cookies): progress is best-effort. */
function read<T extends object>(key: string): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : ({} as T);
    } catch {
        return {} as T;
    }
}

function write(key: string, value: object) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Keep playing without persistence.
    }
}

export const loadHistory = () => read<History>(KEYS.history);
export const loadArchive = () => read<Archive>(KEYS.archive);
export const loadTactics = () => read<Tactics>(KEYS.tactics);

export function saveDay(day: number, record: DayRecord): History {
    const history = { ...loadHistory(), [day]: record };
    write(KEYS.history, history);
    return history;
}

export function saveArchiveDay(day: number, record: ArchiveRecord): Archive {
    const archive = { ...loadArchive(), [day]: record };
    write(KEYS.archive, archive);
    return archive;
}

export function saveTactic(id: string, state: ChallengeState): Tactics {
    const tactics = { ...loadTactics(), [id]: { state } };
    write(KEYS.tactics, tactics);
    return tactics;
}

/** Solved with errors to spare: a line finished with the whole allowance spent on hints doesn't count. */
const isWon = (record?: DayRecord) => Boolean(record && isSolved(record.state));

export function computeStats(history: History, today: number): Stats {
    const finished = Object.entries(history)
        .map(([day, record]) => ({ day: Number(day), record }))
        .filter(({ record }) => record.state.status !== 'playing')
        .sort((a, b) => a.day - b.day);

    const distribution = Array.from({ length: MAX_MISTAKES }, () => 0);
    let maxStreak = 0;
    let run = 0;
    let previousDay = -Infinity;
    for (const { day, record } of finished) {
        if (isWon(record)) {
            distribution[resultBucket(record.state)]++;
            run = day === previousDay + 1 ? run + 1 : 1;
            maxStreak = Math.max(maxStreak, run);
        } else {
            run = 0;
        }
        previousDay = day;
    }

    // Today's challenge still in progress doesn't break the streak.
    let currentStreak = 0;
    const todayFinished = history[today] && history[today].state.status !== 'playing';
    for (let day = todayFinished ? today : today - 1; isWon(history[day]); day--) currentStreak++;

    const withHints = finished.filter(({ record }) => record.state.hints !== undefined);
    const won = finished.filter(({ record }) => isWon(record)).length;
    return {
        played: finished.length,
        won,
        currentStreak,
        maxStreak,
        distribution,
        lost: finished.length - won,
        averageHints: withHints.length
            ? withHints.reduce((sum, { record }) => sum + hintsUsed(record.state), 0) / withHints.length
            : null,
    };
}

// --- Moving progress between devices (no accounts: a file or a pasted code) ---

interface ProgressExport {
    app: 'chessbitz';
    version: 1;
    history: History;
    archive: Archive;
    tactics: Tactics;
}

export function exportProgress(): string {
    const data: ProgressExport = { app: 'chessbitz', version: 1, history: loadHistory(), archive: loadArchive(), tactics: loadTactics() };
    return JSON.stringify(data);
}

const STATUSES = new Set(['playing', 'won', 'lost']);
const isState = (value: unknown): value is { status: string } =>
    typeof value === 'object' && value !== null && STATUSES.has((value as { status?: string }).status ?? '');
const isFinished = (state?: { status: string }) => Boolean(state && state.status !== 'playing');

/** Keeps local results that are already finished; otherwise takes the imported one. */
function prefer<T>(local: T | undefined, incoming: T, finished: (value: T) => boolean): T {
    return local !== undefined && finished(local) ? local : incoming;
}

export type ImportResult = { ok: true; days: number } | { ok: false };

/** Merges an export into this device. Finished local results always win. */
export function importProgress(text: string): ImportResult {
    let data: Partial<ProgressExport>;
    try {
        data = JSON.parse(text.trim());
    } catch {
        return { ok: false };
    }
    if (data?.app !== 'chessbitz' || data.version !== 1) return { ok: false };

    const history = loadHistory();
    let days = 0;
    for (const [day, record] of Object.entries(data.history ?? {})) {
        if (typeof record?.opening !== 'string' || !isState(record.state)) continue;
        history[Number(day)] = prefer(history[Number(day)], record, r => isFinished(r.state));
        days++;
    }

    const archive = loadArchive();
    for (const [day, record] of Object.entries(data.archive ?? {})) {
        if (typeof record?.opening !== 'string') continue;
        const local = archive[Number(day)];
        archive[Number(day)] = {
            opening: record.opening,
            normal: record.normal && isState(record.normal.state) ? prefer(local?.normal, record.normal, r => isFinished(r.state)) : local?.normal,
            expert: record.expert && isState(record.expert.state) ? prefer(local?.expert, record.expert, r => isFinished(r.state)) : local?.expert,
        };
    }

    const tactics = loadTactics();
    for (const [id, record] of Object.entries(data.tactics ?? {})) {
        if (!isState(record?.state)) continue;
        tactics[id] = prefer(tactics[id], record, r => isFinished(r.state));
    }

    write(KEYS.history, history);
    write(KEYS.archive, archive);
    write(KEYS.tactics, tactics);
    return { ok: true, days };
}
