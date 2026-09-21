import schedule from '../src/data/schedule.json';
import { getDayNumber, getRotationIndex } from '../src/lib/daily';

type Lang = 'es' | 'en';

const HOME_PATHS: Record<string, Lang> = { '/': 'es', '/en/': 'en', '/en': 'en' };

interface DailyOpening {
    eco: string;
    es: { name: string; description: string };
    en: { name: string; description: string };
}

class SetContent {
    constructor(private readonly value: string) {}

    element(element: Element) {
        element.setAttribute('content', this.value);
    }
}

/**
 * Link previews (WhatsApp, X, Slack…) can't run JavaScript, so the home page
 * HTML is rewritten at the edge to announce today's opening (UTC day) with its
 * pre-rendered Open Graph image.
 */
export async function injectDailyPreview(url: URL, response: Response, env: { ASSETS: Fetcher }): Promise<Response> {
    const lang = HOME_PATHS[url.pathname];
    if (!lang || !response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return response;

    const day = getDayNumber(new Date());
    const index = getRotationIndex(day, schedule.length);
    const data = await env.ASSETS.fetch(new URL(`/data/daily/${index}.json`, url.origin));
    if (!data.ok) return response;

    const opening = (await data.json()) as DailyOpening;
    const text = opening[lang];
    const title = `${text.name} · Chessbitz #${day + 1}`;
    const image = new URL(`/og/${index}-${lang}.png`, url.origin).toString();

    const rewritten = new HTMLRewriter()
        .on('meta[property="og:title"]', new SetContent(title))
        .on('meta[property="og:description"]', new SetContent(text.description))
        .on('meta[property="og:image"]', new SetContent(image))
        .transform(response);

    const headers = new Headers(rewritten.headers);
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(rewritten.body, { status: rewritten.status, headers });
}
