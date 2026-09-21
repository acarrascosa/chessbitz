import { MAX_MISTAKES, type ChallengeState } from './challenge';

export interface DayRecord {
    /** Slug of the opening played that day. */
    opening: string;
    state: ChallengeState;
}

/** Day number → the player's challenge for that day. */
export type History = Record<number, DayRecord>;

export interface Stats {
    played: number;
    won: number;
    currentStreak: number;
    maxStreak: number;
    /** Wins by number of mistakes (index 0..MAX_MISTAKES-1). */
    distribution: number[];
}

const STORAGE_KEY = 'chessbitz:history:v1';

/** Storage can be unavailable (private mode, blocked cookies): progress is best-effort. */
export function loadHistory(): History {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as History) : {};
    } catch {
        return {};
    }
}

export function saveDay(day: number, record: DayRecord): History {
    const history = { ...loadHistory(), [day]: record };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
        // Keep playing without persistence.
    }
    return history;
}

const isWon = (record?: DayRecord) => record?.state.status === 'won';

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
            distribution[record.state.mistakes]++;
            run = day === previousDay + 1 ? run + 1 : 1;
            maxStreak = Math.max(maxStreak, run);
        } else {
            run = 0;
        }
        previousDay = day;
    }

    // Today's challenge still in progress doesn't break the streak.
    let currentStreak = 0;
    for (let day = isWon(history[today]) ? today : today - 1; isWon(history[day]); day--) currentStreak++;

    return {
        played: finished.length,
        won: finished.filter(({ record }) => isWon(record)).length,
        currentStreak,
        maxStreak,
        distribution,
    };
}
