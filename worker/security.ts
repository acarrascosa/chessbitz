/*
 * HTTPS only. The Worker sees plain-HTTP requests for the paths it runs first on
 * (the home pages and /api/*); everything else is served straight from the asset
 * store with the headers in public/_headers. Redirecting every path, and www,
 * over HTTP needs Cloudflare's "Always Use HTTPS" (see DEPLOY.md).
 */

/** One year; no includeSubDomains, since other subdomains aren't ours to promise. */
export const HSTS = 'max-age=31536000';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Plain HTTP goes to the same URL over HTTPS (308 keeps the method), except on a local `wrangler dev`. */
export function toHttps(url: URL): Response | null {
    if (url.protocol !== 'http:' || LOCAL_HOSTS.has(url.hostname)) return null;
    const target = new URL(url);
    target.protocol = 'https:';
    return Response.redirect(target.toString(), 308);
}

/** Tells browsers to skip plain HTTP next time (only meaningful, and only sent, over HTTPS). */
export function withHsts(response: Response, url: URL): Response {
    if (url.protocol !== 'https:' || response.status === 101 || response.headers.has('Strict-Transport-Security')) return response;
    const secured = new Response(response.body, response);
    secured.headers.set('Strict-Transport-Security', HSTS);
    return secured;
}
