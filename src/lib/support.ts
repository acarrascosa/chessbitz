/**
 * When to suggest buying a coffee: never a paywall, only a friendly note for
 * people who clearly enjoy the site (a few finished games or many page
 * views), at most once every few weeks and never again after they support it.
 */
export const GAMES_BEFORE_ASKING = 3;
export const VIEWS_BEFORE_ASKING = 10;
export const DAYS_BETWEEN_ASKS = 21;
const DAYS_AFTER_SUPPORTING = 180;
const MS_PER_DAY = 86_400_000;

export interface SupportState {
    /** Page views and finished games since the note was last shown. */
    views: number;
    games: number;
    shownAt?: number;
    supportedAt?: number;
}

const KEY = 'chessbitz:support:v1';

export function loadSupport(): SupportState {
    try {
        return { views: 0, games: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
        return { views: 0, games: 0 };
    }
}

function save(state: SupportState): SupportState {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Without storage the note simply never shows.
    }
    return state;
}

export const recordView = () => {
    const state = loadSupport();
    return save({ ...state, views: state.views + 1 });
};

export const recordGame = () => {
    const state = loadSupport();
    return save({ ...state, games: state.games + 1 });
};

export function shouldAsk(state: SupportState, now = Date.now()): boolean {
    if (state.supportedAt && now - state.supportedAt < DAYS_AFTER_SUPPORTING * MS_PER_DAY) return false;
    if (state.shownAt && now - state.shownAt < DAYS_BETWEEN_ASKS * MS_PER_DAY) return false;
    return state.games >= GAMES_BEFORE_ASKING || state.views >= VIEWS_BEFORE_ASKING;
}

/** Showing the note starts the counters again. */
export const markShown = (now = Date.now()) => save({ ...loadSupport(), views: 0, games: 0, shownAt: now });
export const markSupported = (now = Date.now()) => save({ ...loadSupport(), supportedAt: now });
