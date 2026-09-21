import { MAX_MISTAKES, resultGrid, type ChallengeState } from './challenge';
import type { Ply } from './line';

export const SITE_URL = 'https://chessbitz.com';

/** Spoiler-free, Wordle-style summary of a finished challenge. */
export function buildShareText(state: ChallengeState, plies: Ply[], streak: number, challengeNumber: number, openingName: string): string {
    const score = state.status === 'won' ? `${state.mistakes}/${MAX_MISTAKES}` : `X/${MAX_MISTAKES}`;
    const fire = streak > 1 ? ` 🔥${streak}` : '';
    return `Chessbitz #${challengeNumber} · ${openingName}\n${resultGrid(state, plies)} ${score}${fire}\n${SITE_URL}`;
}
