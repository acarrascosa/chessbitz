import type { Env } from './env';

/** There is one queue for everyone: a single Durable Object by this name. */
export const MATCHMAKER_NAME = 'global';
/** Set by the Worker's routes (never by clients): who is searching and at what level. */
export const SEARCHER_HEADER = 'X-Chessbitz-Searcher';

/** Points a searcher usually scores (sent by the page), within sane bounds. */
export function searchLevel(value: string | null): number | undefined {
    const level = Number(value);
    return value !== null && value !== '' && Number.isFinite(level) ? Math.min(1000, Math.max(0, Math.round(level))) : undefined;
}

/** The single public queue, if this deployment has it. */
export function matchmaker(env: Env) {
    return env.MATCHMAKER ? env.MATCHMAKER.get(env.MATCHMAKER.idFromName(MATCHMAKER_NAME)) : null;
}

/** Joins the public queue (web or Discord); who is searching travels in a header only the Worker sets. */
export function joinQueue(env: Env, token: string, level: number | undefined): Promise<Response> | Response {
    const queue = matchmaker(env);
    if (!queue) return Response.json({ error: 'Matchmaking is not available' }, { status: 503 });
    return queue.fetch(new Request('https://match/queue', { headers: { Upgrade: 'websocket', [SEARCHER_HEADER]: JSON.stringify({ token, level }) } }));
}

