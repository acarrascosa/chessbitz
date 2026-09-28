import { describe, expect, it } from 'vitest';
import { HSTS, toHttps, withHsts } from '../worker/security';

describe('https only', () => {
    it('sends plain HTTP to the same URL over HTTPS, keeping the method', () => {
        const response = toHttps(new URL('http://chessbitz.com/en/?ref=x'));
        expect(response?.status).toBe(308);
        expect(response?.headers.get('Location')).toBe('https://chessbitz.com/en/?ref=x');
    });

    it('leaves HTTPS and a local wrangler dev alone', () => {
        expect(toHttps(new URL('https://chessbitz.com/'))).toBeNull();
        expect(toHttps(new URL('http://localhost:8787/'))).toBeNull();
        expect(toHttps(new URL('http://127.0.0.1:8787/api/summary'))).toBeNull();
    });

    it('adds HSTS over HTTPS only, keeping status, headers and body', async () => {
        const page = () => new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300' } });
        const secured = withHsts(page(), new URL('https://chessbitz.com/'));
        expect(secured.headers.get('Strict-Transport-Security')).toBe(HSTS);
        expect(secured.headers.get('Cache-Control')).toBe('public, max-age=300');
        expect(secured.status).toBe(200);
        expect(await secured.text()).toBe('<html>');
        expect(withHsts(page(), new URL('http://localhost:8787/')).headers.has('Strict-Transport-Security')).toBe(false);
    });
});
