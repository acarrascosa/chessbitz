import { MAX_MISTAKES, errorCount, hintsUsed, isSolved, resultGrid, summaryEmoji, type ChallengeState } from './challenge';
import { EXPERT_ATTEMPTS, expertGrid, type ExpertState } from './expert';
import type { Ply } from './line';

export const SITE_URL = 'https://chessbitz.com';

interface ShareOptions {
    streak?: number;
    /** Label appended to the title for replays, e.g. "archivo". */
    tag?: string;
    /** Use the high-contrast emoji palette. */
    contrast?: boolean;
    /** Locale for half errors ("1,5" in Spanish). */
    lang?: string;
}

const title = (challengeNumber: number, openingName: string, tag?: string) =>
    `Chessbitz #${challengeNumber}${tag ? ` (${tag})` : ''} · ${openingName}`;

/** Spoiler-free, Wordle-style summary of a finished challenge. */
export function buildShareText(state: ChallengeState, plies: Ply[], challengeNumber: number, openingName: string, { streak = 0, tag, contrast = false, lang = 'es' }: ShareOptions = {}): string {
    // Errors include hints (half an error each move helped); a lost line is X.
    const score = state.status === 'lost' ? `X/${MAX_MISTAKES}` : `${errorCount(state).toLocaleString(lang)}/${MAX_MISTAKES}`;
    const hints = hintsUsed(state) ? ` 💡${hintsUsed(state)}` : '';
    const fire = streak > 1 ? ` 🔥${streak}` : '';
    return `${title(challengeNumber, openingName, tag)}\n${resultGrid(state, plies, contrast)} ${score}${hints}${fire}\n${SITE_URL}`;
}

/** The day's tactics in one row: a square per puzzle and how many were solved. */
export function buildTacticsShareText(states: ChallengeState[], challengeNumber: number, openingName: string, label: string, { tag, contrast = false }: ShareOptions = {}): string {
    const solved = states.filter(isSolved).length;
    return `${title(challengeNumber, openingName, tag)} · ${label}\n${states.map(s => summaryEmoji(s, contrast)).join('')} ${solved}/${states.length}\n${SITE_URL}`;
}

/** Expert mode shares every attempt row, like Wordle. */
export function buildExpertShareText(state: ExpertState, challengeNumber: number, openingName: string, tag: string, contrast = false): string {
    const score = state.status === 'won' ? `${state.attempts.length}/${EXPERT_ATTEMPTS}` : `X/${EXPERT_ATTEMPTS}`;
    return `${title(challengeNumber, openingName, tag)} · ${score}\n${expertGrid(state, contrast)}\n${SITE_URL}`;
}
