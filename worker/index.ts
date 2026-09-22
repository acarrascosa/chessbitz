import { parseDay, parseSubmission, toDailyStats, type ResultRow } from './stats';
import { injectDailyPreview } from './preview';

export interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    RESULTS_LIMITER?: RateLimit;
}

const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
    });

async function submitResult(request: Request, env: Env): Promise<Response> {
    // The IP is only used as an ephemeral rate-limit key; it is never stored.
    const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.RESULTS_LIMITER && !(await env.RESULTS_LIMITER.limit({ key })).success) {
        return json({ error: 'Too many requests' }, { status: 429 });
    }

    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > 256) return json({ error: 'Payload too large' }, { status: 413 });

    const submission = parseSubmission(await request.json().catch(() => null));
    if (!submission) return json({ error: 'Invalid result' }, { status: 400 });

    const { hints = 0, seconds = 0 } = submission.detail ?? {};
    const detailed = submission.detail ? 1 : 0;
    await env.DB.prepare(
        `INSERT INTO daily_results (day, mistakes, plays, hints, seconds, detailed) VALUES (?1, ?2, 1, ?3, ?4, ?5)
         ON CONFLICT (day, mistakes) DO UPDATE SET
             plays = plays + 1, hints = hints + ?3, seconds = seconds + ?4, detailed = detailed + ?5`,
    ).bind(submission.day, submission.mistakes, hints, seconds, detailed).run();

    return new Response(null, { status: 204 });
}

async function getStats(dayParam: string | undefined, env: Env): Promise<Response> {
    const day = parseDay(dayParam);
    if (day === null) return json({ error: 'Invalid day' }, { status: 400 });

    const { results } = await env.DB.prepare('SELECT mistakes, plays, hints, seconds, detailed FROM daily_results WHERE day = ?1')
        .bind(day)
        .all<ResultRow>();

    return json(toDailyStats(day, results), { headers: { 'Cache-Control': 'public, max-age=60' } });
}

/** All-time totals for the "how to play" page. */
async function getSummary(env: Env): Promise<Response> {
    const row = await env.DB.prepare('SELECT COALESCE(SUM(plays), 0) AS plays, COUNT(DISTINCT day) AS days FROM daily_results')
        .first<{ plays: number; days: number }>();
    return json({ plays: row?.plays ?? 0, days: row?.days ?? 0 }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

export default {
    async fetch(request, env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/api/results') {
            return request.method === 'POST' ? submitResult(request, env) : json({ error: 'Method not allowed' }, { status: 405 });
        }
        if (url.pathname === '/api/summary' && request.method === 'GET') {
            return getSummary(env);
        }
        if (url.pathname.startsWith('/api/stats/') && request.method === 'GET') {
            return getStats(url.pathname.split('/')[3], env);
        }
        if (url.pathname.startsWith('/api/')) {
            return json({ error: 'Not found' }, { status: 404 });
        }

        const response = await env.ASSETS.fetch(request);
        return injectDailyPreview(url, response, env);
    },
} satisfies ExportedHandler<Env>;
